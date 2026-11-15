"use strict";
// Penyimpanan SQLite (node:sqlite bawaan Node 22+). Koleksi catatan bersifat tambah-saja (append-only):
// pemicu di bawah menolak UPDATE/DELETE, sama seperti aturan aplikasi "hari yang disimpan terkunci".
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "siteowner.db"));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recs (coll TEXT NOT NULL, k INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (coll, k));
CREATE TABLE IF NOT EXISTS pins (role TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, role TEXT NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS recs_no_update BEFORE UPDATE ON recs BEGIN SELECT RAISE(ABORT, 'catatan bersifat tambah-saja'); END;
CREATE TRIGGER IF NOT EXISTS recs_no_delete BEFORE DELETE ON recs BEGIN SELECT RAISE(ABORT, 'catatan bersifat tambah-saja'); END;
`);

const q = {
    getDoc: db.prepare("SELECT json FROM docs WHERE name=?"),
    setDoc: db.prepare("INSERT INTO docs(name,json,updated) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET json=excluded.json, updated=excluded.updated"),
    list: db.prepare("SELECT json FROM recs WHERE coll=? ORDER BY k"),
    add: db.prepare("INSERT INTO recs(coll,k,json) VALUES(?,?,?)"),
    count: db.prepare("SELECT COUNT(*) AS c FROM recs WHERE coll=?"),
};

const getDoc = (name, dflt = null) => { const r = q.getDoc.get(name); return r ? JSON.parse(r.json) : dflt; };
const setDoc = (name, obj) => { q.setDoc.run(name, JSON.stringify(obj), new Date().toISOString()); };
const list = coll => q.list.all(coll).map(r => JSON.parse(r.json));
const add = (coll, k, obj) => { q.add.run(coll, k, JSON.stringify(obj)); };
const count = coll => q.count.get(coll).c;
const tx = fn => { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };

module.exports = { db, DATA_DIR, getDoc, setDoc, list, add, count, tx };
