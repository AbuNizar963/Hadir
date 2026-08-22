const CACHE = "hadir-shell-v2";
const BASE = new URL("./", self.registration.scope).pathname;
const APP_SHELL = [
  new URL("./", self.registration.scope).href,
  new URL("./employee", self.registration.scope).href,
  new URL("./manifest.webmanifest", self.registration.scope).href
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match(new URL("./", self.registration.scope).href))));
});