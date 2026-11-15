// Service worker: cangkang aplikasi tersedia offline. Permintaan /api tidak pernah di-cache.
const CACHE = "siteowner-v1";
const SHELL = ["/", "/index.html", "/css/style.css", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon.svg",
    "/js/integrity.js", "/js/config.js", "/js/logic.js", "/js/crypto.js", "/js/export.js", "/js/api.js", "/js/auth.js", "/js/ui.js", "/js/pwa.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
    const u = new URL(e.request.url);
    if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
    // jaringan dulu agar pembaruan cepat sampai; cadangan dari cache saat offline
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("/index.html"))));
});
