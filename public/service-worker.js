importScripts('/call-notification-sw.js');

/* TO-LET PRO — Service Worker
 * ───────────────────────────────────────────────────────────────────────────
 * Makes the app installable and lets the WHOLE app open with no connection —
 * not just the homepage. Written DEFENSIVELY because TO-LET PRO is real-time
 * (Socket.IO signaling, peer-to-peer WebRTC media, live chat polling). If the
 * SW cached those, calls would silently break and users would see stale
 * messages — bugs that are miserable to trace.
 *
 * The rule here is simple and strict:
 *   • STATIC assets (the built JS/CSS/images, icons, manifest) → cache-first,
 *     and PRECACHED, so a route works offline before it has ever been opened.
 *   • EVERYTHING dynamic (API, socket, cross-origin) → NETWORK-ONLY,
 *     never touched by the cache.
 *
 * ► TO CHANGE LATER:
 *   - This file is a TEMPLATE. `scripts/inject-sw-precache.mjs` runs after
 *     `vite build` and writes the real dist/service-worker.js: it fills in the
 *     build id and the two precache lists. Editing dist/ directly is pointless
 *     — edit here and rebuild (`npm run build`, or `npm run sw:precache` on an
 *     existing build).
 *   - There is no CACHE_VERSION to bump any more. The id is derived from the
 *     build's asset hashes AND this file's own contents, so any real change
 *     gives every client a fresh cache and drops the old one on activate.
 *   - NEVER add /api, socket.io, or media hosts to precache or to the
 *     cache-first branch. Keep them on the network-only path below.
 */

// ─── Build identity ────────────────────────────────────────────────────────
// `__BUILD_ID__` is replaced at build time by scripts/inject-sw-precache.mjs,
// so every deploy gets its own cache and the previous one is dropped on
// activate. It used to be a hand-maintained 'v6', which meant a release only
// invalidated caches if somebody remembered to edit this line — and the file
// this cache holds that ISN'T content-hashed is index.html, the one file that
// must never go stale. If the placeholder is still here we're running the
// unprocessed source (dev, or a copy served straight out of public/), so fall
// back to a fixed name.
const BUILD_ID = '__BUILD_ID__';
const CACHE_VERSION = BUILD_ID.indexOf('__') === 0 ? 'tolet-pro-dev' : `tolet-pro-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// The shell: everything that isn't emitted by the bundler.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── Build assets, injected at build time ──────────────────────────────────
// WHY THIS EXISTS — this is the fix for "the app opens offline but no page
// does". Every route in this app is a lazy() chunk, so /living is a SEPARATE
// file from /host-dashboard, which is separate again from the shell. Nothing
// below used to be precached: chunks only entered the cache when the user
// happened to open that route WHILE ONLINE. So a phone that had been to the
// homepage and nothing else had exactly one route cached, and opening the app
// with no connection gave:
//
//     Failed to fetch dynamically imported module: /assets/Living-<hash>.js
//
// which React lazy() throws, which the ErrorBoundary catches — the "Something
// went wrong" screen. The app booted fine; it simply had no page to show.
//
// Two tiers, because the whole build is ~5MB raw and a first-time visitor
// should not wait on the landlord dashboard to see the homepage:
//   • CRITICAL — the entry script + stylesheet + preloaded vendor chunks, read
//     straight out of dist/index.html. Cached during install, before the SW is
//     allowed to activate.
//   • ROUTES — every other chunk. Warmed in the background AFTER the app is on
//     screen (the page posts WARM_CACHE when it goes idle). Resumable: already
//     cached URLs are skipped, so an interrupted warm picks up where it left
//     off on the next launch.
//
// Both lists are regenerated on every build. Do not edit them by hand.
// __PRECACHE_START__
const PRECACHE_CRITICAL = [];
const PRECACHE_ROUTES = [];
// __PRECACHE_END__

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

// ─── Cache filling ─────────────────────────────────────────────────────────
// Deliberately NOT cache.addAll(). addAll is all-or-nothing: one 404 among a
// hundred and forty files and the entire precache rejects, leaving the user
// with nothing cached at all — which is the worst possible failure mode for
// the thing that exists to make the app work offline. This fills the cache one
// file at a time, tolerates individual failures, and skips what's already
// there so a warm can resume after being interrupted.
async function cacheUrls(cache, urls, options) {
  const opts = options || {};
  const concurrency = opts.concurrency || 6;
  const queue = urls.slice();

  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        if (!opts.revalidate) {
          const hit = await cache.match(url, { ignoreVary: true });
          if (hit) continue;
        }
        // `cache: 'reload'` for the shell only. index.html is the one precached
        // file with no content hash, so the browser's own HTTP cache is allowed
        // to hand back a copy from the PREVIOUS deploy — which would then point
        // at build assets this deploy has already deleted. Hashed assets can
        // safely come from the HTTP cache; their names change when they do.
        const req = opts.revalidate ? new Request(url, { cache: 'reload' }) : new Request(url);
        const res = await fetch(req);
        if (res && res.status === 200 && res.type !== 'opaque') {
          await cache.put(url, res.clone());
        }
      } catch {
        /* best effort — a missing file must not abort the rest */
      }
    }
  };

  const lanes = Math.min(concurrency, Math.max(queue.length, 1));
  await Promise.all(Array.from({ length: lanes }, worker));
}

// Background warm of the route chunks. Runs at most once per SW lifetime and
// is safe to call from anywhere — the promise is memoised.
let warmPromise = null;
function warmRouteAssets() {
  if (warmPromise) return warmPromise;
  // Respect Data Saver. Someone who has explicitly asked the browser to spend
  // less data should not silently receive 5MB of route chunks; they still get
  // the shell and whatever they actually open.
  const conn = self.navigator && self.navigator.connection;
  if (conn && conn.saveData) return Promise.resolve();
  warmPromise = caches.open(STATIC_CACHE)
    .then((cache) => cacheUrls(cache, PRECACHE_ROUTES, { concurrency: 4 }))
    .catch(() => {/* best effort */});
  return warmPromise;
}

// Safety net for the launch where the page never asks. That happens for one
// load after a release: the tab is still running the PREVIOUS build's entry
// chunk, which has no idea WARM_CACHE exists, while this worker is already the
// one serving it. Without this, such a device would sit on a shell-only cache
// until its next launch — and the next launch might be the one with no signal.
let warmScheduled = false;
function scheduleWarmFallback(event) {
  if (warmScheduled) return;
  warmScheduled = true;
  // Long enough that the page has certainly finished loading whatever it
  // opened with, and that a page which DOES send WARM_CACHE has already been
  // served (warmRouteAssets is memoised, so the later call is a no-op).
  event.waitUntil(
    new Promise((resolve) => setTimeout(resolve, 20000)).then(warmRouteAssets)
  );
}

// ─── Install: precache the shell + the critical chunks ─────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(STATIC_CACHE);
      await cacheUrls(cache, PRECACHE_URLS, { revalidate: true, concurrency: 4 });
      await cacheUrls(cache, PRECACHE_CRITICAL, { concurrency: 6 });
    } catch {
      /* precache failure shouldn't block install */
    }
    await self.skipWaiting(); // activate the new SW immediately
    // The route chunks are deliberately NOT started here. Install runs while
    // the user is waiting on their first screen, and 5MB of background
    // downloads competing with the route they actually opened is a slow app
    // today in exchange for an offline app tomorrow. The page asks for the
    // warm itself once it has painted and gone idle (see main.jsx).
  })());
});

// ─── Activate: drop old caches, but only once the new one can stand alone ──
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // GUARD. Install fetches over the network, so a worker that installs on a
    // failing connection ends up with an EMPTY cache. Deleting the previous
    // cache at that point takes a phone that worked offline five minutes ago
    // and leaves it with nothing — the exact failure this whole change exists
    // to prevent, caused by the cleanup step.
    //
    // So the old cache is only dropped when the new one actually holds the
    // files needed to boot. Until then both are kept: cacheGet() prefers the
    // new cache and falls back to the old, so the app keeps working from the
    // previous build's assets, and the next successful activation cleans up.
    let complete = false;
    try {
      const cache = await caches.open(STATIC_CACHE);
      const required = ['/index.html'].concat(PRECACHE_CRITICAL);
      const hits = await Promise.all(
        required.map((u) => cache.match(u, { ignoreVary: true }))
      );
      complete = hits.every(Boolean);
    } catch {
      complete = false;
    }

    if (complete) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
      );
    }

    await self.clients.claim();
  })());
});

// ─── Messages from the page ────────────────────────────────────────────────
// WARM_CACHE is sent by main.jsx once the app is on screen and the main thread
// is idle. Going through event.waitUntil() here is the point: it tells the
// browser to keep this worker alive until the warm finishes, which a bare
// call from install() cannot promise.
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'WARM_CACHE') {
    event.waitUntil(warmRouteAssets());
  } else if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: should this request bypass the cache entirely?
function isNetworkOnly(url) {
  return NETWORK_ONLY.some((frag) => url.includes(frag));
}

// Helper: is this a BUILD ASSET — the kind of file that is safe to keep
// forever because its name changes whenever its contents do?
//
// `destination` is the browser telling us what the request is FOR, which is
// what we actually care about: a <script src> is 'script', a stylesheet is
// 'style', an <img> is 'image'. A page load is 'document', and — the case that
// caused the bug — a plain `fetch('/host-dashboard?tab=dashboard')` is ''.
// Neither is an asset, so neither may enter the static cache.
//
// The extension check is a backstop for the same reason the destination check
// exists: it keeps a request that reports no destination from being cached on
// the strength of its URL alone.
const ASSET_DESTINATIONS = ['script', 'style', 'image', 'font', 'audio', 'video', 'worker'];
const ASSET_EXT = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|mp4|webm)$/i;

function isStaticAsset(req) {
  if (ASSET_DESTINATIONS.includes(req.destination)) return true;
  // Extension is read from the PATH only — '?tab=dashboard' must never make a
  // route look like a file, and a query string must never hide one.
  try { return ASSET_EXT.test(new URL(req.url).pathname); } catch { return false; }
}

// Every cache read in this file goes through here, for ONE reason: ignoreVary.
//
// A cache lookup normally honours the stored response's `Vary` header, and
// static hosts (vite preview, Vercel, and Capacitor's asset server) answer
// build assets with `Vary: Origin`. The precache stores those responses under
// a plain `new Request(url)`, which carries no Origin header — but the entry
// script and stylesheet are requested by the browser with `crossorigin` on the
// tag, so THEIR request does carry one. Different Origin ⇒ Vary mismatch ⇒
// miss, on the four files the app cannot start without.
//
// That is precisely how the app came to boot offline into a blank white page:
// index.html was served from the cache, then '/assets/index-<hash>.js' missed
// despite sitting right there in that same cache, fell through to a dead
// network, and the fetch handler answered its own 503. React never ran.
//
// These are same-origin, content-hashed build files. Which Origin header the
// request happened to carry tells us nothing about whether the bytes are
// right, so the Vary check has no job to do here.
// THIS build's cache is asked first, and only then the global lookup, which
// searches every cache this origin owns. Order matters: activate() keeps the
// previous build's cache around when the new one failed to fill (see the guard
// there), and `caches.match()` on its own resolves from the OLDEST cache
// first — so without the explicit first look, one bad install would pin every
// user to the previous release's index.html for good.
async function cacheGet(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    return await caches.match(request, { ignoreVary: true });
  } catch {
    return undefined;
  }
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

  // Navigations (HTML page loads): network-first, falling back to the APP SHELL.
  //
  // THE SHELL, NOT THE OFFLINE PAGE. This used to answer a failed navigation
  // with `caches.match(req)` and then go straight to offline.html — and only
  // '/' is ever stored under its own URL, so every other route missed and got
  // the offline page. Opening the app with no connection on /living or
  // /host-dashboard therefore showed "you are offline" and the app never
  // booted: no React, no stores, nothing to write into. The wallet and the rent
  // register only appeared to be offline-capable because the tab had already
  // been opened online, with the whole app alive in memory, before the
  // connection was cut.
  //
  // TO-LET PRO is a single-page app: the shell can render ANY route from
  // localStorage on its own. So an offline navigation is served index.html and
  // the router takes it from there. offline.html stays as the last resort, for
  // a device that has genuinely never loaded the app.
  if (req.mode === 'navigate') {
    scheduleWarmFallback(event);
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep a fresh copy of the shell for offline — but ONLY from the root
          // navigation. The build now emits prerendered HTML per route
          // (scripts/prerender-seo.mjs), so caching every navigation under the
          // '/index.html' key would leave whichever district page you happened
          // to visit last standing in as the offline shell for the whole app.
          // NOTE: `url` is req.url (a string) — it needs parsing for the path.
          let isRoot = false;
          try { isRoot = new URL(url).pathname === '/'; } catch { isRoot = false; }
          if (isRoot && res && res.status === 200) {
            // BOTH keys, because both are read below and each is reached a
            // different way: '/' is what the installed app launches (the
            // manifest's start_url) and '/index.html' is what every other route
            // now falls back to. Refreshing only one left the other frozen at
            // whatever HTML the service worker first installed with, pointing
            // at build assets that may be several releases old.
            const forIndex = res.clone();
            const forRoot = res.clone();
            caches.open(STATIC_CACHE).then((c) => {
              c.put('/index.html', forIndex).catch(() => {});
              c.put('/', forRoot).catch(() => {});
            }).catch(() => {});
          }
          return res;
        })
        .catch(() => cacheGet(req)
          .then((r) => r || cacheGet('/index.html'))
          .then((r) => r || cacheGet('/'))
          .then((r) => r || cacheGet('/offline.html'))
          .then((r) => r || new Response('Offline', { status: 503 })))
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
        .catch(() => cacheGet(req))
    );
    return;
  }

  // Same-origin static assets (built JS/CSS, icons, images): cache-first, then
  // populate the cache on first hit. Fast repeat loads, works offline.
  //
  // ONLY ASSETS. This branch used to take every same-origin GET that wasn't a
  // navigation, and an HTML route reached it easily — anything doing
  // `fetch('/host-dashboard?tab=dashboard')` rather than navigating to it. Two
  // things then went wrong, and both were seen in production:
  //
  //   1. If that fetch failed, the catch below answered with a MADE-UP 503
  //      ('Offline or missing resource'), so a network blip surfaced as a
  //      server error against a server that was fine.
  //   2. If it succeeded, the HTML was written into STATIC_CACHE under the
  //      route's own URL and kept — this cache is only ever emptied by a
  //      CACHE_VERSION bump. A later failed navigation reads `caches.match(req)`
  //      FIRST (see the navigate branch), so it would be served that frozen
  //      HTML, pointing at '/assets/index-<hash>.js' files that a redeploy had
  //      already deleted. Cache-first is only ever safe for content-hashed
  //      names; HTML has none.
  if (isStaticAsset(req)) {
    event.respondWith(
      cacheGet(req).then((cached) => {
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
    return;
  }

  // Everything else same-origin (HTML routes fetched by script, and anything
  // without an asset shape): network-first, and NOTHING is written to the cache.
  // Offline, it falls back to the app shell for the same reason the navigate
  // branch does — the SPA can render any route from localStorage, so handing it
  // the shell beats handing it an error. The shell is only reached if it is
  // already cached; if it isn't, the real network error is allowed through so
  // the caller sees a failure it can retry, not a fabricated 503.
  event.respondWith(
    fetch(req).catch((err) => cacheGet('/index.html')
      .then((r) => r || cacheGet('/'))
      .then((r) => { if (r) return r; throw err; }))
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
  } else if (data.url || (data.data && data.data.url) || (data.data && data.data.path)) {
    // The push handler assigns the WHOLE payload to notification.data, so a
    // deep link may sit at the envelope root (web-push senders) or one level
    // down inside `data` (senders that shape their payload for FCM, whose data
    // dict is the only part FCM forwards). Accept both — reading only the root
    // is why server-sent links were being ignored and every tap fell back to
    // '/'.
    urlToOpen = data.url || data.data.url || data.data.path;
  }

  var isCallClick = data.type === 'incoming_call' || data.kind === 'incoming_call';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Resolve against the SW origin so we can compare real paths rather than
      // substrings. The old check was `client.url.includes(urlToOpen)`, and with
      // urlToOpen === '/' that is true for EVERY url — so any open tab
      // "matched", the click just re-focused whatever was already on screen,
      // and openWindow was never reached. That is the "clicking does nothing"
      // symptom.
      var target;
      try {
        target = new URL(urlToOpen, self.location.origin);
      } catch (e) {
        target = new URL('/', self.location.origin);
      }

      var sameOrigin = [];
      for (var i = 0; i < windowClients.length; i++) {
        var c = windowClients[i];
        var u = null;
        try { u = new URL(c.url); } catch (e) { u = null; }
        if (!u || u.origin !== target.origin) continue;
        sameOrigin.push(c);

        // Already on the destination route — just focus it.
        if (u.pathname === target.pathname && 'focus' in c) {
          if (isCallClick) c.postMessage({ type: 'ANSWER_CALL', payload: data });
          return c.focus();
        }
      }

      // An app tab is open but on a different route: navigate it in place
      // instead of spawning a duplicate window.
      if (sameOrigin.length > 0) {
        var client = sameOrigin[0];
        if (isCallClick) client.postMessage({ type: 'ANSWER_CALL', payload: data });
        if ('navigate' in client) {
          return client.navigate(target.href)
            .then(function(navigated) {
              var c2 = navigated || client;
              return c2 && 'focus' in c2 ? c2.focus() : undefined;
            })
            .catch(function() {
              // navigate() rejects for uncontrolled clients — fall back to
              // opening a window so the tap still goes somewhere.
              return clients.openWindow ? clients.openWindow(target.href) : undefined;
            });
        }
        return 'focus' in client ? client.focus() : undefined;
      }

      if (clients.openWindow) {
        return clients.openWindow(target.href);
      }
    })
  );
});
