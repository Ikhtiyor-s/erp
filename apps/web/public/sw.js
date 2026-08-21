// Aniq ERP PWA Service Worker — basic offline shell + asset caching
const VERSION = "v1";
const CACHE = `aniq-erp-${VERSION}`;
const APP_SHELL = ["/m", "/m/", "/manifest.json", "/icons/icon-192.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Don't cache API calls
  if (url.pathname.startsWith("/api/")) return;
  // Only cache GET
  if (e.request.method !== "GET") return;

  // Same-origin static assets: cache-first
  if (url.origin === location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached ||
        fetch(e.request, { signal: AbortSignal.timeout(15000) }).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Mobile shell pages: network-first with offline fallback
  if (url.pathname.startsWith("/m")) {
    e.respondWith(
      fetch(e.request, { signal: AbortSignal.timeout(10000) })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match("/m/")))
    );
  }
});

// Web Push notification handling
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : { title: "Aniq ERP", body: "Yangi xabar" };
  e.waitUntil(
    self.registration.showNotification(data.title || "Aniq ERP", {
      body: data.body || "",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: data.url || "/m/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/m/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const c = clients.find((cl) => cl.url.includes(url));
      if (c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
