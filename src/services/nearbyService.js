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

// When the server says the cell is still warming, come back for it. The upstream
// fetch is already running server-side, so these retries are cheap and usually
// land on a filled cache.
const PENDING_RETRIES = 2;
const PENDING_RETRY_DELAY_MS = 2500;

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

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); },
        { once: true },
      );
    }
  });

async function requestNearby(lat, lng, signal) {
  const url = `${API}/geo/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;

  // Compose the caller's signal with our own timeout so either can cancel.
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => timeoutCtrl.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

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
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Nearest place per category around a coordinate.
 *
 * Resolves with `[]` on any failure rather than throwing — the nearby grid is
 * decorative and must never take the property page down with it. An explicit
 * abort by the caller does propagate, so React effects can bail cleanly.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<{key: string, name: string, nameBn: string, distKm: number|null}>>}
 */
export async function fetchNearbyPlaces(lat, lng, { signal } = {}) {
  if (!isUsableLatLng(lat, lng)) return [];

  const key = cellKey(lat, lng);

  const cached = readCachedNearby(lat, lng);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    try {
      for (let attempt = 0; attempt <= PENDING_RETRIES; attempt += 1) {
        const { places, pending } = await requestNearby(lat, lng, signal);

        // A filled result — cache it and we're done.
        if (places.length && places.some((p) => p.distKm != null)) {
          writeCache(key, places);
          return places;
        }

        // Server is still warming this cell upstream. Wait and ask again.
        if (pending && attempt < PENDING_RETRIES) {
          await sleep(PENDING_RETRY_DELAY_MS, signal);
          continue;
        }

        // Genuinely nothing nearby (or upstream is down). Return the empty
        // category rows so the grid renders "—" instead of collapsing, but
        // don't cache it — we want a real answer next time.
        return places;
      }
      return [];
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[nearby] lookup failed:', err.message);
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

export default { fetchNearbyPlaces, readCachedNearby };
