// Ekspor CSV/PDF, log aktivitas, analisis KPI, laporan periodik, cadangan
// ---------- Ekspor CSV (pemisah titik koma agar terbaca Excel berbahasa Indonesia) ----------
function csv(rows) {
    return "\uFEFF" + rows.map(r => r.map(c => {
        const s = String(c === undefined || c === null ? "" : c);
        return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";")).join("\r\n");
}

function anonName(i) { return "Pekerja " + (i + 1); }
function anonBy(by, map) { if (!(by in map)) map[by] = "Pengisi " + String.fromCharCode(65 + Object.keys(map).length); return map[by]; }

function csvRekap(m, a, b, anon) {
    a = a || 1; b = b || m.n;
    const mp = {}, r = [["hari", "tanggal", "pengisi", "status", "pekerja_bekerja", "sakit", "apd_tidak_lengkap", "apd_sebagian", "absen", "jam_lembur_dibayar", "rata_kpi", "upah_total", "progres_kumulatif_sistem"]];
    m.cs.forEach((c, i) => {
        if (i + 1 < a || i + 1 > b) return;
        const mt = S.meta[i] || {};
        r.push([i + 1, mt.tgl || "", anon ? anonBy(mt.by || "", mp) : mt.by || "", STATUS_TXT[dayStatus(i + 1).s], c.fit, c.sk, c.ap, c.ps, c.ab, c.lem, Math.round(c.rk * 10) / 10, Math.round(c.up), Math.round(c.prog * 100) / 100]);
    });
    return csv(r);
}

function csvPekerja(m, a, b, anon) {
    a = a || 1; b = b || m.n;
    const r = [["hari", "tanggal", "pekerja", "zona", "status", "volume", "satuan", "target", "rasio_persen", "kpi", "upah_pokok", "lembur", "bonus", "potongan", "upah_total"]];
    m.cs.forEach((c, i) => c.o.forEach((o, j) => {
        if (i + 1 < a || i + 1 > b) return;
        const row = (S.days[i] || [])[j] || {}, w = W[j] || ["?", "", "", ""];
        r.push([i + 1, (S.meta[i] || {}).tgl || "", anon ? anonName(j) : w[0], w[1], ST[o.st], o.st == 1 ? row.v : "", w[2], w[3], o.st == 1 ? Math.round(o.ra * 100) : "", o.st == 1 ? Math.round(o.kpi * 10) / 10 : "", o.pk, Math.round(o.lm), o.bn, o.pt, Math.round(o.up)]);
    }));
    return csv(r);
}

function csvMaterial() {
    const r = [["tanggal", "material", "satuan", "jenis", "jumlah", "harga_satuan", "nilai", "keterangan", "dicatat_oleh"]], by = {};
    (S.matm || []).forEach(x => by[x.id] = x);
    (S.mat || []).forEach(e => { const x = by[e.mid] || { nm: "?", sat: "" }, h = e.harga > 0 ? e.harga : (x.harga || 0); r.push([e.tgl, x.nm, x.sat, e.jenis, e.qty, h, e.jenis == "masuk" ? Math.round(e.qty * h) : "", e.ket, e.by]); });
    r.push([], ["RINGKASAN STOK", "satuan", "masuk", "keluar", "stok", "batas_minimum", "kebutuhan_rab", "status"]);
    matStock().forEach(o => r.push([o.nm, o.sat, o.masuk, o.keluar, o.stok, o.min || 0, o.keb || 0, o.status]));
    return csv(r);
}

function csvJadwal() {
    const r = [["pekerjaan", "mulai_rencana", "selesai_rencana", "rencana_persen_hari_ini", "realisasi_persen", "status", "catatan_terakhir"]];
    (S.tasks || []).forEach(t => { const x = taskStatus(t); r.push([t.nm, t.mulai, t.selesai, Math.round(x.plan), x.aktual, x.s, x.p ? x.p.cat || "" : ""]); });
    return csv(r);
}

function csvOpname() {
    const r = [["opname_ke", "setelah_hari", "tanggal", "progres_persen", "pemeriksa", "item", "lokasi", "satuan", "volume_rencana", "volume_terpasang", "bobot_persen", "capaian_persen"]];
    (S.op || []).forEach((o, k) => {
        if (!(o.items || []).length) r.push([k + 1, o.d, o.tgl || "", o.v, o.by, "", "", "", "", "", "", ""]);
        (o.items || []).forEach(it => r.push([k + 1, o.d, o.tgl || "", o.v, o.by, it.nm, it.lok || "", it.sat || "", it.vr, it.vt, it.bobot, Math.round(Math.min(it.vt / it.vr, 1) * 1000) / 10]));
    });
    return csv(r);
}

function csvBiaya(m) {
    const f = finSummary(m);
    const r = [["kategori", "rab", "realisasi", "selisih"]];
    KATB.forEach(k => r.push([k, Math.round(f.rab.by[k]), Math.round(f.real[k]), Math.round(f.rab.by[k] - f.real[k])]));
    r.push(["TOTAL", Math.round(f.rab.total), Math.round(f.total), Math.round(f.rab.total - f.total)], ["NILAI KONTRAK", f.nilai], ["ESTIMASI KEUNTUNGAN SAAT INI", Math.round(f.untungSaatIni)], ["PROYEKSI KEUNTUNGAN AKHIR", Math.round(f.untungProyeksi)], [], ["tanggal", "kategori", "keterangan", "jumlah", "dicatat_oleh", "terverifikasi"]);
    (S.fin || []).forEach(x => r.push([x.tgl, x.kat, x.ket, x.jml, x.by || "", x.verif ? "ya" : "belum"]));
    return csv(r);
}

// ---------- Analisis: deret waktu untuk rentang hari ----------
function seriesRange(m, a, b) {
    const idx = [];
    for (let i = Math.max(1, a); i <= b && i <= m.n; i++) idx.push(i);
    const c = i => m.cs[i - 1];
    return {
        labels: idx,
        prog: idx.map(i => c(i).prog),
        upah: idx.map(i => c(i).up),
        kpi: idx.map(i => c(i).rk),
        hadir: idx.map(i => Math.round(c(i).fit / (S.days[i - 1].length || 1) * 100)),
        ringkas: {
            hari: idx.length,
            upah: idx.reduce((s, i) => s + c(i).up, 0),
            lembur: idx.reduce((s, i) => s + c(i).lem, 0),
            kpi: idx.length ? idx.reduce((s, i) => s + c(i).rk, 0) / idx.length : 0,
            apd: idx.reduce((s, i) => s + c(i).ap + c(i).ps, 0),
            sakit: idx.reduce((s, i) => s + c(i).sk, 0),
            absen: idx.reduce((s, i) => s + c(i).ab, 0)
        }
    };
}

// ---------- Log aktivitas gabungan ----------
function logAdd(t) {
    S.log = S.log || [];
    S.log.push({ ts: new Date().toISOString(), t });
}
const logText = x => typeof x == "string" ? x : new Date(x.ts).toLocaleString("id-ID") + " – " + x.t;

function activity() {
    const ev = [];
    (S.meta || []).forEach((mt, i) => ev.push({ ts: mt.iso || "", who: mt.by, txt: "Laporan hari ke-" + (i + 1) + " dikirim" + (mt.tgl ? " (tanggal " + mt.tgl + ")" : "") }));
    (S.corr || []).forEach(c => ev.push({ ts: c.ts, who: c.by, txt: "Koreksi hari ke-" + c.n + " (versi " + c.k + "): " + c.alasan }));
    (S.apprLog || []).forEach(a => ev.push({ ts: a.ts, who: "Owner", txt: "Hari ke-" + a.n + ": " + STATUS_TXT[a.status] + (a.note ? " (" + a.note + ")" : "") }));
    (S.op || []).forEach(o => ev.push({ ts: o.ts || "", who: o.by, txt: "Opname setelah hari ke-" + o.d + ": " + o.v + "%" + ((o.items || []).length ? " (" + o.items.length + " item)" : "") }));
    (S.seals || []).forEach(s => ev.push({ ts: s.ts || "", who: s.by, txt: "Data disegel sampai hari ke-" + s.d }));
    (S.finLog || []).forEach(f => ev.push({ ts: f.ts || "", who: f.by || "Owner", txt: (f.batal ? "Biaya dibatalkan" : f.v > 1 ? "Biaya diubah" : "Biaya dicatat") + ": " + f.kat + " - " + f.ket + " (" + Rp(f.jml) + ")" }));
    (S.mat || []).forEach(x => ev.push({ ts: x.ts || "", who: x.by, txt: "Material " + x.jenis + ": " + x.qty + " " + ((S.matm || []).find(y => y.id == x.mid) || { nm: "?" }).nm }));
    (S.tprog || []).forEach(p => ev.push({ ts: p.ts || "", who: p.by, txt: "Progres pekerjaan " + ((S.tasks || []).find(t => t.id == p.tid) || { nm: "?" }).nm + ": " + p.pct + "%" }));
    (S.log || []).forEach(x => { if (typeof x == "object") ev.push({ ts: x.ts, who: "Owner", txt: x.t }); });
    return ev.filter(e => e.ts).sort((a, b) => a.ts < b.ts ? 1 : -1);
}

// ---------- Rantai hash koreksi dan pemeriksaan cadangan ----------
function corrHash(prev, c) {
    return sha256(Integrity.corrInput(prev, c));
}

async function verifyCorr(corrs) {
    let h = "0";
    for (let i = 0; i < corrs.length; i++) {
        h = await corrHash(h, corrs[i]);
        if (corrs[i].h !== h) return { ok: false, why: "koreksi ke-" + (i + 1) + " (hari " + corrs[i].n + ") tidak cocok dengan sidik digital" };
    }
    return { ok: true };
}

async function checkBackup(txt) {
    let j;
    try { j = JSON.parse(txt); } catch (e) { return { ok: false, err: "Isi bukan JSON yang valid." }; }
    if (!j || !Array.isArray(j.hari) || !j.proyek) return { ok: false, err: "Struktur cadangan tidak dikenali (butuh proyek dan hari)." };
    let rantai = "tidak diperiksa (cadangan tanpa sidik digital)";
    if (j.hari.length && j.hari.every(d => d.h)) {
        const r = await verifyChain(j.hari, (j.opname || []).concat(j.segel || []));
        if (!r.ok) return { ok: false, err: "Rantai hash tidak utuh: " + r.why };
        rantai = "utuh";
    }
    if ((j.koreksi || []).length && j.koreksi.every(c => c.h)) {
        const r = await verifyCorr(j.koreksi);
        if (!r.ok) return { ok: false, err: "Rantai koreksi tidak utuh: " + r.why };
    }
    return { ok: true, hari: j.hari.length, opname: (j.opname || []).length, koreksi: (j.koreksi || []).length, biaya: (j.keuangan || []).length, rantai };
}

// ---------- Analisis KPI: rekap per pekerja dan korelasi ----------
function pearson(x, y) {
    const n = x.length;
    if (n < 3) return null;
    const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
    return sx && sy ? sxy / Math.sqrt(sx * sy) : null;
}

function kpiAnalysis(m, a, b) {
    const per = W.map(w => ({ nm: w[0], hari: 0, rasio: 0, kpi: 0, apd: 0, absen: 0, sakit: 0 })), xs = [], k3 = [], tl = [];
    for (let i = a; i <= b && i <= m.n; i++)
        m.cs[i - 1].o.forEach((o, j) => {
            const p = per[j];
            if (!p) return;
            if (o.st == 1) { p.hari++; p.rasio += o.ra; p.kpi += o.kpi; xs.push(o.ra); k3.push(o.kd); tl.push(o.kt); }
            if (o.st == 3 || (o.st == 1 && ((S.days[i - 1] || [])[j] || {}).a == 1)) p.apd++;
            if (o.st == 0) p.absen++;
            if (o.st == 2) p.sakit++;
        });
    per.forEach(p => { if (p.hari) { p.rasio /= p.hari; p.kpi /= p.hari; } });
    return { per, rK3: pearson(xs, k3), rTeliti: pearson(xs, tl), n: xs.length };
}

// ---------- Laporan periodik dan PDF sederhana ----------
function periodRange(type, m, arg) {
    const n = m.n;
    if (type == "harian") return [arg, arg];
    if (type == "mingguan") return [(arg - 1) * 7 + 1, Math.min(n, arg * 7)];
    if (type == "bulanan") {
        const idx = [];
        for (let i = 1; i <= n; i++) if (((S.meta[i - 1] || {}).tgl || "").startsWith(arg)) idx.push(i);
        return idx.length ? [idx[0], idx[idx.length - 1]] : [1, 0];
    }
    return [1, n];
}

function reportLines(m, type, arg) {
    const [a, b] = periodRange(type, m, arg), s = seriesRange(m, a, b), r = s.ringkas, f = finSummary(m);
    const jd = { harian: "Laporan Harian", mingguan: "Laporan Mingguan", bulanan: "Laporan Bulanan", akhir: "Rekap Akhir Proyek" }[type];
    const L = [jd + " - " + (S.nama || "Proyek"), "Dibuat: " + new Date().toLocaleString("id-ID"), "Periode: hari ke-" + a + " sampai " + b, ""];
    L.push("RINGKASAN", "Hari dilaporkan        : " + r.hari, "Total upah             : " + Rp(r.upah), "Jam lembur dibayar     : " + F(r.lembur), "Rata-rata KPI          : " + F(r.kpi), "Kasus APD bermasalah   : " + r.apd, "Sakit / absen (orang-hari): " + r.sakit + " / " + r.absen, "Progres sistem sekarang: " + F(m.pr) + "% (rencana " + F(m.ren) + "%), status: " + m.tx, "");
    L.push("RINCIAN PER HARI", "Hari | Tanggal    | Bekerja | Upah          | KPI   | Status laporan");
    for (let i = a; i <= b && i <= m.n; i++) { const c = m.cs[i - 1]; L.push(i + " | " + ((S.meta[i - 1] || {}).tgl || "-") + " | " + c.fit + "/" + S.days[i - 1].length + " | " + Rp(c.up) + " | " + F(c.rk) + " | " + STATUS_TXT[dayStatus(i).s]); }
    L.push("", "BIAYA (RAB vs REALISASI, SELURUH PROYEK)");
    KATB.forEach(k => { if (f.rab.by[k] || f.real[k]) L.push(k + ": RAB " + Rp(f.rab.by[k]) + ", realisasi " + Rp(f.real[k])); });
    L.push("TOTAL: RAB " + Rp(f.rab.total) + ", realisasi " + Rp(f.total) + ", sisa " + Rp(f.sisa));
    if (f.nilai) L.push("Nilai kontrak " + Rp(f.nilai) + "; estimasi keuntungan saat ini " + Rp(f.untungSaatIni) + "; proyeksi akhir " + Rp(f.untungProyeksi));
    L.push("", "MATERIAL (stok)");
    matStock().forEach(o => L.push(o.nm + ": masuk " + o.masuk + ", keluar " + o.keluar + ", stok " + o.stok + " " + o.sat + " (" + o.status + ")"));
    L.push("", "JADWAL PEKERJAAN");
    (S.tasks || []).forEach(t => { const x = taskStatus(t); L.push(t.nm + ": rencana " + Math.round(x.plan) + "%, realisasi " + x.aktual + "%, " + x.s); });
    const op = (S.op || []).slice(-1)[0];
    if (op) L.push("", "OPNAME TERAKHIR: setelah hari ke-" + op.d + ", " + op.v + "% oleh " + (op.by || "-"));
    return L;
}

// PDF teks sederhana (Helvetica, A4) tanpa pustaka luar; mengembalikan Uint8Array
function makePdf(title, lines) {
    const clean = s => String(s).replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
    const esc = s => clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const wrap = (s, w) => { const o = []; s = clean(s); while (s.length > w) { let c = s.lastIndexOf(" ", w); if (c < w * 0.5) c = w; o.push(s.slice(0, c)); s = "    " + s.slice(c).trim(); } o.push(s); return o; };
    const all = [];
    lines.forEach(l => wrap(l, 92).forEach(x => all.push(x)));
    const per = 52, pages = [];
    for (let i = 0; i < all.length; i += per) pages.push(all.slice(i, i + per));
    if (!pages.length) pages.push([""]);
    const objs = [];
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[2] = "<< /Type /Pages /Kids [" + pages.map((_, i) => (6 + 2 * i) + " 0 R").join(" ") + "] /Count " + pages.length + " >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    pages.forEach((pg, i) => {
        const head = i == 0 ? "BT /F2 13 Tf 50 800 Td (" + esc(title) + ") Tj ET\n" : "BT /F1 8 Tf 50 815 Td (" + esc(title) + " - halaman " + (i + 1) + ") Tj ET\n";
        const body = "BT /F1 9.5 Tf 13 TL 50 " + (i == 0 ? 780 : 795) + " Td\n" + pg.map(x => "(" + esc(x) + ") Tj T*").join("\n") + "\nET";
        const stream = head + body;
        objs[5 + 2 * i] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
        objs[6 + 2 * i] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (5 + 2 * i) + " 0 R >>";
    });
    let out = "%PDF-1.4\n";
    const off = [];
    for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += i + " 0 obj\n" + objs[i] + "\nendobj\n"; }
    const xr = out.length;
    out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n" + off.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF";
    return Uint8Array.from(out, ch => ch.charCodeAt(0) & 255);
}
