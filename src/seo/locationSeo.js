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
import { areaSeo } from './areaSeo.js';

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
    sections: placeSections(d.en, d.bn, areas, { divisionEn: division?.en || '', aka }),
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
    sections: placeSections(div.en, div.bn, districts.map((d) => d.en), { aka }),
    faq: placeFaq(div.en, div.bn, districts.map((d) => d.en)),
  };
}

/**
 * Body copy for a location page.
 * ─────────────────────────────────────────────────────────────────────────────
 * A grid of listing cards is not something a search engine can rank: the card
 * titles are landlord-written, the prices are numbers, and nothing on the page
 * says which district you are looking at or what renting there involves. These
 * three sections are what turn 65 near-identical result grids into 65 pages
 * that each say something.
 *
 * Every section is woven with THIS place's own data — its name in both
 * languages, its neighbourhoods, its division, its alternate spellings — so
 * the pages differ from each other in substance, not just in a swapped noun.
 *
 * The third section is the positioning pitch: someone searching "বাসা ভাড়া"
 * has no idea the meal manager and the ভাড়ার খাতা exist, and a district page
 * is the most-visited page type on the site, so it is the best place to say so.
 */
function placeSections(en, bn, areas = [], { divisionEn = '', aka = [] } = {}) {
  const spots = areas.slice(0, 5).join(', ');
  const alsoCalled = aka.length ? `${en} (${aka.join(', ')})` : en;

  return [
    {
      h2: {
        bn: `${bn} এ বাসা ভাড়া নেওয়ার আগে`,
        en: `Before you rent in ${en}`,
      },
      paragraphs: [
        {
          bn: `${bn} এ বাসা খোঁজার সবচেয়ে বড় সমস্যা তথ্যের অভাব নয়, বরং ছড়িয়ে-ছিটিয়ে `
            + `থাকা তথ্য — কিছু ফেসবুক গ্রুপে, কিছু দেয়ালে সাঁটা টু-লেট কাগজে, কিছু `
            + `পরিচিত কারও মুখে। ফলে একই বাসা নিয়ে তিন রকম ভাড়ার কথা শোনা যায়, আর `
            + `বেশিরভাগ বিজ্ঞাপনে ছবিই থাকে না। এখানে ${en} এর প্রতিটি টু-লেট বিজ্ঞাপনে `
            + `ছবি, মাসিক ভাড়া, রুম-বাথরুমের সংখ্যা ও সুবিধার তালিকা একসাথে থাকে।`,
          en: `The hard part about finding a place in ${en} is not a shortage of `
            + `information but how scattered it is — some in Facebook groups, some on `
            + `paper stuck to a wall, some passed on by word of mouth. The same flat gets `
            + `quoted at three different rents and most ads carry no photos at all. Every `
            + `to-let listing for ${en} here shows photos, the monthly rent, the room and `
            + `bathroom count and what is included.`,
        },
        {
          bn: `${spots ? `${spots} — এসব এলাকাসহ ` : ''}${bn} এর যেকোনো এলাকার নাম লিখে `
            + `সার্চ করলে ওই এলাকার বাসাগুলো আগে দেখানো হয়। ভাড়ার সীমা, রুম সংখ্যা আর `
            + `ফ্যামিলি বা ব্যাচেলর ফিল্টার দিয়ে তালিকাটা আরও ছোট করে আনা যায়, তাই যে `
            + `বাসাগুলো আপনার জন্য নয় সেগুলো দেখে সময় নষ্ট হয় না।`,
          en: `Search any area name in ${en}${spots ? ` — ${spots}, and the rest` : ''} and `
            + `listings there come first. Filters for rent range, room count and `
            + `family-versus-bachelor narrow it further, so you are not scrolling past `
            + `places that were never going to work for you.`,
        },
      ],
    },
    {
      h2: {
        bn: `${bn} এ কে কী খোঁজেন`,
        en: `Who rents what in ${en}`,
      },
      paragraphs: [
        {
          bn: `পরিবারের জন্য দুই বা তিন রুমের ফ্ল্যাট, চাকরিজীবীদের জন্য ছোট ফ্ল্যাট বা `
            + `সাবলেট, ছাত্রদের জন্য মেসের সিট আর ব্যাচেলরদের জন্য শেয়ার করা রুম — `
            + `${alsoCalled} এ চাহিদা এক রকম নয়, তাই তালিকাও আলাদা করে ভাগ করা। `
            + `ফ্যামিলি, ব্যাচেলর, সাবলেট, মেস/সিট ও কমার্শিয়াল — প্রতিটি আলাদা ক্যাটাগরি।`,
          en: `Two or three-bedroom flats for families, smaller flats and sublets for `
            + `working people, mess seats for students and shared rooms for bachelors — `
            + `demand in ${alsoCalled} is not one thing, so the listings are not one list. `
            + `Family, bachelor, sublet, mess or seat, and commercial are each their own `
            + `category.`,
        },
        {
          bn: `ব্যাচেলর ও ছাত্রদের জন্য এই ভাগটা বিশেষ কাজের। "ব্যাচেলর ভাড়া হবে না" `
            + `কথাটা শুনতে শুনতে অনেকে হাল ছেড়ে দেন — ব্যাচেলর ফিল্টার দিলে শুধু সেই `
            + `বাসাগুলোই থাকে যেখানে ব্যাচেলর উঠতে পারবেন, প্রতিটা বিজ্ঞাপনে ফোন করে `
            + `জিজ্ঞেস করতে হয় না। একইভাবে সিট বা মেস খুঁজলে পুরো ফ্ল্যাটের বিজ্ঞাপন `
            + `মাঝখানে এসে ভিড় করে না।`,
          en: `That split matters most for bachelors and students. Plenty of people give up `
            + `after hearing "no bachelors" enough times — the bachelor filter leaves only `
            + `places that will actually take you, with no need to ring each ad and ask. `
            + `Search for a seat or a mess and whole-flat listings stop cluttering the way.`,
        },
      ],
    },
    {
      h2: {
        bn: 'বাসা পাওয়ার পরের হিসাবটাও এখানেই',
        en: 'The accounts after you move in, in the same place',
      },
      paragraphs: [
        {
          bn: `বেশিরভাগ টু-লেট সাইটের কাজ চাবি হাতে পাওয়ার দিনই শেষ। অথচ ${bn} এ `
            + `মেসে বা শেয়ার করা বাসায় ওঠার পরেই আসল হিসাব শুরু হয় — মাসের মিল কয়টা `
            + `হলো, বাজারে কত গেল, মিল রেট কত দাঁড়াল, কারেন্ট-গ্যাস-ওয়াইফাইয়ের বিল কে `
            + `কত দেবে।`,
          en: `Most to-let sites are finished the day you get the keys. In ${en}, though, `
            + `moving into a mess or a shared flat is where the accounting actually `
            + `starts — how many meals this month, how much went on bazar, what the meal `
            + `rate came to, and who owes what on the electricity, gas and WiFi.`,
        },
        {
          bn: `TO-LET PRO তে সেই হিসাবটাও একই অ্যাকাউন্টে — মিল ম্যানেজার আর রুমমেট `
            + `ওয়ালেট, দুটোই সম্পূর্ণ ফ্রি, কোনো সাবস্ক্রিপশন বা ট্রায়াল ছাড়াই। আর `
            + `${bn} এর বাড়িওয়ালারা একই জায়গা থেকে খালি ইউনিটের বিজ্ঞাপন দিয়ে সেই `
            + `ভাড়াটিয়াকেই ডিজিটাল ভাড়ার খাতায় তুলে রাখতে পারেন।`,
          en: `TO-LET PRO keeps that in the same account — the meal manager and roommate `
            + `wallet, both completely free, with no subscription or trial. And landlords `
            + `in ${en} can list a vacant unit and then keep that same tenant in a digital `
            + `rent book from one place.`,
        },
      ],
    },
  ];
}

/**
 * Seven questions a renter actually asks, answered honestly. These feed an
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
        + `সুবিধা যোগ করলেই বিজ্ঞাপন লাইভ হয়। ফ্রি অ্যাকাউন্টে একটি অ্যাক্টিভ বিজ্ঞাপন `
        + `৫টি ছবিসহ দেওয়া যায়; একাধিক বিজ্ঞাপন, বেশি ছবি বা সার্চ বুস্ট লাগলে Plus ও `
        + `Pro প্ল্যান আছে।`,
    },
    {
      q: `দালাল বা কমিশন দিতে হবে? (Is there any broker fee or commission?)`,
      a: `না। বিজ্ঞাপন দেখে সরাসরি বাড়িওয়ালার সাথে চ্যাট বা কল করা যায়, TO-LET PRO `
        + `কোনো কমিশন নেয় না। ${en} এ বাসা খোঁজা, ছবি দেখা ও যোগাযোগ করা সম্পূর্ণ ফ্রি।`,
    },
    {
      q: `বাসা নেওয়ার পর মেস বা রুমমেটের হিসাবও কি রাখা যায়? (Can I manage mess and roommate accounts after moving in?)`,
      a: `যায়, এবং এখানেই TO-LET PRO অন্য টু-লেট সাইট থেকে আলাদা। একই অ্যাকাউন্টে মিল `
        + `ম্যানেজার (মিল, বাজার, মিল রেট) ও রুমমেট ওয়ালেট (কারেন্ট, গ্যাস, পানি, `
        + `ওয়াইফাইয়ের বিল ভাগাভাগি) আছে — দুটোই সম্পূর্ণ ফ্রি, কোনো সাবস্ক্রিপশন নেই।`,
    },
    {
      q: `${en} এ ভাড়া কত হতে পারে? (What is the rent like in ${en}?)`,
      a: `এলাকা, রুম সংখ্যা ও ধরন অনুযায়ী ভাড়া অনেকটাই বদলায় — একই ${en} এ সিটের `
        + `ভাড়া আর ফ্যামিলি ফ্ল্যাটের ভাড়ায় বিশাল পার্থক্য থাকে। তালিকায় ভাড়ার সীমা `
        + `দিয়ে ফিল্টার করলে আপনার বাজেটের বাসাগুলোই দেখানো হয়, আর প্রতিটি বিজ্ঞাপনে `
        + `মাসিক ভাড়া স্পষ্ট করে লেখা থাকে।`,
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
    // Dhaka city areas — "mirpur-dhaka", "uttara-east-dhaka", "gulshan-1-dhaka".
    // Checked last so a district can never lose its slug to an area, and it is
    // a plain Map lookup, so the cost on non-matching slugs is nil.
    || areaSeo(key)
    || null;
}

/**
 * Body copy for the /to-let hub. Lives here rather than in the component so
 * the prerender script can emit the same words for crawlers that never run
 * JavaScript. Without this the hub is 65 links and an FAQ — a page that gets
 * crawled but has nothing of its own to rank for.
 */
export const HUB_SECTIONS = [
  {
    h2: {
      bn: 'এক জায়গায় সারা দেশের টু-লেট',
      en: 'Every district in one place',
    },
    paragraphs: [
      {
        bn: 'বাংলাদেশে বাসা খোঁজার তথ্য ছড়িয়ে আছে — ফেসবুক গ্রুপ, দেয়ালে সাঁটা কাগজ, '
          + 'পরিচিত কারও মুখের খবর। ঢাকার বাইরের জেলাগুলোতে অবস্থা আরও কঠিন, কারণ বড় '
          + 'সাইটগুলো মূলত ঢাকা আর চট্টগ্রামেই সীমাবদ্ধ থাকে। এখানে ৮ বিভাগ ও ৬৪ জেলার '
          + 'প্রতিটির জন্য আলাদা তালিকা আছে — বগুড়া, যশোর, কুমিল্লা, রংপুর বা কক্সবাজার, '
          + 'যেখানেই খুঁজুন।',
        en: 'Rental information in Bangladesh is scattered across Facebook groups, paper '
          + 'stuck to walls, and word of mouth. Outside Dhaka it is worse, because the '
          + 'large sites concentrate on Dhaka and Chattogram. Here all 8 divisions and '
          + '64 districts have their own list — Bogura, Jashore, Comilla, Rangpur or '
          + "Cox's Bazar included.",
      },
      {
        bn: 'প্রতিটি জেলার পাতায় ফ্যামিলি, ব্যাচেলর, সাবলেট, মেস/সিট ও কমার্শিয়াল আলাদা '
          + 'ক্যাটাগরিতে ভাগ করা, সাথে ভাড়ার সীমা ও রুম সংখ্যার ফিল্টার। বিজ্ঞাপনে ছবি, '
          + 'মাসিক ভাড়া ও সুবিধার তালিকা থাকে, আর বাড়িওয়ালার সাথে সরাসরি চ্যাট বা কল '
          + 'করা যায় — কোনো দালাল বা কমিশন নেই।',
        en: 'Each district page separates family, bachelor, sublet, mess or seat, and '
          + 'commercial, with filters for rent range and room count. Listings carry '
          + 'photos, the monthly rent and what is included, and you can chat or call the '
          + 'landlord directly — no broker, no commission.',
      },
    ],
  },
  {
    h2: {
      bn: 'বাসা খোঁজার পরেও কাজে লাগে',
      en: 'Still useful after you have found it',
    },
    paragraphs: [
      {
        bn: 'TO-LET PRO শুধু একটা টু-লেট সাইট নয়। বাসা পাওয়ার পর মেসের মিল ও বাজারের '
          + 'হিসাব রাখার জন্য মিল ম্যানেজার, রুমমেটদের কারেন্ট-গ্যাস-ওয়াইফাইয়ের বিল ভাগ '
          + 'করার জন্য রুমমেট ওয়ালেট — দুটোই একই অ্যাকাউন্টে, সম্পূর্ণ ফ্রি, কোনো '
          + 'সাবস্ক্রিপশন বা ট্রায়াল ছাড়াই।',
        en: 'TO-LET PRO is not only a listings site. Once you have the place, the meal '
          + 'manager keeps the mess meals and bazar, and the roommate wallet splits the '
          + 'electricity, gas and WiFi — both in the same account, completely free, with '
          + 'no subscription or trial.',
      },
      {
        bn: 'বাড়িওয়ালাদের জন্য একই জায়গা থেকে খালি ইউনিটের বিজ্ঞাপন দেওয়া, ভাড়াটিয়াকে '
          + 'QR দিয়ে যুক্ত করা আর ডিজিটাল ভাড়ার খাতায় ভাড়া, বকেয়া ও রশিদ রাখা যায় — '
          + 'বিজ্ঞাপন এক অ্যাপে আর খাতা আরেক অ্যাপে রাখার দরকার হয় না।',
        en: 'For landlords, the same place lists a vacant unit, onboards the tenant by QR, '
          + 'and keeps rent, dues and receipts in a digital rent book — instead of the ad '
          + 'living in one app and the ledger in another.',
      },
    ],
  },
];

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
