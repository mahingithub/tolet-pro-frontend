/**
 * fetch-listing-counts.mjs — how many live listings each location page has.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run with:  npm run seo:counts   (also runs before every build)
 *
 * ── Why ──
 * The SEO layer generates 208 location pages. The site currently has ~15 live
 * listings, so ~200 of those pages are empty. Google does not rank an empty
 * page, and a couple of hundred near-identical empty pages submitted together
 * is the thin-content pattern that makes a whole domain look low quality.
 *
 * So the build asks the API what actually exists, and everything downstream
 * uses the answer:
 *   • generate-sitemap.mjs  — only submits pages that have listings
 *   • prerender-seo.mjs     — writes `noindex` into the empty ones
 *   • PropertyListing.jsx   — same call at runtime, from the real result count
 *
 * Nothing is deleted or hidden from users: an empty area page still renders,
 * still explains the area, and still links onward. It simply is not offered to
 * the index until it has something to show. The moment a landlord posts there,
 * the next build puts it back in.
 *
 * ── Fail-open, always ──
 * If the API is unreachable at build time this writes `ok: false` and every
 * consumer falls back to including everything. A momentary network blip during
 * a deploy must never silently empty the sitemap.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_LOCATION_PAGES } from '../src/seo/locationSeo.js';
import { ALL_AREA_PAGES } from '../src/seo/areaSeo.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/seo/listingCounts.js');

/**
 * Same host the app talks to. Override with SEO_API_URL when the build runs
 * somewhere that reaches the API on a different address.
 */
const API = (process.env.SEO_API_URL || process.env.VITE_API_URL || 'http://3.1.133.211')
  .replace(/\/+$/, '');

const TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

/**
 * Build the query for one page, mirroring EXACTLY what PropertyListing sends
 * for that URL — otherwise the count here and the list a visitor sees would
 * disagree.
 *   division slug  → ?division=<id>   (the route's own division filter)
 *   district/area  → ?q=<slug spaced> (the route's free-text location search)
 */
function queryFor(page) {
  if (page.kind === 'division') return `division=${encodeURIComponent(page.id)}`;
  const term = String(page.path).replace('/properties/', '').replace(/-/g, ' ');
  return `q=${encodeURIComponent(term)}`;
}

async function countFor(page) {
  const url = `${API}/api/properties?limit=1&${queryFor(page)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return Number(body?.total) || 0;
  } finally {
    clearTimeout(timer);
  }
}

/** Small concurrency pool — 208 sequential round-trips would be a slow build. */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

const pages = [...ALL_LOCATION_PAGES, ...ALL_AREA_PAGES];

let counts = {};
let ok = true;
let failures = 0;

try {
  const results = await mapPool(pages, CONCURRENCY, async (p) => {
    try {
      return [p.path, await countFor(p)];
    } catch {
      failures += 1;
      return [p.path, null]; // unknown for this one page
    }
  });
  counts = Object.fromEntries(results.filter(([, n]) => n !== null));

  // If most of the calls failed the API is effectively down — do not let a
  // half-empty picture decide what gets submitted to Google.
  if (failures > pages.length / 2) ok = false;
} catch (err) {
  ok = false;
  console.warn(`⚠ listing counts: ${err.message}`);
}

const withListings = Object.values(counts).filter((n) => n > 0).length;

const file = `/**
 * listingCounts.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  npm run seo:counts   (runs automatically on every build)
 * Source: scripts/fetch-listing-counts.mjs, which asks the live API.
 *
 * path → number of live listings on that location page, as of the last build.
 *
 * \`ok: false\` means the API could not be reached and the numbers below are not
 * trustworthy; every consumer must then behave as it did before this file
 * existed and include every page.
 */

export const LISTING_COUNTS_OK = ${ok};
export const LISTING_COUNTS_FETCHED_AT = ${JSON.stringify(new Date().toISOString())};
export const LISTING_COUNTS = ${JSON.stringify(counts, null, 1)};

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
`;

writeFileSync(OUT, file, 'utf8');

if (!ok) {
  console.log(`⚠ listing counts — API unreachable (${failures}/${pages.length} failed); every page stays indexable`);
} else {
  console.log(
    `✓ listing counts — ${withListings}/${pages.length} location pages have listings `
    + `(${failures} lookups failed) → src/seo/listingCounts.js`,
  );
}
