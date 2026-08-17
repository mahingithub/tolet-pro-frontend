/**
 * useBdAreas — on-demand access to the Bangladesh area/neighbourhood dataset.
 * ─────────────────────────────────────────────────────────────────────────────
 * bdAreas.js is ~420 KB of source (every union parishad in the country plus the
 * curated city neighbourhoods), so it is deliberately NOT imported statically.
 * Nothing on the home page or the listing feed needs it; only the location
 * pickers do. This module code-splits it into its own chunk and hands callers a
 * cached promise, so the first picker to open pays the download once and every
 * later mount resolves synchronously from the module cache.
 *
 * Usage:
 *   const { areas, ready } = useBdAreas(districtId);   // React
 *   const map = await loadBdAreas();                   // imperative
 */

import { useEffect, useState } from 'react';

/** @type {Promise<Record<string, Record<string, {en:string,bn:string}[]>>> | null} */
let pending = null;
/** Resolved dataset, kept so mounts after the first are synchronous. */
let cache = null;

/**
 * Load (once) the districtSlug → thanaLabel → areas map.
 * @returns {Promise<Record<string, Record<string, {en:string,bn:string}[]>>>}
 */
export function loadBdAreas() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('../data/bdAreas.js')
      .then((mod) => {
        cache = mod.AREAS_BY_THANA || mod.default || {};
        return cache;
      })
      .catch((err) => {
        // Let the next caller retry rather than caching the failure forever —
        // this is usually a transient chunk-load error on a flaky connection.
        pending = null;
        console.error('[useBdAreas] failed to load area dataset', err);
        cache = {};
        return cache;
      });
  }
  return pending;
}

/** Already-loaded dataset, or null. Lets callers avoid a loading flash. */
export const getLoadedBdAreas = () => cache;

/**
 * Areas of one district, keyed by thana label.
 *
 * @param {string} districtId  district slug, e.g. 'dhaka'
 * @returns {{ areas: Record<string, {en:string,bn:string}[]>, ready: boolean }}
 */
export function useBdAreas(districtId) {
  const [all, setAll] = useState(cache);

  useEffect(() => {
    // No district picked yet? Don't pull 420 KB down on the off-chance.
    if (!districtId || cache) return;
    let alive = true;
    loadBdAreas().then((map) => {
      if (alive) setAll(map);
    });
    return () => {
      alive = false;
    };
  }, [districtId]);

  return {
    areas: (all && districtId && all[districtId]) || {},
    ready: Boolean(all),
  };
}

export default useBdAreas;
