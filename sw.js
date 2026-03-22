/* ═══════════════════════════════════════════════════════════
   JAPAN 2026 — Service Worker
   Caches app shell for offline use. Firestore handles its
   own offline persistence separately.
   ═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'japan-2026-202603221800';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // SortableJS — cached for offline drag-and-drop
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js',
  // Google Fonts — cache the CSS (font files get cached on first use)
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap',
];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache first, fall back to network
// For navigation requests (HTML), try network first so you always get the latest
// For everything else (CSS, JS, fonts, images), serve cache first for speed
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Firestore, Firebase Auth, and analytics requests — let them go to network
  if (url.hostname.includes('firestore') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com/identitytoolkit') ||
      url.hostname.includes('securetoken') ||
      url.hostname.includes('er-api.com')) {
    return;
  }

  // For HTML navigation — network first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // For everything else — stale-while-revalidate:
  // Return cached version instantly for speed, fetch update in background
  // so the *next* load always has the latest files without manual cache busting.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if(networkResponse.ok){
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {}); // ignore network errors silently in background
      return cached || fetchPromise;
    })
  );
});
