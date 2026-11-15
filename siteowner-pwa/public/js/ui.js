// Tampilan, formulir, dan peran (Owner/Supervisor)
function chart(m) {
    const w=640,h=250,L=38,T=14,B=26,pw=w-L-12,ph=h-T-B;
    let xm=Math.max(S.dur,m.n);
    if(m.rata>0&&m.pr<100)xm=Math.min(Math.max(xm,m.n+Math.ceil(m.sisa/m.rata)),S.dur+20);
    const lo=Math.max(0,Math.floor((S.awal-3)/5)*5),X=d=>L+d/xm*pw,Y=p=>T+(1-(p-lo)/(100-lo))*ph;
    let g="";
    for(let p=lo;p<=100;p+=5)g+=`<line x1="${L}" x2="${w-12}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--bd)"/><text x="${L-5}" y="${Y(p)+4}" font-size="10" text-anchor="end" fill="var(--mu)">${p}</text>`;
    for(let d=0;d<=xm;d+=Math.ceil(xm/10))g+=`<text x="${X(d)}" y="${h-8}" font-size="10" text-anchor="middle" fill="var(--mu)">${d}</text>`;
    const pts=[[0,S.awal],...m.cs.map((c,i)=>[i+1,i==m.n-1?m.pr:c.prog])].map(p=>X(p[0])+","+Y(p[1])).join(" ");
    let pj="";
    if(m.rata>0&&m.pr<100) {
        const e=Math.min(xm,m.n+m.sisa/m.rata);
        pj=`<line x1="${X(m.n)}" y1="${Y(m.pr)}" x2="${X(e)}" y2="${Y(Math.min(100,m.pr+m.rata*(e-m.n)))}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="2 4"/>`
    }
    return`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Kurva S rencana dan aktual">${g}
<line x1="${X(S.dur)}" x2="${X(S.dur)}" y1="${T}" y2="${T+ph}" stroke="var(--wa)" stroke-dasharray="4 3"/><text x="${X(S.dur)-4}" y="${T+ph-6}" font-size="10" text-anchor="end" fill="var(--wa)">Deadline</text>
<polyline points="${Array.from({length:S.dur+1},(_,d)=>X(d)+","+Y(planAt(d))).join(" ")}" fill="none" stroke="var(--mu)" stroke-width="2" stroke-dasharray="6 4"/>
<polyline points="${pts}" fill="none" stroke="var(--ac)" stroke-width="3"/>${pj}</svg>
<div class="leg">Garis putus abu-abu: rencana. Garis oranye: aktual. Titik-titik merah: proyeksi. Sumbu X: hari kerja, sumbu Y: progres fisik (%).</div>`
}

function render() {
    const m=M();
    $("#jd").textContent=S.nama||"SiteOwner";
    const n=m.n,al=alerts(m),fl=flags(m),rk=rank(m);
    if(role=="owner")$("#t-d").innerHTML=`<div class="ban ${m.lv}">${m.tx}<small>Hari ke-${n} dari ${S.dur} hari kontrak. Deviasi terhadap rencana: ${m.dev>=0?"+":""}${F(m.dev)}%${m.lop?"<br>Opname lapangan hari ke-"+m.lop.d+": "+F(m.lop.v)+"% oleh "+esc(m.lop.by||"-")+" (hitungan sistem: "+F(m.prSys)+"%). Dashboard memakai hasil opname sebagai acuan.":""}</small></div>
<div class="grid"><div class="k"><b>${F(m.pr)}%</b><span>Progres aktual</span></div><div class="k"><b>${F(m.ren)}%</b><span>Progres rencana</span></div>
<div class="k"><b>${m.est===null?"–":m.est+" hari"}</b><span>Estimasi sisa waktu (sisa kontrak ${Math.max(0,m.sk)})</span></div>
<div class="k"><b>${n?m.last.fit+"/"+W.length:"–"}</b><span>Pekerja fit hari ini</span></div>
<div class="k"><b>${Rp(m.up)}</b><span>Upah kumulatif (anggaran ${Rp(m.bud)})</span></div><div class="k"><b>${m.ap}</b><span>Pelanggaran APD</span></div></div>
${tindakanHTML(m)}
${rabHTML(m)}
<div class="card"><h2>Kurva S Proyek</h2><div class="sc">${chart(m)}</div></div>
${n?`<div class="card"><h2>Rincian Upah Hari ke-${n}</h2><div class="tw"><table><tr><th>Pekerja</th><th>Status</th><th>Pokok</th><th>Lembur</th><th>Bonus</th><th>Potongan</th><th>Total</th><th>Dibanding upah normal</th><th>Catatan</th></tr>${m.last.o.map((o,i)=>{const d=o.up-STD;return`<tr><td>${esc(W[i][0])}</td><td>${o.ket||ST[o.st]}</td><td>${Rp(o.pk)}</td><td>${Rp(o.lm)}</td><td>${Rp(o.bn)}</td><td>${Rp(o.pt)}</td><td><b>${Rp(o.up)}</b></td><td style="color:var(--${d>0?"ok":d<0?"bad":"mu"})">${d>0?"Naik "+Rp(d):d<0?"Turun "+Rp(-d):"Normal"}</td><td>${esc((S.days[n-1][i]||{}).n||"")}</td></tr>`}).join("")}</table></div><div class="sub">Upah normal ${Rp(STD)} per hari. Total hari ini ${Rp(m.last.up)}.</div></div>`:""}
${kpiHTML(m)}
<div class="card"><h2>Peringatan &amp; Rekomendasi</h2>${al.map(a=>`<div class="al ${a[0]}">${esc(a[1])}</div>`).join("")}</div>
<div class="card"><h2>Indikasi Kejanggalan Data ${fl.length?"("+fl.length+")":""}</h2>${fl.length?fl.map(a=>`<div class="al ${a[0]}">${esc(a[1])}</div>`).join(""):`<div class="al ok">Tidak ada pola janggal terdeteksi. Pendeteksi penuh aktif setelah 3 hari data.</div>`}</div>
<div class="card"><h2>Ranking Kinerja Pekerja</h2><div class="tw"><table><tr><th>#</th><th>Nama</th><th>Zona</th><th>Rata-rata KPI</th><th>Hari kerja</th><th>Tidak layak</th></tr>
${rk.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.n)}</td><td>${esc(r.z)}</td><td>${r.c?F(r.k):"–"}</td><td>${r.c}</td><td>${r.v}</td></tr>`).join("")}</table></div></div>
${quickHTML()}
<div class="card" id="ig"><h2>Integritas Data</h2><div class="sub">Memeriksa…</div></div>
<div class="card"><h2>Jejak Audit Input</h2><div class="tw"><table><tr><th>Hari</th><th>Waktu input</th><th>Pengisi</th><th>Upah hari itu</th><th>Opname</th><th>Foto</th></tr>${m.cs.map((c,i)=>`<tr><td>${i+1}</td><td>${esc((S.meta[i]||{}).ts||"-")}</td><td>${esc((S.meta[i]||{}).by||"-")}</td><td>${Rp(c.up)}</td><td>${(o=>o?F(o.v)+"% oleh "+esc(o.by||"-"):"")(S.op.find(p=>p.d==i+1))}</td><td>${((S.meta[i]||{}).photos||[]).filter(id=>/^[0-9a-f]{32}$/.test(id)).map(id=>`<a href="/api/photo/${id}" target="_blank"><img src="/api/photo/${id}" alt="foto bukti" style="width:40px;height:40px;object-fit:cover;border-radius:6px"></a>`).join(" ")}</td></tr>`).join("")}</table></div><div class="sub">Hari yang sudah disimpan terkunci. Tidak ada fitur ubah atau hapus data lama.</div></div>`;
    $("#hk").textContent="Hari ke-"+(n+1)+((n+1)-(S.op.slice(-1)[0]||{d:0}).d>=OPI?" – MENUNGGU OPNAME OWNER/QC":"");
    if(role=="owner")$("#rp").value=report(m,al.concat(fl));
    $("#sn").value=S.nama;
    $("#sd").value=S.dur;
    $("#sa").value=S.awal
}

// Kapan setiap isian ditampilkan (supaya yang tidak relevan tersembunyi)
const FIELDS = {
    h: r => true,
    s: r => r.h == 1,
    sd: r => r.h == 1 && r.s == 0,
    a: r => r.h == 1 && r.s != 0,
    ar: r => r.h == 1 && r.s != 0 && r.a == 0,
    v: r => r.h == 1 && r.s != 0 && r.a != 0,
    t: r => r.h == 1 && r.s != 0 && r.a != 0,
    d: r => r.h == 1 && r.s != 0 && r.a != 0,
    l: r => r.h == 1 && r.s != 0 && r.a != 0,
    nt: r => true
};
const pilih = k => OP[k].map((t, v) => `<option value="${v}">${t}</option>`).reverse().join("");
let dirty = false;

function rf() {
    return [...document.querySelectorAll("#ft .wk")].map(card => {
        const val = c => card.querySelector("." + c).value;
        const num = c => +val(c);
        const opt = c => val(c) === "" ? undefined : num(c);
        const n = val("nt").trim().slice(0, 80);
        if (num("h") == 0) return { h: 0, n };
        return { h: 1, s: num("s"), a: num("a"), v: Math.max(0, num("v") || 0), t: num("t"), d: num("d"),
                 l: num("l"), sd: opt("sd"), ar: opt("ar"), n };
    });
}

function prev() {
    const rows = rf(), res = calc(rows);
    document.querySelectorAll("#ft .wk").forEach((card, i) => {
        const r = rows[i], o = res.o[i], d = o.up - STD;
        card.querySelectorAll("[data-f]").forEach(l => l.hidden = !FIELDS[l.dataset.f](r));
        card.querySelector(".up").innerHTML = `<b>${Rp(o.up)}</b> <span style="color:var(--${d > 0 ? "ok" : d < 0 ? "bad" : "mu"})">${d > 0 ? "naik " + Rp(d) : d < 0 ? "turun " + Rp(-d) : "normal"}</span>`;
    });
}

function form() {
    dirty = false;
    const opsi = (v, t) => `<option value="${v}">${t}</option>`;
    $("#ft").innerHTML = W.map((w, i) => `
      <div class="wk" data-i="${i}">
        <div class="wh"><div><b>${esc(w[0])}</b> <span class="sub">${esc(w[1])}</span></div><div class="up"></div></div>
        <div class="g">
          <label data-f="h">Kehadiran<select class="h">${opsi(1, "Hadir")}${opsi(0, "Absen / izin")}</select></label>
          <label data-f="s">Kondisi kesehatan<select class="s">${pilih("s")}</select></label>
          <label data-f="sd">Surat dokter<select class="sd">${opsi("", "Pilih…")}${opsi(1, "Ada surat dokter")}${opsi(0, "Tanpa surat dokter")}</select></label>
          <label data-f="a">APD<select class="a">${pilih("a")}</select></label>
          <label data-f="ar">Alasan APD tidak lengkap<select class="ar">${opsi("", "Pilih…")}${opsi(1, "APD tidak disediakan / rusak")}${opsi(0, "Menolak memakai APD")}</select></label>
          <label data-f="v">Volume hasil (${esc(w[2])}), target ${esc(w[3])}<input class="v" type="number" inputmode="decimal" min="0" step="0.1" placeholder="isi angka"></label>
          <label data-f="t">Ketelitian<select class="t">${pilih("t")}</select></label>
          <label data-f="d">Kepatuhan K3<select class="d">${pilih("d")}</select></label>
          <label data-f="l">Durasi lembur<select class="l">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => opsi(v * 30, LB(v * 30))).join("")}</select></label>
          <label data-f="nt">Catatan / keberatan pekerja<input class="nt" maxlength="80" placeholder="opsional"></label>
        </div>
        <div class="er-msg" hidden></div>
      </div>`).join("");
    prev();
}

function check(rows) {
    const cards = document.querySelectorAll("#ft .wk");
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.h == 1 && r.s == 0 && r.sd === undefined) return { i, msg: "Pilih ada atau tidaknya surat dokter." };
        if (r.h == 1 && r.s != 0 && r.a == 0 && r.ar === undefined) return { i, msg: "Pilih alasan APD tidak lengkap." };
        if (r.h == 1 && r.s != 0 && r.a != 0 && cards[i].querySelector(".v").value === "") return { i, msg: "Isi volume hasil pekerja ini (angka, boleh 0)." };
    }
    return null;
}

function clearErr() {
    document.querySelectorAll("#ft .wk").forEach(c => { c.classList.remove("er"); c.querySelector(".er-msg").hidden = true; });
}

function showErr(er) {
    clearErr();
    const card = document.querySelectorAll("#ft .wk")[er.i];
    card.classList.add("er");
    const m = card.querySelector(".er-msg");
    m.textContent = er.msg;
    m.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    msg("Periksa " + W[er.i][0] + ": " + er.msg);
}

let CORR = 0; // nomor hari yang sedang dikoreksi (0 = input hari baru)

function fillForm(rows) {
    document.querySelectorAll("#ft .wk").forEach((card, i) => {
        const r = rows[i] || { h: 0 }, set = (c, v) => { if (v !== undefined) card.querySelector("." + c).value = v; };
        set("h", r.h);
        if (r.h == 1) { set("s", r.s); set("a", r.a); set("v", r.v); set("t", r.t); set("d", r.d); set("l", r.l); set("sd", r.sd); set("ar", r.ar); }
        set("nt", r.n || "");
    });
    prev();
}

function startCorr(n) {
    CORR = n;
    dirty = true;
    fillForm(S.days[n - 1]);
    $("#cb").hidden = false;
    $("#cb").textContent = "Mode koreksi hari ke-" + n + ": perbaiki isian, isi alasan koreksi, lalu kirim. Laporan asli tetap tersimpan sebagai riwayat.";
    $("#all").hidden = false;
    $("#tgl").hidden = true;
    $("#sv").textContent = "Kirim koreksi";
    window.scrollTo(0, 0);
}

function endCorr() {
    CORR = 0;
    $("#cb").hidden = true;
    $("#all").hidden = true;
    $("#tgl").hidden = false;
    $("#sv").textContent = "Hitung & Simpan Hari Ini";
}

function histUI() {
    const n = S.days.length, from = Math.max(1, n - 7);
    let h = "";
    for (let i = n; i >= from; i--) {
        const s = dayStatus(i), mt = S.meta[i - 1] || {};
        const btn = (s.s == "revisi" || s.s == "ditolak") ? `<button class="btn g" data-kr="${i}" style="padding:4px 10px">Koreksi</button>` : "";
        h += `<tr><td>${i}</td><td>${esc(mt.tgl || "-")}</td><td><span class="chip ${s.s}">${STATUS_TXT[s.s]}</span>${s.note ? `<div class="sub">Catatan owner: ${esc(s.note)}</div>` : ""}</td><td>${btn}</td></tr>`;
    }
    $("#hs").innerHTML = n ? `<div class="card"><h2>Riwayat pengiriman</h2><div class="tw"><table><tr><th>Hari</th><th>Tanggal</th><th>Status</th><th></th></tr>${h}</table></div><div class="sub">Laporan yang diminta revisi atau ditolak dapat dikoreksi. Koreksi disimpan sebagai versi baru; laporan asli tidak berubah.</div></div>` : "";
}
$("#hs").addEventListener("click", e => { const b = e.target.closest("[data-kr]"); if (b) startCorr(+b.dataset.kr); });

$("#sv").onclick = async () => {
    const btn = $("#sv");
    clearErr();
    const by = $("#by").value.trim();
    if (!by) { msg("Isi nama pengisi dulu agar tercatat di jejak audit."); $("#by").focus(); return; }
    const rows = rf(), er = check(rows) || rangeError(rows);
    if (er) { showErr(er); return; }
    let alasan = "", tgl = "";
    if (CORR) {
        alasan = $("#al").value.trim();
        if (alasan.length < 5) { msg("Isi alasan koreksi (minimal 5 huruf)."); $("#al").focus(); return; }
    } else {
        if (M().prSys >= 100) { msg("Proyek sudah 100%."); return; }
        tgl = $("#tg").value;
        const de = dateError(tgl, lastTgl());
        if (de) { msg(de); $("#tg").focus(); return; }
        if (needOpname()) { msg("Opname lapangan belum dilakukan (wajib tiap " + OPI + " hari kerja). Minta owner atau QC mengisi opname dulu."); return; }
    }
    const was = CORR, n = CORR || S.days.length + 1, total = calc(rows).up;
    btn.disabled = true;
    msg("Menyimpan…");
    try {
        if (was) await apiCommitCorr(was, rows, by, alasan);
        else await apiCommitDay(rows, by, tgl, [...$("#ph").files]);
        $("#ph").value = "";
        $("#al").value = "";
        endCorr();
        form();
        render();
        histUI();
        msg((was ? "Koreksi hari ke-" + n + " terkirim" : "Hari ke-" + n + " tersimpan") + ". Total upah hari itu: " + Rp(total) + ".");
        window.scrollTo(0, 0);
    } catch (e) {
        msg("Gagal menyimpan: " + ((e && e.message) || e));
    } finally {
        btn.disabled = false;
    }
};

document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=> {
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x==b));
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t.id=="t-"+b.dataset.t))
});
$("#cp").onclick=()=> {
    const t=$("#rp");
    t.select();
    let ok=false;
    try {
        ok=document.execCommand("copy")
    } catch(e) {
    }
    $("#cm").textContent=ok?"Tersalin. Tempel ke WhatsApp.":"Teks sudah terpilih, salin manual (Ctrl+C)."
};
[["#sn",v=>S.nama=v],["#sd",v=>S.dur=Math.max(1,+v||1)],["#sa",v=>S.awal=Math.min(99,Math.max(0,+v||0))]].forEach(([id,f])=>$(id).onchange=e=> {
    f(e.target.value);
    save();
    render()
});
const RNG = { std:[0,1e7], lem:[0,1e7], bon:[0,1e7], pen:[0,1e7], pap:[0,1e7], psd:[0,100], pst:[0,100], pas:[0,100], pam:[0,100], al:[0,100], ab:[0,100], lm1:[0,5], lm2:[0,5], opi:[1,30], vmax:[1.5,20] };
function clampCfg(k, v) {
    const [lo, hi] = RNG[k] || [0, 1e9], x = Math.min(hi, Math.max(lo, v));
    if (x !== v) toast("Nilai dibatasi ke rentang " + lo + " sampai " + hi + ".");
    return x;
}
const CF=[["std","Upah pokok per hari (Rp)",1],["lem","Upah lembur per jam (Rp)",1],["bon","Bonus insentif (Rp)",1],["pen","Penalti KPI rendah (Rp)",1],["pap","Potongan APD sebagian (Rp)",1],["psd","Upah sakit dengan surat dokter (%)",100],["pst","Upah sakit tanpa surat dokter (%)",100],["pas","Upah jika APD tidak disediakan/rusak (%)",100],["pam","Upah jika menolak memakai APD (%)",100],["al","Hasil minimal agar lembur dibayar (% target)",100],["ab","Hasil minimal agar dapat bonus (% target)",100],["lm1","Pengali lembur jam pertama (kali)",1],["lm2","Pengali lembur jam berikutnya (kali)",1],["opi","Jeda opname (hari kerja)",1],["vmax","Batas volume wajar (kali target)",1]];

function cfgui0() {
    const g=k=>({std:STD,lem:LEM,bon:BON,pen:PEN,pap:PAP,psd:PSD,pst:PST,pas:PAS,pam:PAM,al:AL,ab:AB,lm1:LM1,lm2:LM2,opi:OPI,vmax:VMAX})[k];
    $("#cf").innerHTML=`<h2 id="sec-pekerja">Pekerja &amp; target volume</h2><div class="tw"><table><tr><th>Nama</th><th>Zona kerja</th><th>Satuan</th><th>Target per hari</th></tr>${W.map((w,i)=>`<tr>${[0,1,2,3].map(k=>`<td><input data-w="${i},${k}" value="${esc(w[k])}" ${k==3?'type="number" min="0.1" step="0.1" style="width:90px"':'style="width:130px"'}></td>`).join("")}</tr>`).join("")}</table></div><div class="row" style="margin-top:8px"><button class="btn g" id="aw">+ Tambah pekerja</button></div><div class="sub" style="margin-bottom:12px">Pekerja tidak bisa dihapus agar riwayat tetap utuh. Sesuaikan target dengan AHSP atau RAB proyek.</div><h2 id="sec-upah">Aturan upah &amp; ambang</h2><div class="row">${CF.map(c=>`<label>${c[1]}<input data-c="${c[0]}" type="number" step="any" value="${Math.round(g(c[0])*c[2]*100)/100}" style="width:120px"></label>`).join("")}</div><div class="sub">Nilai awal adalah asumsi, bukan ketentuan hukum. Sakit dengan surat dokter pada umumnya tetap berhak upah (UU Ketenagakerjaan Pasal 93), dan APD wajib disediakan pengusaha tanpa biaya (Permenaker 8/2010). Pengali lembur bernilai awal 1 (tarif datar); aturan lembur resmi umumnya memakai pengali lebih besar (misalnya 1,5 untuk jam pertama dan 2 untuk jam berikutnya pada hari kerja), jadi periksa ketentuan yang berlaku. Sesuaikan dengan kontrak kerja dan peraturan perusahaan. Riwayat perubahan pengaturan:</div>${S.log.slice(-5).map(x=>`<div class="sub">- ${esc(logText(x))}</div>`).join("")||'<div class="sub">- belum ada</div>'}<br>`
}
$("#cf").addEventListener("change",e=> {
    const t=e.target;
    if(!t.dataset.w&&!t.dataset.c) return; // abaikan isian lain (PIN, rencana) agar tidak memuat ulang halaman
    const L=logAdd;
    if(t.dataset.w) {
        const[i,k]=t.dataset.w.split(",").map(Number),v=k==3?Math.max(.1,+t.value||1):(t.value.trim()||W[i][k]);
        L(W[i][0]+": "+["nama","zona","satuan","target"][k]+" diubah ke "+v);
        S.W[i][k]=v
    } else if(t.dataset.c) {
        const c=CF.find(x=>x[0]==t.dataset.c);
        S.cfg[c[0]]=clampCfg(c[0],+t.value||0)/c[2];
        L(c[1]+" diubah ke "+t.value)
    }
    save();
    lc();
    cfgui();
    form();
    render()
});
$("#cf").addEventListener("click",e=> {
    if(e.target.id=="aw"&&S.W.length<8) {
        S.W.push(["Pekerja "+(S.W.length+1),"Zona baru","m\u00b2",10]);
        logAdd("pekerja ditambahkan");
        save();
        lc();
        cfgui();
        form();
        render()
    }
});
const msg = t => { $("#sm").textContent = t };

const editing = sel => $(sel).contains(document.activeElement);

function cfgui() {
    cfgui0();
    $("#cf").insertAdjacentHTML("beforeend", rabEdHTML() + matmEdHTML() + taskEdHTML() + planHTML() + secHTML() + cadHTML());
}
$("#cf").addEventListener("click", async e => {
    if (e.target.id == "cpo") await changeOwnerPin();
    if (e.target.id == "cps") await resetSupPin();
    if (e.target.id == "spl") savePlan();
});

function enter(r) {
    role = r;
    $("#gate").style.display = "none";
    $("#app").style.display = "block";
    document.querySelectorAll(".tabs button").forEach(b => b.style.display = (b.dataset.r == r || b.dataset.r == "all") ? "" : "none");
    $("#who").textContent = "Masuk sebagai: " + RL[r] + " (data tersinkron dengan server)";
    $("#lo").style.display = "";
    idleReset();
    helpui();
    form();
    $("#tg").value = todayStr();
    endCorr();
    histUI();
    matUI();
    jadUI();
    if (r == "sup") byaUI();
    if (r == "owner") { cfgui(); opui(); apprUI(); finUI(); anaUI(); logUI(); }
    render();
    if (r == "owner") verifyNow();
    $("#sm").textContent = "";
    document.querySelector(".tabs button[data-r='" + r + "']").click();
}

function refresh() {
    if (!role) return;
    render();
    if (role == "owner") {
        if (!editing("#cf")) cfgui();
        if (!editing("#t-o")) opui();
        if (!editing("#t-a")) apprUI();
        if (!editing("#t-k")) finUI();
        if (!editing("#t-n")) anaUI();
        logUI();
        matUI();
        jadUI();
        verifyNow();
    } else {
        histUI();
        if (!editing("#t-m")) matUI();
        if (!editing("#t-j")) jadUI();
        if (!editing("#t-y")) byaUI();
        if (!dirty) form();
    }
}

function helpui() {
    const H = [
        ["Apa itu opname?", "Opname adalah pengecekan langsung di lapangan oleh pihak independen (QC, pengawas, atau owner) untuk mengukur berapa persen pekerjaan yang benar-benar sudah terpasang, lalu dibandingkan dengan gambar kerja dan RAB. Contoh: setelah 5 hari, QC mengukur dan menyatakan progres 72%, sedangkan hitungan aplikasi 75%. Aplikasi memakai 72% sebagai acuan dan menandai selisihnya. Opname juga menyegel data harian (lihat Integritas data)."],
        ["Progres sistem dan progres opname", "Progres sistem adalah perkiraan dari kehadiran, KPI, dan lembur. Progres opname adalah hasil ukur nyata. Setelah ada opname, progres dihitung dari angka opname ditambah kemajuan sesudahnya. Opname wajib diisi tiap beberapa hari kerja (nilai awal 5, bisa diatur owner); sebelum itu supervisor tidak bisa menyimpan hari berikutnya."],
        ["Bagaimana KPI dan upah dihitung?", "Kecepatan dinilai otomatis dari rasio volume hasil terhadap target (bukan skor subjektif). Ketelitian dan kepatuhan K3 dipilih dari kategori. KPI = (kecepatan + ketelitian + K3) dibagi 15, dikali 100. Bonus untuk KPI tinggi, penalti untuk KPI rendah, lembur hanya dibayar jika hasil mencapai ambang dan pekerja sehat. Semua angka bisa diatur owner di Pengaturan."],
        ["Surat dokter dan alasan APD", "Pekerja sakit dilarang bekerja. Supervisor memilih apakah ada surat dokter; besar upah mengikuti pengaturan owner (nilai awal: dengan surat dokter 100%, tanpa surat dokter 50%). APD tidak lengkap juga membuat pekerja dilarang bekerja. Jika APD tidak disediakan atau rusak, itu tanggung jawab proyek dan bukan pelanggaran pekerja; jika pekerja menolak memakai, upah mengikuti pengaturan. Nilai awal ini asumsi, bukan ketentuan hukum."],
        ["Kurva S dan deviasi", "Kurva S membandingkan progres rencana (garis lurus, kurva S standar, atau titik kustom sesuai time schedule, sampai 100% pada akhir kontrak) dengan progres aktual. Deviasi adalah selisihnya. Status: lebih cepat, sesuai jadwal, potensi terlambat, atau kritis."],
        ["Integritas data (segel)", "Setiap hari yang disimpan diberi sidik digital (SHA-256) yang tersambung ke hari sebelumnya. Saat opname, sidik hari terakhir disegel oleh owner. Jika ada yang mengubah data lama, sidiknya tidak cocok lagi dan dashboard owner menandainya."],
        ["Server dan sinkronisasi", "Semua data disimpan di server proyek (basis data SQLite). Owner dan Supervisor membuka alamat yang sama dari perangkat masing-masing dan melihat data yang sama; perubahan dari satu perangkat muncul di perangkat lain tanpa muat ulang. Aplikasi dapat dipasang di layar utama HP (PWA). Tanpa sambungan internet, tampilan terakhir tetap terbuka tetapi data tidak dapat disimpan sampai tersambung lagi."],
        ["RAB, biaya, dan keuntungan", "RAB (rencana anggaran biaya) diisi owner di Pengaturan: nilai kontrak dan daftar item per kategori (material, upah, peralatan, subkontraktor, pajak, perizinan dan biaya dinas, pengawas, konsultan, overhead, lain-lain). Item dihitung dari volume x harga, atau sebagai persen dari nilai kontrak (cocok untuk pajak). Realisasi diambil otomatis: upah dari laporan harian, material dari material masuk, dan biaya lain dari catatan yang diisi supervisor atau owner. Estimasi keuntungan saat ini = nilai kontrak x kemajuan pekerjaan - biaya terpakai. Proyeksi biaya akhir = biaya terpakai / kemajuan pekerjaan. Biaya terpakai menghitung material yang sudah dipakai (keluar), bukan yang baru dibeli. Semua angka bergantung pada data yang dimasukkan, jadi perlu diperiksa."],
        ["Material", "Owner menyiapkan daftar material (satuan, batas minimum, kebutuhan RAB, harga standar) di Pengaturan. Supervisor mencatat material masuk dan keluar. Stok = masuk - keluar. Aplikasi memperingatkan stok menipis, stok negatif, pemakaian melebihi kebutuhan RAB, dan material masuk yang jauh melebihi kebutuhan. Pembelian bahan dicatat di modul Material (bukan di Biaya) agar stok dan biaya sinkron."],
        ["Jadwal pekerjaan", "Owner mengisi pekerjaan beserta tanggal mulai dan target selesai di Pengaturan. Supervisor memperbarui persen selesai. Rencana hari ini dihitung linear antara tanggal mulai dan target; selisih dengan realisasi menentukan status: sesuai jadwal, terlambat ringan, terlambat, lewat target, atau selesai."],
        ["Laporan, ekspor, dan data anonim", "Tab Analisis membuat laporan harian, mingguan, bulanan, dan rekap akhir. PDF, CSV (Excel), dan teks laporan diunduh sebagai berkas. Opsi Anonimkan mengganti nama pekerja dan pengisi dengan kode saat mengekspor untuk keperluan penelitian."],
        ["Persetujuan dan koreksi laporan", "Setiap laporan harian yang dikirim supervisor berstatus Dikirim. Owner dapat menyetujui, meminta revisi, atau menolak (dengan catatan) di tab Persetujuan. Laporan yang diminta revisi atau ditolak dapat dikoreksi supervisor lewat tombol Koreksi di Riwayat pengiriman; koreksi wajib beralasan dan disimpan sebagai versi baru, sedangkan laporan asli tidak pernah dihapus atau diubah. Setelah dikoreksi, laporan kembali berstatus Dikirim ulang untuk diputuskan lagi. Upah yang dihitung final adalah upah pada laporan yang disetujui."],
        ["Keuangan", "Tab Keuangan memuat anggaran periode (untuk sisa pekerjaan dari progres awal sampai 100%), upah otomatis dari laporan harian (dipisah disetujui dan menunggu), serta pengeluaran lain (material, operasional, subkontraktor, lainnya) yang dicatat owner. Pengeluaran tidak dihapus; koreksi dilakukan dengan entri bernilai negatif beserta keterangan. Aplikasi membandingkan persentase biaya terpakai dengan kemajuan pekerjaan sebagai peringatan dini."],
        ["Analisis dan ekspor data", "Tab Analisis menampilkan tren progres, upah, KPI, dan kehadiran untuk rentang hari yang dipilih, serta ringkasan periode. Data dapat diekspor sebagai CSV (rekap harian, per pekerja, opname, dan biaya) untuk dibuka di Excel atau Google Sheets. Kamus data di halaman yang sama menjelaskan arti tiap kolom."],
        ["Opname rinci", "Selain progres keseluruhan, opname dapat memuat daftar item pekerjaan: nama, lokasi, satuan, volume rencana, volume terpasang, dan bobot. Jika total bobot 100%, aplikasi menghitung progres tertimbang secara otomatis. Tanggal dan pemeriksa tercatat."],
        ["Login dan PIN", "Setiap peran punya PIN sendiri (4 sampai 8 angka, disimpan sebagai hash berulang dengan garam, bukan teks asli). PIN Owner dan PIN Supervisor harus berbeda, sehingga supervisor tidak dapat masuk sebagai Owner. Setelah 5 kali salah, login dikunci 30 detik. Sesi berakhir otomatis setelah 10 menit tidak aktif. PIN diperiksa di server (disimpan sebagai hash scrypt dengan garam), sehingga PIN Owner tidak pernah dikirim ke perangkat Supervisor. Lupa PIN Owner: administrator server menjalankan perintah reset PIN (lihat README); data proyek tidak terhapus."],
        ["Siapa bisa melihat apa?", "Owner melihat dashboard, kejanggalan, biaya, opname, laporan, dan pengaturan. Supervisor hanya mengisi audit harian. Tampilan supervisor tidak memuat dashboard owner. Pembatasan ini dijaga server: Supervisor tidak dapat menulis data milik Owner (persetujuan, opname, pengaturan, RAB) dan tidak menerima nilai kontrak maupun RAB. Supervisor tetap dapat melihat data operasional proyek (laporan, material, jadwal, biaya yang dicatat)."]
    ];
    $("#t-b").innerHTML = `<div class="card"><h2>Bantuan</h2>${H.map(h => `<details style="margin-bottom:8px"><summary><b>${h[0]}</b></summary><p style="margin:6px 0 4px;font-size:14px">${h[1]}</p></details>`).join("")}</div>`;
}

function itemRow(it) {
    it = it || {};
    const num = v => v === undefined || v === null ? "" : v;
    return `<tr class="ir"><td><input class="i-nm" value="${esc(it.nm || "")}" placeholder="Pekerjaan" style="width:120px"></td><td><input class="i-lok" value="${esc(it.lok || "")}" placeholder="Lokasi" style="width:84px"></td><td><input class="i-sat" value="${esc(it.sat || "")}" placeholder="m²" style="width:48px"></td><td><input class="i-vr" type="number" step="any" min="0" value="${num(it.vr)}" style="width:72px"></td><td><input class="i-vt" type="number" step="any" min="0" value="${num(it.vt)}" style="width:72px"></td><td><input class="i-bw" type="number" step="any" min="0" value="${num(it.bobot)}" style="width:56px"></td><td><button class="btn g" data-rm="1" style="padding:3px 9px">×</button></td></tr>`;
}

function readItems() {
    return [...document.querySelectorAll("#oi .ir")].map(r => ({
        nm: r.querySelector(".i-nm").value.trim(), lok: r.querySelector(".i-lok").value.trim(), sat: r.querySelector(".i-sat").value.trim(),
        vr: +r.querySelector(".i-vr").value, vt: +r.querySelector(".i-vt").value, bobot: +r.querySelector(".i-bw").value
    }));
}

function opui() {
    const lo = S.op.slice(-1)[0] || { d: 0 }, due = needOpname();
    const hist = S.op.map(o => `<tr><td>${o.d}</td><td>${esc(o.tgl || "-")}</td><td>${F(o.v)}%</td><td>${esc(o.by || "-")}</td><td>${(o.items || []).length ? `<details><summary>${o.items.length} item</summary>${o.items.map(it => esc(it.nm) + " (" + esc(it.lok || "-") + "): " + it.vt + "/" + it.vr + " " + esc(it.sat || "") + ", bobot " + it.bobot + "%").join("<br>")}</details>` : "-"}</td></tr>`).join("");
    $("#t-o").innerHTML = `<div class="card"><h2>Opname Lapangan (QC / Owner)</h2>
      <details style="margin-bottom:8px"><summary><b>Apa itu opname?</b></summary><p class="sub" style="font-size:14px;color:var(--tx)">Pengecekan langsung progres fisik di lapangan oleh pihak independen. Hasilnya menjadi acuan progres dan menyegel data harian sampai hari itu.</p></details>
      <div class="al ${due ? "bad" : "ok"}">${due ? "Opname sudah jatuh tempo. Supervisor tidak bisa menyimpan hari berikutnya sebelum opname diisi." : "Opname terakhir setelah hari ke-" + lo.d + ". Berikutnya wajib sebelum hari ke-" + (lo.d + OPI) + "."}</div>
      <div class="row"><label>Tanggal opname<input id="otg" type="date" value="${todayStr()}"></label><label>Progres fisik hasil cek langsung (%)<input id="ov" type="number" min="0" max="100" step="0.1" style="width:150px"></label><label>Diperiksa oleh<input id="op" style="width:170px"></label></div>
      <details open style="margin:8px 0"><summary><b>Rincian per item pekerjaan</b> (opsional, disarankan)</summary>
        <div class="tw"><table><tr><th>Pekerjaan</th><th>Lokasi</th><th>Sat.</th><th>Vol. rencana</th><th>Vol. terpasang</th><th>Bobot %</th><th></th></tr><tbody id="oi">${itemRow()}</tbody></table></div>
        <div class="row" style="margin-top:6px"><button class="btn g" id="oia">+ Tambah item</button><button class="btn g" id="oic">Hitung progres dari item</button></div>
        <div class="sub">Total bobot harus 100%. Progres item dihitung terpasang ÷ rencana (maksimal 100%), lalu ditimbang dengan bobot.</div></details>
      <div class="row"><button class="btn" id="so">Simpan Opname</button><button class="btn g" id="sg">Segel data sekarang</button></div>
      <div class="sub" id="om"></div>
      <h2 style="margin-top:12px">Riwayat Opname</h2>${S.op.length ? `<div class="tw"><table><tr><th>Setelah hari</th><th>Tanggal</th><th>Progres</th><th>Pemeriksa</th><th>Item</th></tr>${hist}</table></div>` : '<div class="sub">Belum ada opname.</div>'}</div>`;
    $("#so").onclick = async () => {
        const v = $("#ov").value, b = $("#op").value.trim(), tgl = $("#otg").value, m = $("#om");
        if (v === "" || !b) { m.textContent = "Isi progres dan nama pemeriksa."; return; }
        const de = dateError(tgl, null);
        if (de) { m.textContent = de.replace("kerja", "opname"); return; }
        let val = Math.min(100, Math.max(0, +v));
        const items = readItems().filter(i => i.nm || i.vr || i.vt || i.bobot);
        if (items.length) {
            const r = opnameFromItems(items);
            if (!r.ok) { m.textContent = r.err; return; }
            if (Math.abs(r.pct - val) > 0.5) { m.textContent = "Progres yang diisi tidak cocok dengan item (hitungan item: " + F(r.pct, 2) + "%). Klik Hitung progres dari item, atau kosongkan item."; return; }
        }
        try {
            await apiCommitOp(val, b, items, tgl);
            render();
            opui();
        } catch (e) { m.textContent = "Gagal menyimpan opname: " + ((e && e.message) || e); }
    };
}

$("#t-o").addEventListener("click", e => {
    if (e.target.id == "oia") $("#oi").insertAdjacentHTML("beforeend", itemRow());
    if (e.target.closest("[data-rm]")) { const r = e.target.closest(".ir"); if (document.querySelectorAll("#oi .ir").length > 1) r.remove(); }
    if (e.target.id == "oic") {
        const r = opnameFromItems(readItems());
        if (!r.ok) { $("#om").textContent = r.err; return; }
        $("#ov").value = r.pct;
        $("#om").textContent = "Progres tertimbang dari item: " + F(r.pct, 2) + "%.";
    }
});

function planHTML() {
    const pl = (S.plan || []).map(p => p[0] + "=" + p[1]).join(", "), sel = v => S.shape == v ? " selected" : "";
    const hist = (S.planHist || []).slice(-5).map((x, k) => `<div class="sub">- ${esc(new Date(x.ts).toLocaleDateString("id-ID"))}: ${esc(x.shape)}${x.plan.length ? " (" + esc(x.plan.map(p => p[0] + "=" + p[1]).join(", ")) + ")" : ""}, alasan: ${esc(x.alasan)}</div>`).join("");
    return `<div class="card" id="sec-plan"><h2>Rencana progres (Kurva S)</h2>
      <div class="row"><label>Bentuk rencana<select id="shp" style="max-width:240px"><option value="linear"${sel("linear")}>Garis lurus</option><option value="s"${sel("s")}>Kurva S standar</option><option value="custom"${sel("custom")}>Kustom (titik hari=persen)</option></select></label>
      <label>Titik kustom (hari=persen)<input id="plp" style="width:260px" placeholder="5=70, 10=82, 15=93" value="${esc(pl)}"></label>
      <label>Alasan perubahan<input id="pla" style="width:260px" placeholder="wajib jika sudah ada laporan"></label><button class="btn g" id="spl">Simpan rencana</button></div>
      <div class="sub">Kurva S standar landai di awal dan akhir, curam di tengah. Untuk rencana sesuai time schedule proyek, pilih Kustom dan isi titik progres kumulatif rencana. Setiap perubahan disimpan sebagai versi baru beserta alasannya agar perbandingan tetap dapat ditelusuri.</div>${hist ? '<div class="sub" style="margin-top:6px"><b>Riwayat versi rencana</b></div>' + hist : ""}<div class="er-msg" id="plm"></div></div>`;
}

function savePlan() {
    const shape = $("#shp").value, alasan = $("#pla").value.trim();
    let plan = [];
    if (shape == "custom") {
        const r = parsePlan($("#plp").value, S.dur);
        if (!r.ok) { $("#plm").textContent = r.err; return; }
        if (!r.plan.length) { $("#plm").textContent = "Isi minimal satu titik untuk rencana kustom."; return; }
        plan = r.plan;
    }
    if (S.days.length && alasan.length < 5) { $("#plm").textContent = "Isi alasan perubahan rencana (minimal 5 huruf) karena sudah ada laporan harian."; return; }
    S.shape = shape; S.plan = plan;
    S.planHist = S.planHist || [];
    S.planHist.push({ ts: new Date().toISOString(), shape, plan, alasan: alasan || "versi awal" });
    logAdd("rencana progres diubah ke " + shape + (alasan ? ": " + alasan : ""));
    save(); lc(); render(); cfgui();
}

$("#t-o").addEventListener("click", async e => {
    if (e.target.id != "sg") return;
    const b = $("#op").value.trim();
    if (!b) { $("#om").textContent = "Isi nama pemeriksa/penyegel dulu."; return; }
    try { await commitSeal(b); $("#om").textContent = "Data disegel sampai hari ke-" + S.days.length + "."; }
    catch (x) { $("#om").textContent = "Gagal menyegel: " + ((x && x.message) || x); }
});

const chip = s => `<span class="chip ${s}">${STATUS_TXT[s]}</span>`;
const cardH = (t, b) => `<div class="card"><h2>${t}</h2>${b}</div>`;
const TABN = { a: "Persetujuan", o: "Opname", k: "Keuangan", m: "Material", j: "Jadwal" };

// ---------- Persetujuan laporan (Owner) ----------
function apprUI() {
    const n = S.days.length;
    if (!n) { $("#t-a").innerHTML = cardH("Persetujuan Laporan Harian", '<div class="sub">Belum ada laporan.</div>'); return; }
    let cards = "";
    for (let i = n; i >= 1; i--) {
        const s = dayStatus(i), c = calc(S.days[i - 1]), mt = S.meta[i - 1] || {}, cr = (S.corr || []).filter(x => x.n == i);
        cards += `<div class="wk" data-day="${i}"><div class="wh"><div><b>Hari ke-${i}</b> <span class="sub">${esc(mt.tgl || "")} · ${esc(mt.by || "")}</span></div>${chip(s.s)}</div>
          <div class="sub">Bekerja ${c.fit}/${S.days[i - 1].length} · Upah ${Rp(c.up)} · Lembur dibayar ${F(c.lem)} jam${c.ap + c.ps ? " · APD bermasalah " + (c.ap + c.ps) : ""}${c.sk ? " · Sakit " + c.sk : ""}</div>
          ${cr.length ? `<div class="sub">Koreksi: ${cr.map(x => "v" + x.k + " oleh " + esc(x.by || "-") + " (" + esc(x.alasan) + ")").join("; ")}</div>` : ""}
          ${s.note ? `<div class="sub">Catatan owner: ${esc(s.note)}</div>` : ""}
          <div class="row" style="margin-top:6px"><label style="flex:1;min-width:180px">Catatan<input class="an" maxlength="120" placeholder="wajib untuk revisi atau tolak" style="width:100%"></label><button class="btn" data-ap="disetujui">Setujui</button><button class="btn g" data-ap="revisi">Minta revisi</button><button class="btn g" data-ap="ditolak">Tolak</button></div><div class="er-msg" hidden></div></div>`;
    }
    $("#t-a").innerHTML = cardH("Persetujuan Laporan Harian", '<div class="sub">Laporan baru berstatus Dikirim. Setujui, minta revisi, atau tolak dengan catatan. Supervisor hanya dapat mengoreksi laporan yang diminta revisi atau ditolak, dan koreksi dicatat sebagai versi baru tanpa menghapus data asli. Upah final hanya menghitung hari yang disetujui.</div>') + cards;
}
$("#t-a").addEventListener("click", async e => {
    const b = e.target.closest("[data-ap]");
    if (!b) return;
    const card = b.closest("[data-day]"), n = +card.dataset.day, st = b.dataset.ap;
    const note = card.querySelector(".an").value.trim(), er = card.querySelector(".er-msg");
    if (st != "disetujui" && note.length < 3) { er.textContent = "Isi catatan (minimal 3 huruf) untuk meminta revisi atau menolak."; er.hidden = false; return; }
    b.disabled = true;
    try { await apiCommitAppr(n, st, note); apprUI(); render(); }
    catch (x) { er.textContent = "Gagal menyimpan: " + ((x && x.message) || x); er.hidden = false; b.disabled = false; }
});

// ---------- RAB di dashboard, Keuangan (Owner), Biaya (Supervisor) ----------
const kp = (v, t) => `<div class="k"><b>${v}</b><span>${t}</span></div>`;
const rpR = v => `<td style="text-align:right">${v}</td>`;

function katTable(f) {
    return KATB.filter(k => f.rab.by[k] || f.real[k]).map(k => { const d = f.rab.by[k] - f.real[k]; return `<tr><td>${esc(k)}</td>${rpR(Rp(f.rab.by[k]))}${rpR(Rp(f.real[k]))}<td style="text-align:right;color:var(--${d < 0 ? "bad" : "ok"})">${Rp(d)}</td></tr>`; }).join("");
}

function rabHTML(m) {
    const f = finSummary(m);
    if (!f.rab.total && !f.nilai && !f.total) return "";
    const un = f.nilai ? `<div class="al ${f.untungProyeksi < 0 ? "bad" : f.untungProyeksi < f.untungRencana * 0.5 ? "wa" : "ok"}">Rencana keuntungan (kontrak - RAB): ${Rp(f.untungRencana)}. Estimasi keuntungan saat ini: ${Rp(f.untungSaatIni)}. Proyeksi keuntungan akhir: ${f.eac ? Rp(f.untungProyeksi) : "belum dapat dihitung"}.</div>` : '<div class="al wa">Isi nilai kontrak di Pengaturan, bagian RAB dan biaya, untuk melihat estimasi keuntungan.</div>';
    return `<div class="card"><h2>RAB dan biaya proyek</h2><div class="grid">${kp(f.nilai ? Rp(f.nilai) : "–", "Nilai kontrak")}${kp(Rp(f.rab.total), "RAB (rencana biaya)")}${kp(Rp(f.total), "Realisasi biaya")}${kp(f.ang ? Rp(f.sisa) : "–", "Sisa RAB")}${kp(f.eac ? Rp(f.eac) : "–", "Proyeksi biaya akhir")}${kp(f.nilai && f.eac ? Rp(f.untungProyeksi) : "–", "Proyeksi keuntungan akhir")}</div>${un}<div class="tw"><table><tr><th>Kategori</th><th>RAB</th><th>Realisasi</th><th>Selisih</th></tr>${katTable(f)}</table></div><div class="sub">Realisasi biaya: upah dari laporan harian, material dari pembelian (material masuk), biaya lain dari catatan biaya. Estimasi dan proyeksi memakai nilai material yang sudah dipakai (bukan yang baru dibeli) dan kemajuan pekerjaan periode ini (${F(f.kemajuan, 0)}%). <a href="#" data-go="k">Buka Keuangan</a></div></div>`;
}

let EDITFIN = 0, DELARM = 0, DELT = 0, WHO = "";
$("#by").addEventListener("input", e => { WHO = e.target.value; });
const nameField = id => `<label>Nama pencatat<input id="${id}" value="${esc(WHO)}" maxlength="40" style="width:150px"></label>`;

function finFormHTML(owner) {
    const e = EDITFIN ? S.fin.find(x => x.id == EDITFIN) : null;
    return `<div class="row"><label>Tanggal<input id="ft1" type="date" value="${e ? esc(e.tgl) : todayStr()}"></label><label>Kategori<select id="ft2" style="max-width:220px">${KAT.map(k => `<option${e && e.kat == k ? " selected" : ""}>${k}</option>`).join("")}</select></label><label>Keterangan<input id="ft3" maxlength="80" style="width:200px" value="${e ? esc(e.ket) : ""}"></label><label>Jumlah (Rp)<input id="ft4" type="number" step="any" style="width:140px" value="${e ? e.jml : ""}"></label>${owner ? "" : nameField("ft5")}<button class="btn" id="fadd">${e ? "Simpan perubahan" : "Tambah"}</button>${e ? '<button class="btn g" id="fcan">Batal</button>' : ""}</div>`;
}

function finUI() {
    const m = M(), f = finSummary(m), uv = S.fin.filter(x => !x.verif).length;
    const note = !f.ang ? '<div class="al wa">RAB belum diisi. Isi di Pengaturan, bagian RAB dan biaya.</div>' : f.pakai >= 100 ? '<div class="al bad">RAB sudah terlampaui.</div>'
        : f.selisih > 10 ? `<div class="al wa">Biaya terpakai (${F(f.pakai, 0)}%) jauh lebih cepat daripada kemajuan pekerjaan (${F(f.kemajuan, 0)}%).</div>`
        : `<div class="al ok">Biaya terpakai ${F(f.pakai, 0)}% sejalan dengan kemajuan pekerjaan ${F(f.kemajuan, 0)}%.</div>`;
    const list = S.fin.slice().reverse().slice(0, 30).map(x => `<tr><td>${esc(x.tgl)}</td><td>${esc(x.kat)}</td><td>${esc(x.ket)}</td>${rpR(Rp(x.jml))}<td>${esc(x.by || "-")}</td><td>${x.verif ? '<span class="chip disetujui">Terverifikasi</span>' : '<span class="chip revisi">Menunggu</span>'}</td><td style="white-space:nowrap"><button class="btn g" data-fe="${x.id}" style="padding:3px 8px">Ubah</button> ${x.verif ? "" : `<button class="btn g" data-fv="${x.id}" style="padding:3px 8px">Verifikasi</button> `}<button class="btn g" data-fd="${x.id}" style="padding:3px 8px">Hapus</button></td></tr>`).join("");
    $("#t-k").innerHTML = cardH("Keuangan Proyek", `<div class="grid">${kp(f.nilai ? Rp(f.nilai) : "–", "Nilai kontrak")}${kp(Rp(f.rab.total), "RAB")}${kp(Rp(f.total), "Realisasi biaya")}${kp(f.ang ? Rp(f.sisa) : "–", "Sisa RAB")}${kp(f.nilai ? Rp(f.untungSaatIni) : "–", "Keuntungan saat ini")}${kp(f.eac && f.nilai ? Rp(f.untungProyeksi) : "–", "Proyeksi keuntungan akhir")}</div>${note}<div class="sub">Nilai kontrak, RAB, dan harga diedit di Pengaturan. <a href="#" data-go="p:#sec-rab">Buka RAB dan biaya</a></div>`)
      + cardH("RAB dibanding realisasi", `<div class="tw"><table><tr><th>Kategori</th><th>RAB</th><th>Realisasi</th><th>Selisih</th></tr>${katTable(f)}<tr><td><b>Total</b></td>${rpR("<b>" + Rp(f.rab.total) + "</b>")}${rpR("<b>" + Rp(f.total) + "</b>")}${rpR("<b>" + Rp(f.rab.total - f.total) + "</b>")}</tr></table></div><div class="sub">Upah: disetujui ${Rp(f.upahOk)}, menunggu persetujuan ${Rp(f.upahPending)}. Material dihitung dari material masuk.</div>`)
      + cardH("Catat dan kelola biaya" + (uv ? " (" + uv + " menunggu verifikasi)" : ""), `${finFormHTML(true)}<div class="sub">Supervisor juga dapat mencatat biaya; catatannya menunggu verifikasi owner. Perubahan dan penghapusan disimpan sebagai versi baru (riwayat tetap ada). Untuk koreksi bisa memakai entri bernilai negatif.</div><div class="er-msg" id="fm2"></div>${list ? `<div class="tw" style="margin-top:8px"><table><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th style="text-align:right">Jumlah</th><th>Oleh</th><th>Status</th><th></th></tr>${list}</table></div>` : ""}`);
}

function byaUI() {
    const list = S.fin.filter(x => x.role == "sup").slice().reverse().slice(0, 20).map(x => `<tr><td>${esc(x.tgl)}</td><td>${esc(x.kat)}</td><td>${esc(x.ket)}</td>${rpR(Rp(x.jml))}<td>${esc(x.by || "-")}</td><td>${x.verif ? '<span class="chip disetujui">Terverifikasi</span>' : '<span class="chip revisi">Menunggu owner</span>'}</td></tr>`).join("");
    $("#t-y").innerHTML = cardH("Catat Biaya Lapangan", `${finFormHTML(false)}<div class="sub">Catat pengeluaran lapangan di luar upah dan material (upah dihitung otomatis dari laporan harian; pembelian bahan dicatat di tab Material). Owner akan memverifikasi catatanmu.</div><div class="er-msg" id="fm2"></div>`)
      + (list ? cardH("Catatan biaya dari supervisor", `<div class="tw"><table><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th style="text-align:right">Jumlah</th><th>Oleh</th><th>Status</th></tr>${list}</table></div>`) : "");
}

async function finClick(e) {
    const t = e.target, ow = role == "owner", er = $("#fm2");
    const g = t.closest("[data-go]");
    if (g) { e.preventDefault(); go(g.dataset.go); return; }
    const redraw = () => { if (ow) { finUI(); render(); } else byaUI(); };
    try {
        if (t.id == "fcan") { EDITFIN = 0; redraw(); return; }
        if (t.id == "fadd") {
            const tgl = $("#ft1").value, kat = $("#ft2").value, ket = $("#ft3").value.trim(), jml = +$("#ft4").value, by = ow ? "Owner" : $("#ft5").value.trim();
            const de = dateError(tgl, null);
            if (de) { er.textContent = de.replace("kerja", "pengeluaran"); return; }
            if (ket.length < 3) { er.textContent = "Isi keterangan (minimal 3 huruf)."; return; }
            if (!jml || Math.abs(jml) > 1e12 || (!ow && jml < 0)) { er.textContent = ow ? "Isi jumlah yang valid (boleh negatif untuk koreksi)." : "Isi jumlah lebih dari 0."; return; }
            if (!by) { er.textContent = "Isi nama pencatat."; return; }
            if (!ow) WHO = by;
            if (EDITFIN) { await apiEditFin(EDITFIN, { tgl, kat, ket, jml, verif: true }); EDITFIN = 0; }
            else await apiAddFin({ tgl, kat, ket, jml, by, role: ow ? "owner" : "sup", verif: ow });
            redraw();
        }
        if (ow && t.dataset.fe) { EDITFIN = +t.dataset.fe; finUI(); }
        if (ow && t.dataset.fv) { await apiEditFin(+t.dataset.fv, { verif: true }); redraw(); }
        if (ow && t.dataset.fd) {
            const id = +t.dataset.fd;
            if (DELARM == id && Date.now() - DELT < 6000) { await apiEditFin(id, { batal: true }); DELARM = 0; redraw(); }
            else { DELARM = id; DELT = Date.now(); er.textContent = "Tekan Hapus sekali lagi dalam 6 detik untuk membatalkan catatan ini (riwayat tetap tersimpan)."; }
        }
    } catch (x) { er.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
}
$("#t-k").addEventListener("click", finClick);
$("#t-y").addEventListener("click", finClick);

// ---------- Material ----------
const mchip = s => `<span class="chip ${s == "aman" ? "disetujui" : s == "menipis" ? "revisi" : "ditolak"}">${s}</span>`;

function matUI() {
    const st = matStock(), al = matAlerts(), ow = role == "owner";
    const rows = st.map(o => `<tr><td>${esc(o.nm)}</td><td>${esc(o.sat)}</td><td>${o.masuk}</td><td>${o.keluar}</td><td><b>${o.stok}</b></td><td>${o.min || 0}</td><td>${o.keb || "-"}</td><td>${mchip(o.status)}</td></tr>`).join("");
    const opts = (S.matm || []).map(o => `<option value="${esc(o.id)}">${esc(o.nm)} (${esc(o.sat)})</option>`).join("");
    const mv = (S.mat || []).slice().reverse().slice(0, 20).map(x => { const y = (S.matm || []).find(z => z.id == x.mid) || { nm: "?", sat: "" }; return `<tr><td>${esc(x.tgl)}</td><td>${esc(y.nm)}</td><td>${x.jenis == "masuk" ? "Masuk" : "Keluar"}</td><td>${x.qty} ${esc(y.sat)}</td><td>${ow && x.harga > 0 ? Rp(x.harga) : ""}</td><td>${esc(x.ket)}</td><td>${esc(x.by || "")}</td></tr>`; }).join("");
    $("#t-m").innerHTML = cardH("Stok Material", st.length ? `<div class="tw"><table><tr><th>Material</th><th>Sat.</th><th>Masuk</th><th>Keluar</th><th>Stok</th><th>Min.</th><th>Kebutuhan RAB</th><th>Status</th></tr>${rows}</table></div>` : '<div class="al wa">Daftar material belum disiapkan. Owner mengisinya di Pengaturan, bagian Daftar material.</div>')
      + (al.length ? cardH("Peringatan material", al.map(a => `<div class="al ${a[0]}">${esc(a[1])}</div>`).join("")) : "")
      + (st.length ? cardH("Catat material masuk atau keluar", `<div class="row"><label>Tanggal<input id="mv1" type="date" value="${todayStr()}"></label><label>Material<select id="mv2" style="max-width:200px">${opts}</select></label><label>Jenis<select id="mv3"><option value="masuk">Masuk</option><option value="keluar">Keluar (dipakai)</option></select></label><label>Jumlah<input id="mv4" type="number" step="any" min="0" style="width:90px"></label><label>Harga satuan (Rp, opsional)<input id="mv5" type="number" step="any" min="0" style="width:120px"></label><label>Keterangan (supplier, nota, atau pekerjaan)<input id="mv6" maxlength="80" style="width:230px"></label>${ow ? "" : nameField("mv7")}<button class="btn" id="mvadd">Simpan</button></div><div class="sub">Material keluar tidak boleh melebihi stok. Catat pembelian bahan di sini (bukan di Biaya) agar stok dan biaya sinkron.</div><div class="er-msg" id="mvm"></div>`) : "")
      + (mv ? cardH("Riwayat keluar masuk", `<div class="tw"><table><tr><th>Tanggal</th><th>Material</th><th>Jenis</th><th>Jumlah</th><th>${ow ? "Harga" : ""}</th><th>Keterangan</th><th>Oleh</th></tr>${mv}</table></div>`) : "");
}
$("#t-m").addEventListener("click", async e => {
    if (e.target.id != "mvadd") return;
    const m = $("#mvm"), ow = role == "owner", tgl = $("#mv1").value, mid = $("#mv2").value, jenis = $("#mv3").value, qty = +$("#mv4").value, harga = +$("#mv5").value || 0, ket = $("#mv6").value.trim(), by = ow ? "Owner" : $("#mv7").value.trim();
    const de = dateError(tgl, null);
    if (de) { m.textContent = de.replace("kerja", "pencatatan"); return; }
    if (!(qty > 0) || qty > 1e9) { m.textContent = "Isi jumlah lebih dari 0."; return; }
    if (ket.length < 3) { m.textContent = "Isi keterangan (minimal 3 huruf)."; return; }
    if (!by) { m.textContent = "Isi nama pencatat."; return; }
    const st = matStock().find(o => o.id == mid);
    if (jenis == "keluar" && st && qty > st.stok) { m.textContent = "Stok " + st.nm + " hanya " + st.stok + " " + st.sat + ". Catat material masuk dulu atau periksa jumlahnya."; return; }
    if (!ow) WHO = by;
    try { await apiAddMat({ tgl, mid, jenis, qty, harga: jenis == "masuk" ? harga : 0, ket, by }); matUI(); if (ow) render(); }
    catch (x) { m.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
});

// ---------- Jadwal pekerjaan ----------
function ganttSVG() {
    const ts = S.tasks || [];
    if (!ts.length) return "";
    const d0 = Math.min(...ts.map(t => dayNum(t.mulai))), d1 = Math.max(...ts.map(t => dayNum(t.selesai))), span = Math.max(1, d1 - d0), tn = dayNum(todayStr());
    const L = 150, w = 640, rh = 26, h = ts.length * rh + 30, pw = w - L - 10, X = d => L + (d - d0) / span * pw;
    const bars = ts.map((t, i) => {
        const a = dayNum(t.mulai), b = dayNum(t.selesai), p = taskStatus(t).aktual, y = i * rh + 6;
        return `<text x="${L - 6}" y="${y + 12}" font-size="11" text-anchor="end" fill="var(--tx)">${esc(t.nm.length > 22 ? t.nm.slice(0, 21) + "…" : t.nm)}</text><rect x="${X(a)}" y="${y}" width="${Math.max(2, X(b) - X(a))}" height="16" rx="3" fill="var(--bd)"/><rect x="${X(a)}" y="${y}" width="${Math.max(0, (X(b) - X(a)) * Math.min(p, 100) / 100)}" height="16" rx="3" fill="var(--ac)"/>`;
    }).join("");
    const today = tn >= d0 && tn <= d1 ? `<line x1="${X(tn)}" x2="${X(tn)}" y1="0" y2="${ts.length * rh + 4}" stroke="var(--bad)" stroke-dasharray="4 3" stroke-width="1.5"/>` : "";
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Jadwal pekerjaan">${bars}${today}<text x="${L}" y="${h - 6}" font-size="10" fill="var(--mu)">${esc(new Date(d0 * 86400000).toISOString().slice(0, 10))}</text><text x="${w - 10}" y="${h - 6}" font-size="10" text-anchor="end" fill="var(--mu)">${esc(new Date(d1 * 86400000).toISOString().slice(0, 10))}</text></svg>`;
}

function jadUI() {
    const ts = S.tasks || [], ow = role == "owner";
    if (!ts.length) { $("#t-j").innerHTML = cardH("Jadwal Pekerjaan", '<div class="al wa">Jadwal belum disiapkan. Owner mengisinya di Pengaturan, bagian Jadwal pekerjaan.</div>'); return; }
    const cc = c => c == "ok" ? "disetujui" : c == "wa" ? "revisi" : c == "bad" ? "ditolak" : "mu";
    const rows = ts.map(t => { const x = taskStatus(t); return `<tr><td><b>${esc(t.nm)}</b><div class="sub">${esc(t.mulai)} sampai ${esc(t.selesai)}</div></td><td>${Math.round(x.plan)}%</td><td>${x.aktual}%</td><td><span class="chip ${cc(x.cls)}">${esc(x.s)}</span>${x.p && x.p.cat ? `<div class="sub">${esc(x.p.cat)}</div>` : ""}</td></tr>`; }).join("");
    const upd = ts.map(t => `<tr data-tid="${t.id}"><td>${esc(t.nm)}</td><td><input class="tp-pct" type="number" min="0" max="100" step="1" value="${(lastProg(t.id) || {}).pct ?? ""}" style="width:70px"></td><td><input class="tp-sel" type="date" style="width:140px"></td><td><input class="tp-cat" maxlength="80" placeholder="catatan" style="width:170px"></td><td><button class="btn g" data-tp="${t.id}" style="padding:4px 10px">Perbarui</button></td></tr>`).join("");
    $("#t-j").innerHTML = cardH("Jadwal Pekerjaan", `<div class="sc">${ganttSVG()}</div><div class="leg">Abu-abu: rencana. Oranye: realisasi. Garis merah putus-putus: hari ini.</div><div class="tw" style="margin-top:8px"><table><tr><th>Pekerjaan</th><th>Rencana hari ini</th><th>Realisasi</th><th>Status</th></tr>${rows}</table></div>`)
      + cardH("Perbarui realisasi", `<div class="sub" style="margin-bottom:6px">Isi persen selesai terbaru. Tanggal selesai wajib diisi jika 100%. Menurunkan persen wajib disertai catatan.</div><div class="row">${ow ? "" : nameField("tp0")}</div><div class="tw"><table><tr><th>Pekerjaan</th><th>Selesai (%)</th><th>Tgl selesai</th><th>Catatan</th><th></th></tr>${upd}</table></div><div class="er-msg" id="tpm"></div>`);
}
$("#t-j").addEventListener("click", async e => {
    const b = e.target.closest("[data-tp]");
    if (!b) return;
    const row = b.closest("tr"), tid = +b.dataset.tp, m = $("#tpm"), ow = role == "owner";
    const pct = +row.querySelector(".tp-pct").value, sel = row.querySelector(".tp-sel").value, cat = row.querySelector(".tp-cat").value.trim(), by = ow ? "Owner" : $("#tp0").value.trim(), prev = lastProg(tid);
    if (row.querySelector(".tp-pct").value === "" || !(pct >= 0 && pct <= 100)) { m.textContent = "Isi persen selesai antara 0 dan 100."; return; }
    if (!by) { m.textContent = "Isi nama pencatat."; return; }
    if (prev && pct < prev.pct && cat.length < 5) { m.textContent = "Menurunkan persen dari " + prev.pct + "% wajib disertai catatan (minimal 5 huruf)."; return; }
    if (pct == 100 && !sel) { m.textContent = "Isi tanggal selesai karena pekerjaan 100%."; return; }
    if (sel) { const de = dateError(sel, null); if (de) { m.textContent = de.replace("kerja", "selesai"); return; } }
    if (!ow) WHO = by;
    try { await apiAddProg({ tid, pct, aSelesai: sel || "", cat, by }); jadUI(); if (ow) render(); }
    catch (x) { m.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
});

// ---------- Editor Pengaturan: RAB, daftar material, jadwal ----------
const rabRow = it => `<tr class="rr"><td><select class="r-kat" style="max-width:150px">${KATB.map(k => `<option${k == it.kat ? " selected" : ""}>${k}</option>`).join("")}</select></td><td><input class="r-ur" value="${esc(it.uraian || "")}" style="width:150px"></td><td><input class="r-vol" type="number" step="any" min="0" value="${it.vol ?? ""}" style="width:64px"></td><td><input class="r-sat" value="${esc(it.sat || "")}" style="width:50px"></td><td><input class="r-hr" type="number" step="any" min="0" value="${it.harga ?? ""}" style="width:96px"></td><td><input class="r-pct" type="number" step="any" min="0" max="100" value="${it.pct ?? ""}" style="width:56px"></td><td><button class="btn g" data-rmrow="1" style="padding:3px 9px">×</button></td></tr>`;
function rabEdHTML() {
    const f = rabSummary();
    return `<div class="card" id="sec-rab"><h2>RAB dan biaya proyek</h2>
      <div class="sub" style="margin-bottom:8px">Isi nilai kontrak dan semua komponen biaya yang dibutuhkan selama proyek: material, upah, peralatan, subkontraktor, pajak, perizinan dan biaya dinas, pengawas, konsultan, overhead, dan lain-lain. Setiap baris dihitung volume × harga, atau persen dari nilai kontrak (cocok untuk pajak). Tarif pajak dan biaya lain mengikuti ketentuan dan kontrak yang berlaku; angka di sini hanya yang Anda isi.</div>
      <div class="row"><label>Nilai kontrak / pendapatan (Rp)<input id="rabn" type="number" min="0" step="any" value="${(S.fcfg || {}).nilai || ""}" style="width:200px"></label></div>
      <div class="tw"><table><tr><th>Kategori</th><th>Uraian</th><th>Vol.</th><th>Sat.</th><th>Harga satuan</th><th>% kontrak</th><th></th></tr><tbody id="rabb">${((S.fcfg || {}).rab || []).map(rabRow).join("") || rabRow({})}</tbody></table></div>
      <div class="row" style="margin-top:6px"><button class="btn g" id="rabadd">+ Tambah baris</button><button class="btn g" id="rabpj">+ Baris pajak (% kontrak)</button><button class="btn" id="rabsv">Simpan RAB</button></div>
      <div class="sub">Total RAB saat ini: <b>${Rp(f.total)}</b></div><div class="er-msg" id="rabm"></div></div>`;
}
async function saveRab() {
    const m = $("#rabm"), nilai = +$("#rabn").value || 0;
    const rows = [...document.querySelectorAll("#rabb .rr")].map(r => ({ kat: r.querySelector(".r-kat").value, uraian: r.querySelector(".r-ur").value.trim(), vol: +r.querySelector(".r-vol").value || 0, sat: r.querySelector(".r-sat").value.trim(), harga: +r.querySelector(".r-hr").value || 0, pct: +r.querySelector(".r-pct").value || 0 })).filter(x => x.uraian || x.vol || x.harga || x.pct);
    if (nilai < 0 || nilai > 1e13) { m.textContent = "Nilai kontrak tidak valid."; return; }
    for (const x of rows) {
        if (!x.uraian) { m.textContent = "Setiap baris perlu uraian."; return; }
        if (x.pct < 0 || x.pct > 100) { m.textContent = 'Persen "' + x.uraian + '" harus 0 sampai 100.'; return; }
        if (x.pct > 0 && !nilai) { m.textContent = 'Baris "' + x.uraian + '" memakai persen kontrak; isi nilai kontrak dulu.'; return; }
        if (x.pct == 0 && !(x.vol > 0 && x.harga >= 0)) { m.textContent = 'Isi volume dan harga untuk "' + x.uraian + '", atau isi persen dari nilai kontrak.'; return; }
    }
    S.fcfg = { nilai, rab: rows };
    const tot = rabSummary().total;
    logAdd("RAB diperbarui: " + rows.length + " item, total " + Rp(tot));
    try { await apiSaveFcfg(); save(); m.textContent = "RAB tersimpan: " + rows.length + " item, total " + Rp(tot) + "."; render(); }
    catch (x) { m.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
}

const mmRow = it => `<tr class="mr" data-id="${esc(it.id || "")}"><td><input class="m-nm" value="${esc(it.nm || "")}" style="width:170px"></td><td><input class="m-sat" value="${esc(it.sat || "")}" style="width:56px"></td><td><input class="m-min" type="number" min="0" step="any" value="${it.min ?? ""}" style="width:70px"></td><td><input class="m-keb" type="number" min="0" step="any" value="${it.keb ?? ""}" style="width:80px"></td><td><input class="m-hr" type="number" min="0" step="any" value="${it.harga ?? ""}" style="width:96px"></td><td><button class="btn g" data-rmrow="1" style="padding:3px 9px">×</button></td></tr>`;
function matmEdHTML() {
    return `<div class="card" id="sec-matm"><h2>Daftar material</h2><div class="sub" style="margin-bottom:8px">Material yang dipakai proyek. Supervisor mencatat keluar masuknya. Kebutuhan (sesuai RAB) dan harga standar dipakai untuk peringatan dan penilaian biaya.</div>
      <div class="tw"><table><tr><th>Material</th><th>Sat.</th><th>Stok min.</th><th>Kebutuhan RAB</th><th>Harga standar</th><th></th></tr><tbody id="mmb">${(S.matm || []).map(mmRow).join("") || mmRow({})}</tbody></table></div>
      <div class="row" style="margin-top:6px"><button class="btn g" id="mmadd">+ Tambah material</button><button class="btn" id="mmsv">Simpan daftar material</button></div><div class="er-msg" id="mmm"></div></div>`;
}
async function saveMatm2() {
    const m = $("#mmm"), old = S.matm || [];
    const rows = [...document.querySelectorAll("#mmb .mr")].map((r, i) => ({ id: r.dataset.id || "m" + Date.now().toString(36) + i, nm: r.querySelector(".m-nm").value.trim(), sat: r.querySelector(".m-sat").value.trim(), min: +r.querySelector(".m-min").value || 0, keb: +r.querySelector(".m-keb").value || 0, harga: +r.querySelector(".m-hr").value || 0 })).filter(x => x.nm || x.sat);
    for (const x of rows) if (!x.nm || !x.sat) { m.textContent = "Setiap material perlu nama dan satuan."; return; }
    const gone = old.filter(o => !rows.some(r => r.id == o.id) && (S.mat || []).some(e => e.mid == o.id));
    if (gone.length) { m.textContent = 'Material "' + gone[0].nm + '" sudah punya catatan keluar masuk dan tidak dapat dihapus.'; return; }
    S.matm = rows;
    logAdd("daftar material diperbarui: " + rows.length + " item");
    try { await apiSaveMatm(); save(); m.textContent = "Daftar material tersimpan (" + rows.length + " item)."; matUI(); }
    catch (x) { m.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
}

const tkRow = it => `<tr class="tr2" data-id="${esc(it.id || "")}"><td><input class="t-nm" value="${esc(it.nm || "")}" style="width:200px"></td><td><input class="t-a" type="date" value="${esc(it.mulai || "")}"></td><td><input class="t-b" type="date" value="${esc(it.selesai || "")}"></td><td><button class="btn g" data-rmrow="1" style="padding:3px 9px">×</button></td></tr>`;
function taskEdHTML() {
    return `<div class="card" id="sec-task"><h2>Jadwal pekerjaan</h2><div class="sub" style="margin-bottom:8px">Daftar pekerjaan dengan tanggal mulai dan target selesai. Supervisor memperbarui persen selesai; aplikasi menghitung status keterlambatan.</div>
      <div class="tw"><table><tr><th>Pekerjaan</th><th>Mulai</th><th>Target selesai</th><th></th></tr><tbody id="tkb">${(S.tasks || []).map(tkRow).join("") || tkRow({})}</tbody></table></div>
      <div class="row" style="margin-top:6px"><button class="btn g" id="tkadd">+ Tambah pekerjaan</button><button class="btn" id="tksv">Simpan jadwal</button></div><div class="er-msg" id="tkm"></div></div>`;
}
async function saveTasks2() {
    const m = $("#tkm"), old = S.tasks || [];
    let next = Math.max(0, ...old.map(t => t.id)) + 1;
    const rows = [...document.querySelectorAll("#tkb .tr2")].map(r => ({ id: r.dataset.id ? +r.dataset.id : next++, nm: r.querySelector(".t-nm").value.trim(), mulai: r.querySelector(".t-a").value, selesai: r.querySelector(".t-b").value })).filter(x => x.nm || x.mulai || x.selesai);
    for (const x of rows) {
        if (!x.nm || !x.mulai || !x.selesai) { m.textContent = "Setiap pekerjaan perlu nama, tanggal mulai, dan target selesai."; return; }
        if (x.selesai < x.mulai) { m.textContent = 'Target selesai "' + x.nm + '" tidak boleh sebelum tanggal mulai.'; return; }
    }
    const gone = old.filter(o => !rows.some(r => r.id == o.id) && (S.tprog || []).some(p => p.tid == o.id));
    if (gone.length) { m.textContent = 'Pekerjaan "' + gone[0].nm + '" sudah punya catatan progres dan tidak dapat dihapus.'; return; }
    S.tasks = rows;
    logAdd("jadwal pekerjaan diperbarui: " + rows.length + " pekerjaan");
    try { await apiSaveTasks(); save(); m.textContent = "Jadwal tersimpan (" + rows.length + " pekerjaan)."; jadUI(); }
    catch (x) { m.textContent = "Gagal menyimpan: " + ((x && x.message) || x); }
}
$("#cf").addEventListener("click", async e => {
    const t = e.target;
    if (t.id == "rabadd") $("#rabb").insertAdjacentHTML("beforeend", rabRow({}));
    if (t.id == "rabpj") $("#rabb").insertAdjacentHTML("beforeend", rabRow({ kat: "Pajak (PPN, PPh)", uraian: "Pajak (persen dari nilai kontrak)" }));
    if (t.dataset.rmrow) { const tr = t.closest("tr"), body = tr.parentNode; if (body.children.length > 1) tr.remove(); }
    if (t.id == "rabsv") await saveRab();
    if (t.id == "mmadd") $("#mmb").insertAdjacentHTML("beforeend", mmRow({}));
    if (t.id == "mmsv") await saveMatm2();
    if (t.id == "tkadd") $("#tkb").insertAdjacentHTML("beforeend", tkRow({}));
    if (t.id == "tksv") await saveTasks2();
});

// ---------- Analisis dan ekspor (Owner) ----------
let ANA = { a: 1, b: 9999 };

function miniChart(title, labels, series, zero) {
    if (!labels.length) return `<h2>${title}</h2><div class="sub">Tidak ada data pada rentang ini.</div>`;
    const w = 640, h = 190, L = 46, T = 14, B = 24, R = 12, pw = w - L - R, ph = h - T - B;
    const all = series.flatMap(s => s.v), lo0 = Math.min(...all), hi0 = Math.max(...all), span = (hi0 - lo0) || 1;
    const lo = zero ? Math.min(0, lo0) : lo0 - span * 0.1, hi = hi0 + span * 0.1;
    const X = i => L + (labels.length < 2 ? pw / 2 : i / (labels.length - 1) * pw), Y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
    let g = "";
    for (let k = 0; k <= 4; k++) {
        const v = lo + (hi - lo) * k / 4;
        g += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--bd)"/><text x="${L - 5}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mu)">${Math.abs(v) >= 1000 ? Math.round(v / 1000) + "rb" : Math.round(v * 10) / 10}</text>`;
    }
    labels.forEach((lb, i) => { if (labels.length <= 12 || i % Math.ceil(labels.length / 12) == 0) g += `<text x="${X(i)}" y="${h - 8}" font-size="10" text-anchor="middle" fill="var(--mu)">${lb}</text>`; });
    const lines = series.map(s => `<polyline points="${s.v.map((v, i) => X(i) + "," + Y(v)).join(" ")}" fill="none" stroke="${s.c}" stroke-width="2.5"/>` + s.v.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${s.c}"/>`).join("")).join("");
    return `<h2>${title}</h2><div class="sc"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${g}${lines}</svg></div><div class="leg">Sumbu X: hari kerja.</div>`;
}

const KAMUS = [
    ["rekap harian", "hari, tanggal (kerja), pengisi, status laporan, jumlah pekerja bekerja/sakit/APD tidak lengkap/APD sebagian/absen, jam lembur dibayar, rata-rata KPI, upah total (Rp), progres kumulatif sistem (%)"],
    ["per pekerja", "hari, tanggal, pekerja, zona, status, volume dan satuan, target, rasio volume (%), KPI, upah pokok, lembur, bonus, potongan, upah total (Rp)"],
    ["opname", "nomor opname, setelah hari ke, tanggal, progres (%), pemeriksa, serta per item: pekerjaan, lokasi, satuan, volume rencana, volume terpasang, bobot (%), capaian (%)"],
    ["biaya", "per kategori: RAB, realisasi, selisih; nilai kontrak, estimasi dan proyeksi keuntungan; lalu catatan biaya: tanggal, kategori, keterangan, jumlah, pencatat, terverifikasi"],
    ["material", "keluar masuk: tanggal, material, satuan, jenis, jumlah, harga satuan, nilai, keterangan, pencatat; ringkasan stok: masuk, keluar, stok, batas minimum, kebutuhan RAB, status"],
    ["jadwal", "pekerjaan, mulai dan selesai rencana, rencana (%) hari ini, realisasi (%), status, catatan terakhir"]
];

function barChart(title, items, ref) {
    if (!items.length) return `<h2>${title}</h2><div class="sub">Tidak ada data pada rentang ini.</div>`;
    const w = 640, rh = 26, h = items.length * rh + 24, L = 120, pw = w - L - 50, mx = Math.max(120, ...items.map(i => i.v)), X = v => L + v / mx * pw;
    const bars = items.map((it, i) => `<text x="${L - 6}" y="${i * rh + 17}" font-size="11" text-anchor="end" fill="var(--tx)">${esc(it.l)}</text><rect x="${L}" y="${i * rh + 5}" width="${Math.max(1, X(it.v) - L)}" height="16" rx="3" fill="${it.v >= ref ? "var(--ok)" : "var(--ac)"}"/><text x="${X(it.v) + 5}" y="${i * rh + 17}" font-size="11" fill="var(--mu)">${Math.round(it.v)}%</text>`).join("");
    return `<h2>${title}</h2><div class="sc"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${bars}<line x1="${X(ref)}" x2="${X(ref)}" y1="0" y2="${h - 16}" stroke="var(--bad)" stroke-dasharray="4 3"/><text x="${X(ref)}" y="${h - 3}" font-size="10" text-anchor="middle" fill="var(--bad)">target ${ref}%</text></svg></div>`;
}

function anaUI() {
    const m = M(), n = m.n;
    if (!n) { $("#t-n").innerHTML = cardH("Analisis Data", '<div class="sub">Belum ada data untuk dianalisis.</div>'); return; }
    const a = Math.min(Math.max(1, ANA.a), n), b = Math.min(Math.max(a, ANA.b), n), s = seriesRange(m, a, b), r = s.ringkas, ka = kpiAnalysis(m, a, b);
    const opt = sel => Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${i + 1 == sel ? " selected" : ""}>Hari ${i + 1}</option>`).join("");
    const cor = v => v === null ? "belum dapat dihitung (data kurang)" : (Math.abs(v) < 0.3 ? "lemah" : Math.abs(v) < 0.6 ? "sedang" : "kuat") + " (r = " + F(v, 2) + ")";
    const per = ka.per.map(p => `<tr><td>${esc(p.nm)}</td><td>${p.hari}</td><td>${F(p.rasio * 100, 0)}%</td><td>${F(p.kpi)}</td><td>${p.apd}</td><td>${p.sakit}</td><td>${p.absen}</td></tr>`).join("");
    $("#t-n").innerHTML = cardH("Analisis Data", `<div class="row"><label>Dari<select id="aa">${opt(a)}</select></label><label>Sampai<select id="ab">${opt(b)}</select></label></div>
      <div class="grid">${kp(r.hari, "Hari dianalisis")}${kp(Rp(r.upah), "Total upah")}${kp(F(r.lembur), "Jam lembur dibayar")}${kp(F(r.kpi), "Rata-rata KPI")}${kp(r.apd, "Kasus APD bermasalah")}${kp(r.sakit + " / " + r.absen, "Sakit / absen (orang-hari)")}</div>`)
      + cardH("", miniChart("Progres kumulatif sistem (%)", s.labels, [{ v: s.prog, c: "var(--ac)" }]))
      + cardH("", miniChart("Upah per hari (Rp)", s.labels, [{ v: s.upah, c: "var(--ok)" }], true))
      + cardH("", miniChart("Rata-rata KPI dan kehadiran bekerja (%)", s.labels, [{ v: s.kpi, c: "var(--ac)" }, { v: s.hadir, c: "var(--mu)" }], true) + '<div class="leg">Oranye: rata-rata KPI. Abu-abu: persentase pekerja yang bekerja.</div>')
      + cardH("", barChart("Realisasi dibanding target volume per pekerja (rata-rata rasio)", ka.per.filter(p => p.hari).map(p => ({ l: p.nm, v: p.rasio * 100 })), 100))
      + cardH("Rekap produktivitas dan keselamatan per pekerja", `<div class="tw"><table><tr><th>Pekerja</th><th>Hari bekerja</th><th>Rata rasio volume</th><th>Rata KPI</th><th>Kasus APD</th><th>Sakit</th><th>Absen</th></tr>${per}</table></div>
        <div class="sub" style="margin-top:6px">Hubungan produktivitas dengan kedisiplinan K3: ${cor(ka.rK3)}. Hubungan produktivitas dengan ketelitian: ${cor(ka.rTeliti)}. Dihitung dari ${ka.n} data pekerja-hari. Korelasi bukan bukti sebab-akibat dan tidak andal bila datanya sedikit.</div>`)
      + cardH("Laporan dan ekspor", `<div class="row"><label>Jenis laporan<select id="rp1"><option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option><option value="akhir">Rekap akhir proyek</option></select></label><label>Periode<select id="rp2"></select></label></div>
        <div class="row"><button class="btn" id="rppdf">Unduh PDF</button><button class="btn g" id="rpcsv">Unduh Excel (CSV)</button><button class="btn g" id="rptxt">Unduh teks (.txt)</button></div>
        <label style="display:flex;gap:6px;align-items:center;font-size:13px;margin:6px 0"><input type="checkbox" id="anon" style="width:auto"> Anonimkan nama pekerja dan pengisi (untuk data penelitian)</label>
        <div class="sub">PDF, CSV (dibuka di Excel atau Google Sheets), dan teks laporan diunduh sebagai berkas.</div>
        <div class="row" style="margin-top:8px"><button class="btn g" data-ex="rekap">Rekap harian</button><button class="btn g" data-ex="pekerja">Per pekerja</button><button class="btn g" data-ex="opname">Opname</button><button class="btn g" data-ex="biaya">Biaya (RAB)</button><button class="btn g" data-ex="material">Material</button><button class="btn g" data-ex="jadwal">Jadwal</button></div>`)
      + cardH("Kamus data", `<div class="tw"><table><tr><th>Berkas</th><th>Kolom dan artinya</th></tr>${KAMUS.map(k => `<tr><td>${k[0]}</td><td>${esc(k[1])}</td></tr>`).join("")}</table></div><div class="sub">Rumus KPI, upah, dan progres dijelaskan di tab Bantuan. Klaim bahwa aplikasi meningkatkan produktivitas perlu diuji dengan metode dan data yang sesuai; fitur saja bukan bukti.</div>`);
    fillRp();
}

function fillRp() {
    const m = M(), t = $("#rp1").value, n = m.n;
    let o = "";
    if (t == "harian") o = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">Hari ke-${i + 1}</option>`).join("");
    else if (t == "mingguan") o = Array.from({ length: Math.ceil(n / 7) }, (_, i) => `<option value="${i + 1}">Minggu ke-${i + 1}</option>`).join("");
    else if (t == "bulanan") o = [...new Set(S.meta.map(x => (x.tgl || "").slice(0, 7)).filter(Boolean))].map(x => `<option value="${x}">${x}</option>`).join("") || '<option value="">(belum ada tanggal)</option>';
    else o = '<option value="">Seluruh proyek</option>';
    $("#rp2").innerHTML = o;
}
const rpSel = () => { const t = $("#rp1").value, v = $("#rp2").value; return [t, t == "bulanan" ? v : t == "akhir" ? null : +v]; };

$("#t-n").addEventListener("change", e => {
    if (e.target.id == "aa") { ANA.a = +e.target.value; anaUI(); }
    if (e.target.id == "ab") { ANA.b = +e.target.value; anaUI(); }
    if (e.target.id == "rp1") fillRp();
});

function exportCsv(name, data) {
    download(name, data, name.endsWith(".txt") ? "text/plain" : "text/csv");
    toast("Berkas " + name + " diunduh.");
}

$("#t-n").addEventListener("click", async e => {
    const m = M(), anon = $("#anon") && $("#anon").checked, a = Math.min(Math.max(1, ANA.a), m.n), b = Math.min(Math.max(a, ANA.b), m.n);
    const bt = e.target.closest("[data-ex]");
    if (bt) {
        const k = bt.dataset.ex;
        await exportCsv("siteowner-" + k + ".csv", k == "rekap" ? csvRekap(m, a, b, anon) : k == "pekerja" ? csvPekerja(m, a, b, anon) : k == "opname" ? csvOpname() : k == "biaya" ? csvBiaya(m) : k == "material" ? csvMaterial() : csvJadwal());
    }
    if (e.target.id == "rppdf" || e.target.id == "rpcsv" || e.target.id == "rptxt") {
        const [type, arg] = rpSel(), [ra, rb] = periodRange(type, m, arg), lines = reportLines(m, type, arg), nm = "laporan-" + type + (arg ? "-" + arg : "");
        if (e.target.id == "rpcsv") await exportCsv(nm + ".csv", csvRekap(m, ra, rb, anon));
        else if (e.target.id == "rptxt") await exportCsv(nm + ".txt", lines.join("\n"));
        else { download(nm + ".pdf", makePdf(lines[0], lines), "application/pdf"); toast("Laporan PDF diunduh."); }
    }
});

// ---------- Riwayat aktivitas (Owner) ----------
function logUI() {
    const ev = activity().slice(0, 80);
    $("#t-r").innerHTML = cardH("Riwayat Aktivitas", `<div class="sub" style="margin-bottom:8px">Catatan siapa melakukan apa dan kapan: laporan, koreksi, keputusan persetujuan, opname, penyegelan, biaya, dan perubahan pengaturan.</div>${ev.length ? `<div class="tw"><table><tr><th>Waktu</th><th>Pelaku</th><th>Kegiatan</th></tr>${ev.map(x => `<tr><td>${esc(new Date(x.ts).toLocaleString("id-ID"))}</td><td>${esc(x.who || "-")}</td><td>${esc(x.txt)}</td></tr>`).join("")}</table></div>` : '<div class="sub">Belum ada aktivitas.</div>'}`);
}

// ---------- Dashboard: transparansi KPI, tindakan, pintasan pengaturan ----------
function kpiHTML(m) {
    if (!m.n) return "";
    const rows = m.last.o.map((o, i) => o.st == 1
        ? `<tr><td>${esc(W[i][0])}</td><td>${F(S.days[m.n - 1][i].v, 1)} / ${W[i][3]}</td><td>${Math.round(o.ra * 100)}%</td><td>${o.ks}</td><td>${o.kt}</td><td>${o.kd}</td><td><b>${F(o.kpi)}</b></td></tr>`
        : `<tr><td>${esc(W[i][0])}</td><td colspan="6" class="sub">${esc(o.ket || ST[o.st])}</td></tr>`).join("");
    return `<div class="card"><h2>Transparansi KPI hari ke-${m.n}</h2><div class="tw"><table><tr><th>Pekerja</th><th>Volume / target</th><th>Rasio</th><th>Nilai cepat</th><th>Nilai teliti</th><th>Nilai K3</th><th>KPI</th></tr>${rows}</table></div><div class="sub">KPI = (cepat + teliti + K3) ÷ 15 × 100, dibulatkan 1 desimal. Nilai cepat: rasio 110% atau lebih = 5, 95% = 4, 80% = 3, 60% = 2, di bawahnya 1. KPI hanya salah satu dasar; keputusan upah atau sanksi perlu pemeriksaan manusia dan aturan tertulis yang disepakati.</div></div>`;
}

function tindakanHTML(m) {
    const t = todo(m);
    return `<div class="card"><h2>Perlu tindakan${t.length ? " (" + t.length + ")" : ""}</h2>${t.length ? t.map(x => `<div class="al ${x[0]}">${esc(x[1])}${TABN[x[2]] ? ` <button class="btn g" data-go="${x[2]}" style="padding:3px 10px;margin-left:6px">Buka ${TABN[x[2]]}</button>` : ""}</div>`).join("") : '<div class="al ok">Tidak ada tindakan mendesak.</div>'}</div>`;
}

function quickHTML() {
    const b = (g, t) => `<button class="btn g" data-go="${g}" style="margin:3px">${t}</button>`;
    return `<div class="card"><h2>Pengaturan cepat</h2><div class="sub" style="margin-bottom:6px">Pintasan ke pengaturan yang paling sering diubah. Seluruh pengaturan ada di tab Pengaturan.</div>${b("p:#sec-pekerja", "Pekerja dan target")}${b("p:#sec-upah", "Aturan upah")}${b("p:#sec-plan", "Rencana progres")}${b("k", "Keuangan")}${b("p:#sec-rab", "RAB dan biaya")}${b("p:#sec-matm", "Daftar material")}${b("p:#sec-task", "Jadwal pekerjaan")}${b("p:#sec-aman", "Keamanan (PIN)")}${b("p:#sec-cad", "Cadangan data")}${b("p", "Semua pengaturan")}</div>`;
}

function go(spec) {
    const [tab, sel] = spec.split(":");
    document.querySelector('.tabs button[data-t="' + tab + '"]').click();
    if (sel) setTimeout(() => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
}
$("#t-d").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });

// ---------- Cadangan data: buat dan uji ----------
function cadHTML() {
    return `<div class="card" id="sec-cad"><h2>Cadangan data</h2><div class="sub" style="margin-bottom:8px">Unduh cadangan secara berkala lalu uji bahwa cadangan dapat dibaca dan utuh. Cadangan yang belum pernah diuji belum tentu dapat dipulihkan. Admin server juga dapat mencadangkan basis data langsung (lihat README).</div>
      <div class="row"><button class="btn g" id="cb1">Unduh cadangan (JSON)</button></div>
      <label style="display:block;font-size:12px;color:var(--mu)">Uji cadangan: pilih berkas JSON cadangan<input id="cbf" type="file" accept="application/json,.json" style="width:100%"></label>
      <div class="sub" id="cbm"></div></div>`;
}

function backupData() {
    return {
        versi: 3, dibuat: nowIso(),
        proyek: { nama: S.nama, dur: S.dur, awal: S.awal, W: S.W, cfg: S.cfg, shape: S.shape, plan: S.plan, planHist: S.planHist, anggaran: S.anggaran },
        hari: DAYDOCS, koreksi: CORRDOCS, persetujuan: S.apprLog, opname: OPDOCS, segel: SEALDOCS,
        keuangan: S.finLog, fcfg: S.fcfg, matm: S.matm, mat: S.mat, tasks: S.tasks, tprog: S.tprog
    };
}

$("#cf").addEventListener("click", e => {
    if (e.target.id == "cb1") { download("siteowner-cadangan-" + todayStr() + ".json", JSON.stringify(backupData(), null, 1), "application/json"); $("#cbm").textContent = "Cadangan diunduh. Simpan di tempat aman dan ujilah secara berkala."; }
});
$("#cf").addEventListener("change", async e => {
    if (e.target.id != "cbf" || !e.target.files[0]) return;
    const r = await checkBackup(await e.target.files[0].text());
    $("#cbm").textContent = r.ok ? "Cadangan valid: " + r.hari + " hari, " + r.opname + " opname, " + r.koreksi + " koreksi, " + r.biaya + " biaya; rantai hash " + r.rantai + "." : "Cadangan tidak valid: " + r.err;
});

$("#lo").onclick = () => logout();
$("#ft").addEventListener("input", () => { dirty = true; clearErr(); prev(); });
form();
render();
boot();
