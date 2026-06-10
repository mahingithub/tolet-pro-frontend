importScripts('/call-notification-sw.js');

/* TO-LET PRO — Service Worker
 * ───────────────────────────────────────────────────────────────────────────
 * Makes the app installable + gives a basic offline shell. Written DEFENSIVELY
 * because TO-LET PRO is real-time (Socket.IO signaling, WebRTC/ZegoCloud media,
 * live chat polling). If the SW cached those, calls would silently break and
 * users would see stale messages — bugs that are miserable to trace.
 *
 * The rule here is simple and strict:
 *   • STATIC assets (the built JS/CSS/images, icons, manifest) → cache-first.
 *   • EVERYTHING dynamic (API, socket, Zego, cross-origin) → NETWORK-ONLY,
 *     never touched by the cache.
 *
 * ► TO CHANGE LATER:
 *   - Bump CACHE_VERSION whenever you want every client to drop the old cache
 *     and re-fetch fresh assets (e.g. after a big release).
 *   - The version below is a STATIC string, so it only invalidates caches when
 *     YOU change it by hand (audit 6.5). For automatic per-deploy invalidation,
 *     inject the build hash here at build time — e.g. a post-`vite build` script
 *     that replaces a `__BUILD_ID__` placeholder in dist/service-worker.js with
 *     `Date.now()` or the git short SHA, or adopt vite-plugin-pwa.
 *   - NEVER add /api, socket.io, or media hosts to precache or to the
 *     cache-first branch. Keep them on the network-only path below.
 */

// Bump this on any release that changes a PRECACHED file (index.html, manifest,
// icons, offline.html). Hashed build assets (index-*.js/css) already bust their
// own cache via unique filenames, so they don't need a version bump.
const CACHE_VERSION = 'tolet-pro-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Minimal app shell. Hashed build assets (index-*.js/css) are cached at runtime
// on first fetch — we don't list them here because their names change per build.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Requests we must NEVER serve from cache. If any of these substrings appear in
// the URL, the SW gets out of the way and lets the network handle it directly.
// (Covers your Render API, Socket.IO, and ZegoCloud media/log endpoints.)
const NETWORK_ONLY = [
  '/api/',
  '/socket.io/',
  'onrender.com',          // backend host (API + socket)
  'zego.im',
  'zegocloud.com',
  'coolzcloud.com',        // Zego media/edge
  'webliveroom',           // Zego room endpoints
  'googleapis.com',        // Firebase / Google auth
  'firebaseio.com',
  'identitytoolkit',       // Firebase auth
];

// ─── Install: precache the shell ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate the new SW immediately
      .catch(() => {/* precache failure shouldn't block install */})
  );
});

// ─── Activate: drop old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Helper: should this request bypass the cache entirely?
function isNetworkOnly(url) {
  return NETWORK_ONLY.some((frag) => url.includes(frag));
}

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only deal with GET. Never cache POST/PATCH/DELETE (calls, sending messages,
  // mark-seen, deletes, token mint — all must hit the network live).
  if (req.method !== 'GET') return;

  const url = req.url;

  // Real-time / API / cross-origin dynamic → straight to network, no caching.
  if (isNetworkOnly(url)) {
    return; // let the browser handle it normally
  }

  // Navigations (HTML page loads): network-first, fall back to offline shell.
  // This keeps users on fresh HTML when online, but shows something when not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // keep a fresh copy of the shell for offline
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // PWA manifest: network-first so install metadata (name, icons, theme)
  // refreshes on its own without waiting for a manual CACHE_VERSION bump
  // (audit 6.5). Falls back to the cached copy when offline.
  if (url.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin static assets (built JS/CSS, icons, images): cache-first, then
  // populate the cache on first hit. Fast repeat loads, works offline.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, basic (same-origin) responses.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
