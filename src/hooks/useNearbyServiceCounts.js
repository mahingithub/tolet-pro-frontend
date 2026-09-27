/**
 * useNearbyServiceCounts — "is anybody actually selling this near me?"
 * ──────────────────────────────────────────────────────────────────────────
 * One shared answer to the only question the খাতা hints need from the server.
 *
 * ─── WHY IT IS CACHED AT MODULE LEVEL ────────────────────────────────────────
 * /services/nearby/categories returns EVERY category's count in one response,
 * and a Living screen can render several hints at once (a গ্যাস clock, a পানি
 * clock and a বাজার hint on the same overview). Without a shared cache that is
 * three identical requests for one answer, on a phone that is usually on a
 * congested network. The cache is keyed by rounded position, so a GPS fix that
 * drifts a few metres between screens still hits it.
 *
 * ─── SILENCE IS THE FAILURE MODE ─────────────────────────────────────────────
 * Every error resolves to an empty count map, never to a thrown promise and
 * never to a retry loop. A hint is uninvited: if we cannot confirm somebody is
 * there, the right output is nothing at all. See `hasNearby` below — callers
 * are expected to gate on it rather than on `counts` being loaded.
 */

import { useEffect, useState } from 'react';

import useServiceLocation from './useServiceLocation';
import { getNearbyCategories } from '../services/marketplaceService';

// Three decimals is ~110 m — the same grid the server's NearbyPlaces cache
// buckets on, and far finer than the 500 m bands the browse ranking uses.
const round = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : '');

const keyFor = (q) => (q ? `${round(q.lat)}|${round(q.lng)}|${q.thana || ''}` : '');

/** key → Promise<{ [categoryId]: count }>. Lives for the page's lifetime. */
const cache = new Map();

function load(key, query) {
  if (cache.has(key)) return cache.get(key);

  const p = getNearbyCategories(query)
    .then((data) => Object.fromEntries(
      (data.categories || []).map((c) => [c.id, Number(c.count) || 0]),
    ))
    .catch(() => {
      // Do not memoise a failure — a dropped request on the metro should not
      // silence every hint for the rest of the session.
      cache.delete(key);
      return {};
    });

  cache.set(key, p);
  return p;
}

/**
 * The same answer, for code that is not rendering.
 *
 * The post-save toast cannot use the hook: it does not know which shop it is
 * asking about until the moment somebody saves a row, and fetching on mount
 * instead would spend a request on every open of the খরচ tab for a toast that
 * usually never fires.
 *
 * @returns {Promise<Record<string, number>|null>} null when we have no
 *          location — which callers must read as "say nothing", never as
 *          "no shops".
 */
export function fetchNearbyCounts(query) {
  const key = keyFor(query);
  if (!key) return Promise.resolve(null);
  return load(key, query);
}

/**
 * @param {boolean} [enabled=true] pass false to skip the request entirely —
 *        e.g. when the caller already knows it has nothing to ask about.
 * @returns {{
 *   counts: Record<string, number>,
 *   located: boolean,
 *   hasNearby: (serviceId: string) => boolean,
 * }}
 */
export default function useNearbyServiceCounts(enabled = true) {
  const { query } = useServiceLocation();
  // The key is stored WITH the answer instead of being reset in the effect.
  // Resetting meant a synchronous setState in the effect body on every render
  // where we had no location — a cascading render for a value that is simply
  // "not this key's". Comparing during render says the same thing for free,
  // and stale counts from a previous location can never be read.
  const [answer, setAnswer] = useState({ key: '', counts: null });

  const key = enabled ? keyFor(query) : '';

  useEffect(() => {
    if (!key) return undefined;

    let cancelled = false;
    load(key, query).then((c) => { if (!cancelled) setAnswer({ key, counts: c }); });
    return () => { cancelled = true; };
    // `query` is rebuilt every render by useServiceLocation; `key` is the
    // value that actually changes, so it is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const counts = key && answer.key === key ? answer.counts : null;

  return {
    counts: counts || {},
    located: !!key,
    /**
     * The gate every hint should use.
     *
     * FALSE until proven otherwise — no location, no answer yet, a failed
     * request and an empty category all return false. The marketplace's own
     * rule is "never show an empty category"; inside somebody's খাতা, where
     * nobody asked us to speak, an unconfirmed one counts as empty too.
     */
    hasNearby: (serviceId) => !!counts && (counts[serviceId] || 0) > 0,
  };
}
