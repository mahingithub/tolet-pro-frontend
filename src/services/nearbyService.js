/**
 * ─── NEARBY PLACES SERVICE ───────────────────────────────────────────────────
 *
 * Feeds the "What's nearby" grid on the property details page.
 *
 * The heavy lifting (OpenStreetMap Overpass, mirror racing, distance maths,
 * server-side caching) all happens in the backend's
 * services/nearbyPlaces.service.js. This module exists to make the *client*
 * side instant:
 *
 *   • readCachedNearby() is synchronous, so a property the user has already
 *     seen renders its nearby grid on the very first paint — no spinner, no
 *     request, no layout shift.
 *   • Results persist in localStorage keyed on a ~110 m grid cell, so any two
 *     properties on the same street share one entry, and the data survives
 *     reloads and app restarts.
 *   • Requests are deduped in-flight, so React re-renders or a Strict Mode
 *     double-invoke can't fire two network calls.
 *   • Everything is abortable and has a hard timeout, so a slow backend can
 *     never leave the section hanging the way it used to.
 *
 * Shape returned to callers (order is fixed by the server):
 *   [{ key: 'hospital', name: 'Impulse Hospital', nameBn: 'ইমপালস্ হাসপাতাল', distKm: 0.42 }, …]
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// Bump when the response shape changes so stale entries are ignored instead of
// being rendered by code that no longer understands them.
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `nearby:${CACHE_VERSION}:`;

// POIs barely move. A month is plenty conservative, and the server does its own
// stale-while-revalidate behind this anyway.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Ceiling on a single attempt. The server self-limits to ~9 s and then reports
// `pending`, so this only guards against the network itself stalling.
const REQUEST_TIMEOUT_MS = 12000;

// ─── HOW LONG WE KEEP ASKING ─────────────────────────────────────────────────
//
// This used to be 2 retries at a flat 2.5 s, which gave a total budget of about
// 32 s (3 × the server's own 9 s deadline + 2 gaps). That was far too short, and
// the section's headline bug was the direct result: the client stopped asking
// while the answer was still on its way, then never asked again for the rest of
// the page's life. The grid sat on "—" indefinitely even though the backend had
// the real data cached seconds later.
//
// Measured backend worst case for a cold cell (all timings observed live):
//   • fastest healthy Overpass mirror answers the 8-statement query in 15-25 s
//   • when the good mirrors fail, the race still waits on the hung ones for the
//     full 22 s mirror timeout, then the server waits before retrying once
//   • so a bad-luck cold cell can legitimately need 45-65 s
//
// 90 s therefore covers the realistic worst case with room to spare. The cost of
// waiting is near zero: each poll is a ~600 byte GET, and while the cell is cold
// the SERVER blocks for up to 9 s per call, so the polls are self-spacing — the
// whole 90 s window is roughly 8 requests, not hundreds.
const POLL_BUDGET_MS = 90000;

// Gap between polls, on top of however long the server took to answer. Grows so
// a genuinely dead upstream is asked about less and less often.
const POLL_GAP_START_MS = 1500;
const POLL_GAP_MAX_MS = 8000;
const POLL_GAP_GROWTH = 1.35;

// A single failed poll (network blip, 502 from the host, our own 12 s timeout)
// is not fatal — the loop keeps going inside the budget. Only this many
// consecutive hard failures gives up, which is what distinguishes "the backend
// is down" from "one request lost".
const MAX_CONSECUTIVE_ERRORS = 3;

/** Same ~110 m grid the backend uses, so both caches agree on what a "place" is. */
const cellKey = (lat, lng) => `${(Math.round(lat * 1000) / 1000).toFixed(3)},${(Math.round(lng * 1000) / 1000).toFixed(3)}`;

const isUsableLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(lat === 0 && lng === 0);

// ─── CACHE ───────────────────────────────────────────────────────────────────

/** L1: survives route changes within the SPA session, costs nothing to read. */
const memoryCache = new Map();

/** In-flight requests keyed by cell, so concurrent callers share one fetch. */
const inflight = new Map();

const storage = () => {
  try {
    // Private-mode Safari throws on access, not just on write.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/**
 * Synchronous cache read. Returns the cached rows or null.
 *
 * Call this during render to decide the initial state — that's what turns a
 * revisit into a zero-latency paint instead of a spinner.
 */
export function readCachedNearby(lat, lng) {
  if (!isUsableLatLng(lat, lng)) return null;
  const key = cellKey(lat, lng);

  const hit = memoryCache.get(key);
  if (hit) return hit;

  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.places) || !parsed.places.length) return null;
    if (Date.now() - (parsed.at || 0) > CACHE_TTL_MS) {
      ls.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memoryCache.set(key, parsed.places); // promote so the next read skips JSON
    return parsed.places;
  } catch {
    return null;
  }
}

function writeCache(key, places) {
  memoryCache.set(key, places);
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), places }));
  } catch {
    // Quota exceeded or storage disabled — the in-memory cache still works.
    pruneStoredCells(ls);
  }
}

/** Drop the oldest stored cells when we run out of quota. */
function pruneStoredCells(ls) {
  try {
    const entries = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (!k || !k.startsWith(CACHE_PREFIX)) continue;
      let at = 0;
      try { at = JSON.parse(ls.getItem(k))?.at || 0; } catch { /* corrupt → evict first */ }
      entries.push([k, at]);
    }
    entries.sort((a, b) => a[1] - b[1]);
    entries.slice(0, Math.ceil(entries.length / 2)).forEach(([k]) => ls.removeItem(k));
  } catch {
    /* nothing more we can do */
  }
}

// ─── NETWORK ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function requestNearby(lat, lng) {
  const url = `${API}/geo/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;

  // Only our own timeout can cancel this. The caller's signal deliberately does
  // NOT reach the wire — see fetchNearbyPlaces for why.
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: timeoutCtrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      places: Array.isArray(data.places) ? data.places : [],
      pending: Boolean(data.pending),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** A filled row is one that actually carries a distance. */
const isFilled = (places) => places.length > 0 && places.some((p) => p.distKm != null);

/**
 * Poll the backend until the cell is filled or the budget runs out.
 *
 * Runs detached from any caller: whoever started it may navigate away, but the
 * work continues and lands in the cache, so the next reader gets it for free.
 */
async function pollUntilFilled(key, lat, lng) {
  const deadline = Date.now() + POLL_BUDGET_MS;
  let gap = POLL_GAP_START_MS;
  let errors = 0;
  let lastPlaces = [];

  while (Date.now() < deadline) {
    try {
      const { places, pending } = await requestNearby(lat, lng);
      errors = 0;
      lastPlaces = places;

      if (isFilled(places)) {
        writeCache(key, places);
        return places;
      }

      // Not filled. `pending` means the server is still working upstream, so
      // keep waiting. A non-pending empty answer means the server is confident
      // there is genuinely nothing within its radius — stop and show "—".
      if (!pending) return places;
    } catch (err) {
      errors += 1;
      if (errors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[nearby] giving up after ${errors} failed attempts:`, err.message);
        return lastPlaces;
      }
    }

    if (Date.now() + gap >= deadline) break;
    await sleep(gap);
    gap = Math.min(Math.round(gap * POLL_GAP_GROWTH), POLL_GAP_MAX_MS);
  }

  // Budget exhausted. Hand back whatever shape we last saw so the grid renders
  // "—" rather than collapsing, and don't cache it — a later visit retries.
  return lastPlaces;
}

/** Rejects when `signal` aborts; resolves never. Cleans its own listener up. */
function abortSignalAsRejection(signal) {
  let detach = () => {};
  const promise = new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    detach = () => signal.removeEventListener('abort', onAbort);
  });
  return { promise, detach };
}

/**
 * Nearest place per category around a coordinate.
 *
 * Resolves with `[]` on any failure rather than throwing — the nearby grid is
 * decorative and must never take the property page down with it. An explicit
 * abort by the caller does propagate, so React effects can bail cleanly.
 *
 * ── On aborts and the shared job ──
 * The polling job is deliberately NOT wired to the caller's signal. It used to
 * be, and that was a real bug: the single-flight map hands the SAME promise to
 * every caller for a cell, so the first caller's cleanup — a React effect
 * re-running, or StrictMode's double-invoke in development — aborted the fetch
 * out from under everyone else, and the later subscribers received a rejected
 * promise for a request they never cancelled. The grid then shimmered forever.
 *
 * Now an abort only detaches THAT caller. The job keeps running and writes to
 * the cache, so the work is never wasted and a remount reads it synchronously.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<{key: string, name: string, nameBn: string, distKm: number|null}>>}
 */
export function fetchNearbyPlaces(lat, lng, { signal } = {}) {
  if (!isUsableLatLng(lat, lng)) return Promise.resolve([]);

  const key = cellKey(lat, lng);

  const cached = readCachedNearby(lat, lng);
  if (cached) return Promise.resolve(cached);

  let job = inflight.get(key);
  if (!job) {
    job = pollUntilFilled(key, lat, lng)
      .catch((err) => {
        console.warn('[nearby] lookup failed:', err?.message || err);
        return [];
      })
      .finally(() => { inflight.delete(key); });
    inflight.set(key, job);
  }

  if (!signal) return job;

  // Race the shared job against this caller's abort. Whichever settles first
  // wins for this caller only; the job itself is untouched either way.
  const { promise: aborted, detach } = abortSignalAsRejection(signal);
  return Promise.race([job, aborted]).finally(detach);
}

export default { fetchNearbyPlaces, readCachedNearby };
