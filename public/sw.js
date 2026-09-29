const CACHE_NAME = "employee-profile-shell-v5";
const SHELL = ["/offline.html", "/manifest.webmanifest", "/pwa/icon-192.png", "/pwa/icon-512.png", "/council-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js dev rebuilds scripts at the same URLs. Cached copies can hydrate
  // fresh HTML with old code, so always fetch them from the local dev server.
  if (
    (self.location.hostname === "localhost" ||
      self.location.hostname === "127.0.0.1" ||
      self.location.hostname === "[::1]") &&
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Only public, versioned assets are cached. Employee pages and API responses
  // always use the network so private records never enter the offline cache.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});
