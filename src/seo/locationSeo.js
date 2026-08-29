/**
 * locationSeo.js — a rankable page for every division and district in
 * Bangladesh, generated from the geo data the app already ships.
 * ─────────────────────────────────────────────────────────────────────────────
 * "flat rent in dhaka" and "সিলেটে বাসা ভাড়া" are two different searches, and
 * neither is won by a homepage. They are won by a page whose <title>, <h1> and
 * first paragraph name that place — in the language the searcher typed.
 *
 * `/properties/:divisionName` already renders results for any division slug OR
 * any free-text location slug (Navbar and HeroSection both route into it that
 * way), so every one of these pages already EXISTS — it just had no identity of
 * its own. This module supplies that identity: 8 divisions + 64 districts = 71
 * indexable location pages off one data file, no new routes, no duplicate
 * content.
 *
 * ── How the underlying route actually filters (PropertyListing.jsx:168) ──
 *   • slug ∈ the 8 division ids  → division filter, no text search
 *   • anything else              → free-text location search, hyphens → spaces
 * So a district URL must be hyphenated, never underscored: `/properties/
 * coxs-bazar` searches "coxs bazar" and matches; `/properties/coxs_bazar`
 * would search the literal underscore and match nothing. `districtPath()`
 * below is the only place that conversion is allowed to happen.
 *
 * Node build scripts import this to emit the sitemap, so keep it browser-free.
 */

import {
  DIVISIONS, DISTRICTS_BY_DIVISION, POPULAR_AREAS_BY_DISTRICT,
  getDivision, getDistrict, getDivisionOfDistrict, getThanas,
} from '../data/bdGeo.js';
import { RENT_KEYWORDS, toKeywordString } from './keywords.js';

/** The 8 division slugs the listing route treats as a division filter. */
export const DIVISION_IDS = DIVISIONS.map((d) => d.id);

/** Flat list of all 64 districts, each tagged with its division. */
export const ALL_DISTRICTS = Object.entries(DISTRICTS_BY_DIVISION)
  .flatMap(([divisionId, list]) => list.map((d) => ({ ...d, divisionId })));

/** The metros renters search hardest for — used for homepage/footer links. */
export const PRIORITY_DISTRICTS = [
  'dhaka', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'gazipur',
  'narayanganj', 'comilla', 'rangpur', 'barishal', 'mymensingh', 'bogura',
  'coxs_bazar', 'jashore', 'dinajpur', 'pabna',
];

/**
 * Districts whose geo id does not survive the round-trip through the listing
 * route's text search.
 *
 * Cox's Bazar is stored as "Cox's Bazar", and the backend matches each typed
 * token as a plain case-insensitive regex against that stored string
 * (searchService.tokenize → tokenRegex). The token "coxs" therefore matches
 * nothing — the apostrophe sits between the x and the s — so the obvious slug
 * `/properties/coxs-bazar` would render a district page with zero listings on
 * it. "cox bazar" tokenises to ["cox", "bazar"], both of which do match, and
 * it happens to be the spelling most people type anyway.
 *
 * The page copy still calls it Cox's Bazar and names the other spellings (see
 * NAME_VARIANTS), so nothing is lost for the searcher.
 */
const SEARCH_SLUG_OVERRIDES = { coxs_bazar: 'cox-bazar' };

const DISTRICT_ID_BY_SEARCH_SLUG = Object.fromEntries(
  Object.entries(SEARCH_SLUG_OVERRIDES).map(([id, slug]) => [slug, id]),
);

/** URL slug for a district: underscores become hyphens (see header note). */
export const districtPath = (districtId) => {
  const id = String(districtId);
  return `/properties/${SEARCH_SLUG_OVERRIDES[id] || id.replace(/_/g, '-')}`;
};

/**
 * Alternate spellings that are the SAME city to a searcher but different
 * strings to a search engine. Naming both on the page is free traffic.
 */
const NAME_VARIANTS = {
  chattogram: ['Chittagong'],
  chittagong: ['Chattogram'],
  comilla: ['Cumilla'],
  barishal: ['Barisal'],
  jashore: ['Jessore'],
  bogura: ['Bogra'],
  coxs_bazar: ["Cox's Bazar", 'Coxs Bazar'],
  brahmanbaria: ['Brahminbaria'],
  chapainawabganj: ['Nawabganj'],
  netrokona: ['Netrakona'],
  moulvibazar: ['Maulvibazar', 'Moulovibazar'],
};

/**
 * Neighbourhoods to name in the copy. Real place names are the long tail:
 * someone searching "মিরপুর বাসা ভাড়া" needs the word Mirpur on the page.
 */
function areaSample(districtId, limit = 8) {
  const popular = POPULAR_AREAS_BY_DISTRICT[districtId] || [];
  if (popular.length) return popular.slice(0, limit);
  return getThanas(districtId).slice(0, limit).map((t) => t.en);
}

const areaSampleBn = (districtId, limit = 8) =>
  getThanas(districtId).slice(0, limit).map((t) => t.bn || t.en);

/* ── copy generators ─────────────────────────────────────────────────────── */

/**
 * Titles lead with the place and stay near 60 characters so Google shows them
 * whole. Bangla first because that is the majority of the search volume here,
 * English second because that is what the diaspora and office renters type.
 */
const placeTitle = (en, bn) => `${en} বাসা ভাড়া — To-Let & Flat Rent in ${en} (${bn})`;

const districtDescription = (en, bn, areas, aka) => {
  const spots = areas.slice(0, 4).join(', ');
  const alt = aka.length ? ` (also spelled ${aka.join(', ')})` : '';
  return `${en} (${bn}) এ বাসা, ফ্ল্যাট, রুম, সিট ও মেস ভাড়ার সব টু-লেট বিজ্ঞাপন এক জায়গায়। `
    + `Browse verified to-let flats, bachelor and family houses, sublets and mess seats in ${en}${alt}`
    + `${spots ? ` — ${spots}` : ''}. ভাড়া, ছবি ও বাড়িওয়ালার নম্বরসহ, দালাল ছাড়াই।`;
};

const divisionDescription = (en, bn, districts) => {
  const names = districts.slice(0, 6).map((d) => d.en).join(', ');
  return `${en} বিভাগের (${bn}) সব জেলার টু-লেট ও বাসা ভাড়ার বিজ্ঞাপন — ${names}। `
    + `Find flats, rooms, mess seats, sublets and family houses to rent across ${en} `
    + `division with photos, monthly rent and direct landlord contact on TO-LET PRO.`;
};

/** Location-specific keyword bag: the generic terms, each bound to the place. */
function locationKeywords(en, bn, aka = []) {
  const forName = (n) => [
    `to let ${n}`, `${n} to let`, `house rent ${n}`, `flat rent ${n}`,
    `${n} basa vara`, `bachelor flat ${n}`, `family flat rent ${n}`,
    `sublet ${n}`, `mess rent ${n}`, `room rent ${n}`,
  ];
  return [
    ...forName(en),
    `${bn} বাসা ভাড়া`, `${bn} টু-লেট`, `${bn} ফ্ল্যাট ভাড়া`, `${bn} রুম ভাড়া`,
    `${bn} মেস ভাড়া`, `${bn} ব্যাচেলর বাসা`,
    ...aka.flatMap(forName).slice(0, 8),
    ...RENT_KEYWORDS.slice(0, 8),
  ];
}

/* ── the public builders ─────────────────────────────────────────────────── */

/**
 * SEO payload for a district page.
 * @param {string} districtId slug, e.g. 'gazipur' | 'coxs_bazar'
 */
export function districtSeo(districtId) {
  const id = String(districtId || '').toLowerCase();
  const d = getDistrict(id);
  if (!d) return null;
  const divisionId = getDivisionOfDistrict(id);
  const division = getDivision(divisionId);
  const areas = areaSample(id);
  const aka = NAME_VARIANTS[id] || [];
  const path = districtPath(id);

  return {
    kind: 'district',
    id,
    path,
    en: d.en,
    bn: d.bn,
    aka,
    divisionId,
    divisionEn: division?.en || '',
    divisionBn: division?.bn || '',
    areas,
    areasBn: areaSampleBn(id),
    title: placeTitle(d.en, d.bn),
    description: districtDescription(d.en, d.bn, areas, aka),
    keywords: toKeywordString(locationKeywords(d.en, d.bn, aka)),
    h1: `${d.en} (${d.bn}) — বাসা ভাড়া ও টু-লেট`,
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'To-Let', path: '/to-let' },
      ...(division ? [{ name: division.en, path: `/properties/${division.id}` }] : []),
      { name: d.en, path },
    ],
    faq: placeFaq(d.en, d.bn, areas),
  };
}

/** SEO payload for a division page. */
export function divisionSeo(divisionId) {
  const id = String(divisionId || '').toLowerCase();
  const div = getDivision(id);
  if (!div) return null;
  const districts = DISTRICTS_BY_DIVISION[id] || [];
  const aka = NAME_VARIANTS[id] || [];
  const path = `/properties/${id}`;

  return {
    kind: 'division',
    id,
    path,
    en: div.en,
    bn: div.bn,
    aka,
    districts,
    title: placeTitle(div.en, div.bn),
    description: divisionDescription(div.en, div.bn, districts),
    keywords: toKeywordString(locationKeywords(div.en, div.bn, aka)),
    h1: `${div.en} বিভাগে বাসা ভাড়া ও টু-লেট`,
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'To-Let', path: '/to-let' },
      { name: div.en, path },
    ],
    faq: placeFaq(div.en, div.bn, districts.map((d) => d.en)),
  };
}

/**
 * Four questions a renter actually asks, answered honestly. These feed an
 * FAQPage block — the accordion Google sometimes shows under a result — and
 * they are the only place long-tail phrases like "ব্যাচেলর বাসা" can sit in
 * natural sentences instead of a keyword list.
 */
function placeFaq(en, bn, areas = []) {
  const spots = areas.slice(0, 3).join(', ');
  return [
    {
      q: `${en} এ বাসা ভাড়া কিভাবে খুঁজব? (How do I find a house for rent in ${en}?)`,
      a: `TO-LET PRO তে ${en} (${bn}) সিলেক্ট করে এলাকা, ভাড়ার সীমা, রুম সংখ্যা ও `
        + `ব্যাচেলর/ফ্যামিলি ফিল্টার দিয়ে খুঁজুন। প্রতিটি টু-লেট বিজ্ঞাপনে ছবি, ভাড়া, `
        + `সুবিধার তালিকা এবং বাড়িওয়ালার সাথে সরাসরি চ্যাট বা কলের সুযোগ আছে। `
        + `Searching is free and there is no broker in between.`,
    },
    {
      q: `${en} এ ব্যাচেলরদের জন্য বাসা বা মেস পাওয়া যায়? (Are there bachelor flats and mess seats in ${en}?)`,
      a: `হ্যাঁ। ${en} এ ব্যাচেলর ফ্ল্যাট, রুম, সিট ও মেসের আলাদা ক্যাটাগরি আছে — `
        + `"Bachelor" ফিল্টার দিলে শুধু ব্যাচেলরদের জন্য উন্মুক্ত বাসাগুলোই দেখা যাবে। `
        + `সিট ভাড়া ও সাবলেটের বিজ্ঞাপনও একই তালিকায় থাকে।`,
    },
    {
      q: `${en} এর কোন এলাকায় টু-লেট বেশি? (Which areas of ${en} have the most listings?)`,
      a: spots
        ? `${spots} সহ ${en} এর জনপ্রিয় এলাকাগুলোতে নিয়মিত নতুন টু-লেট যোগ হয়। `
          + `এলাকার নাম লিখে সার্চ করলে ওই এলাকার বাসাগুলো আগে দেখানো হয়।`
        : `${en} এর সব থানা ও এলাকা থেকে বিজ্ঞাপন যোগ হয়; এলাকার নাম লিখে সার্চ করুন।`,
    },
    {
      q: `বাড়িওয়ালা হিসেবে ${en} এ ফ্রি টু-লেট বিজ্ঞাপন দেব কিভাবে? (How can a landlord post a free to-let ad in ${en}?)`,
      a: `TO-LET PRO তে অ্যাকাউন্ট খুলে "List your property" থেকে ছবি, ভাড়া ও `
        + `সুবিধা যোগ করলেই বিজ্ঞাপন লাইভ হয় — কোনো খরচ নেই। এরপর একই অ্যাপ থেকে `
        + `ভাড়াটিয়া, ভাড়া আদায়, রশিদ, মিল ও বিল সব ম্যানেজ করা যায়।`,
    },
  ];
}

/**
 * Resolve a `/properties/:slug` param to its SEO payload.
 *
 * Division ids win when a slug is both a division and a district ("dhaka",
 * "sylhet", "khulna", …) because that is what the route actually filters by —
 * the page must not claim to be something the results are not.
 *
 * Free-text slugs typed into the Navbar search ("dhanmondi-dhaka") return null,
 * and PropertyListing leaves those out of the index rather than spawning an
 * unbounded number of thin, near-identical URLs.
 */
export function locationSeoFor(slug) {
  const key = String(slug || '').toLowerCase();
  if (!key || key === 'all') return null;
  return divisionSeo(key)
    || districtSeo(DISTRICT_ID_BY_SEARCH_SLUG[key])
    || districtSeo(key)
    || districtSeo(key.replace(/-/g, '_'))
    || null;
}

/**
 * Every indexable location URL, de-duplicated by path. Seven slugs name both a
 * division and its principal district (dhaka, sylhet, rajshahi, khulna,
 * barishal, rangpur, mymensingh); they collapse to a single URL with the
 * division identity, matching locationSeoFor().
 */
export const ALL_LOCATION_PAGES = (() => {
  const byPath = new Map();
  DIVISIONS.forEach((d) => {
    const seo = divisionSeo(d.id);
    if (seo) byPath.set(seo.path, seo);
  });
  ALL_DISTRICTS.forEach((d) => {
    const seo = districtSeo(d.id);
    if (seo && !byPath.has(seo.path)) byPath.set(seo.path, seo);
  });
  return [...byPath.values()];
})();
