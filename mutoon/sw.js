// أكاديمية المتون — يعمل دون إنترنت: يحفظ ملفات التطبيق والنصوص والخطوط في الجهاز.
const SHELL = "mutoon-academy-v2";
const ASSETS = [
  "./", "./index.html", "./style.css", "./app.js", "./app-data.js", "./manifest.webmanifest",
  "./icon.svg", "./icon-192.png", "./icon-512.png",
  "./data/nawaqid.js", "./data/qawaid.js", "./data/usul.js", "./data/nawawi.js",
  "./data/tuhfa.js", "./data/shurut.js", "./data/tawhid.js", "./data/bayquniyya.js", "./data/ilbiri.js", "./data/ajurrumiyya.js", "./data/wasitiyya.js", "./data/waraqat.js", "./data/unwan.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mutoon-academy-v") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fonts: cache first.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("mutoon-academy-fonts").then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // App files: serve from cache at once, refresh in the background.
  e.respondWith(caches.open(SHELL).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
