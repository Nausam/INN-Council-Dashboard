const CACHE_NAME = "employee-profile-shell-v5";
const SHELL = ["/offline.html", "/manifest.webmanifest", "/pwa/icon-v2-192.png", "/pwa/icon-v2-512.png", "/council-logo.png"];

// The signed-in employee's own profile page and photo, saved by the installed
// app (lib/employee-profile-cache.ts uses the same names) so it opens
// instantly. Nobody else's records are saved, and Log out deletes the cache.
const PROFILE_CACHE = "employee-profile-pages-v1";
const PROFILE_OWNER_KEY = "/__employee-profile/owner";
const PROFILE_HOME = "/employees/details";
// After opening the saved copy, the next load within this window goes to the
// server. That covers the page reloading itself after a deploy.
const SAVED_COPY_WINDOW_MS = 15000;
const savedCopyServedAt = new Map();

const isLocalDev =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "[::1]";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== PROFILE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "employee-profile:served-from-cache" && event.ports[0]) {
    const servedAt = savedCopyServedAt.get(data.path);
    event.ports[0].postMessage({ servedFromCache: Boolean(servedAt && Date.now() - servedAt < 60000) });
  }
});

async function profileOwnerId() {
  try {
    const owner = await (await caches.open(PROFILE_CACHE)).match(PROFILE_OWNER_KEY);
    const data = owner ? await owner.json() : null;
    return data && typeof data.employeeId === "string" ? data.employeeId : null;
  } catch {
    return null;
  }
}

function isCacheablePage(response) {
  return response.ok && !response.redirected && (response.headers.get("content-type") || "").includes("text/html");
}

// Saves the scripts and styles a saved page needs, so it still starts after a
// deploy has replaced them on the server.
async function cachePageAssets(response) {
  if (isLocalDev) return;
  const html = await response.text();
  const urls = Array.from(new Set(html.match(/\/_next\/static\/[^"'\s\\)]+\.(?:js|css)/g) || []));
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const asset = await fetch(url);
        if (asset.ok) await cache.put(url, asset);
      } catch {
        // Fetched again when the page asks for it.
      }
    }),
  );
}

async function handleNavigation(event) {
  const request = event.request;
  const url = new URL(request.url);
  const ownerId = url.search ? null : await profileOwnerId();
  const ownerPath = ownerId ? `${PROFILE_HOME}/${ownerId}` : null;

  if (ownerPath) {
    const cache = await caches.open(PROFILE_CACHE);

    // The app's start URL: go straight to the saved profile, no server trip.
    if (url.pathname === PROFILE_HOME && (await cache.match(ownerPath))) {
      return Response.redirect(new URL(ownerPath, self.location.origin).href, 302);
    }

    if (url.pathname === ownerPath) {
      const fresh = fetch(request).then(async (response) => {
        if (isCacheablePage(response)) {
          await cache.put(ownerPath, response.clone());
          await cachePageAssets(response.clone());
        } else if (response.type === "opaqueredirect") {
          // The server sent this employee to sign in: drop the saved copy.
          await caches.delete(PROFILE_CACHE);
        }
        return response;
      });
      const servedAt = savedCopyServedAt.get(ownerPath);
      const justServed = servedAt && Date.now() - servedAt < SAVED_COPY_WINDOW_MS;
      const saved = justServed ? undefined : await cache.match(ownerPath);
      if (saved) {
        // Show the saved copy now; the page refreshes its records itself.
        savedCopyServedAt.set(ownerPath, Date.now());
        event.waitUntil(fresh.catch(() => undefined));
        return saved;
      }
      return fresh.catch(async () => (await cache.match(ownerPath)) || caches.match("/offline.html"));
    }
  }

  return fetch(request).catch(() => caches.match("/offline.html"));
}

// The signed-in employee's photo. Its URL changes with each new photo, so a
// saved copy never goes stale.
async function handleOwnPhoto(request) {
  const cache = await caches.open(PROFILE_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const path = new URL(request.url).pathname;
    const older = (await cache.keys()).filter((key) => new URL(key.url).pathname === path);
    await Promise.all(older.map((key) => cache.delete(key)));
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js dev rebuilds scripts at the same URLs. Cached copies can hydrate
  // fresh HTML with old code, so always fetch them from the local dev server.
  if (isLocalDev && url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/api/employee-photos/") && url.searchParams.has("v")) {
    event.respondWith(
      profileOwnerId().then((ownerId) =>
        ownerId && url.pathname === `/api/employee-photos/${encodeURIComponent(ownerId)}`
          ? handleOwnPhoto(request).catch(() => fetch(request))
          : fetch(request),
      ),
    );
    return;
  }

  // Only public, versioned assets are cached here. Other pages and API
  // responses always use the network.
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
