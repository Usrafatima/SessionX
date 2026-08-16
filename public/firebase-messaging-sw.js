/* Firebase background messaging + a small offline app shell cache. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// v2: _next/static is served network-first so rebuilt JS bundles can never be
// hydrated against older HTML (that caused React hydration mismatches).
const CACHE = "sessionx-v2";
const OFFLINE = "/offline";
// Never let a failed offline-cache fetch abort the SW install: an SW that fails to
// activate leaves the browser with no push handler, which silently kills native
// notifications (navigator.serviceWorker.ready never resolves in the page).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/", OFFLINE, "/icons/icon.svg"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))]));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put("/", copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/") || caches.match(OFFLINE))));
    return;
  }
  // Build assets (_next/static) change between builds, and in dev their URLs are
  // stable — a cache-first policy would serve an old bundle next to fresh HTML.
  // Always hit the network first and keep the cache only as an offline fallback.
  if (sameOrigin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { if (sameOrigin) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); } return response; })));
});

const workerUrl = new URL(self.location.href);
const config = {
  apiKey: workerUrl.searchParams.get("apiKey"),
  projectId: workerUrl.searchParams.get("projectId"),
  messagingSenderId: workerUrl.searchParams.get("messagingSenderId"),
  appId: workerUrl.searchParams.get("appId")
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "SessionX";
    const body = payload.notification?.body || payload.data?.body;
    // Keep the open dashboard in sync when a push arrives.
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage({ type: "TRADING_PUSH", payload: { title, body, data: payload.data } })));
    // The Firebase messaging SDK (loaded above) already auto-displays background
    // messages that carry a `notification` payload. Calling showNotification here
    // too produces a duplicate popup per message, so only display ourselves for
    // data-only messages.
    if (!payload.notification) {
      return self.registration.showNotification(title, { body, icon: "/icons/icon.svg", badge: "/icons/badge.svg", tag: payload.data?.eventId, data: { page: payload.data?.page || "home" } });
    }
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // The dashboard is a hash-routed SPA at /dashboard#<view>; the landing page does not
  // read a ?page= query param, so clicks must navigate into the dashboard.
  const page = event.notification.data?.page || "home";
  const target = new URL(`/dashboard#${page}`, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes("/dashboard")) || clients.find((client) => client.url.startsWith(self.location.origin));
      return existing ? existing.focus().then(() => existing.navigate(target.href)) : self.clients.openWindow(target.href);
    })
  );
});
