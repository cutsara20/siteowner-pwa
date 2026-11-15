// Pendaftaran service worker (agar aplikasi dapat dipasang dan cangkangnya tersedia offline)
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
