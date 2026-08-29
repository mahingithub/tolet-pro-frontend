/**
 * generate-sitemap.mjs — writes public/sitemap.xml from the app's own data.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run automatically before every build (see package.json "prebuild"), or by
 * hand:
 *
 *     npm run seo:sitemap
 *
 * The old sitemap listed four URLs on a domain that 404s. This one lists every
 * public page the app actually has — 8 divisions, 64 districts, the landing
 * pages, the hub and the legal pages — generated from src/seo/, so adding a
 * district or a landing page updates the sitemap without anyone remembering to.
 *
 * ── What is deliberately NOT here ──
 * Individual listings (/property/:id). There can be thousands, they change
 * every day, and only the backend knows which are live. That wants a dynamic
 * sitemap served from the API and referenced from robots.txt — see the note at
 * the bottom of this file for exactly what to add when you want it.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_URL } from '../src/seo/siteConfig.js';
import { ALL_LOCATION_PAGES } from '../src/seo/locationSeo.js';
import { FEATURE_PAGES } from '../src/seo/featurePages.js';
import { ALL_AREA_PAGES } from '../src/seo/areaSeo.js';
import { hasListings, LISTING_COUNTS_OK } from '../src/seo/listingCounts.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/sitemap.xml');

const today = new Date().toISOString().slice(0, 10);

/** XML-escape the few characters that can appear in a URL path. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * @param {string} path
 * @param {{changefreq?: string, priority?: number}} [opts]
 */
const url = (path, { changefreq = 'weekly', priority = 0.6 } = {}) => `  <url>
    <loc>${esc(SITE_URL + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;

const entries = [
  // ── Core ────────────────────────────────────────────────────────────────
  url('/', { changefreq: 'daily', priority: 1.0 }),
  url('/to-let', { changefreq: 'daily', priority: 0.9 }),
  url('/properties/all', { changefreq: 'daily', priority: 0.9 }),

  // ── Locations WITH LISTINGS ────────────────────────────────────────────
  // Only places that actually have something to show. There are 194 location
  // pages and, right now, ~21 with any inventory — submitting the other ~173
  // empty ones would ask Google to judge this domain on a couple of hundred
  // pages that have nothing on them. They stay live and crawlable for anyone
  // who follows a link; they are simply not offered until they fill up, and
  // the next build adds them back automatically.
  //
  // `hasListings` fails open: if the API was unreachable at build time every
  // page is included, exactly as before.
  ...ALL_LOCATION_PAGES
    .filter((p) => hasListings(p.path))
    .map((p) => url(p.path, {
      changefreq: 'daily',
      priority: p.kind === 'division' ? 0.8 : 0.7,
    })),

  ...ALL_AREA_PAGES
    .filter((p) => hasListings(p.path))
    .map((p) => url(p.path, { changefreq: 'daily', priority: 0.8 })),

  // ── Feature landing pages ──────────────────────────────────────────────
  ...FEATURE_PAGES.map((p) => url(p.slug, { changefreq: 'monthly', priority: 0.7 })),

  // ── Supporting pages ───────────────────────────────────────────────────
  url('/how-it-works', { changefreq: 'monthly', priority: 0.6 }),
  url('/support', { changefreq: 'monthly', priority: 0.4 }),
  url('/trust-safety', { changefreq: 'yearly', priority: 0.4 }),
  url('/privacy-policy', { changefreq: 'yearly', priority: 0.3 }),
  url('/terms', { changefreq: 'yearly', priority: 0.3 }),
  url('/refund', { changefreq: 'yearly', priority: 0.3 }),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  sitemap.xml — GENERATED FILE, DO NOT EDIT BY HAND.
  Regenerate with:  npm run seo:sitemap   (runs automatically on every build)

  Source of truth: src/seo/locationSeo.js + src/seo/featurePages.js
  Individual listings are not listed here — see scripts/generate-sitemap.mjs.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, xml, 'utf8');

const allLocations = [...ALL_LOCATION_PAGES, ...ALL_AREA_PAGES];
const submitted = allLocations.filter((p) => hasListings(p.path)).length;
console.log(
  `✓ sitemap.xml — ${entries.length} URLs `
  + `(${submitted}/${allLocations.length} location pages have listings, `
  + `${FEATURE_PAGES.length} landing pages) → public/sitemap.xml`,
);
if (!LISTING_COUNTS_OK) {
  console.log('  ⚠ listing counts unavailable — every location page included');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * WHEN YOU WANT LISTINGS IN THE INDEX TOO
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Backend: add a public route that streams live listings as XML, e.g.
 *      GET /api/sitemap/properties.xml
 *    selecting { _id, updatedAt } where status = 'active' AND moderationStatus
 *    is approved, capped at 50,000 URLs per file, cached for an hour.
 *
 * 2. Frontend: proxy it onto the canonical host so both sitemaps share an
 *    origin (search engines reject cross-host sitemap entries). In vercel.json:
 *      { "source": "/sitemap-properties.xml",
 *        "destination": "https://<api-host>/api/sitemap/properties.xml" }
 *
 * 3. robots.txt: add a second line —
 *      Sitemap: https://www.toletpro.rent/sitemap-properties.xml
 *
 * Do this only once there is a healthy number of live listings. A sitemap full
 * of thin or expired listings teaches Google to crawl the site less, not more.
 */
