/**
 * listingCounts.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  npm run seo:counts   (runs automatically on every build)
 * Source: scripts/fetch-listing-counts.mjs, which asks the live API.
 *
 * path → number of live listings on that location page, as of the last build.
 *
 * `ok: false` means the API could not be reached and the numbers below are not
 * trustworthy; every consumer must then behave as it did before this file
 * existed and include every page.
 */

export const LISTING_COUNTS_OK = false;
export const LISTING_COUNTS_FETCHED_AT = "2026-09-05T15:19:36.050Z";
export const LISTING_COUNTS = {};

/**
 * Should this location page be offered to search engines?
 * Unknown counts and a failed fetch both mean "yes" — fail open, never hide a
 * page because of a network problem.
 */
export const hasListings = (path) => {
  if (!LISTING_COUNTS_OK) return true;
  const n = LISTING_COUNTS[path];
  return n === undefined ? true : n > 0;
};
