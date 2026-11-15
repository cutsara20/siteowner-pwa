"use strict";
// Validasi dan normalisasi masukan. Server tidak percaya pada validasi di browser.
const bad = m => { const e = new Error(m); e.status = 400; return e; };
const isNum = x => typeof x === "number" && Number.isFinite(x);
const str = (x, max) => String(x == null ? "" : x).trim().slice(0, max);

const DW = [["Pak Budi", "Pembesian", "kg besi", 250], ["Pak Joko", "Cor beton", "m³", 6], ["Pak Agus", "Bekisting", "m²", 12], ["Pak Rahmat", "Pasang bata", "m²", 10], ["Pak Dani", "Finishing", "m²", 18]];
const KAT = ["Material", "Peralatan / sewa alat", "Subkontraktor", "Pajak (PPN, PPh)", "Perizinan dan biaya dinas", "Pengawas / manajemen konstruksi", "Konsultan", "Overhead / operasional", "Lain-lain"];
const KATB = ["Material", "Upah", ...KAT.slice(1)];
// rentang nilai tersimpan (persen disimpan sebagai pecahan 0..1)
const CFG_RNG = { std: [0, 1e7], lem: [0, 1e7], bon: [0, 1e7], pen: [0, 1e7], pap: [0, 1e7], psd: [0, 1], pst: [0, 1], pas: [0, 1], pam: [0, 1], al: [0, 1], ab: [0, 1], lm1: [0, 5], lm2: [0, 5], opi: [1, 30], vmax: [1.5, 20] };

const defaultProj = () => ({ nama: "Proyek", dur: 20, awal: 65, W: DW.map(w => w.slice()), cfg: {}, log: [], shape: "s", plan: [], anggaran: 0, planHist: [] });

function name(x, required) {
    const s = str(x, 40);
    if (required && !s) throw bad("Isi nama pengisi/pencatat.");
    return s;
}
function date(x, label) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x || "") || isNaN(Date.parse(x + "T00:00:00Z"))) throw bad("Isi " + (label || "tanggal") + ".");
    if (Date.parse(x + "T00:00:00Z") > Date.now() + 36 * 3600 * 1000) throw bad("Tanggal tidak boleh di masa depan.");
    return x;
}

function proj(b, cur, hasDays) {
    const o = {};
    o.nama = str(b.nama, 80) || cur.nama;
    o.dur = Math.round(+b.dur); if (!(o.dur >= 1 && o.dur <= 200)) throw bad("Durasi kontrak harus 1 sampai 200 hari kerja.");
    o.awal = +b.awal; if (!(o.awal >= 0 && o.awal <= 99)) throw bad("Progres awal harus 0 sampai 99.");
    if (!Array.isArray(b.W) || b.W.length < (cur.W || []).length || b.W.length > 8 || !b.W.length) throw bad("Daftar pekerja tidak valid (pekerja tidak boleh dihapus, maksimal 8).");
    o.W = b.W.map(w => {
        if (!Array.isArray(w) || !(+w[3] > 0) || +w[3] > 1e6) throw bad("Target volume pekerja tidak valid.");
        return [str(w[0], 40) || "Pekerja", str(w[1], 40), str(w[2], 20), +w[3]];
    });
    o.cfg = {};
    for (const [k, [lo, hi]] of Object.entries(CFG_RNG)) if (b.cfg && b.cfg[k] !== undefined) {
        const v = +b.cfg[k]; if (!isNum(v) || v < lo || v > hi) throw bad("Nilai pengaturan " + k + " di luar rentang.");
        o.cfg[k] = v;
    }
    o.log = (Array.isArray(b.log) ? b.log : []).slice(-300).map(x => typeof x === "string" ? str(x, 300) : { ts: str(x && x.ts, 40), t: str(x && x.t, 300) });
    o.shape = ["linear", "s", "custom"].includes(b.shape) ? b.shape : "linear";
    o.plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, 100).map(p => { if (!Array.isArray(p) || !isNum(+p[0]) || !isNum(+p[1])) throw bad("Titik rencana tidak valid."); return [+p[0], +p[1]]; });
    if (o.shape === "custom" && !o.plan.length) throw bad("Rencana kustom butuh minimal satu titik.");
    o.anggaran = isNum(+b.anggaran) ? +b.anggaran : 0;
    o.planHist = (Array.isArray(b.planHist) ? b.planHist : []).slice(-100).map(x => ({ ts: str(x && x.ts, 40), shape: str(x && x.shape, 10), plan: Array.isArray(x && x.plan) ? x.plan.slice(0, 100).map(p => [+p[0] || 0, +p[1] || 0]) : [], alasan: str(x && x.alasan, 200) }));
    return o;
}

function fcfg(b) {
    const nilai = +b.nilai || 0;
    if (nilai < 0 || nilai > 1e13) throw bad("Nilai kontrak tidak valid.");
    const rab = (Array.isArray(b.rab) ? b.rab : []).slice(0, 300).map(x => {
        if (!KATB.includes(x.kat)) throw bad("Kategori RAB tidak dikenal.");
        const r = { kat: x.kat, uraian: str(x.uraian, 120), vol: +x.vol || 0, sat: str(x.sat, 20), harga: +x.harga || 0, pct: +x.pct || 0 };
        if (!r.uraian) throw bad("Setiap baris RAB perlu uraian.");
        if (r.pct < 0 || r.pct > 100 || r.vol < 0 || r.harga < 0 || r.vol * r.harga > 1e13) throw bad("Angka RAB tidak valid.");
        return r;
    });
    return { nilai, rab };
}

function matm(l) {
    if (!Array.isArray(l) || l.length > 300) throw bad("Daftar material tidak valid.");
    const seen = new Set();
    return l.map(x => {
        const o = { id: str(x.id, 40), nm: str(x.nm, 60), sat: str(x.sat, 20), min: +x.min || 0, keb: +x.keb || 0, harga: +x.harga || 0 };
        if (!/^[A-Za-z0-9_-]+$/.test(o.id) || seen.has(o.id)) throw bad("ID material tidak valid.");
        seen.add(o.id);
        if (!o.nm || !o.sat) throw bad("Setiap material perlu nama dan satuan.");
        if (o.min < 0 || o.keb < 0 || o.harga < 0) throw bad("Angka material tidak boleh negatif.");
        return o;
    });
}

function tasks(l) {
    if (!Array.isArray(l) || l.length > 300) throw bad("Jadwal tidak valid.");
    const seen = new Set();
    return l.map(x => {
        const o = { id: Math.round(+x.id), nm: str(x.nm, 80), mulai: str(x.mulai, 10), selesai: str(x.selesai, 10) };
        if (!(o.id > 0) || seen.has(o.id)) throw bad("ID pekerjaan tidak valid.");
        seen.add(o.id);
        if (!o.nm || !/^\d{4}-\d{2}-\d{2}$/.test(o.mulai) || !/^\d{4}-\d{2}-\d{2}$/.test(o.selesai)) throw bad("Setiap pekerjaan perlu nama, tanggal mulai, dan target selesai.");
        if (o.selesai < o.mulai) throw bad('Target selesai "' + o.nm + '" tidak boleh sebelum tanggal mulai.');
        return o;
    });
}

// Baris laporan harian: satu entri per pekerja.
function rows(r, p) {
    if (!Array.isArray(r) || r.length !== p.W.length) throw bad("Jumlah baris laporan tidak sama dengan jumlah pekerja.");
    const vmax = (p.cfg || {}).vmax ?? 5, tri = [0, 1, 2], bin = [0, 1];
    return r.map((x, i) => {
        const nm = p.W[i][0];
        if (!x || typeof x !== "object") throw bad("Baris " + nm + " tidak valid.");
        const n = str(x.n, 80);
        if (x.h === 0) return { h: 0, n };
        if (x.h !== 1) throw bad("Kehadiran " + nm + " tidak valid.");
        const o = { h: 1, s: x.s, a: x.a, v: +x.v || 0, t: x.t, d: x.d, l: +x.l || 0, n };
        if (!tri.includes(o.s) || !tri.includes(o.a) || !tri.includes(o.t) || !tri.includes(o.d)) throw bad("Pilihan " + nm + " tidak valid.");
        if (o.l < 0 || o.l > 480 || o.l % 30) throw bad("Durasi lembur " + nm + " tidak valid.");
        if (o.v < 0) throw bad("Volume " + nm + " tidak valid.");
        if (o.s === 0) { if (!bin.includes(x.sd)) throw bad("Pilih ada atau tidaknya surat dokter untuk " + nm + "."); o.sd = x.sd; }
        if (o.s !== 0 && o.a === 0) { if (!bin.includes(x.ar)) throw bad("Pilih alasan APD tidak lengkap untuk " + nm + "."); o.ar = x.ar; }
        if (o.s !== 0 && o.a !== 0 && o.v > vmax * p.W[i][3]) throw bad("Volume " + nm + " melebihi " + vmax + " kali target.");
        return o;
    });
}

function opItems(l) {
    if (l === undefined) return [];
    if (!Array.isArray(l) || l.length > 100) throw bad("Item opname tidak valid.");
    return l.map(x => ({ nm: str(x.nm, 80), lok: str(x.lok, 60), sat: str(x.sat, 20), vr: +x.vr, vt: +x.vt, bobot: +x.bobot }));
}
function opnameFromItems(items) {
    if (!items.length) return { ok: false, err: "Isi minimal satu item pekerjaan." };
    let tot = 0, pct = 0;
    for (const it of items) {
        if (!it.nm) return { ok: false, err: "Setiap item perlu nama pekerjaan." };
        if (!(it.vr > 0)) return { ok: false, err: 'Volume rencana "' + it.nm + '" harus lebih dari 0.' };
        if (!(it.vt >= 0)) return { ok: false, err: 'Volume terpasang "' + it.nm + '" tidak valid.' };
        if (!(it.bobot > 0)) return { ok: false, err: 'Bobot "' + it.nm + '" harus lebih dari 0.' };
        tot += it.bobot; pct += it.bobot * Math.min(it.vt / it.vr, 1);
    }
    if (Math.abs(tot - 100) > 0.01) return { ok: false, err: "Total bobot harus 100% (sekarang " + Math.round(tot * 100) / 100 + "%)." };
    return { ok: true, pct: Math.round(pct * 100) / 100 };
}

function finEntry(b, role) {
    const e = { tgl: date(b.tgl, "tanggal pengeluaran"), kat: b.kat, ket: str(b.ket, 80), jml: +b.jml };
    if (!KAT.includes(e.kat)) throw bad("Kategori biaya tidak dikenal.");
    if (e.ket.length < 3) throw bad("Isi keterangan (minimal 3 huruf).");
    if (!e.jml || Math.abs(e.jml) > 1e12 || (role !== "owner" && e.jml < 0)) throw bad(role === "owner" ? "Isi jumlah yang valid (boleh negatif untuk koreksi)." : "Isi jumlah lebih dari 0.");
    return e;
}
function finPatch(b) {
    const p = {};
    if (b.tgl !== undefined) p.tgl = date(b.tgl, "tanggal pengeluaran");
    if (b.kat !== undefined) { if (!KAT.includes(b.kat)) throw bad("Kategori biaya tidak dikenal."); p.kat = b.kat; }
    if (b.ket !== undefined) { p.ket = str(b.ket, 80); if (p.ket.length < 3) throw bad("Isi keterangan (minimal 3 huruf)."); }
    if (b.jml !== undefined) { p.jml = +b.jml; if (!p.jml || Math.abs(p.jml) > 1e12) throw bad("Isi jumlah yang valid."); }
    if (b.verif !== undefined) p.verif = !!b.verif;
    if (b.batal !== undefined) p.batal = !!b.batal;
    return p;
}

function matEntry(b, matm) {
    const e = { tgl: date(b.tgl, "tanggal pencatatan"), mid: str(b.mid, 40), jenis: b.jenis, qty: +b.qty, harga: +b.harga || 0, ket: str(b.ket, 80) };
    if (!matm.some(m => m.id === e.mid)) throw bad("Material tidak dikenal.");
    if (e.jenis !== "masuk" && e.jenis !== "keluar") throw bad("Jenis harus masuk atau keluar.");
    if (!(e.qty > 0) || e.qty > 1e9) throw bad("Isi jumlah lebih dari 0.");
    if (e.ket.length < 3) throw bad("Isi keterangan (minimal 3 huruf).");
    if (e.harga < 0) throw bad("Harga tidak valid.");
    if (e.jenis === "keluar") e.harga = 0;
    return e;
}

function progEntry(b, tasks, prev) {
    const tid = Math.round(+b.tid), e = { tid, pct: +b.pct, aSelesai: str(b.aSelesai, 10), cat: str(b.cat, 80) };
    if (!tasks.some(t => t.id === tid)) throw bad("Pekerjaan tidak dikenal.");
    if (!(e.pct >= 0 && e.pct <= 100) || b.pct === "" || b.pct === null) throw bad("Isi persen selesai antara 0 dan 100.");
    if (prev && e.pct < prev.pct && e.cat.length < 5) throw bad("Menurunkan persen dari " + prev.pct + "% wajib disertai catatan (minimal 5 huruf).");
    if (e.pct === 100 && !e.aSelesai) throw bad("Isi tanggal selesai karena pekerjaan 100%.");
    if (e.aSelesai) date(e.aSelesai, "tanggal selesai");
    return e;
}

module.exports = { defaultProj, name, date, proj, fcfg, matm, tasks, rows, opItems, opnameFromItems, finEntry, finPatch, matEntry, progEntry };
