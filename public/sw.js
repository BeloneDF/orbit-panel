const CACHE_NAME = "orbit-static-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const staticAsset = request.method === "GET" && url.origin === self.location.origin && ["style", "script", "font", "image"].includes(request.destination);
  // Rotas, APIs, sessões e dados da instância permanecem sempre na rede.
  if (!staticAsset) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))); }
    return response;
  })));
});
