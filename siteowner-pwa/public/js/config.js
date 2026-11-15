// Konfigurasi, aturan upah, daftar pekerja, dan state awal (dimuat dari server setelah login)
const TGT=2.5,BJ=0.05;
let STD=150000,LEM=25000,BON=30000,PEN=20000,PAP=10000,PSD=1,PST=.5,PAS=1,PAM=.5,AL=.8,AB=.95,LM1=1,LM2=1,OPI=5,VMAX=5;
const DW=[["Pak Budi","Pembesian","kg besi",250],["Pak Joko","Cor beton","m³",6],["Pak Agus","Bekisting","m²",12],["Pak Rahmat","Pasang bata","m²",10],["Pak Dani","Finishing","m²",18]];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let W=DW;
const ST=["Absen","Bekerja","Sakit, dilarang kerja","APD tidak lengkap, dilarang kerja"];
const OP={s:["Sakit","Kurang sehat","Sehat"],a:["Tidak lengkap","Sebagian","Lengkap"],t:["Tidak teliti","Kurang teliti","Teliti"],d:["Tidak patuh","Setengah patuh","Patuh"]},SK=[1,3,5],LB=m=>m<=0?"Tidak lembur":(m>=60?Math.floor(m/60)+" jam":"")+(m%60&&m>=60?" ":"")+(m%60?m%60+" menit":"");
const $=s=>document.querySelector(s),Rp=n=>"Rp "+Math.round(n).toLocaleString("id-ID"),F=(n,d=1)=>Number(n).toFixed(d).replace(".",",");
let S={nama:"Proyek",dur:20,awal:65,days:[],meta:[],op:[],W:DW.map(w=>w.slice()),cfg:{},log:[],shape:"s",plan:[],planHist:[],anggaran:0,fin:[],raw:null,corr:[],apprLog:[],appr:{},seals:[],fcfg:{nilai:0,rab:[]},matm:[],mat:[],tasks:[],tprog:[],finLog:[]};
lc();

function lc() {
    W=S.W;
    const c=S.cfg,g=(k,d)=>c[k]===undefined?d:c[k];
    STD=g("std",150000);
    LEM=g("lem",25000);
    BON=g("bon",30000);
    PEN=g("pen",20000);
    PAP=g("pap",10000);
    PSD=g("psd",g("psk",1));
    PST=g("pst",.5);
    PAS=g("pas",1);
    PAM=g("pam",g("pad",.5));
    AL=g("al",.8);
    AB=g("ab",.95);
    LM1=g("lm1",1);
    LM2=g("lm2",1);
    OPI=Math.max(1,Math.round(g("opi",5)));
    VMAX=Math.max(1.5,g("vmax",5))
}
let role = null; // peran sesi aktif: "owner" | "sup" | null
