// رفيق الحفظ — service worker for the whole app (Quran + hadith): keeps it and its fonts available offline.
// Quran text and recitations are cached by the page (Cache API: hifz-data / hifz-audio).
const SHELL = "hifz-shell-v5";
const ASSETS = ["./", "./index.html", "./hadith.html", "./sahih/", "./sahih/index.html", "./sahih/icon.svg", "./sahih/icon-192.png", "./sahih/data/index.json", "./sahih/data/curated.json", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];

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

  // Hadith texts never change: cache first, kept in their own cache.
  if (url.origin === self.location.origin && /\/sahih\/data\/(b|m|s-)[\w-]*\.json$/.test(url.pathname)) {
    e.respondWith(caches.open("hifz-hadith").then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }

  // App files: serve from cache, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = (await c.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? await c.match(url.pathname.includes("/sahih/") ? "./sahih/index.html" : "./index.html") : undefined);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; });
      if (hit) { net.catch(() => {}); return hit; }   // refresh in the background
      return net;                                     // no copy yet: a failed load reaches the page as a normal network error
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
