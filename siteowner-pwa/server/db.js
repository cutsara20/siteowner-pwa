"use strict";

const { Pool } = require("pg");
const { AsyncLocalStorage } = require("node:async_hooks");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diatur.");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

const txContext = new AsyncLocalStorage();

async function query(sql, values = []) {
    const client = txContext.getStore() || pool;
    return client.query(sql, values);
}

async function getDoc(name, dflt = null) {
    const r = await query(
        "SELECT json FROM docs WHERE name = $1",
        [name]
    );
    return r.rows.length ? r.rows[0].json : dflt;
}

async function setDoc(name, obj) {
    await query(
        `INSERT INTO docs(name, json, updated)
         VALUES($1, $2::jsonb, $3)
         ON CONFLICT(name)
         DO UPDATE SET json = EXCLUDED.json, updated = EXCLUDED.updated`,
        [name, JSON.stringify(obj), new Date().toISOString()]
    );
}

async function list(coll) {
    const r = await query(
        "SELECT json FROM recs WHERE coll = $1 ORDER BY k",
        [coll]
    );
    return r.rows.map(row => row.json);
}

async function add(coll, k, obj) {
    await query(
        "INSERT INTO recs(coll, k, json) VALUES($1, $2, $3::jsonb)",
        [coll, k, JSON.stringify(obj)]
    );
}

async function count(coll) {
    const r = await query(
        "SELECT COUNT(*)::int AS c FROM recs WHERE coll = $1",
        [coll]
    );
    return r.rows[0].c;
}

async function tx(fn) {
    const existing = txContext.getStore();
    if (existing) return fn();

    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await txContext.run(client, fn);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    db: { query },
    pool,
    DATA_DIR: "Supabase PostgreSQL",
    query,
    getDoc,
    setDoc,
    list,
    add,
    count,
    tx
};