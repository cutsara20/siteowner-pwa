// Dipakai bersama oleh server (Node) dan browser: bentuk teks baku yang di-hash untuk rantai SHA-256.
// Berkas ini HARUS sama persis di kedua sisi, jadi hanya ada satu salinan.
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.Integrity = factory();
})(typeof self !== "undefined" ? self : this, function () {
    // JSON dengan urutan kunci tetap, agar hash sama walau urutan kunci berubah di database
    function canon(v) {
        if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
        if (v && typeof v == "object")
            return "{" + Object.keys(v).filter(k => v[k] !== undefined).sort()
                .map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
        return JSON.stringify(v === undefined ? null : v);
    }
    // tanggal kerja ikut disidik hanya jika ada (agar data lama tetap valid)
    function dayInput(prev, day) {
        return prev + "|" + canon(day.tgl ? [day.rows, day.by, day.ts, day.photos || [], day.tgl] : [day.rows, day.by, day.ts, day.photos || []]);
    }
    function corrInput(prev, c) {
        return prev + "|" + canon([c.n, c.k, c.rows, c.by, c.ts, c.alasan]);
    }
    return { canon, dayInput, corrInput };
});
