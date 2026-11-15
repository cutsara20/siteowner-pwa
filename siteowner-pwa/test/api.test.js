// Tes API: node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "so-test-"));
const { server } = require("../server/server");
const auth = require("../server/auth");
const Integrity = require("../public/js/integrity.js");
const crypto = require("node:crypto");

let base, owner = "", sup = "";
test.before(async () => { await new Promise(r => server.listen(0, "127.0.0.1", r)); base = "http://127.0.0.1:" + server.address().port; });
test.after(() => server.close());

async function call(method, url, body, cookie, raw) {
    const h = { "X-SiteOwner": "1" };
    if (cookie) h.Cookie = cookie;
    if (body && !raw) h["Content-Type"] = "application/json";
    const r = await fetch(base + url, { method, headers: h, body: raw ? body : body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie");
    const ct = r.headers.get("content-type") || "";
    return { status: r.status, json: ct.includes("json") ? await r.json() : null, cookie: sc ? sc.split(";")[0] : null, buf: ct.includes("image") ? Buffer.from(await r.arrayBuffer()) : null };
}
const okRow = (i, v) => ({ h: 1, s: 2, a: 2, v, t: 2, d: 2, l: 0, n: "" });
const rows = v => [okRow(0, v || 200), okRow(1, 5), okRow(2, 10), { h: 0, n: "izin" }, okRow(4, 15)];
const today = () => new Date().toISOString().slice(0, 10);
const dayBefore = k => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10);

test("setup butuh kode dan PIN valid", async () => {
    assert.equal((await call("GET", "/api/status")).json.setup, false);
    let r = await call("POST", "/api/setup", { code: "00000000", ownerPin: "1234", supPin: "5678" });
    assert.equal(r.status, 403);
    const code = auth.setupCode();
    r = await call("POST", "/api/setup", { code, ownerPin: "1234", supPin: "1234" });
    assert.equal(r.status, 400);
    r = await call("POST", "/api/setup", { code, ownerPin: "1234", supPin: "5678" });
    assert.equal(r.status, 200); owner = r.cookie;
    assert.equal((await call("POST", "/api/setup", { code, ownerPin: "1", supPin: "2" })).status, 403, "setup tidak bisa diulang");
});

test("tanpa header X-SiteOwner atau tanpa sesi ditolak", async () => {
    const r = await fetch(base + "/api/logout", { method: "POST" });
    assert.equal(r.status, 403);
    assert.equal((await call("GET", "/api/state")).status, 401);
});

test("login supervisor, salah PIN dikunci setelah 5 kali", async () => {
    let r = await call("POST", "/api/login", { role: "sup", pin: "5678" });
    assert.equal(r.status, 200); sup = r.cookie;
    for (let i = 0; i < 4; i++) assert.equal((await call("POST", "/api/login", { role: "owner", pin: "0000" })).status, 401);
    r = await call("POST", "/api/login", { role: "owner", pin: "0000" });
    assert.equal(r.status, 429);
    assert.equal((await call("POST", "/api/login", { role: "owner", pin: "1234" })).status, 429, "tetap terkunci walau PIN benar");
});

test("hak akses per peran", async () => {
    assert.equal((await call("PUT", "/api/proj", {}, sup)).status, 403);
    assert.equal((await call("POST", "/api/appr", { n: 1, status: "disetujui" }, sup)).status, 403);
    assert.equal((await call("POST", "/api/days", {}, owner)).status, 403);
    const s = (await call("GET", "/api/state", null, sup)).json;
    assert.equal(s.fcfg, undefined, "supervisor tidak menerima RAB/nilai kontrak");
    assert.ok((await call("GET", "/api/state", null, owner)).json.fcfg);
});

test("laporan harian: validasi, rantai hash, foto", async () => {
    const good = { rows: rows(), by: "Budi", tgl: dayBefore(5) };
    assert.equal((await call("POST", "/api/days", { ...good, by: "" }, sup)).status, 400, "nama wajib");
    assert.equal((await call("POST", "/api/days", { ...good, tgl: "2999-01-01" }, sup)).status, 400, "tanggal masa depan");
    assert.equal((await call("POST", "/api/days", { ...good, rows: rows(9999) }, sup)).status, 400, "volume tak wajar");
    assert.equal((await call("POST", "/api/days", { ...good, rows: rows().slice(1) }, sup)).status, 400, "jumlah baris salah");
    const sakit = rows(); sakit[1] = { h: 1, s: 0, a: 2, v: 0, t: 2, d: 2, l: 0 };
    assert.equal((await call("POST", "/api/days", { ...good, rows: sakit }, sup)).status, 400, "sakit tanpa info surat dokter");

    // foto
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50, 1)]);
    assert.equal((await call("POST", "/api/photos", Buffer.from("bukan jpeg"), sup, true)).status, 400);
    const ph = await call("POST", "/api/photos", jpg, sup, true);
    assert.equal(ph.status, 200);
    const back = await call("GET", "/api/photo/" + ph.json.id, null, owner);
    assert.equal(back.status, 200); assert.ok(back.buf.equals(jpg));

    assert.equal((await call("POST", "/api/days", { ...good, photos: [ph.json.id] }, sup)).status, 200);
    assert.equal((await call("POST", "/api/days", { rows: rows(), by: "Budi", tgl: dayBefore(5) }, sup)).status, 400, "tanggal harus setelah laporan sebelumnya");
    for (let k = 4; k >= 2; k--) assert.equal((await call("POST", "/api/days", { rows: rows(), by: "Budi", tgl: dayBefore(k) }, sup)).status, 200);

    const st = (await call("GET", "/api/state", null, owner)).json;
    assert.equal(st.days.length, 4);
    let h = "0";
    for (const d of st.days) { h = crypto.createHash("sha256").update(Integrity.dayInput(h, d)).digest("hex"); assert.equal(d.h, h, "hash hari " + d.n); }
});

test("opname wajib tiap 5 hari; segel mengikat hash", async () => {
    // aturan asli: opname wajib sebelum hari ke-(d + 5), jadi hari ke-5 sudah terkunci setelah 4 hari
    let r = await call("POST", "/api/days", { rows: rows(), by: "Budi", tgl: dayBefore(1) }, sup);
    assert.equal(r.status, 400); assert.match(r.json.error, /Opname/);

    assert.equal((await call("POST", "/api/op", { v: 70, by: "QC", tgl: today() }, sup)).status, 403);
    assert.equal((await call("POST", "/api/op", { v: 70, by: "QC", tgl: today(), items: [{ nm: "A", vr: 10, vt: 5, bobot: 100 }] }, owner)).status, 400, "progres tidak cocok item");
    r = await call("POST", "/api/op", { v: 50, by: "QC", tgl: today(), items: [{ nm: "A", lok: "L2", sat: "m2", vr: 10, vt: 5, bobot: 100 }] }, owner);
    assert.equal(r.status, 200);
    assert.equal((await call("POST", "/api/seal", { by: "QC" }, owner)).status, 200);
    const st = (await call("GET", "/api/state", null, owner)).json;
    assert.equal(st.op[0].d, 4); assert.equal(st.op[0].hd, st.days[3].h);
    assert.equal(st.seal[0].hd, st.days[3].h);
    assert.equal((await call("POST", "/api/days", { rows: rows(), by: "Budi", tgl: dayBefore(1) }, sup)).status, 200, "setelah opname bisa lanjut");
});

test("persetujuan, koreksi hanya untuk revisi/ditolak, rantai koreksi", async () => {
    assert.equal((await call("POST", "/api/corr", { n: 1, rows: rows(), by: "Budi", alasan: "salah ketik volume" }, sup)).status, 400, "belum diminta revisi");
    assert.equal((await call("POST", "/api/appr", { n: 1, status: "revisi", note: "" }, owner)).status, 400, "catatan wajib");
    assert.equal((await call("POST", "/api/appr", { n: 1, status: "revisi", note: "cek volume Pak Budi" }, owner)).status, 200);
    assert.equal((await call("POST", "/api/corr", { n: 1, rows: rows(220), by: "Budi", alasan: "x" }, sup)).status, 400, "alasan min 5");
    assert.equal((await call("POST", "/api/corr", { n: 1, rows: rows(220), by: "Budi", alasan: "volume diukur ulang" }, sup)).status, 200);
    const st = (await call("GET", "/api/state", null, sup)).json;
    assert.equal(st.corr.length, 1);
    assert.equal(st.corr[0].h, crypto.createHash("sha256").update(Integrity.corrInput("0", st.corr[0])).digest("hex"));
});

test("biaya: peran, verifikasi, versi, batal", async () => {
    const e = { tgl: today(), kat: "Lain-lain", ket: "Biaya angkut", jml: 250000 };
    assert.equal((await call("POST", "/api/fin", { ...e, jml: -5, by: "Budi" }, sup)).status, 400, "supervisor tidak boleh negatif");
    assert.equal((await call("POST", "/api/fin", { ...e, kat: "Upah", by: "Budi" }, sup)).status, 400, "upah otomatis");
    let r = await call("POST", "/api/fin", { ...e, by: "Budi", verif: true, role: "owner" }, sup);
    assert.equal(r.status, 200);
    let st = (await call("GET", "/api/state", null, owner)).json;
    assert.equal(st.fin[0].verif, false, "klaim verif dari klien diabaikan"); assert.equal(st.fin[0].role, "sup");
    assert.equal((await call("POST", "/api/fin/" + r.json.id, { verif: true }, sup)).status, 403);
    assert.equal((await call("POST", "/api/fin/" + r.json.id, { verif: true }, owner)).status, 200);
    assert.equal((await call("POST", "/api/fin/" + r.json.id, { batal: true }, owner)).status, 200);
    st = (await call("GET", "/api/state", null, owner)).json;
    assert.equal(st.fin.length, 3); assert.equal(st.fin[2].v, 3);
});

test("material dan jadwal", async () => {
    assert.equal((await call("PUT", "/api/matm", { list: [{ id: "m1", nm: "Semen", sat: "sak", min: 5, keb: 100, harga: 68000 }] }, owner)).status, 200);
    assert.equal((await call("POST", "/api/mat", { tgl: today(), mid: "m1", jenis: "keluar", qty: 1, ket: "cor kolom", by: "Budi" }, sup)).status, 400, "stok kosong");
    assert.equal((await call("POST", "/api/mat", { tgl: today(), mid: "m1", jenis: "masuk", qty: 10, harga: 70000, ket: "toko maju", by: "Budi" }, sup)).status, 200);
    assert.equal((await call("POST", "/api/mat", { tgl: today(), mid: "m1", jenis: "keluar", qty: 4, ket: "cor kolom", by: "Budi" }, sup)).status, 200);
    assert.equal((await call("PUT", "/api/matm", { list: [] }, owner)).status, 400, "material berriwayat tak boleh dihapus");

    assert.equal((await call("PUT", "/api/tasks", { list: [{ id: 1, nm: "Pembesian", mulai: "2026-01-01", selesai: "2026-01-10" }] }, owner)).status, 200);
    assert.equal((await call("POST", "/api/tprog", { tid: 1, pct: 100, cat: "" , by: "Budi" }, sup)).status, 400, "100% butuh tanggal selesai");
    assert.equal((await call("POST", "/api/tprog", { tid: 1, pct: 40, by: "Budi" }, sup)).status, 200);
    assert.equal((await call("POST", "/api/tprog", { tid: 1, pct: 30, by: "Budi" }, sup)).status, 400, "turun butuh catatan");
    assert.equal((await call("PUT", "/api/tasks", { list: [] }, owner)).status, 400);
});

test("pengaturan proyek dan PIN", async () => {
    const st = (await call("GET", "/api/state", null, owner)).json, p = st.proj;
    assert.equal((await call("PUT", "/api/proj", { ...p, dur: 0 }, owner)).status, 400);
    assert.equal((await call("PUT", "/api/proj", { ...p, W: p.W.slice(1) }, owner)).status, 400, "pekerja tidak boleh dihapus");
    assert.equal((await call("PUT", "/api/proj", { ...p, nama: "Gedung A", cfg: { std: 160000, psd: 1 } }, owner)).status, 200);
    assert.equal((await call("PUT", "/api/proj", { ...p, cfg: { psd: 5 } }, owner)).status, 400, "persen di luar rentang");
    assert.equal((await call("PUT", "/api/pin", { role: "sup", pin: "1234" }, owner)).status, 400, "sama dengan PIN owner");
    assert.equal((await call("PUT", "/api/pin", { role: "owner", old: "9999", pin: "2468" }, owner)).status, 400, "PIN lama salah");
    assert.equal((await call("PUT", "/api/pin", { role: "sup", pin: "1357" }, owner)).status, 200);
    assert.equal((await call("PUT", "/api/pin", { role: "owner", old: "1234", pin: "2468" }, owner)).status, 200);
    assert.equal((await call("POST", "/api/login", { role: "sup", pin: "1357" })).status, 200);
});

test("catatan tambah-saja: SQL langsung ditolak, logout menutup sesi", async () => {
    const { db } = require("../server/db");
    assert.throws(() => db.prepare("UPDATE recs SET json='{}'").run(), /tambah-saja/);
    assert.throws(() => db.prepare("DELETE FROM recs").run(), /tambah-saja/);
    assert.equal((await call("POST", "/api/logout", {}, owner)).status, 200);
    assert.equal((await call("GET", "/api/state", null, owner)).status, 401);
});
