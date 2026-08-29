/**
 * generate-dhaka-areas.mjs — builds src/seo/dhakaAreaData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Run with:  npm run seo:areas   (also runs automatically before every build)
 *
 * ── Why a generated file instead of importing the geo data directly ──
 * The area names live in src/data/bdAreas.js, which is 431 KB and is
 * deliberately code-split behind useBdAreas() so only a screen that opens a
 * location picker ever downloads it. The SEO layer is imported by
 * PropertyListing — i.e. by every listing page — so pulling bdAreas in there
 * would put 431 KB into the main bundle and wreck the Core Web Vitals that
 * search ranking partly depends on.
 *
 * So this script does the expensive join once, in Node, and emits only what
 * the SEO layer actually needs: ~150 page records plus the sub-area names that
 * appear as text on their parent thana page.
 *
 * ── What becomes a page, and what does not ──
 *   PAGE   58 metropolitan thanas  (Mirpur, Uttara East, Dhanmondi, Motijheel…)
 *   PAGE   95 popular areas        (Gulshan 1, Uttara Sector 7, Dhanmondi 27…)
 *   TEXT   655 sub-areas           (Sheikhertek, Baitul Aman Housing…)
 *
 * The 655 sub-areas are listed as linked text on their parent thana page
 * instead of getting 655 pages of their own. That is a deliberate line: a
 * page-per-mahalla, all sharing one template and most with zero listings, is
 * the doorway-page pattern Google penalises. As text on a real page those
 * names still match the search, and they still feed the thana page's
 * relevance — nothing is "left out", it just is not its own URL.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THANAS_BY_DISTRICT, POPULAR_AREAS_BY_DISTRICT } from '../src/data/bdGeo.js';
import { AREAS_BY_THANA } from '../src/data/bdAreas.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/seo/dhakaAreaData.js');
// Sub-area names are ~85% of the bytes and are only needed to render chips
// below the fold, so they ship separately and are loaded on demand. Keeping
// them in the main file cost 41 KB gzipped on EVERY page of the site.
const OUT_SUB = resolve(HERE, '../src/seo/dhakaSubAreas.js');

const THANAS = THANAS_BY_DISTRICT.dhaka || [];
const POPULAR = POPULAR_AREAS_BY_DISTRICT.dhaka || [];
const AREAS = AREAS_BY_THANA.dhaka || {};

/**
 * URL slug. Every Dhaka area URL ends in `-dhaka`:
 *   • it disambiguates names that repeat in other districts (Kotwali, Bazar…)
 *   • the listing route turns hyphens into spaces, so the slug IS the search
 *     query — "mirpur-dhaka" searches "mirpur dhaka", which is also exactly
 *     how people type it.
 */
const slugify = (name) => `${String(name)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')}-dhaka`;

/**
 * Bengali names the source data has no translation for. These are all major
 * Dhaka areas, and a page titled "Baridhara বাসা ভাড়া" with the English name
 * where the Bengali should be simply cannot rank for "বারিধারা বাসা ভাড়া" —
 * which is how most people search for it.
 */
const MANUAL_BN = {
  'ashulia': 'আশুলিয়া',
  'baridhara': 'বারিধারা',
  'dhanmondi 1': 'ধানমন্ডি ১',
  'eskaton': 'ইস্কাটন',
  'karwan bazar': 'কারওয়ান বাজার',
  'lalmatia': 'লালমাটিয়া',
  'mouchak': 'মৌচাক',
  'north badda': 'উত্তর বাড্ডা',
  'old dhaka': 'পুরান ঢাকা',
  'tejgaon i/a': 'তেজগাঁও শিল্প এলাকা',
};

/** Bengali name for an area, looked up from the thana → areas tables. */
const bnIndex = new Map();
for (const list of Object.values(AREAS)) {
  for (const a of list) {
    const key = a.en.toLowerCase();
    // Only keep a Bengali label that is actually Bengali; the source falls
    // back to the English string for names nobody has translated yet.
    if (!bnIndex.has(key) && /[ঀ-৿]/.test(a.bn || '')) {
      bnIndex.set(key, a.bn);
    }
  }
}
const bnFor = (en, fallback = '') => {
  const key = String(en).toLowerCase();
  return MANUAL_BN[key] || bnIndex.get(key) || fallback || en;
};

/** Which thana does a popular area sit in? */
const thanaOfArea = new Map();
for (const [thanaEn, list] of Object.entries(AREAS)) {
  for (const a of list) {
    const key = a.en.toLowerCase();
    if (!thanaOfArea.has(key)) thanaOfArea.set(key, thanaEn);
  }
}

/* ── build the page records ──────────────────────────────────────────────── */

const bySlug = new Map();

// 1. Thanas first: they are the broadest, most reliably-populated pages, so
//    they win any slug collision with a same-named neighbourhood (Banani,
//    Dhanmondi and Gulshan are both a thana and a popular area).
for (const t of THANAS) {
  const slug = slugify(t.en);
  const subAreas = (AREAS[t.en] || [])
    .filter((a) => a.en.toLowerCase() !== t.en.toLowerCase())
    .map((a) => ({ en: a.en, bn: bnFor(a.en, a.bn) }));
  bySlug.set(slug, {
    slug,
    en: t.en,
    // `t.bn` falls back to the English string for untranslated thanas, so it
    // has to be tested for actual Bengali rather than just for truthiness —
    // otherwise the MANUAL_BN overrides above never get a chance to apply.
    bn: /[ঀ-৿]/.test(t.bn || '') ? t.bn : bnFor(t.en, t.bn),
    kind: 'thana',
    thana: t.en,
    subAreas,
  });
}

// 2. Popular neighbourhoods that are not already a thana page.
for (const name of POPULAR) {
  const slug = slugify(name);
  if (bySlug.has(slug)) continue;
  const thana = thanaOfArea.get(name.toLowerCase()) || '';
  bySlug.set(slug, {
    slug,
    en: name,
    bn: bnFor(name),
    kind: 'area',
    thana,
    subAreas: [],
  });
}

const pages = [...bySlug.values()].sort((a, b) => a.en.localeCompare(b.en));

// Split: the page index stays small enough to sit in the main bundle, the
// sub-area names go to a lazily-imported chunk.
const subAreasByThana = {};
for (const p of pages) {
  if (p.subAreas.length) subAreasByThana[p.slug] = p.subAreas;
  delete p.subAreas;
}

/* ── emit ────────────────────────────────────────────────────────────────── */

const totalSubAreas = Object.values(subAreasByThana).reduce((n, l) => n + l.length, 0);

const file = `/**
 * dhakaAreaData.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  npm run seo:areas   (runs automatically on every build)
 * Source: scripts/generate-dhaka-areas.mjs, joining src/data/bdGeo.js with the
 * 431 KB src/data/bdAreas.js so that big file never reaches the browser.
 *
 * ${pages.length} indexable Dhaka area pages (${pages.filter((p) => p.kind === 'thana').length} thanas,
 * ${pages.filter((p) => p.kind === 'area').length} neighbourhoods) plus ${totalSubAreas} sub-area names
 * rendered as text on their parent thana page.
 *
 * Shape: { slug, en, bn, kind: 'thana'|'area', thana }
 * Sub-area names live in the sibling dhakaSubAreas.js, loaded on demand.
 */

export const DHAKA_AREAS = ${JSON.stringify(pages, null, 1)};
`;

const subFile = `/**
 * dhakaSubAreas.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  npm run seo:areas
 *
 * areaSlug → [{ en, bn }] for the ${totalSubAreas} neighbourhoods inside Dhaka's
 * thanas (Sheikhertek inside Adabar, Kazipara inside Mirpur, …).
 *
 * Kept OUT of dhakaAreaData.js on purpose: it is ~85% of the bytes and is only
 * needed to render chips below the fold on an area page, so LocationSeoBlock
 * imports it dynamically. Bundling it cost 41 KB gzipped on every page load,
 * including pages that show none of it.
 */

export const DHAKA_SUB_AREAS = ${JSON.stringify(subAreasByThana, null, 1)};
`;

writeFileSync(OUT, file, 'utf8');
writeFileSync(OUT_SUB, subFile, 'utf8');

const kb = (b) => (Buffer.byteLength(b, 'utf8') / 1024).toFixed(1);
console.log(
  `✓ dhaka areas — ${pages.length} pages `
  + `(${pages.filter((p) => p.kind === 'thana').length} thanas, ${pages.filter((p) => p.kind === 'area').length} neighbourhoods) `
  + `${kb(file)} KB bundled + ${totalSubAreas} sub-areas ${kb(subFile)} KB lazy`,
);
