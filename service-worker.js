const CACHE_PREFIX = "lift-tracker-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v15`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./history-context.mjs",
  "./workout-state.mjs",
  "./plan-files.mjs",
  "./plan-builder.mjs",
  "./plan-builder-state.mjs",
  "./plan-builder.css",
  "./swipe-rows.mjs",
  "./recommendations.mjs",
  "./firebase.js",
  "./workouts.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);
  const shellUrls = APP_SHELL.map(path => new URL(path, self.registration.scope).href);
  const isAppNavigation = event.request.mode === "navigate" &&
    [new URL(self.registration.scope).pathname, new URL("./index.html", self.registration.scope).pathname].includes(requestUrl.pathname);

  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin ||
      (!shellUrls.includes(requestUrl.href) && !isAppNavigation)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // Keep an installed shell coherent until the user activates the next version.
      const cached = await cache.match(isAppNavigation ? "./index.html" : event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok && shellUrls.includes(requestUrl.href)) await cache.put(event.request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
