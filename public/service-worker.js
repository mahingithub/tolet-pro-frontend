importScripts('/call-notification-sw.js');

/* TO-LET PRO — Service Worker
 * ───────────────────────────────────────────────────────────────────────────
 * Makes the app installable + gives a basic offline shell. Written DEFENSIVELY
 * because TO-LET PRO is real-time (Socket.IO signaling, peer-to-peer WebRTC
 * media, live chat polling). If the SW cached those, calls would silently break
 * and users would see stale messages — bugs that are miserable to trace.
 *
 * The rule here is simple and strict:
 *   • STATIC assets (the built JS/CSS/images, icons, manifest) → cache-first.
 *   • EVERYTHING dynamic (API, socket, cross-origin) → NETWORK-ONLY,
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
const CACHE_VERSION = 'tolet-pro-v3';
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
// (Covers your Render API and Socket.IO signaling endpoints.)
const NETWORK_ONLY = [
  '/api/',
  '/socket.io/',
  'onrender.com',          // backend host (API + socket)
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

  // Cross-origin requests (Cloudinary chat media, CDNs, any third-party) →
  // NEVER intercept. The browser must handle these itself, including the HTTP
  // Range requests that <audio>/<video> use for voice messages. Previously the
  // SW re-fetched these and a failed range re-fetch returned a 503, which is
  // exactly why voice notes wouldn't play. Getting out of the way fixes it.
  let sameOrigin = true;
  try { sameOrigin = new URL(url).origin === self.location.origin; } catch { sameOrigin = true; }
  if (!sameOrigin) return;

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
        .catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')).then((r) => r || new Response('Offline', { status: 503 })))
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
      }).catch(() => cached || new Response('Offline or missing resource', { status: 503 }));
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'New message';
  let options = {
    body: data.body || 'You have a new message.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data // Pass all data
  };

  const isCall = data.type === 'incoming_call' || data.kind === 'incoming_call';
  const isMessage = data.type === 'message';
  const isBooking = data.type === 'booking';

  if (isCall) {
    options = {
      ...options,
      tag: `incoming-call-${data.callId}`,
      requireInteraction: true,
      renotify: true,
      vibrate: [250, 100, 250, 100, 250],
      actions: [
        { action: 'answer', title: '✅ রিসিভ করুন' },
        { action: 'decline', title: '❌ কাটুন' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else if (data.kind === 'missed_call') {
    options = {
      ...options,
      tag: `missed-call-${data.callId}`,
      renotify: true,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else if (isMessage) {
    options = {
      ...options,
      tag: `message-${data.senderId || Date.now()}`,
    };
    event.waitUntil(self.registration.showNotification(data.title || 'নতুন মেসেজ', options));
  } else if (isBooking) {
    options = {
      ...options,
      tag: `booking-${data.targetId || Date.now()}`,
    };
    event.waitUntil(self.registration.showNotification(data.title || 'বুকিং আপডেট', options));
  } else {
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  
  // If it's an incoming call and user clicked decline
  if ((data.type === 'incoming_call' || data.kind === 'incoming_call') && event.action === 'decline') {
    event.waitUntil(
      fetch(`${data.apiBaseUrl || '/api'}/calls/push-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          token: data.callActionToken,
          callId: data.callId
        })
      }).catch((err) => console.error('Failed to decline via push:', err))
    );
    return;
  }

  // Otherwise, determine the URL to open
  let urlToOpen = '/';
  if (data.type === 'incoming_call' || data.kind === 'incoming_call') {
    const action = (event.action === 'answer' || event.action === 'accept') ? 'accept' : 'open';
    const params = new URLSearchParams({
      incomingCall: '1',
      callAction: action,
      callId: data.callId || '',
      callerId: data.callerId || '',
      callerName: data.callerName || '',
      callerAvatar: data.callerAvatar || '',
      type: data.type || 'voice',
      roomId: data.roomId || ''
    });
    urlToOpen = `/messages?${params.toString()}`;
  } else if (data.kind === 'missed_call') {
    urlToOpen = `/messages?userId=${data.callerId || ''}`;
  } else if (data.url) {
    urlToOpen = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          // Send message to active client if it's an incoming call
          if (data.type === 'incoming_call' || data.kind === 'incoming_call') {
            client.postMessage({
              type: 'ANSWER_CALL',
              payload: data
            });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
