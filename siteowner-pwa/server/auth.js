"use strict";

const crypto = require("node:crypto");
const store = require("./db");

const SESSION_MAX_IDLE_MS = 12 * 60 * 60 * 1000;

const pinValid = p => typeof p === "string" && /^\d{4,8}$/.test(p);
const sha = s => crypto.createHash("sha256").update(s).digest("hex");

function hashPin(pin, salt) {
    return crypto.scryptSync(pin, salt, 32, {
        N: 16384, r: 8, p: 1
    }).toString("hex");
}

async function setPin(role, pin) {
    const salt = crypto.randomBytes(12).toString("hex");
    await store.query(
        `INSERT INTO pins(role, salt, hash)
         VALUES($1, $2, $3)
         ON CONFLICT(role)
         DO UPDATE SET salt = EXCLUDED.salt, hash = EXCLUDED.hash`,
        [role, salt, hashPin(pin, salt)]
    );
}

async function checkPin(role, pin) {
    if (!pinValid(pin)) return false;
    const r = await store.query(
        "SELECT salt, hash FROM pins WHERE role = $1", [role]
    );
    if (!r.rows.length) return false;
    const row = r.rows[0];
    const a = Buffer.from(hashPin(pin, row.salt), "hex");
    const b = Buffer.from(row.hash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function isSetup() {
    const r = await store.query("SELECT COUNT(*)::int AS c FROM pins");
    return r.rows[0].c >= 2;
}

async function setupCode() {
    const r = await store.query(
        "SELECT v FROM meta WHERE k = $1", ["setup_code"]
    );
    if (r.rows.length) return r.rows[0].v;

    const code = String(crypto.randomInt(0, 1e8)).padStart(8, "0");
    await store.query(
        "INSERT INTO meta(k, v) VALUES($1, $2) ON CONFLICT(k) DO NOTHING",
        ["setup_code", code]
    );

    const saved = await store.query(
        "SELECT v FROM meta WHERE k = $1", ["setup_code"]
    );
    if (!saved.rows.length) throw new Error("Gagal membuat kode setup.");

    console.log("\n  KODE SETUP AWAL: " + saved.rows[0].v + "\n");
    return saved.rows[0].v;
}

async function consumeSetupCode() {
    await store.query("DELETE FROM meta WHERE k = $1", ["setup_code"]);
}

async function createSession(role) {
    const id = crypto.randomBytes(32).toString("hex");
    const now = Date.now();

    await store.query(
        `INSERT INTO sessions(id, role, created, last_seen)
         VALUES($1, $2, $3, $4)`,
        [sha(id), role, now, now]
    );
    await store.query(
        "DELETE FROM sessions WHERE last_seen < $1",
        [now - SESSION_MAX_IDLE_MS]
    );
    return id;
}

function readCookie(req, name) {
    const m = (req.headers.cookie || "")
        .split(/;\s*/)
        .find(c => c.startsWith(name + "="));
    return m ? m.slice(name.length + 1) : null;
}

async function sessionOf(req, touch = true) {
    const id = readCookie(req, "so_sid");
    if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;

    const hashed = sha(id);
    const r = await store.query(
        "SELECT role, last_seen FROM sessions WHERE id = $1",
        [hashed]
    );
    if (!r.rows.length) return null;

    const row = r.rows[0];
    if (Date.now() - Number(row.last_seen) > SESSION_MAX_IDLE_MS) {
        await store.query("DELETE FROM sessions WHERE id = $1", [hashed]);
        return null;
    }

    if (touch) {
        await store.query(
            "UPDATE sessions SET last_seen = $1 WHERE id = $2",
            [Date.now(), hashed]
        );
    }
    return { role: row.role, id };
}

async function destroySession(req) {
    const id = readCookie(req, "so_sid");
    if (id) {
        await store.query("DELETE FROM sessions WHERE id = $1", [sha(id)]);
    }
}

async function destroyAllSessions() {
    await store.query("DELETE FROM sessions");
}

const fails = new Map();

function lockLeft(key) {
    const f = fails.get(key);
    return f && f.until > Date.now()
        ? Math.ceil((f.until - Date.now()) / 1000)
        : 0;
}

function noteFail(key) {
    const f = fails.get(key) || { n: 0, until: 0 };
    f.n++;
    if (f.n >= 5) {
        f.n = 0;
        f.until = Date.now() + 30000;
    }
    fails.set(key, f);
    return 5 - f.n;
}

const clearFail = key => fails.delete(key);

module.exports = {
    pinValid, setPin, checkPin, isSetup, setupCode,
    consumeSetupCode, createSession, sessionOf,
    destroySession, destroyAllSessions,
    lockLeft, noteFail, clearFail, sha
};