/**
 * locationSeo.js — a rankable page for every division, district and city in
 * Bangladesh, generated from the geo data the app already ships.
 * ─────────────────────────────────────────────────────────────────────────────
 * "flat rent in dhaka" and "সিলেটে বাসা ভাড়া" are two different searches, and
 * neither is won by a homepage. They are won by a page whose <title>, <h1> and
 * first paragraph name that place — in the language the searcher typed.
 *
 * `/properties/:divisionName` already renders results for any division OR
 * district slug (Navbar and HeroSection both route into it that way), so every
 * one of these pages already EXISTS — it just had no identity of its own. This
 * module supplies that identity: 8 divisions + 64 districts = 72 location pages
 * off one data file, with no new routes and no duplicate content.
 *
 * Node build scripts import this to emit the sitemap, so keep it browser-free.
 */

import {
  DIVISIONS, DISTRICTS_BY_DIVISION, POPULAR_AREAS_BY_DISTRICT,
  getDivision, getDistrict, getDivisionOfDistrict, getThanas,
} from '../data/bdGeo';
import { RENT_KEYWORDS, toKeywordString } from './keywords';

/** Flat list of all 64 districts, each tagged with its division. */
export const ALL_DISTRICTS = Object.entries(DISTRICTS_BY_DIVISION)
  .flatMap(([divisionId, list]) =>
    list.map((d) => ({ ...d, divisionId })),
  );

/** The metros renters search hardest for — used for homepage/footer links. */
export const PRIORITY_DISTRICTS = [
  'dhaka', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'gazipur',
  'narayanganj', 'comilla', 'rangpur', 'barishal', 'mymensingh', 'bogura',
  'coxs_bazar', 'jashore', 'dinajpur', 'pabna',
];

/**
 * Neighbourhoods to name in the copy. Real place names are the long-tail:
 * someone searching "মিরপুর বাসা ভাড়া" needs the word Mirpur on the page.
 */
function areaSample(districtId, limit = 8) {
  const popular = POPULAR_AREAS_BY_DISTRICT[districtId] || [];
  if (popular.length) return popular.slice(0, limit);
  return getThanas(districtId).slice(0, limit).map((t) => t.en);
}

function areaSampleBn(districtId, limit = 8) {
  return getThanas(districtId).slice(0, limit).map((t) => t.bn || t.en);
}

/* ── copy generators ─────────────────────────────────────────────────────── */

/**
 * Titles stay under ~60 characters so Google shows them whole, and lead with
 * the place + the term, because that is the order people type.
 */
const districtTitle = (en, bn) => `${en} বাসা ভাড়া — To-Let & Flat Rent in ${en} (${bn})`;

const districtDescription = (en, bn, areas) => {
  const spots = areas.slice(0, 4).join(', ');
  return `${en} (${bn}) এ বাসা, ফ্ল্যাট, রুম, সিট ও মেস ভাড়ার সব টু-লেট বিজ্ঞাপন এক জায়গায়। `
    + `Browse verified to-let flats, bachelor and family houses, sublets and mess seats in ${en}`
    + `${spots ? ` — ${spots}` : ''}. ভাড়া, ছবি ও বাড়িওয়ালার নম্বরসহ, সম্পূর্ণ ফ্রি।`;
};

const divisionTitle = (en, bn) => `${en} Division বাসা ভাড়া — To-Let in ${en} (${bn})`;

const divisionDescription = (en, bn, districts) => {
  const names = districts.slice(0, 5).map((d) => d.en).join(', ');
  return `${en} বিভাগের (${bn}) সব জেলার টু-লেট ও বাসা ভাড়ার বিজ্ঞাপন — ${names}। `
    + `Find flats, rooms, mess seats and family houses to rent across ${en} division `
    + `with photos, rent and direct landlord contact on TO-LET PRO.`;
};

/** Location-specific keyword bag: the generic terms, each bound to the place. */
function locationKeywords(en, bn) {
  const bound = [
    `to let ${en}`, `${en} to let`, `house rent ${en}`, `flat rent ${en}`,
    `${en} বাসা ভাড়া`, `${bn} বাসা ভাড়া`, `${bn} টু-লেট`, `${en} basa vara`,
    `bachelor flat ${en}`, `family flat rent ${en}`, `sublet ${en}`,
    `mess rent ${en}`, `${bn} ফ্ল্যাট ভাড়া`, `room rent ${en}`,
    `${en} rental property`, `${bn} রুম ভাড়া`,
  ];
  return [...bound, ...RENT_KEYWORDS.slice(0, 10)];
}

/* ── the public builders ─────────────────────────────────────────────────── */

/**
 * SEO payload for a district page.
 * @param {string} districtId slug, e.g. 'dhaka' | 'coxs_bazar'
 */
export function districtSeo(districtId) {
  const d = getDistrict(districtId);
  if (!d) return null;
  const divisionId = getDivisionOfDistrict(districtId);
  const division = getDivision(divisionId);
  const areas = areaSample(districtId);
  const areasBn = areaSampleBn(districtId);
  const path = `/properties/${districtId}`;

  return {
    kind: 'district',
    id: districtId,
    path,
    en: d.en,
    bn: d.bn,
    divisionId,
    divisionEn: division?.en || '',
    divisionBn: division?.bn || '',
    areas,
    areasBn,
    title: districtTitle(d.en, d.bn),
    description: districtDescription(d.en, d.bn, areas),
    keywords: toKeywordString(locationKeywords(d.en, d.bn)),
    h1: `${d.en} — বাসা ভাড়া ও টু-লেট`,
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'To-Let', path: '/to-let' },
      ...(division ? [{ name: division.en, path: `/properties/${division.id}` }] : []),
      { name: d.en, path },
    ],
    faq: districtFaq(d.en, d.bn, areas),
  };
}

/** SEO payload for a division page. */
export function divisionSeo(divisionId) {
  const div = getDivision(divisionId);
  if (!div) return null;
  const districts = DISTRICTS_BY_DIVISION[divisionId] || [];
  const path = `/properties/${divisionId}`;

  return {
    kind: 'division',
    id: divisionId,
    path,
    en: div.en,
    bn: div.bn,
    districts,
    title: divisionTitle(div.en, div.bn),
    description: divisionDescription(div.en, div.bn, districts),
    keywords: toKeywordString(locationKeywords(div.en, div.bn)),
    h1: `${div.en} বিভাগে বাসা ভাড়া`,
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'To-Let', path: '/to-let' },
      { name: div.en, path },
    ],
    faq: districtFaq(div.en, div.bn, districts.map((d) => d.en)),
  };
}

/**
 * Four questions a renter actually asks, answered honestly. These feed an
 * FAQPage block — the accordion Google sometimes shows under the result — and
 * they are also the only place long-tail phrases like "ব্যাচেলর বাসা" can sit
 * in natural sentences.
 */
function districtFaq(en, bn, areas = []) {
  const spots = areas.slice(0, 3).join(', ');
  return [
    {
      q: `${en} এ বাসা ভাড়া কিভাবে খুঁজব? (How do I find a house for rent in ${en}?)`,
      a: `TO-LET PRO তে ${en} (${bn}) সিলেক্ট করে এলাকা, ভাড়ার সীমা, রুম সংখ্যা ও `
        + `ব্যাচেলর/ফ্যামিলি ফিল্টার দিয়ে খুঁজুন। প্রতিটি টু-লেট বিজ্ঞাপনে ছবি, ভাড়া, `
        + `সুবিধার তালিকা ও বাড়িওয়ালার সাথে সরাসরি চ্যাট বা কলের সুযোগ আছে। `
        + `Search is free and no broker is involved.`,
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
        + `ভাড়াটিয়া, ভাড়া আদায়, রশিদ ও বিল ম্যানেজ করা যায়।`,
    },
  ];
}

/**
 * Resolve any `/properties/:slug` param to its SEO payload. The route accepts
 * division slugs, district slugs, 'all', and free-text location slugs typed
 * into the Navbar search ("mirpur-dhaka") — only the first three get a
 * hand-built identity; the rest fall through to a generic search page that is
 * deliberately left out of the index (see PropertyListing).
 */
export function locationSeoFor(slug) {
  const key = String(slug || '').toLowerCase();
  if (!key || key === 'all') return null;
  return divisionSeo(key) || districtSeo(key) || null;
}

/** Every location URL, for the sitemap and the /to-let hub. */
export const ALL_LOCATION_PAGES = [
  ...DIVISIONS.map((d) => divisionSeo(d.id)),
  ...ALL_DISTRICTS.map((d) => districtSeo(d.id)),
].filter(Boolean);
