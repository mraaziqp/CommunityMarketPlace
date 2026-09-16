/**
 * ============================================================================
 * SHAREHUB SERVICE WORKER (public/sw.js)
 * 
 * Performance & Offline Resiliency Strategy:
 * - Cache-First for static assets, stylesheets, fonts, and icons.
 * - Network-First with offline cache fallback for navigation requests.
 * - Clean cache invalidation on service worker activation.
 * ============================================================================
 */

const CACHE_NAME = 'sharehub-cache-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 1. Install Event: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // addAll is atomic: one 404 discards the whole precache. Add each
        // asset on its own so a single missing file cannot empty the shell.
        return Promise.all(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn('[Service Worker] Skipped precaching', asset, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-First for dynamic API/Actions, Cache-First for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (e.g. POST server actions)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension or external analytics
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle static assets (fonts, images, scripts, styles)
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Navigation requests: Network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      })
    );
  }
});
