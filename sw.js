// sw.js — the "service worker": a helper that keeps copies of the app's files
// on your phone, so Farefaren still opens with no internet.

const APP_CACHE = "farefaren-app";
const MAP_CACHE = "farefaren-maps";

// The app's files (if one is missing, that's fine: it's skipped)
const APP_FILES = [
  "./", "index.html", "style.css", "manifest.json", "icon.png",
  "app.js", "menu.js", "wishlist.js", "photos.js", "places.js", "map.js", "travel.js",
  "backup.js", "today.js", "hotel.js", "calendar.js", "offline.js", "whatnow.js", "shops.js", "start.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];

// 1. Installing: save a copy of every app file
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function (cache) {
      return Promise.allSettled(APP_FILES.map((file) => cache.add(file)));
    })
  );
  self.skipWaiting(); // start helping straight away
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim()); // look after pages that are already open
});

// 2. Every time the app asks for a file, decide where to get it from
self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(mapTile(request)); // map pictures
  } else if (url.origin === self.location.origin || url.hostname === "unpkg.com") {
    event.respondWith(appFile(request)); // the app's own files
  }
  // Anything else (like 🔍 Find on map) just goes to the internet as normal
});

// 3. App files: get the newest from the internet; if that's slow or fails, use the saved copy
async function appFile(request) {
  const cache = await caches.open(APP_CACHE);
  const fromInternet = fetch(request.url, { cache: "no-cache" }).then(function (response) {
    if (response.ok) {
      cache.put(request.url, response.clone()); // keep the saved copy up to date
    }
    return response;
  });

  try {
    return await withTimeout(fromInternet, 4000);
  } catch (error) {
    const saved = await cache.match(request, { ignoreSearch: true });
    return saved || fromInternet; // nothing saved yet: keep waiting for the internet
  }
}

// 4. Map pictures: use a saved copy if we have one, otherwise download and save it
async function mapTile(request) {
  const cache = await caches.open(MAP_CACHE);
  const saved = await cache.match(request.url);
  if (saved) {
    return saved;
  }
  try {
    const response = await fetch(request.url, { mode: "cors" });
    if (response.ok) {
      cache.put(request.url, response.clone());
    }
    return response;
  } catch (error) {
    return Response.error();
  }
}

// 5. Give up waiting for slow internet after a few seconds
function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error("too slow")), milliseconds)),
  ]);
}