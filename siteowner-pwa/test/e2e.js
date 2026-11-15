// Tes browser end-to-end (Playwright + Chromium): node test/e2e.js
"use strict";
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "so-e2e-"));
const { chromium } = require("playwright");
const { server } = require("../server/server");
const auth = require("../server/auth");
const assert = require("node:assert");

const errors = [];
function watchErrors(page, tag) {
    page.on("pageerror", e => errors.push(tag + " pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(tag + " console: " + m.text()); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const url = "http://127.0.0.1:" + server.address().port + "/";
    const browser = await chromium.launch();
    const ownerCtx = await browser.newContext(), supCtx = await browser.newContext();
    const A = await ownerCtx.newPage(), B = await supCtx.newPage();
    watchErrors(A, "owner"); watchErrors(B, "sup");

    // 1. setup awal sebagai Owner
    await A.goto(url);
    await A.click("#r1");
    await A.waitForSelector("#sv0");
    await A.fill("#o1", "1234"); await A.fill("#o2", "1234"); await A.fill("#s1", "5678"); await A.fill("#s2", "5678");
    await A.fill("#sc", "00000000"); await A.click("#sv0");
    await A.waitForFunction(() => document.querySelector("#gm")?.textContent.includes("Kode setup salah"));
    await A.fill("#sc", auth.setupCode()); await A.click("#sv0");
    await A.waitForSelector("#who");
    assert.match(await A.textContent("#who"), /Owner/);
    console.log("ok setup + masuk Owner");

    // 2. semua tab Owner dapat dibuka tanpa galat
    for (const t of ["a", "o", "k", "m", "j", "n", "l", "r", "p", "b", "d"]) { await A.click(`.tabs button[data-t="${t}"]`); await sleep(60); }
    console.log("ok semua tab Owner");

    // 3. Supervisor masuk dari perangkat lain
    await B.goto(url);
    await B.click("#r2"); await B.fill("#pn", "0000"); await B.click("#go");
    await B.waitForFunction(() => document.querySelector("#gm")?.textContent.includes("PIN salah"));
    await B.fill("#pn", "5678"); await B.click("#go");
    await B.waitForSelector("#who");
    assert.match(await B.textContent("#who"), /Supervisor/);
    assert.equal(await B.locator('.tabs button[data-t="d"]').isVisible(), false, "supervisor tidak melihat Dashboard Owner");
    console.log("ok Supervisor masuk, tab Owner tersembunyi");

    // 4. Supervisor isi hari 1
    await B.click('.tabs button[data-t="i"]');
    await B.fill("#by", "Pak Supervisor");
    const n = await B.locator("#ft .wk").count();
    assert.equal(n, 5);
    for (let i = 0; i < n; i++) {
        const card = B.locator("#ft .wk").nth(i);
        const tgt = +(await card.locator("label[data-f=v]").textContent()).match(/target ([\d.,]+)/)[1].replace(",", ".");
        await card.locator(".v").fill(String(Math.round(tgt * 0.9 * 10) / 10));
    }
    await B.click("#sv");
    await B.waitForFunction(() => document.querySelector("#sm")?.textContent.includes("tersimpan"), null, { timeout: 8000 });
    console.log("ok hari 1 tersimpan:", await B.textContent("#sm"));

    // 5. Owner melihat data tanpa muat ulang (SSE) + integritas
    await A.click('.tabs button[data-t="d"]');
    await A.waitForFunction(() => /Hari ke-1 dari/.test(document.querySelector("#t-d")?.textContent || ""), null, { timeout: 8000 });
    await A.waitForFunction(() => /Aman: 1 hari/.test(document.querySelector("#ig")?.textContent || ""), null, { timeout: 8000 });
    console.log("ok sinkronisasi waktu nyata + integritas data aman");

    // 6. Owner minta revisi; Supervisor melihat status dan tombol Koreksi
    await A.click('.tabs button[data-t="a"]');
    await A.fill("#t-a .an", "Cek volume hari ini");
    await A.click('#t-a [data-ap="revisi"]');
    await B.waitForSelector("#hs [data-kr]", { timeout: 8000 });
    await B.click("#hs [data-kr]");
    await B.fill("#al", "Volume diukur ulang");
    await B.click("#sv");
    await B.waitForFunction(() => document.querySelector("#sm")?.textContent.includes("Koreksi hari ke-1 terkirim"), null, { timeout: 8000 });
    await A.waitForFunction(() => /Dikirim ulang/.test(document.querySelector("#t-a")?.textContent || ""), null, { timeout: 8000 });
    console.log("ok revisi -> koreksi -> dikirim ulang");

    // 7. Owner: isi RAB + material, supervisor catat material masuk
    await A.click('.tabs button[data-t="p"]');
    await A.fill("#rabn", "85000000");
    await A.fill("#rabb .r-ur", "Besi beton"); await A.fill("#rabb .r-vol", "100"); await A.fill("#rabb .r-hr", "15000");
    await A.click("#rabsv");
    await A.waitForFunction(() => /RAB tersimpan/.test(document.querySelector("#rabm")?.textContent || ""));
    await A.fill("#mmb .m-nm", "Semen"); await A.fill("#mmb .m-sat", "sak"); await A.fill("#mmb .m-min", "5"); await A.click("#mmsv");
    await A.waitForFunction(() => /Daftar material tersimpan/.test(document.querySelector("#mmm")?.textContent || ""));
    await B.click('.tabs button[data-t="m"]');
    await B.waitForSelector("#mvadd", { timeout: 8000 });
    await B.fill("#mv4", "20"); await B.fill("#mv6", "Toko Maju nota 1"); await B.fill("#mv7", "Pak Supervisor"); await B.click("#mvadd");
    await A.click('.tabs button[data-t="m"]');
    await A.waitForFunction(() => /Toko Maju/.test(document.querySelector("#t-m")?.textContent || ""), null, { timeout: 8000 });
    console.log("ok RAB, material, sinkronisasi material");

    // 8. ekspor CSV/PDF memicu unduhan
    await A.click('.tabs button[data-t="n"]');
    const [dl1] = await Promise.all([A.waitForEvent("download"), A.click('[data-ex="rekap"]')]);
    assert.match(dl1.suggestedFilename(), /siteowner-rekap\.csv/);
    const [dl2] = await Promise.all([A.waitForEvent("download"), A.click("#rppdf")]);
    const pdfPath = await dl2.path();
    assert.equal(fs.readFileSync(pdfPath).slice(0, 5).toString(), "%PDF-");
    console.log("ok unduh CSV dan PDF");

    // 9. keluar menutup sesi; reload tidak masuk otomatis
    await A.click("#lo");
    await A.waitForSelector("#r1");
    await A.reload();
    await A.waitForSelector("#r1");
    console.log("ok keluar");

    // 10. reload saat sesi aktif tetap masuk (cookie)
    await B.reload();
    await B.waitForSelector("#who", { timeout: 8000 });
    console.log("ok reload mempertahankan sesi");

    // 11. PWA: manifest + service worker
    const man = await (await fetch(url + "manifest.webmanifest")).json();
    assert.equal(man.display, "standalone");
    await B.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 8000 });
    console.log("ok manifest + service worker");

    await browser.close(); server.close();
    const real = errors.filter(e => !/Failed to load resource.*(401|403)/.test(e));
    if (real.length) { console.error("GALAT BROWSER:\n" + real.join("\n")); process.exit(1); }
    console.log("\nSEMUA TES E2E LULUS");
})().catch(e => { console.error("GAGAL:", e.message, "\n", errors.join("\n")); process.exit(1); });
