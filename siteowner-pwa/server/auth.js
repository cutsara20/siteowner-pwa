"use strict";
// PIN (scrypt + garam), sesi cookie, pembatasan percobaan login, kode setup awal.
const crypto = require("node:crypto");
const store = require("./db");
const { db } = store;

const SESSION_MAX_IDLE_MS = 12 * 60 * 60 * 1000; // batas keras sisi server; sesi tak aktif 10 menit ditutup oleh aplikasi
const pinValid = p => typeof p === "string" && /^\d{4,8}$/.test(p);
const sha = s => crypto.createHash("sha256").update(s).digest("hex");

function hashPin(pin, salt) { return crypto.scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex"); }
function setPin(role, pin) {
    const salt = crypto.randomBytes(12).toString("hex");
    db.prepare("INSERT INTO pins(role,salt,hash) VALUES(?,?,?) ON CONFLICT(role) DO UPDATE SET salt=excluded.salt, hash=excluded.hash").run(role, salt, hashPin(pin, salt));
}
function checkPin(role, pin) {
    const r = db.prepare("SELECT salt,hash FROM pins WHERE role=?").get(role);
    if (!r || !pinValid(pin)) return false;
    const a = Buffer.from(hashPin(pin, r.salt), "hex"), b = Buffer.from(r.hash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const isSetup = () => db.prepare("SELECT COUNT(*) AS c FROM pins").get().c >= 2;

// Kode setup: mencegah orang asing yang lebih dulu membuka server menjadi Owner.
function setupCode() {
    let r = db.prepare("SELECT v FROM meta WHERE k='setup_code'").get();
    if (!r) {
        const code = String(crypto.randomInt(0, 1e8)).padStart(8, "0");
        db.prepare("INSERT INTO meta(k,v) VALUES('setup_code',?)").run(code);
        console.log("\n  KODE SETUP AWAL (dibutuhkan saat membuat PIN pertama kali): " + code + "\n");
        return code;
    }
    return r.v;
}
const consumeSetupCode = () => db.prepare("DELETE FROM meta WHERE k='setup_code'").run();

function createSession(role) {
    const id = crypto.randomBytes(32).toString("hex"), now = Date.now();
    db.prepare("INSERT INTO sessions(id,role,created,last_seen) VALUES(?,?,?,?)").run(sha(id), role, now, now);
    db.prepare("DELETE FROM sessions WHERE last_seen<?").run(now - SESSION_MAX_IDLE_MS);
    return id;
}
function readCookie(req, name) {
    const m = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(name + "="));
    return m ? m.slice(name.length + 1) : null;
}
function sessionOf(req, touch = true) {
    const id = readCookie(req, "so_sid");
    if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;
    const row = db.prepare("SELECT role,last_seen FROM sessions WHERE id=?").get(sha(id));
    if (!row || Date.now() - row.last_seen > SESSION_MAX_IDLE_MS) return null;
    if (touch) db.prepare("UPDATE sessions SET last_seen=? WHERE id=?").run(Date.now(), sha(id));
    return { role: row.role, id };
}
function destroySession(req) {
    const id = readCookie(req, "so_sid");
    if (id) db.prepare("DELETE FROM sessions WHERE id=?").run(sha(id));
}
function destroyAllSessions() { db.prepare("DELETE FROM sessions").run(); }

// 5 salah berturut-turut: dikunci 30 detik per (alamat, peran)
const fails = new Map();
function lockLeft(key) { const f = fails.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
function noteFail(key) {
    const f = fails.get(key) || { n: 0, until: 0 };
    f.n++;
    if (f.n >= 5) { f.n = 0; f.until = Date.now() + 30000; }
    fails.set(key, f);
    return 5 - f.n;
}
const clearFail = key => fails.delete(key);

module.exports = { pinValid, setPin, checkPin, isSetup, setupCode, consumeSetupCode, createSession, sessionOf, destroySession, destroyAllSessions, lockLeft, noteFail, clearFail, sha };
