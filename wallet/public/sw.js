const CACHE_NAME = "cloakpay-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

self.addEventListener("fetch", (event) => {
  // Network-first for API calls, cache-first for assets
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetching = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
      return cached || fetching;
    })
  );
});
