// Login berperan. PIN diperiksa di server; sesi berupa cookie HttpOnly. Sesi ditutup setelah 10 menit tanpa aktivitas.
const RL = { owner: "Owner", sup: "Supervisor" };
const IDLE_MS = 10 * 60 * 1000;
let idleTimer = null;

async function boot() {
    try {
        const me = await http("GET", "/api/me");
        await loadState();
        watch();
        enter(me.role);
    } catch (e) { gate(); }
}

async function logout() {
    clearTimeout(idleTimer);
    stopWatch();
    try { await http("POST", "/api/logout", {}); } catch (e) {}
    resetState();
    gate();
}

function gate(r) {
    role = null;
    clearTimeout(idleTimer);
    ["#t-d", "#t-a", "#t-o", "#t-k", "#t-m", "#t-j", "#t-n", "#t-r", "#t-y", "#cf", "#hs"].forEach(s => $(s).innerHTML = "");
    $("#rp").value = "";
    $("#gate").style.display = "block";
    $("#app").style.display = "none";
    if (r) loginStep(r); else chooseRole();
}

function chooseRole() {
    $("#gate").innerHTML = `<div class="card"><h2>Masuk sebagai</h2>
      <div class="row"><button class="btn" id="r1">Owner / Pemilik Proyek</button><button class="btn g" id="r2">Supervisor Lapangan</button></div>
      <div class="sub">Owner dan Supervisor memakai PIN yang berbeda. Supervisor tidak dapat masuk sebagai Owner. Data tersinkron antar perangkat.</div></div>`;
    $("#r1").onclick = () => gate("owner");
    $("#r2").onclick = () => gate("sup");
}

function blocked(t) {
    $("#gate").innerHTML = `<div class="card"><h2>Tidak dapat masuk</h2><div class="al wa">${esc(t)}</div><div class="row"><button class="btn g" id="bk">Kembali</button></div></div>`;
    $("#bk").onclick = () => gate();
}

async function loginStep(r) {
    $("#gate").innerHTML = '<div class="card"><div class="sub">Memeriksa…</div></div>';
    let st;
    try { st = await http("GET", "/api/status"); } catch (e) { return blocked(e.message); }
    if (!st.setup) {
        if (r == "owner") return setupStep();
        return blocked("PIN Supervisor belum dibuat. Minta Owner masuk lebih dulu: Owner membuat PIN Supervisor saat pertama kali masuk, dan dapat mengubahnya di Pengaturan, bagian Keamanan.");
    }
    pinPrompt(r);
}

function pinField(id, label, w) {
    return `<label>${label}<input id="${id}" type="password" inputmode="numeric" maxlength="8" autocomplete="off"${w ? ' style="width:' + w + 'px"' : ""}></label>`;
}

function pinPrompt(r) {
    $("#gate").innerHTML = `<div class="card"><h2>Masuk sebagai ${RL[r]}</h2>
      <div class="row">${pinField("pn", "PIN " + RL[r], 160)}<button class="btn" id="go">Masuk</button><button class="btn g" id="bk">Kembali</button></div>
      <div class="er-msg" id="gm"></div>${r == "owner" ? '<div class="sub"><a href="#" id="fg">Lupa PIN Owner?</a></div>' : ""}</div>`;
    const m = $("#gm");
    const attempt = async () => {
        const v = $("#pn").value;
        if (!pinValid(v)) { m.textContent = "PIN harus 4 sampai 8 angka."; return; }
        $("#go").disabled = true;
        try {
            await http("POST", "/api/login", { role: r, pin: v });
            await loadState();
            watch();
            enter(r);
        } catch (e) {
            m.textContent = e.message;
            $("#pn").value = "";
            $("#go").disabled = false;
        }
    };
    $("#go").onclick = attempt;
    $("#pn").addEventListener("keydown", e => { if (e.key == "Enter") attempt(); });
    $("#bk").onclick = () => gate();
    if ($("#fg")) $("#fg").onclick = e => { e.preventDefault(); forgot(); };
}

function setupStep() {
    $("#gate").innerHTML = `<div class="card"><h2>Pengaturan awal keamanan</h2>
      <div class="sub" style="margin-bottom:8px">Buat dua PIN yang berbeda (4 sampai 8 angka): PIN Owner untuk pemilik proyek dan PIN Supervisor untuk petugas lapangan. Berikan PIN Supervisor hanya kepada supervisor. Kode setup ditampilkan di konsol server saat pertama kali dijalankan.</div>
      <div class="g">${pinField("o1", "PIN Owner")}${pinField("o2", "Ulangi PIN Owner")}${pinField("s1", "PIN Supervisor")}${pinField("s2", "Ulangi PIN Supervisor")}
      <label>Kode setup (8 angka)<input id="sc" inputmode="numeric" maxlength="8" autocomplete="off"></label></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="sv0">Simpan dan masuk</button><button class="btn g" id="bk">Kembali</button></div><div class="er-msg" id="gm"></div></div>`;
    $("#sv0").onclick = async () => {
        const a = $("#o1").value, b = $("#o2").value, c = $("#s1").value, d = $("#s2").value, code = $("#sc").value.trim(), m = $("#gm");
        if (!pinValid(a) || !pinValid(c)) { m.textContent = "Kedua PIN harus 4 sampai 8 angka."; return; }
        if (a !== b || c !== d) { m.textContent = "Pengulangan PIN tidak sama."; return; }
        if (a === c) { m.textContent = "PIN Owner dan PIN Supervisor harus berbeda."; return; }
        if (!code) { m.textContent = "Isi kode setup dari konsol server."; return; }
        $("#sv0").disabled = true;
        try {
            await http("POST", "/api/setup", { code, ownerPin: a, supPin: c });
            await loadState();
            watch();
            enter("owner");
        } catch (x) { m.textContent = x.message; $("#sv0").disabled = false; }
    };
    $("#bk").onclick = () => gate();
}

function forgot() {
    $("#gate").innerHTML = `<div class="card"><h2>Lupa PIN Owner</h2>
      <div class="al wa">PIN tersimpan sebagai hash dan tidak dapat dilihat. Administrator server dapat mengatur ulang PIN tanpa menghapus data proyek: jalankan <b>node server/cli.js reset-pins</b> di server, catat kode setup yang tampil, lalu buka aplikasi dan pilih Owner untuk membuat PIN baru.</div>
      <div class="row"><button class="btn g" id="bk">Kembali</button></div></div>`;
    $("#bk").onclick = () => gate();
}

function idleReset() {
    clearTimeout(idleTimer);
    if (role) idleTimer = setTimeout(() => { logout().then(() => toast("Sesi berakhir karena tidak aktif. Silakan masuk lagi.")); }, IDLE_MS);
}
["pointerdown", "keydown", "input", "scroll"].forEach(ev => document.addEventListener(ev, idleReset, { passive: true }));

// ---------- Keamanan di Pengaturan (Owner) ----------
function secHTML() {
    return `<div class="card" id="sec-aman"><h2>Keamanan (PIN)</h2>
      <div class="sub" style="margin-bottom:8px">Owner dan Supervisor memakai PIN berbeda. Supervisor tidak dapat masuk sebagai Owner. Jika PIN Supervisor bocor, atur ulang di sini.</div>
      <div class="g">${pinField("k1", "PIN Owner lama")}${pinField("k2", "PIN Owner baru")}${pinField("k3", "Ulangi PIN Owner baru")}</div>
      <div class="row" style="margin-top:8px"><button class="btn g" id="cpo">Ubah PIN Owner</button></div>
      <div class="g" style="margin-top:8px">${pinField("k4", "PIN Supervisor baru")}${pinField("k5", "Ulangi PIN Supervisor baru")}</div>
      <div class="row" style="margin-top:8px"><button class="btn g" id="cps">Atur ulang PIN Supervisor</button></div><div class="er-msg" id="km"></div></div>`;
}

async function changeOwnerPin() {
    const m = $("#km"), old = $("#k1").value, n = $("#k2").value, n2 = $("#k3").value;
    m.textContent = "";
    if (!pinValid(n)) { m.textContent = "PIN baru harus 4 sampai 8 angka."; return; }
    if (n !== n2) { m.textContent = "Pengulangan PIN baru tidak sama."; return; }
    try { await http("PUT", "/api/pin", { role: "owner", old, pin: n }); } catch (e) { m.textContent = e.message; return; }
    ["k1", "k2", "k3"].forEach(i => $("#" + i).value = "");
    toast("PIN Owner diubah.");
}

async function resetSupPin() {
    const m = $("#km"), n = $("#k4").value, n2 = $("#k5").value;
    m.textContent = "";
    if (!pinValid(n)) { m.textContent = "PIN harus 4 sampai 8 angka."; return; }
    if (n !== n2) { m.textContent = "Pengulangan PIN tidak sama."; return; }
    try { await http("PUT", "/api/pin", { role: "sup", pin: n }); } catch (e) { m.textContent = e.message; return; }
    ["k4", "k5"].forEach(i => $("#" + i).value = "");
    toast("PIN Supervisor diatur ulang.");
}
