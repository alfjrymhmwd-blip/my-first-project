// رفيق الحفظ — service worker: keeps the app itself and its fonts available offline.
// Quran text and recitations are cached by the page (Cache API: hifz-data / hifz-audio).
const SHELL = "hifz-shell-v2";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hifz-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: serve from cache, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = (await c.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? await c.match("./index.html") : undefined);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }

  // Google Fonts: cache-first.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    })());
    return;
  }

  // Recitation audio the page saved (used when the CDN didn't allow reading it directly).
  if (url.hostname === "cdn.islamic.network") {
    e.respondWith((async () => {
      const hit = await (await caches.open("hifz-audio")).match(req.url);
      return hit || fetch(req);
    })());
  }
});
