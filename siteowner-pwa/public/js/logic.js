// Logika murni: upah/KPI, progres, jadwal, peringatan, kejanggalan, keuangan, material
// LOGIKA: kalkulasi upah/KPI, progres, status jadwal, peringatan, deteksi kejanggalan, laporan

function calc(rows) {
    let fit=0,sk=0,ap=0,ps=0,ab=0,lem=0,up=0,ks=0,lt=0,snd=0,asd=0;
    const o=rows.map((r,i)=> {
        if(!r.h) {
            ab++;
            return{st:0,kpi:0,up:0,l:0,pk:0,lm:0,bn:0,pt:0}
        }
        if(r.s==0||r.a==0) {
            const sak=r.s==0,sdk=r.sd===0,tdis=r.ar===1,u=STD*(sak?(sdk?PST:PSD):(tdis?PAS:PAM)),ket=sak?(sdk?"Sakit, tanpa surat dokter":"Sakit, dengan surat dokter"):(tdis?"APD tidak disediakan/rusak":"Menolak memakai APD");
            up+=u;
            if(sak) {
                sk++;
                if(sdk)snd++;
                return{st:2,kpi:0,up:u,l:0,pk:u,lm:0,bn:0,pt:0,ket}
            }
            ap++;
            if(tdis)asd++;
            return{st:3,kpi:0,up:u,l:0,pk:u,lm:0,bn:0,pt:0,ket}
        }
        const ra=(r.v||0)/W[i][3],k=ra>=1.1?5:ra>=.95?4:ra>=.8?3:ra>=.6?2:1,kpi=(k+SK[r.t]+SK[r.d])/15*100,lr=(r.l||0)/60,l=ra>=AL&&r.s==2?lr:0;
        if(lr>l)lt++;
        if(r.a==1)ps++;
        const lm=LEM*(Math.min(l,1)*LM1+Math.max(l-1,0)*LM2),bn=kpi>=85&&ra>=AB&&r.a==2?BON:0,pt=(kpi<65?PEN:0)+(r.a==1?PAP:0),u=STD+lm+bn-pt;
        fit++;
        ks+=kpi;
        lem+=l;
        up+=u;
        return{st:1,kpi,up:u,l,ra,lr,t:r.t,d:r.d,ks:k,kt:SK[r.t],kd:SK[r.d],pk:STD,lm,bn,pt}
    });
    const rk=fit?ks/fit:0,f=!fit?0:rk>=85?1.1:rk>=65?1:.8;
    return{o,fit,sk,ap,ps,ab,lem,lt,snd,asd,up,rk,gain:TGT*fit/rows.length*f+lem*BJ}
}

function M() {
    const n=S.days.length,cs=[];
    let pr=S.awal,up=0,ap=0;
    S.days.forEach(d=> {
        const c=calc(d);
        pr=Math.min(100,pr+c.gain);
        c.prog=pr;
        cs.push(c);
        up+=c.up;
        ap+=c.ap-c.asd+c.ps
    });
    const prSys=pr,lop=(S.op||[]).slice(-1)[0];
    let gap=0;
    if(lop) {
        const sd=lop.d<=0?S.awal:(cs[lop.d-1]?cs[lop.d-1].prog:prSys);
        gap=Math.max(0,sd-lop.v)
    }
    pr=lop?Math.min(100,lop.v+cs.slice(lop.d).reduce((a,c)=>a+c.gain,0)):prSys;
    const ren=planAt(n),dev=pr-ren,rata=n?(pr-S.awal)/n:0,sisa=100-pr, est=rata>0&&sisa>0?Math.ceil(sisa/rata):null,sk=S.dur-n,bud=S.days.reduce((a,d)=>a+d.length*STD,0);
    let lv,tx;
    if(pr>=100) {
        lv="ok";
        tx="Proyek selesai 100%"
    } else if(!n) {
        lv="ok";
        tx="Belum ada data"
    } else if(dev>=.5) {
        lv="ok";
        tx="Lebih cepat dari jadwal"
    } else if(dev>=-1) {
        lv="ok";
        tx="Sesuai jadwal"
    } else if(dev>=-5) {
        lv="wa";
        tx="Potensi terlambat"
    } else {
        lv="bad";
        tx="Kritis – terancam terlambat parah"
    }
    return{n,cs,pr,prSys,gap,lop,ren,dev,rata,sisa,est,sk,up,ap,bud,lv,tx,last:cs[n-1]}
}

function alerts(m) {
    const a=[],{last:l}=m;
    if(!m.n)return[["wa","Isi Input Harian untuk mulai memantau proyek."]];
    if(m.est!==null&&m.est>m.sk) {
        const t=m.est-m.sk;
        let s="Proyeksi terlambat "+t+" hari kerja pada kecepatan saat ini.";
        if(m.sk>0) {
            const j=Math.ceil((m.sisa/m.sk-m.rata)/BJ);
            s+=" Untuk mengejar jadwal perlu sekitar "+j+" jam lembur tambahan per hari (total semua pekerja).";
        } else s+=" Masa kontrak habis, pertimbangkan addendum waktu.";
        a.push(["bad",s])
    } else if(m.est!==null)a.push(["ok","Proyeksi selesai "+m.est+" hari lagi, cadangan "+(m.sk-m.est)+" hari dari kontrak."]);
    if(l.ap>0)a.push(["bad","Hari ini "+l.ap+" pekerja APD tidak lengkap dan dilarang bekerja. Berikan APD pengganti."]);
    if(l.asd>0)a.push(["bad","Temuan: "+l.asd+" pekerja tidak dapat memakai APD karena tidak disediakan/rusak. Ini tanggung jawab proyek, bukan pekerja. Segera sediakan APD standar."]);
    if(l.ps>0)a.push(["wa",l.ps+" pekerja memakai APD sebagian. Boleh bekerja, tetapi dikenakan potongan dan teguran."]);
    if(l.sk>0)a.push(["wa",l.sk+" pekerja sakit/tidak fit hari ini. Arahkan ke poliklinik proyek."+(l.snd?" "+l.snd+" di antaranya tanpa surat dokter, upah mengikuti pengaturan ("+Math.round(PST*100)+"%).":"")]);
    if(l.ab>0)a.push(["wa",l.ab+" pekerja absen. Siapkan tenaga cadangan agar progres tidak turun."]);
    if(m.ap>=3)a.push(["bad","Total pelanggaran APD "+m.ap+" kasus. Disarankan safety talk atau toolbox meeting."]);
    if(m.up>m.bud)a.push(["wa","Biaya upah kumulatif melebihi anggaran normal sebesar "+Rp(m.up-m.bud)+"."]);
    else a.push(["ok","Biaya upah kumulatif masih di bawah anggaran normal (selisih "+Rp(m.bud-m.up)+")."]);
    return a
}

function flags(m) {
    const f=[],n=m.n;
    if(n&&m.last.lt>0)f.push(["wa",m.last.lt+" pengajuan lembur hari ini tidak dibayar (hasil di bawah "+Math.round(AL*100)+"% target atau pekerja kurang sehat)."]);
    if(m.gap>2)f.push(["bad","Progres sistem lebih tinggi "+F(m.gap)+"% dari hasil opname lapangan. Progres dikoreksi mengikuti opname."]);
    if(n<3)return f;
    const R=m.cs.slice(-5),avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
    W.forEach((w,i)=> {
        const L=R.map(c=>c.o[i]||{st:0}).filter(o=>o.st==1);
        if(L.length<3)return;
        const nm=w[0],vr=avg(L.map(o=>o.ra)),td=avg(L.map(o=>(o.t+o.d)/2)),lv=avg(L.map(o=>o.lr));
        if(L.every(o=>o.t==2&&o.d==2))f.push(["bad",nm+": selalu dinilai Teliti dan Patuh K3 tanpa variasi ("+L.length+" hari). Perlu diverifikasi QC."]);
        if(td>=1.8&&vr<.75)f.push(["bad",nm+": skor kualitas tinggi tetapi volume hasil hanya "+F(vr*100,0)+"% dari target. Tidak konsisten."]);
        if(L.filter(o=>o.lr>0&&o.ra<AL).length>=2)f.push(["wa",nm+": mengajukan lembur berulang kali padahal hasil di bawah "+Math.round(AL*100)+"% target."]);
        if(lv>=3.5)f.push(["wa",nm+": lembur hampir selalu penuh (rata-rata "+F(lv)+" jam per hari)."]);
        if(L.filter(o=>o.ra>1.5).length>=2)f.push(["wa",nm+": volume melebihi 150% target berulang. Cek ukuran dan volume di lapangan."])
    });
    const cp=c=>c.gain>0?c.up/c.gain:0,pre=m.cs.slice(0,-1).map(cp).filter(x=>x>0);
    if(pre.length&&cp(m.last)>1.5*avg(pre))f.push(["wa","Biaya upah per 1% progres hari ini melonjak lebih dari 1,5 kali rata-rata hari sebelumnya."]);
    return f
}

function rank(m) {
    return W.map((w,i)=> {
        let s=0,c=0,v=0;
        m.cs.forEach(d=> {
            const o=d.o[i]||{st:0};
            if(o.st==1) {
                s+=o.kpi;
                c++
            } else if(o.st>1)v++
        });
        return{n:w[0],z:w[1],k:c?s/c:0,c,v}
    }).sort((a,b)=>b.k-a.k)
}

function report(m,al) {
    if(!m.n)return"Belum ada data audit.";
    const l=m.last,e=m.est===null?"-":m.est+" hari kerja";
    return`*LAPORAN HARIAN – ${S.nama}*\nHari ke-${m.n} dari ${S.dur}\n\nProgres aktual : ${F(m.pr)}%\nProgres rencana: ${F(m.ren)}%\nDeviasi        : ${m.dev>=0?"+":""}${F(m.dev)}%\nStatus         : ${m.tx}\nEstimasi sisa  : ${e} (sisa kontrak ${Math.max(0,m.sk)})\n\n*Tenaga kerja*\nBekerja ${l.fit} | Sakit ${l.sk} | APD tidak lengkap ${l.ap} | APD sebagian ${l.ps} | Absen ${l.ab}\nLembur dibayar: ${F(l.lem)} jam\nUpah hari ini: ${Rp(l.up)}\nUpah kumulatif: ${Rp(m.up)} (anggaran ${Rp(m.bud)})\n\n*Catatan*\n`+al.map(a=>"- "+a[1]).join("\n")
}

// ---------- Rencana progres: garis lurus, Kurva S standar, atau titik kustom ----------
function planAt(d) {
    const a = S.awal, T = S.dur, t = Math.min(1, Math.max(0, d / T));
    if (S.shape == "custom" && S.plan && S.plan.length) {
        const pts = [[0, a], ...S.plan.filter(p => p[0] > 0 && p[0] < T).sort((x, y) => x[0] - y[0]), [T, 100]];
        for (let i = 0; i < pts.length - 1; i++)
            if (d <= pts[i + 1][0]) {
                const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
                return y0 + (y1 - y0) * (d - x0) / (x1 - x0);
            }
        return 100;
    }
    if (S.shape == "s") return a + (100 - a) * (3 * t * t - 2 * t * t * t);
    return a + (100 - a) * t;
}

function parsePlan(txt, dur) {
    const plan = [];
    for (const part of txt.split(",").map(s => s.trim()).filter(Boolean)) {
        const m = part.match(/^(\d+)\s*=\s*(\d+(?:[.,]\d+)?)$/);
        if (!m) return { ok: false, err: 'Format salah pada "' + part + '". Contoh: 5=70, 10=82' };
        const d = +m[1], p = +m[2].replace(",", ".");
        if (d <= 0 || d >= dur) return { ok: false, err: "Hari harus antara 1 dan " + (dur - 1) + "." };
        if (p < 0 || p > 100) return { ok: false, err: "Persen harus antara 0 dan 100." };
        plan.push([d, p]);
    }
    plan.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < plan.length; i++)
        if (plan[i][1] < plan[i - 1][1]) return { ok: false, err: "Persen rencana tidak boleh turun." };
    if (plan.length && plan[0][1] < S.awal) return { ok: false, err: "Persen pertama tidak boleh di bawah progres awal (" + S.awal + "%)." };
    return { ok: true, plan };
}

// ---------- Status laporan, koreksi, dan data efektif ----------
const STATUS_TXT = { dikirim: "Dikirim (menunggu)", dikirim_ulang: "Dikirim ulang (koreksi)", disetujui: "Disetujui", revisi: "Perlu revisi", ditolak: "Ditolak" };

function latestCorr(n) {
    let r = null;
    (S.corr || []).forEach(c => { if (c.n == n && (!r || c.k > r.k)) r = c; });
    return r;
}

function rebuildAppr() {
    const m = {};
    (S.apprLog || []).forEach(a => { if (!m[a.n] || a.ts > m[a.n].ts) m[a.n] = a; });
    S.appr = m;
}

function dayStatus(n) {
    const a = (S.appr || {})[n], c = latestCorr(n);
    if (c && (!a || c.ts > a.ts)) return { s: "dikirim_ulang", k: c.k };
    return a ? { s: a.status, note: a.note, ts: a.ts } : { s: "dikirim" };
}

// S.raw = laporan asli (tidak pernah diubah); S.days = data efektif (asli, atau versi koreksi terbaru)
function applyCorr() {
    S.days = (S.raw || []).map((r, i) => { const c = latestCorr(i + 1); return c ? c.rows : r; });
}

function normState() {
    S.raw = S.raw || S.days.slice();
    S.corr = S.corr || []; S.apprLog = S.apprLog || []; S.fin = S.fin || [];
    S.planHist = S.planHist || []; S.seals = S.seals || []; S.anggaran = S.anggaran || 0;
    S.fcfg = S.fcfg || { nilai: 0, rab: [] }; S.fcfg.rab = S.fcfg.rab || [];
    S.matm = S.matm || []; S.mat = S.mat || []; S.tasks = S.tasks || []; S.tprog = S.tprog || [];
    S.finLog = S.finLog || [];
    if (!S.finLog.length && (S.fin || []).length)
        S.finLog = S.fin.map((f, i) => ({ id: i + 1, v: 1, tgl: f.tgl, kat: f.kat, ket: f.ket, jml: f.jml, by: "Owner", role: "owner", verif: true, ts: f.ts }));
    rebuildFin();
    rebuildAppr();
    applyCorr();
}

const needOpname = () => (S.op.slice(-1)[0] || { d: 0 }).d + OPI <= S.days.length + 1;
const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const lastTgl = () => { for (let i = (S.meta || []).length - 1; i >= 0; i--) if (S.meta[i] && S.meta[i].tgl) return S.meta[i].tgl; return ""; };

// ---------- Validasi ----------
function dateError(tgl, prev) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl || "")) return "Isi tanggal kerja.";
    if (tgl > todayStr()) return "Tanggal kerja tidak boleh di masa depan.";
    if (prev && tgl <= prev) return "Tanggal harus setelah laporan sebelumnya (" + prev + ").";
    return null;
}

function rangeError(rows) {
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.h == 1 && r.s != 0 && r.a != 0 && r.v > VMAX * W[i][3])
            return { i, msg: "Volume " + r.v + " melebihi " + VMAX + " kali target (" + W[i][3] + " " + W[i][2] + "). Periksa angka dan satuannya." };
    }
    return null;
}

// ---------- Opname rinci: progres tertimbang dari item pekerjaan ----------
function opnameFromItems(items) {
    if (!items.length) return { ok: false, err: "Isi minimal satu item pekerjaan." };
    let tot = 0, pct = 0;
    for (const it of items) {
        if (!it.nm) return { ok: false, err: "Setiap item perlu nama pekerjaan." };
        if (!(it.vr > 0)) return { ok: false, err: 'Volume rencana "' + it.nm + '" harus lebih dari 0.' };
        if (!(it.vt >= 0)) return { ok: false, err: 'Volume terpasang "' + it.nm + '" tidak valid.' };
        if (!(it.bobot > 0)) return { ok: false, err: 'Bobot "' + it.nm + '" harus lebih dari 0.' };
        tot += it.bobot;
        pct += it.bobot * Math.min(it.vt / it.vr, 1);
    }
    if (Math.abs(tot - 100) > 0.01) return { ok: false, err: "Total bobot harus 100% (sekarang " + Math.round(tot * 100) / 100 + "%)." };
    return { ok: true, pct: Math.round(pct * 100) / 100 };
}

// ---------- Keuangan: RAB, realisasi, dan estimasi keuntungan ----------
const KATB = ["Material", "Upah", "Peralatan / sewa alat", "Subkontraktor", "Pajak (PPN, PPh)", "Perizinan dan biaya dinas", "Pengawas / manajemen konstruksi", "Konsultan", "Overhead / operasional", "Lain-lain"];
const KAT = KATB.filter(k => k != "Upah"); // kategori yang dicatat manual (upah otomatis dari laporan harian)

const rabJml = it => it.pct > 0 ? ((S.fcfg || {}).nilai || 0) * it.pct / 100 : (it.vol || 0) * (it.harga || 0);

function rabSummary() {
    const by = {};
    KATB.forEach(k => by[k] = 0);
    ((S.fcfg || {}).rab || []).forEach(it => by[it.kat] = (by[it.kat] || 0) + rabJml(it));
    return { by, total: Object.values(by).reduce((a, b) => a + b, 0) };
}

// Riwayat versi biaya: entri terbaru per id yang tidak dibatalkan
function rebuildFin() {
    const m = {};
    (S.finLog || []).forEach(e => { if (!m[e.id] || e.v > m[e.id].v) m[e.id] = e; });
    S.fin = Object.values(m).filter(e => !e.batal).sort((a, b) => a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : a.id - b.id);
}

// ---------- Material: stok masuk, keluar, dan kebutuhan ----------
function matStock() {
    const out = (S.matm || []).map(x => ({ ...x, masuk: 0, keluar: 0, nilai: 0 })), by = {};
    out.forEach(o => by[o.id] = o);
    (S.mat || []).forEach(e => {
        const o = by[e.mid];
        if (!o) return;
        if (e.jenis == "masuk") { o.masuk += e.qty; o.nilai += e.qty * (e.harga > 0 ? e.harga : (o.harga || 0)); }
        else o.keluar += e.qty;
    });
    out.forEach(o => { o.stok = o.masuk - o.keluar; o.status = o.stok < 0 ? "negatif" : o.stok <= (o.min || 0) ? "menipis" : "aman"; });
    return out;
}
const matCost = () => matStock().reduce((a, o) => a + o.nilai, 0);

function matAlerts() {
    const t = [];
    matStock().forEach(o => {
        if (o.stok < 0) t.push(["bad", "Stok " + o.nm + " negatif (" + o.stok + " " + o.sat + "): pemakaian lebih besar dari yang tercatat masuk."]);
        else if (o.stok <= (o.min || 0)) t.push(["wa", "Stok " + o.nm + " menipis (" + o.stok + " " + o.sat + ", batas " + (o.min || 0) + ")."]);
        if (o.keb > 0 && o.keluar > o.keb) t.push(["bad", "Pemakaian " + o.nm + " (" + o.keluar + ") melebihi kebutuhan RAB (" + o.keb + ")."]);
        else if (o.keb > 0 && o.masuk > o.keb * 1.1) t.push(["wa", "Material masuk " + o.nm + " (" + o.masuk + ") melebihi kebutuhan RAB (" + o.keb + ")."]);
    });
    return t;
}

function finSummary(m) {
    const rab = rabSummary(), nilai = (S.fcfg || {}).nilai || 0, real = {};
    KATB.forEach(k => real[k] = 0);
    real["Upah"] = m.up;
    real["Material"] = matCost();
    (S.fin || []).forEach(f => real[f.kat] = (real[f.kat] || 0) + f.jml);
    let ok = 0;
    m.cs.forEach((c, i) => { if (dayStatus(i + 1).s == "disetujui") ok += c.up; });
    const total = Object.values(real).reduce((a, b) => a + b, 0), ang = rab.total || S.anggaran || 0;
    // Estimasi laba memakai nilai material yang sudah DIPAKAI (keluar), bukan yang baru dibeli
    const beli = matCost(), dipakai = matStock().reduce((a, o) => a + (o.masuk ? o.keluar * (o.nilai / o.masuk) : 0), 0), totalPakai = total - beli + dipakai;
    const pakai = ang ? total / ang * 100 : 0, kemajuan = (m.pr - S.awal) / (100 - S.awal) * 100;
    const eac = kemajuan > 0 ? totalPakai / (kemajuan / 100) : 0;
    return {
        upah: m.up, upahOk: ok, upahPending: m.up - ok, real, rab, nilai, total, ang, sisa: ang - total, pakai, kemajuan,
        selisih: ang ? pakai - kemajuan : 0, lain: total - m.up - real["Material"], eac, totalPakai, matBeli: beli, matPakai: dipakai,
        untungRencana: nilai ? nilai - rab.total : 0, untungProyeksi: nilai && eac ? nilai - eac : 0, untungSaatIni: nilai ? nilai * kemajuan / 100 - totalPakai : 0
    };
}

// ---------- Jadwal pekerjaan ----------
const dayNum = s => Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
function lastProg(tid) {
    let r = null;
    (S.tprog || []).forEach(p => { if (p.tid == tid && (!r || p.ts > r.ts)) r = p; });
    return r;
}
function taskStatus(t, today) {
    const p = lastProg(t.id), a = p ? p.pct : 0, d0 = dayNum(t.mulai), d1 = dayNum(t.selesai), dn = dayNum(today || todayStr());
    const plan = dn <= d0 ? 0 : dn >= d1 ? 100 : (dn - d0) / (d1 - d0) * 100;
    let s, cls;
    if (a >= 100) { const late = p.aSelesai && dayNum(p.aSelesai) > d1; s = late ? "Selesai terlambat" : "Selesai"; cls = late ? "wa" : "ok"; }
    else if (dn < d0) { s = "Belum mulai"; cls = "mu"; }
    else if (dn > d1) { s = "Lewat target " + (dn - d1) + " hari"; cls = "bad"; }
    else if (plan - a > 20) { s = "Terlambat"; cls = "bad"; }
    else if (plan - a > 5) { s = "Terlambat ringan"; cls = "wa"; }
    else { s = "Sesuai jadwal"; cls = "ok"; }
    return { s, cls, plan, aktual: a, p };
}
const tasksLate = today => (S.tasks || []).filter(t => { const x = taskStatus(t, today); return x.cls == "bad" || x.s == "Terlambat ringan"; }).length;

// ---------- Daftar tindakan untuk owner ----------
function todo(m) {
    const t = [], n = m.n;
    const st = Array.from({ length: n }, (_, i) => dayStatus(i + 1).s);
    const wait = st.filter(s => s == "dikirim" || s == "dikirim_ulang").length;
    if (wait) t.push(["wa", wait + " laporan harian menunggu persetujuan.", "a"]);
    const rev = st.filter(s => s == "revisi" || s == "ditolak").length;
    if (rev) t.push(["wa", rev + " laporan menunggu koreksi dari supervisor.", "a"]);
    if (needOpname()) t.push(["bad", "Opname sudah jatuh tempo. Supervisor tidak bisa menyimpan laporan berikutnya.", "o"]);
    const lt = lastTgl();
    if (n && lt && lt < todayStr() && m.pr < 100) t.push(["wa", "Belum ada laporan untuk hari ini (laporan terakhir: " + lt + ").", "d"]);
    if (n && (m.lv == "bad" || m.lv == "wa")) t.push([m.lv, "Status jadwal: " + m.tx + ".", "d"]);
    const f = finSummary(m);
    if (f.ang && f.pakai >= 90) t.push(["bad", "Biaya terpakai " + Math.round(f.pakai) + "% dari anggaran.", "k"]);
    else if (f.ang && f.selisih > 10) t.push(["wa", "Biaya terpakai lebih cepat dari kemajuan pekerjaan (selisih " + Math.round(f.selisih) + " poin).", "k"]);
    const mt = matAlerts();
    if (mt.length) t.push([mt.some(x => x[0] == "bad") ? "bad" : "wa", mt.length + " peringatan material (stok atau kebutuhan RAB).", "m"]);
    const tl = tasksLate();
    if (tl) t.push(["wa", tl + " pekerjaan terlambat dari jadwal.", "j"]);
    const uv = (S.fin || []).filter(f => !f.verif).length;
    if (uv) t.push(["wa", uv + " catatan biaya dari supervisor menunggu verifikasi.", "k"]);
    const fl = n >= 3 ? flags(m) : [];
    if (fl.length) t.push(["wa", fl.length + " indikasi kejanggalan data perlu diperiksa.", "d"]);
    return t;
}
