#!/usr/bin/env node
"use strict";
// Perintah pemeliharaan di server:
//   node server/cli.js reset-pins   -> hapus PIN & sesi (data proyek TIDAK dihapus), buat kode setup baru
//   node server/cli.js backup [dir] -> salin basis data yang konsisten ke berkas bertanggal
const path = require("node:path");
const fs = require("node:fs");
const { db, DATA_DIR } = require("./db");
const auth = require("./auth");

const cmd = process.argv[2];
if (cmd === "reset-pins") {
    db.prepare("DELETE FROM pins").run();
    auth.destroyAllSessions();
    db.prepare("DELETE FROM meta WHERE k='setup_code'").run();
    auth.setupCode();
    console.log("PIN dihapus. Buka aplikasi, pilih Owner, lalu buat PIN baru dengan kode setup di atas.");
} else if (cmd === "backup") {
    const dir = process.argv[3] || path.join(DATA_DIR, "backup");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "siteowner-" + new Date().toISOString().replace(/[:.]/g, "-") + ".db");
    db.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
    console.log("Cadangan dibuat: " + file);
} else {
    console.log("Pemakaian: node server/cli.js reset-pins | backup [folder]");
    process.exitCode = 1;
}
