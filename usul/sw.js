// دروس ثلاثة الأصول — يحفظ التطبيق على الجهاز ليعمل دون إنترنت.
const SHELL = "usul-shell-v3";
const ASSETS = ["./", "./index.html", "./lessons.js", "./extras.js", "./audio.js", "./manifest.webmanifest", "../icon-192.png", "../icon-512.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("usul-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const same = url.origin === self.location.origin;
  if (!same && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? await c.match("./index.html") : undefined);
    const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })());
});
