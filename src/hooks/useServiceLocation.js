/**
 * useServiceLocation — deciding WHERE a tenant is asking from.
 * ──────────────────────────────────────────────────────────────────────────
 * Every screen in the marketplace needs one answer to this, and getting it
 * wrong is not a cosmetic failure: a hyperlocal directory measured from the
 * wrong place shows the wrong shops, confidently.
 *
 * ─── THE LADDER, BEST TO WORST ───────────────────────────────────────────────
 *   1. GPS, if the browser will give it without a prompt. Only this one
 *      justifies printing a distance to the tenant.
 *   2. A thana the tenant picked, remembered.
 *   3. A thana derived from the flat they already rent — they live there; it is
 *      a better guess than anything we could infer.
 *   4. Nothing, and the page says so and asks.
 *
 * ─── WHY GEOLOCATION IS NOT REQUESTED ON MOUNT ───────────────────────────────
 * Only asked for when `permissions.query` already says 'granted', mirroring
 * NearbyAreaSuggestion on the dashboard. A native permission prompt thrown at
 * somebody the moment a page opens is how people press Block — permanently, for
 * the whole origin — and a blocked origin cannot be un-blocked from inside the
 * app. `request()` exists for a deliberate tap on "আমার অবস্থান", which is the
 * only context where the prompt makes sense.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'tolet_service_location';

// A coarse fix is fine — the question is "which neighbourhood", not "which
// doorway" — and a coarse fix is far faster and cheaper on a phone.
const GEO_OPTS = { timeout: 8000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false };

const read = () => {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const write = (value) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* quota */ }
};

/**
 * A saved fix goes stale: somebody who searched from their office last week is
 * at home tonight, and a week-old pin quietly returns the wrong neighbourhood
 * with no sign that anything is wrong. The thana they PICKED does not expire —
 * that was a deliberate statement about where they want service, not a
 * measurement of where their phone was.
 */
const GPS_TTL_MS = 60 * 60 * 1000;

const isFresh = (saved) => (
  saved && saved.source === 'gps' && saved.at && Date.now() - saved.at < GPS_TTL_MS
);

export function useServiceLocation(fallbackThana = '') {
  const [loc, setLoc] = useState(() => {
    const saved = read();
    if (saved && (saved.thana || isFresh(saved))) return saved;
    return null;
  });
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  // Silent upgrade: if the tenant has already granted location to this origin,
  // take it. No prompt, no spinner, no cost to anyone who said no.
  useEffect(() => {
    if (isFresh(loc)) return undefined;
    if (typeof window === 'undefined' || !navigator.geolocation || !navigator.permissions) {
      return undefined;
    }

    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            // The picked thana rides along: a provider whose coverage is a list
            // of thana NAMES (an ISP selling by area) cannot be matched on
            // coordinates alone, so the server wants both when both exist.
            const next = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              thana: read()?.thana || '',
              source: 'gps',
              at: Date.now(),
            };
            setLoc(next);
            write(next);
          },
          () => { /* a silent attempt that fails is not worth reporting */ },
          GEO_OPTS,
        );
      })
      .catch(() => { /* Safari without the Permissions API — stay on the fallback */ });

    return () => { cancelled = true; };
    // Runs once. Re-running on every `loc` change would re-read GPS after the
    // tenant deliberately picked a thana, and silently overwrite their choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A deliberate tap on "আমার অবস্থান ব্যবহার করুন". This one may prompt. */
  const request = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) { setDenied(true); resolve(null); return; }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          thana: read()?.thana || '',
          source: 'gps',
          at: Date.now(),
        };
        setLoc(next);
        write(next);
        setAsking(false);
        setDenied(false);
        resolve(next);
      },
      () => {
        // Blocked, timed out, or no fix. All three mean the same thing here:
        // fall back to a thana and say so, never leave the page empty.
        setAsking(false);
        setDenied(true);
        resolve(null);
      },
      GEO_OPTS,
    );
  }), []);

  /**
   * The tenant picked a thana by hand. This REPLACES any GPS fix rather than
   * sitting alongside it: someone who just told us where they want service has
   * overruled the phone, and quietly measuring from the phone anyway would make
   * the picker look broken.
   */
  const setThana = useCallback((thana) => {
    const next = { thana: String(thana || '').trim(), source: 'picked', at: Date.now() };
    setLoc(next.thana ? next : null);
    if (next.thana) write(next);
    else { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } }
    return next;
  }, []);

  const clear = useCallback(() => {
    setLoc(null);
    setDenied(false);
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  // The flat they already rent, used only when nothing better exists. Not
  // written to storage — it is derived, and persisting it would survive a move.
  const effective = loc || (fallbackThana
    ? { thana: fallbackThana, source: 'tenancy' }
    : null);

  return {
    location: effective,
    // What the browse endpoints take. `null` when we have nothing at all, which
    // callers must treat as "ask the tenant", NOT as "search everywhere".
    query: effective
      ? { lat: effective.lat, lng: effective.lng, thana: effective.thana }
      : null,
    // Only a real GPS fix earns a printed distance. A thana centroid is a
    // neighbourhood guess and "৪০০ মিটার দূরে" off one is a lie with a decimal
    // point in it.
    precise: effective?.source === 'gps',
    asking,
    denied,
    request,
    setThana,
    clear,
  };
}

export default useServiceLocation;
