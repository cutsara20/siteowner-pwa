// Sidik digital SHA-256 untuk memeriksa rantai hari/koreksi (server yang membuat sidik; browser hanya memverifikasi)
const canon = Integrity.canon;

async function sha256(text) {
    if (typeof crypto !== "undefined" && crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256js(text); // cadangan bila crypto.subtle tidak tersedia (mis. beberapa WebView)
}

function dayHash(prev, day) { return sha256(Integrity.dayInput(prev, day)); }

async function chainOf(days) {
    let h = "0";
    const out = [];
    for (const d of days) {
        h = await dayHash(h, d);
        out.push(h);
    }
    return out;
}

async function verifyChain(days, ops) {
    const calc = await chainOf(days);
    for (let i = 0; i < days.length; i++)
        if (days[i].h !== calc[i])
            return { ok: false, day: i + 1, why: "isi hari ke-" + (i + 1) + " tidak cocok dengan sidik digital tersimpan" };
    for (const o of ops)
        if (o.d > 0 && o.d <= days.length && o.hd !== calc[o.d - 1])
            return { ok: false, day: o.d, why: "data hingga hari ke-" + o.d + " berubah sejak disegel opname" };
    return { ok: true, n: days.length, sealed: ops.filter(o => o.d > 0).length };
}

// ---------- SHA-256 murni JavaScript (cadangan) ----------
const SHA_P = [];
for (let n = 2; SHA_P.length < 64; n++) if (SHA_P.every(p => n % p)) SHA_P.push(n);
const SHA_FR = x => Math.floor((x - Math.floor(x)) * 4294967296);
const SHA_K = SHA_P.map(p => SHA_FR(Math.cbrt(p)));
const SHA_H0 = SHA_P.slice(0, 8).map(p => SHA_FR(Math.sqrt(p)));

function sha256js(str) {
    const bytes = [...new TextEncoder().encode(str)];
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 != 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    let H = SHA_H0.slice();
    for (let o = 0; o < bytes.length; o += 64) {
        const w = [];
        for (let i = 0; i < 16; i++)
            w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + SHA_K[i] + w[i]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + mj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

const pinValid = p => /^\d{4,8}$/.test(p);
