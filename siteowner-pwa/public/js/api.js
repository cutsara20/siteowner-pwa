// Lapisan data: semua baca/tulis lewat API server. Sinkronisasi antar perangkat lewat SSE (/api/events).
let DAYDOCS = [], OPDOCS = [], SEALDOCS = [], CORRDOCS = [], APPRDOCS = [], FINDOCS = [];
const nowIso = () => new Date().toISOString();
const clean = o => JSON.parse(JSON.stringify(o));

function toast(t) {
    const e = $("#toast");
    e.textContent = t;
    e.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => e.hidden = true, 6000);
}

// Unduh berkas dari teks/byte yang dibuat di browser (CSV, PDF, cadangan)
function download(name, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime || "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function http(method, url, body, rawBlob) {
    const h = { "X-SiteOwner": "1" };
    let b;
    if (rawBlob) { b = rawBlob; h["Content-Type"] = "image/jpeg"; }
    else if (body !== undefined) { b = JSON.stringify(body); h["Content-Type"] = "application/json"; }
    let r;
    try { r = await fetch(url, { method, headers: h, body: b, credentials: "same-origin" }); }
    catch (e) { throw new Error("Tidak dapat terhubung ke server. Periksa sambungan internet."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
        const e = new Error(j.error || "Kesalahan server (" + r.status + ")");
        e.status = r.status;
        if (r.status === 401 && role) sessionEnded();
        throw e;
    }
    return j;
}

function sessionEnded() {
    stopWatch();
    resetState();
    gate();
    toast("Sesi berakhir. Silakan masuk lagi.");
}

function resetState() {
    S.days = []; S.raw = []; S.meta = []; S.op = []; S.corr = []; S.apprLog = []; S.appr = {}; S.fin = []; S.finLog = []; S.fcfg = { nilai: 0, rab: [] };
    S.matm = []; S.mat = []; S.tasks = []; S.tprog = []; S.seals = []; S.planHist = []; S.anggaran = 0;
    S.W = DW.map(w => w.slice()); S.cfg = {}; S.log = []; S.shape = "s"; S.plan = []; S.nama = "Proyek"; S.dur = 20; S.awal = 65;
    DAYDOCS = []; OPDOCS = []; SEALDOCS = []; CORRDOCS = []; APPRDOCS = []; FINDOCS = [];
    lc();
}

function applyState(st) {
    const p = st.proj;
    if (p) {
        S.nama = p.nama || S.nama; S.dur = p.dur || S.dur; S.awal = p.awal ?? S.awal;
        S.W = p.W || S.W; S.cfg = p.cfg || {}; S.log = p.log || []; S.shape = p.shape || "linear"; S.plan = p.plan || [];
        S.anggaran = p.anggaran || 0; S.planHist = p.planHist || [];
        lc();
    }
    DAYDOCS = st.days;
    S.raw = DAYDOCS.map(d => d.rows);
    S.meta = DAYDOCS.map(d => ({ ts: new Date(d.ts).toLocaleString("id-ID"), by: d.by, photos: d.photos || [], iso: d.ts, tgl: d.tgl }));
    SEALDOCS = S.seals = st.seal;
    CORRDOCS = S.corr = st.corr;
    APPRDOCS = S.apprLog = st.appr;
    FINDOCS = S.finLog = st.fin;
    S.mat = st.mat; S.tprog = st.tprog; S.matm = st.matm; S.tasks = st.tasks;
    if (st.fcfg) { S.fcfg = st.fcfg; S.fcfg.rab = S.fcfg.rab || []; }
    OPDOCS = st.op;
    S.op = OPDOCS.map(o => ({ d: o.d, v: o.v, by: o.by, items: o.items || [], tgl: o.tgl, ts: o.ts }));
    rebuildAppr(); rebuildFin(); applyCorr();
}

async function loadState() { applyState(await http("GET", "/api/state")); }

// ---------- Sinkronisasi waktu nyata ----------
let ES = null, esOpen = 0, syncT = 0;
function watch() {
    stopWatch();
    ES = new EventSource("/api/events");
    ES.onmessage = () => { clearTimeout(syncT); syncT = setTimeout(syncNow, 120); };
    ES.onopen = () => { if (esOpen++) syncNow(); }; // tersambung kembali: ambil data yang terlewat
}
function stopWatch() { if (ES) ES.close(); ES = null; esOpen = 0; clearTimeout(syncT); }
async function syncNow() {
    if (!role) return;
    try { await loadState(); refresh(); } catch (e) { /* 401 ditangani http(); gangguan jaringan: coba lagi pada pesan berikut */ }
}

// ---------- Foto bukti ----------
async function shrink(file) {
    // perkecil foto (maks 1280 px, JPEG) agar upload cepat dan hemat
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.75));
}

// ---------- Penulisan data (validasi akhir dan pemberian sidik digital dilakukan server) ----------
async function apiCommitDay(rows, by, tgl, files) {
    const photos = [];
    for (const f of files.slice(0, 3)) photos.push((await http("POST", "/api/photos", undefined, await shrink(f))).id);
    await http("POST", "/api/days", { rows, by, tgl, photos });
    await loadState();
}
async function apiCommitCorr(n, rows, by, alasan) { await http("POST", "/api/corr", { n, rows, by, alasan }); await loadState(); }
async function apiCommitAppr(n, status, note) { await http("POST", "/api/appr", { n, status, note }); await loadState(); }
async function apiCommitOp(v, by, items, tgl) { await http("POST", "/api/op", { v, by, items, tgl }); await loadState(); }
async function commitSeal(by) { await http("POST", "/api/seal", { by }); await loadState(); }

// Biaya: entri berversi (tambah, ubah, batalkan) agar riwayat perubahan tidak hilang
async function apiAddFin(e) { await http("POST", "/api/fin", clean(e)); await loadState(); }
async function apiEditFin(id, patch) { await http("POST", "/api/fin/" + id, clean(patch)); await loadState(); }
async function apiAddMat(e) { await http("POST", "/api/mat", clean(e)); await loadState(); }
async function apiAddProg(e) { await http("POST", "/api/tprog", clean(e)); await loadState(); }

// Pengaturan Owner: bila ditolak server, kembalikan tampilan ke data server lalu teruskan galatnya
async function guarded(fn) { try { await fn(); } catch (e) { await loadState().catch(() => {}); throw e; } }
const apiSaveFcfg = () => guarded(() => http("PUT", "/api/fcfg", clean(S.fcfg)));
const apiSaveMatm = () => guarded(() => http("PUT", "/api/matm", { list: clean(S.matm) }));
const apiSaveTasks = () => guarded(() => http("PUT", "/api/tasks", { list: clean(S.tasks) }));

let saveQ = Promise.resolve();
function saveProj() {
    saveQ = saveQ.catch(() => {}).then(() => http("PUT", "/api/proj", clean({ nama: S.nama, dur: S.dur, awal: S.awal, W: S.W, cfg: S.cfg, log: S.log, shape: S.shape, plan: S.plan, anggaran: S.anggaran, planHist: S.planHist })));
    return saveQ;
}
function save() {
    if (role == "owner") saveProj().catch(e => { toast("Gagal menyimpan pengaturan: " + e.message); loadState().then(refresh).catch(() => {}); });
}

async function verifyNow() {
    if (role != "owner" || !$("#ig")) return;
    let r = await verifyChain(DAYDOCS, OPDOCS.concat(SEALDOCS));
    if (r.ok) { const rc = await verifyCorr(CORRDOCS); if (!rc.ok) r = { ok: false, why: rc.why }; }
    const el = $("#ig");
    if (!el) return;
    el.innerHTML = "<h2>Integritas Data</h2>" + (r.ok
        ? `<div class="al ok">Aman: ${r.n} hari data konsisten${r.sealed ? ", " + r.sealed + " segel cocok" : ""}.</div>`
        : `<div class="al bad">Terdeteksi perubahan data: ${esc(r.why)}. Periksa riwayat dan minta penjelasan pengisi.</div>`)
        + `<div class="sub">Setiap hari diberi sidik digital (SHA-256) yang tersambung ke hari sebelumnya. Opname menyegel sidik terakhir, sehingga perubahan diam-diam pada hari yang sudah disegel akan terlihat.</div>`;
}
