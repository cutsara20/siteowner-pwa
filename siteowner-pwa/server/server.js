"use strict";
// SiteOwner server: berkas statis PWA + API JSON + SSE sinkronisasi. Tanpa dependensi luar (Node 22+).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const store = require("./db");
const auth = require("./auth");
const V = require("./validate");
const Integrity = require("../public/js/integrity.js");

const PUBLIC = path.join(__dirname, "..", "public");
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");
const now = () => new Date().toISOString();

class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra || {}; } }
const bad = (m, extra) => new HttpError(400, m, extra);

// ---------- SSE ----------
const clients = new Set();
const broadcast = () => { for (const res of clients) res.write("data: change\n\n"); };
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 25000).unref();

// ---------- State per peran ----------
function stateFor(role) {
    const st = {
        role,
        proj: store.getDoc("proj"),
        days: store.list("days"), op: store.list("op"), seal: store.list("seal"), corr: store.list("corr"),
        appr: store.list("appr"), fin: store.list("fin"), mat: store.list("mat"), tprog: store.list("tprog"),
        matm: (store.getDoc("matm") || { list: [] }).list, tasks: (store.getDoc("tasks") || { list: [] }).list,
    };
    if (role === "owner") st.fcfg = store.getDoc("fcfg") || { nilai: 0, rab: [] };
    return st;
}

// ---------- Aturan tulis ----------
const proj = () => { const p = store.getDoc("proj"); if (!p) throw bad("Pengaturan proyek belum ada."); return p; };
const opi = p => Math.max(1, Math.round((p.cfg || {}).opi ?? 5));
const nextK = (coll, field = "k") => { const l = store.list(coll); return l.length ? Math.max(...l.map(x => x[field] || 0)) + 1 : 1; };

function stockOf(mid) {
    let s = 0;
    for (const e of store.list("mat")) if (e.mid === mid) s += e.jenis === "masuk" ? e.qty : -e.qty;
    return s;
}

const routes = {
    // ----- tanpa login -----
    "GET /api/status": (req, res, ctx) => ({ setup: auth.isSetup() }),

    "POST /api/setup": (req, res, ctx) => {
        if (auth.isSetup()) throw new HttpError(403, "Aplikasi sudah diatur.");
        const { code, ownerPin, supPin } = ctx.body;
        if (String(code || "") !== auth.setupCode()) throw new HttpError(403, "Kode setup salah. Lihat kode di konsol server.");
        if (!auth.pinValid(ownerPin) || !auth.pinValid(supPin)) throw bad("Kedua PIN harus 4 sampai 8 angka.");
        if (ownerPin === supPin) throw bad("PIN Owner dan PIN Supervisor harus berbeda.");
        store.tx(() => {
            auth.setPin("owner", ownerPin); auth.setPin("sup", supPin);
            if (!store.getDoc("proj")) store.setDoc("proj", V.defaultProj());
            auth.consumeSetupCode();
        });
        const sid = auth.createSession("owner");
        ctx.setCookie(sid);
        return { role: "owner" };
    },

    "POST /api/login": (req, res, ctx) => {
        const { role, pin } = ctx.body;
        if (role !== "owner" && role !== "sup") throw bad("Peran tidak dikenal.");
        if (!auth.isSetup()) throw new HttpError(409, "PIN belum dibuat.", { setup: false });
        const key = ctx.ip + "|" + role, wait = auth.lockLeft(key);
        if (wait) throw new HttpError(429, "Terlalu banyak percobaan salah. Coba lagi dalam " + wait + " detik.", { wait });
        if (!auth.pinValid(pin)) throw bad("PIN harus 4 sampai 8 angka.");
        if (!auth.checkPin(role, pin)) {
            const left = auth.noteFail(key), w = auth.lockLeft(key);
            if (w) throw new HttpError(429, "PIN salah 5 kali. Dikunci 30 detik.", { wait: w });
            throw new HttpError(401, "PIN salah. Sisa percobaan: " + left + ".", { left });
        }
        auth.clearFail(key);
        ctx.setCookie(auth.createSession(role));
        return { role };
    },

    // ----- butuh login -----
    "GET /api/me": (req, res, ctx) => ({ role: ctx.sess.role }),
    "POST /api/logout": (req, res, ctx) => { auth.destroySession(req); ctx.clearCookie(); return { ok: true }; },
    "GET /api/state": (req, res, ctx) => stateFor(ctx.sess.role),

    "GET /api/events": (req, res, ctx) => {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
        res.write("retry: 3000\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return null; // respons sudah dikirim
    },

    "GET /api/photo/:id": (req, res, ctx) => {
        const id = ctx.params.id;
        if (!/^[0-9a-f]{32}$/.test(id)) throw new HttpError(404, "Tidak ditemukan.");
        const r = store.db.prepare("SELECT mime,data FROM photos WHERE id=?").get(id);
        if (!r) throw new HttpError(404, "Tidak ditemukan.");
        res.writeHead(200, { "Content-Type": r.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
        res.end(Buffer.from(r.data));
        return null;
    },

    // Unggah foto bukti (JPEG, sudah diperkecil di browser). Hanya Supervisor.
    "POST /api/photos": (req, res, ctx) => {
        need(ctx, "sup");
        const b = ctx.raw;
        if (!b || !b.length) throw bad("Berkas kosong.");
        if (b.length > 4 * 1024 * 1024) throw new HttpError(413, "Foto terlalu besar (maks 4 MB).");
        if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) throw bad("Hanya foto JPEG.");
        const id = crypto.randomBytes(16).toString("hex");
        store.db.prepare("INSERT INTO photos(id,mime,data,created) VALUES(?,?,?,?)").run(id, "image/jpeg", b, now());
        return { id };
    },

    // ----- Owner: pengaturan -----
    "PUT /api/proj": (req, res, ctx) => {
        need(ctx, "owner");
        const cur = store.getDoc("proj") || V.defaultProj();
        const p = V.proj(ctx.body, cur, store.count("days") > 0);
        store.setDoc("proj", p);
        return { ok: true };
    },
    "PUT /api/fcfg": (req, res, ctx) => { need(ctx, "owner"); store.setDoc("fcfg", V.fcfg(ctx.body)); return { ok: true }; },
    "PUT /api/matm": (req, res, ctx) => {
        need(ctx, "owner");
        const list = V.matm(ctx.body.list);
        const used = new Set(store.list("mat").map(e => e.mid));
        const cur = (store.getDoc("matm") || { list: [] }).list;
        const gone = cur.find(o => !list.some(r => r.id === o.id) && used.has(o.id));
        if (gone) throw bad('Material "' + gone.nm + '" sudah punya catatan keluar masuk dan tidak dapat dihapus.');
        store.setDoc("matm", { list });
        return { ok: true };
    },
    "PUT /api/tasks": (req, res, ctx) => {
        need(ctx, "owner");
        const list = V.tasks(ctx.body.list);
        const used = new Set(store.list("tprog").map(e => e.tid));
        const cur = (store.getDoc("tasks") || { list: [] }).list;
        const gone = cur.find(o => !list.some(r => r.id === o.id) && used.has(o.id));
        if (gone) throw bad('Pekerjaan "' + gone.nm + '" sudah punya catatan progres dan tidak dapat dihapus.');
        store.setDoc("tasks", { list });
        return { ok: true };
    },

    // ----- Supervisor: laporan harian dan koreksi -----
    "POST /api/days": (req, res, ctx) => store.tx(() => {
        need(ctx, "sup");
        const p = proj(), days = store.list("days"), ops = store.list("op"), n = days.length + 1;
        const b = ctx.body, by = V.name(b.by, true);
        if (n - (ops.length ? ops[ops.length - 1].d : 0) >= opi(p))
            throw bad("Opname lapangan belum dilakukan (wajib tiap " + opi(p) + " hari kerja). Minta owner atau QC mengisi opname dulu.");
        const tgl = V.date(b.tgl, "tanggal kerja");
        const prevTgl = [...days].reverse().map(d => d.tgl).find(Boolean) || "";
        if (prevTgl && tgl <= prevTgl) throw bad("Tanggal harus setelah laporan sebelumnya (" + prevTgl + ").");
        const rows = V.rows(b.rows, p);
        const photos = Array.isArray(b.photos) ? b.photos : [];
        if (photos.length > 3) throw bad("Maksimal 3 foto.");
        for (const id of photos) if (!/^[0-9a-f]{32}$/.test(id) || !store.db.prepare("SELECT 1 FROM photos WHERE id=?").get(id)) throw bad("Foto tidak dikenal.");
        const day = { n, rows, by, ts: now(), uid: "sup", photos, tgl };
        day.h = sha256(Integrity.dayInput(days.length ? days[days.length - 1].h : "0", day));
        store.add("days", n, day);
        return { n };
    }),

    "POST /api/corr": (req, res, ctx) => store.tx(() => {
        need(ctx, "sup");
        const p = proj(), days = store.list("days"), b = ctx.body, n = +b.n;
        if (!Number.isInteger(n) || n < 1 || n > days.length) throw bad("Hari ke-" + b.n + " tidak ditemukan.");
        const by = V.name(b.by, true), alasan = String(b.alasan || "").trim().slice(0, 200);
        if (alasan.length < 5) throw bad("Isi alasan koreksi (minimal 5 huruf).");
        const status = latestStatus(n);
        if (status !== "revisi" && status !== "ditolak") throw bad("Hanya laporan yang diminta revisi atau ditolak yang dapat dikoreksi.");
        const corrs = store.list("corr"), g = corrs.length + 1, k = corrs.filter(c => c.n === n).length + 1;
        const c = { g, n, k, rows: V.rows(b.rows, p), by, alasan, ts: now(), uid: "sup" };
        c.h = sha256(Integrity.corrInput(corrs.length ? corrs[corrs.length - 1].h : "0", c));
        store.add("corr", g, c);
        return { g };
    }),

    // ----- Owner: persetujuan, opname, segel -----
    "POST /api/appr": (req, res, ctx) => store.tx(() => {
        need(ctx, "owner");
        const n = +ctx.body.n, status = ctx.body.status, note = String(ctx.body.note || "").trim().slice(0, 120);
        if (!Number.isInteger(n) || n < 1 || n > store.count("days")) throw bad("Hari ke-" + ctx.body.n + " tidak ditemukan.");
        if (!["disetujui", "revisi", "ditolak"].includes(status)) throw bad("Status tidak valid.");
        if (status !== "disetujui" && note.length < 3) throw bad("Isi catatan (minimal 3 huruf) untuk meminta revisi atau menolak.");
        const k = store.count("appr") + 1;
        store.add("appr", k, { k, n, status, note, ts: now(), by: "Owner", uid: "owner" });
        return { k };
    }),

    "POST /api/op": (req, res, ctx) => store.tx(() => {
        need(ctx, "owner");
        const days = store.list("days"), ops = store.list("op"), b = ctx.body;
        const v = +b.v;
        if (!(v >= 0 && v <= 100)) throw bad("Progres harus 0 sampai 100.");
        const by = V.name(b.by, true), tgl = V.date(b.tgl, "tanggal opname"), items = V.opItems(b.items);
        if (items.length) {
            const r = V.opnameFromItems(items);
            if (!r.ok) throw bad(r.err);
            if (Math.abs(r.pct - v) > 0.5) throw bad("Progres tidak cocok dengan item (hitungan item: " + r.pct + "%).");
        }
        const d = days.length, k = ops.length + 1;
        store.add("op", k, { k, d, v, by, items, tgl, ts: now(), hd: d ? days[d - 1].h : "0" });
        return { k };
    }),

    "POST /api/seal": (req, res, ctx) => store.tx(() => {
        need(ctx, "owner");
        const days = store.list("days");
        if (!days.length) throw bad("Belum ada data untuk disegel.");
        const by = V.name(ctx.body.by, true), k = store.count("seal") + 1;
        store.add("seal", k, { k, d: days.length, hd: days[days.length - 1].h, by, ts: now() });
        return { k };
    }),

    // ----- Biaya (Owner dan Supervisor) -----
    "POST /api/fin": (req, res, ctx) => store.tx(() => {
        const role = ctx.sess.role, b = ctx.body, e = V.finEntry(b, role);
        const l = store.list("fin"), k = l.length + 1, id = Math.max(0, ...l.map(x => x.id || 0)) + 1;
        const by = role === "owner" ? "Owner" : V.name(b.by, true);
        store.add("fin", k, { k, id, v: 1, ...e, by, role, verif: role === "owner", ts: now(), uid: role });
        return { id };
    }),
    "POST /api/fin/:id": (req, res, ctx) => store.tx(() => {
        need(ctx, "owner");
        const id = +ctx.params.id, l = store.list("fin"), cur = l.filter(x => x.id === id).sort((a, b) => b.v - a.v)[0];
        if (!cur) throw bad("Catatan biaya tidak ditemukan.");
        const patch = V.finPatch(ctx.body);
        const k = l.length + 1;
        store.add("fin", k, { ...cur, ...patch, k, id, v: cur.v + 1, ts: now(), uid: "owner" });
        return { id };
    }),

    // ----- Material dan progres pekerjaan (Owner dan Supervisor) -----
    "POST /api/mat": (req, res, ctx) => store.tx(() => {
        const role = ctx.sess.role, b = ctx.body;
        const matm = (store.getDoc("matm") || { list: [] }).list;
        const e = V.matEntry(b, matm);
        if (e.jenis === "keluar" && e.qty > stockOf(e.mid)) throw bad("Stok tidak cukup. Catat material masuk dulu atau periksa jumlahnya.");
        const by = role === "owner" ? "Owner" : V.name(b.by, true), k = nextK("mat");
        store.add("mat", k, { k, ...e, by, ts: now(), uid: role });
        return { k };
    }),
    "POST /api/tprog": (req, res, ctx) => store.tx(() => {
        const role = ctx.sess.role, b = ctx.body;
        const tasks = (store.getDoc("tasks") || { list: [] }).list;
        const prevs = store.list("tprog").filter(p => p.tid === +b.tid);
        const e = V.progEntry(b, tasks, prevs.length ? prevs[prevs.length - 1] : null);
        const by = role === "owner" ? "Owner" : V.name(b.by, true), k = nextK("tprog");
        store.add("tprog", k, { k, ...e, by, ts: now(), uid: role });
        return { k };
    }),

    // ----- Owner: PIN -----
    "PUT /api/pin": (req, res, ctx) => {
        need(ctx, "owner");
        const { role, old, pin } = ctx.body;
        if (role !== "owner" && role !== "sup") throw bad("Peran tidak dikenal.");
        if (!auth.pinValid(pin)) throw bad("PIN baru harus 4 sampai 8 angka.");
        if (role === "owner") {
            if (!auth.checkPin("owner", old)) throw bad("PIN Owner lama salah.");
            if (auth.checkPin("sup", pin)) throw bad("PIN Owner tidak boleh sama dengan PIN Supervisor.");
        } else if (auth.checkPin("owner", pin)) throw bad("PIN Supervisor tidak boleh sama dengan PIN Owner.");
        auth.setPin(role, pin);
        return { ok: true };
    },
};

function latestStatus(n) {
    const a = store.list("appr").filter(x => x.n === n).sort((x, y) => (x.ts < y.ts ? 1 : -1))[0];
    const c = store.list("corr").filter(x => x.n === n).sort((x, y) => (x.ts < y.ts ? 1 : -1))[0];
    if (c && (!a || c.ts > a.ts)) return "dikirim_ulang";
    return a ? a.status : "dikirim";
}
function need(ctx, role) { if (ctx.sess.role !== role) throw new HttpError(403, "Peran " + (ctx.sess.role === "owner" ? "Owner" : "Supervisor") + " tidak berhak melakukan ini."); }

// ---------- Router ----------
const compiled = Object.keys(routes).map(key => {
    const [method, pattern] = key.split(" ");
    const names = [];
    const re = new RegExp("^" + pattern.replace(/:([a-z]+)/g, (_, n) => { names.push(n); return "([^/]+)"; }) + "$");
    return { method, re, names, fn: routes[key], pub: key === "GET /api/status" || key === "POST /api/setup" || key === "POST /api/login" };
});

function readBody(req, limit) {
    return new Promise((resolve, reject) => {
        const parts = []; let size = 0;
        req.on("data", c => { size += c.length; if (size > limit) { reject(new HttpError(413, "Data terlalu besar.")); req.destroy(); } else parts.push(c); });
        req.on("end", () => resolve(Buffer.concat(parts)));
        req.on("error", reject);
    });
}

const SEC = {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
};
const sendJson = (res, status, obj, extra) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...(extra || {}) }); res.end(JSON.stringify(obj)); };

async function handleApi(req, res, url) {
    const m = routes && compiled.find(r => r.method === req.method && r.re.test(url.pathname));
    if (!m) return sendJson(res, 404, { error: "Tidak ditemukan." });
    const params = {}; const mm = url.pathname.match(m.re); m.names.forEach((n, i) => params[n] = decodeURIComponent(mm[i + 1]));
    const secure = process.env.COOKIE_SECURE === "1" || req.headers["x-forwarded-proto"] === "https";
    let cookie = null;
    const ctx = {
        params, ip: req.socket.remoteAddress || "?", sess: null, body: {}, raw: null,
        setCookie: sid => { cookie = "so_sid=" + sid + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200" + (secure ? "; Secure" : ""); },
        clearCookie: () => { cookie = "so_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + (secure ? "; Secure" : ""); },
    };
    try {
        if (req.method !== "GET" && req.headers["x-siteowner"] !== "1") throw new HttpError(403, "Permintaan ditolak.");
        if (!m.pub) { ctx.sess = auth.sessionOf(req); if (!ctx.sess) throw new HttpError(401, "Sesi berakhir. Silakan masuk lagi."); }
        if (req.method !== "GET") {
            const isPhoto = url.pathname === "/api/photos";
            const buf = await readBody(req, isPhoto ? 4.5 * 1024 * 1024 : 1024 * 1024);
            if (isPhoto) ctx.raw = buf;
            else if (buf.length) { try { ctx.body = JSON.parse(buf.toString("utf8")); } catch { throw bad("JSON tidak valid."); } }
            if (!ctx.body || typeof ctx.body !== "object" || Array.isArray(ctx.body)) ctx.body = {};
        }
        const out = m.fn(req, res, ctx);
        if (out === null) return; // SSE atau foto: sudah dijawab
        const write = req.method !== "GET" && !(url.pathname === "/api/login" || url.pathname === "/api/setup" || url.pathname === "/api/logout");
        sendJson(res, 200, out, cookie ? { "Set-Cookie": cookie } : undefined);
        if (write) broadcast();
    } catch (e) {
        if (e && e.status && e.status < 500) return sendJson(res, e.status, { error: e.message, ...(e.extra || {}) });
        console.error(e);
        sendJson(res, 500, { error: "Kesalahan server." });
    }
}

// ---------- Berkas statis ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, SEC); return res.end("Tidak ditemukan"); }
    const ext = path.extname(file);
    const noCache = rel === "/sw.js" || rel === "/index.html" || rel === "/manifest.webmanifest";
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": noCache ? "no-cache" : "public, max-age=3600", ...SEC });
    fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) return void handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, SEC); return res.end(); }
    serveStatic(req, res, url);
});

if (require.main === module) {
    server.listen(PORT, HOST, () => {
        console.log("SiteOwner berjalan di http://" + (HOST === "0.0.0.0" ? "localhost" : HOST) + ":" + PORT + "  (data: " + store.DATA_DIR + ")");
        if (!auth.isSetup()) auth.setupCode();
    });
}
module.exports = { server };
