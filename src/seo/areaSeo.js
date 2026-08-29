/**
 * areaSeo.js — a page for every area of Dhaka city.
 * ─────────────────────────────────────────────────────────────────────────────
 * District pages win "ঢাকায় বাসা ভাড়া". They do NOT win "মিরপুর বাসা ভাড়া",
 * and that is where the volume actually is: nobody moving to Dhaka searches for
 * a district, they search for the area next to their university or their
 * office. Before this, a search for Mirpur landed on the whole-Dhaka listing
 * with no filter applied, which is a worse answer than the question deserved.
 *
 * 129 pages — 58 metropolitan thanas and 71 neighbourhoods — generated from
 * src/seo/dhakaAreaData.js (see scripts/generate-dhaka-areas.mjs for what gets
 * a page and what stays as text).
 *
 * ── The URL is the filter ──
 * `/properties/mirpur-dhaka` needs no new route. PropertyListing turns any
 * unknown slug into a location search with hyphens as spaces, so the slug
 * "mirpur-dhaka" IS the query "mirpur dhaka" — the page opens on the listing
 * with Mirpur already filtered. The `-dhaka` suffix disambiguates names that
 * repeat in other districts (Kotwali, New Market) and matches how people type.
 *
 * ── Two audiences, named explicitly ──
 * Students arriving in Dhaka search near a campus; new job-holders search near
 * an office district. CAMPUSES and OFFICE_HUBS below let an area page say
 * which universities or workplaces it is next to, which is both the honest
 * answer to their question and the phrase they typed.
 */

import { DHAKA_AREAS } from './dhakaAreaData.js';
import { RENT_KEYWORDS, toKeywordString } from './keywords.js';

/** slug → record, for O(1) lookup on every listing-page render. */
const BY_SLUG = new Map(DHAKA_AREAS.map((a) => [a.slug, a]));

export const ALL_DHAKA_AREAS = DHAKA_AREAS;

/**
 * Universities and colleges by the area they sit in or next to.
 * Hand-curated: this is the single highest-intent signal on these pages, and
 * a wrong campus-to-area mapping is worse than none. Keyed by area slug.
 */
const CAMPUSES = {
  'ashulia-dhaka': ['Daffodil International University', 'ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটি'],
  'savar-dhaka': ['Jahangirnagar University', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'Gono Bishwabidyalay'],
  'dhanmondi-dhaka': ['Dhaka University area', 'BUET', 'Daffodil (Dhanmondi campus)', 'ঢাকা বিশ্ববিদ্যালয়'],
  'shahbagh-dhaka': ['University of Dhaka', 'ঢাকা বিশ্ববিদ্যালয়', 'Dhaka Medical College', 'ঢাকা মেডিকেল কলেজ'],
  'new-market-dhaka': ['University of Dhaka', 'Nilkhet', 'নীলক্ষেত', 'Dhaka College'],
  'azimpur-dhaka': ['Eden Mohila College', 'ইডেন কলেজ', 'Dhaka University', 'Dhaka College'],
  'palashi-dhaka': ['BUET', 'বুয়েট', 'Dhaka University'],
  'lalbagh-dhaka': ['BUET', 'Dhaka College', 'ঢাকা কলেজ'],
  'bashundhara-r-a-dhaka': ['North South University', 'নর্থ সাউথ ইউনিভার্সিটি', 'Independent University (IUB)', 'Apollo'],
  'badda-dhaka': ['BRAC University', 'ব্র্যাক ইউনিভার্সিটি', 'Merul Badda'],
  'aftab-nagar-dhaka': ['East West University', 'ইস্ট ওয়েস্ট ইউনিভার্সিটি'],
  'bhatara-dhaka': ['United International University (UIU)', 'ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি', 'Natun Bazar'],
  'khilkhet-dhaka': ['AIUB', 'আমেরিকান ইন্টারন্যাশনাল ইউনিভার্সিটি', 'Kuratoli'],
  'uttara-east-dhaka': ['Uttara University', 'উত্তরা ইউনিভার্সিটি', 'IUBAT'],
  'uttara-west-dhaka': ['IUBAT', 'Uttara University', 'উত্তরা ইউনিভার্সিটি'],
  'mirpur-dhaka': ['BUBT', 'বিইউবিটি', 'Mirpur Bangla College', 'Manarat International University'],
  'pallabi-dhaka': ['BUBT', 'Mirpur Cantonment colleges'],
  'mohammadpur-dhaka': ['Dhaka Residential Model College', 'ঢাকা রেসিডেনসিয়াল মডেল কলেজ', 'Green University area'],
  'tejgaon-dhaka': ['Tejgaon College', 'তেজগাঁও কলেজ', 'BAF Shaheen'],
  'farmgate-dhaka': ['Tejgaon College', 'তেজগাঁও কলেজ', 'coaching centres', 'কোচিং সেন্টার'],
  'gendaria-dhaka': ['Jagannath University area', 'জগন্নাথ বিশ্ববিদ্যালয়'],
  'sutrapur-dhaka': ['Jagannath University', 'জগন্নাথ বিশ্ববিদ্যালয়'],
  'kotwali-dhaka': ['Jagannath University', 'Old Dhaka colleges'],
  'mugda-dhaka': ['Mugda Medical College', 'মুগদা মেডিকেল কলেজ'],
  'kafrul-dhaka': ['MIST', 'এমআইএসটি', 'Army Medical College'],
  'cantonment-dhaka': ['MIST', 'Army Medical College', 'BAF Shaheen'],
};

/** Office / commercial districts — the "new job in Dhaka" audience. */
const OFFICE_HUBS = {
  'motijheel-dhaka': ['banks and head offices', 'ব্যাংক ও কর্পোরেট অফিস', 'Dilkusha'],
  'paltan-dhaka': ['government offices', 'সরকারি অফিস', 'Bijoy Nagar'],
  'karwan-bazar-dhaka': ['media houses and corporate offices', 'মিডিয়া ও কর্পোরেট অফিস'],
  'gulshan-dhaka': ['multinational offices and embassies', 'মাল্টিন্যাশনাল অফিস ও দূতাবাস'],
  'gulshan-1-dhaka': ['corporate offices', 'কর্পোরেট অফিস'],
  'gulshan-2-dhaka': ['multinational offices', 'মাল্টিন্যাশনাল অফিস'],
  'banani-dhaka': ['corporate offices', 'কর্পোরেট অফিস'],
  'tejgaon-i-a-dhaka': ['factories and corporate offices', 'কারখানা ও অফিস'],
  'tejgaon-industrial-area-dhaka': ['industrial and corporate offices', 'শিল্প ও কর্পোরেট এলাকা'],
  'mohakhali-dhaka': ['corporate offices and hospitals', 'অফিস ও হাসপাতাল'],
  'uttara-east-dhaka': ['offices and the airport', 'অফিস ও বিমানবন্দর'],
  'ashulia-dhaka': ['garment factories', 'গার্মেন্টস কারখানা'],
  'savar-dhaka': ['EPZ and factories', 'ইপিজেড ও কারখানা'],
  'hazaribagh-dhaka': ['tannery and small industry', 'ট্যানারি ও ছোট শিল্প'],
};

/** URL for an area page. */
export const areaPath = (slug) => `/properties/${slug}`;

/* ── copy ────────────────────────────────────────────────────────────────── */

const title = (en, bn) => `${bn} বাসা ভাড়া — To-Let & Flat Rent in ${en}, Dhaka`;

function description(area, campuses, offices) {
  const near = campuses.length
    ? ` ${campuses[0]} সহ কাছাকাছি ক্যাম্পাসের ছাত্রদের জন্য মেস ও সিটও আছে।`
    : offices.length
      ? ` ${area.en} এর অফিসপাড়ার কাছে থাকতে চাইলে ছোট ফ্ল্যাট ও সাবলেটও পাবেন।`
      : '';
  return `${area.bn} (${area.en}), ঢাকায় বাসা, ফ্ল্যাট, রুম, সিট, মেস ও সাবলেট ভাড়ার `
    + `টু-লেট বিজ্ঞাপন — ছবি, মাসিক ভাড়া ও বাড়িওয়ালার সাথে সরাসরি যোগাযোগ, দালাল ছাড়াই।`
    + `${near} To-let flats, bachelor and family houses, mess seats and sublets in `
    + `${area.en}, Dhaka.`;
}

function keywords(area, campuses) {
  const { en, bn } = area;
  return toKeywordString([
    `${bn} বাসা ভাড়া`, `${bn} টু-লেট`, `${bn} ফ্ল্যাট ভাড়া`, `${bn} রুম ভাড়া`,
    `${bn} সাবলেট`, `${bn} মেস`, `${bn} সিট ভাড়া`, `${bn} ব্যাচেলর বাসা`,
    `${en} to let`, `to let ${en}`, `${en} house rent`, `${en} flat rent`,
    `${en} basa vara`, `bachelor flat ${en}`, `family flat ${en}`,
    `sublet ${en}`, `mess ${en}`, `seat rent ${en}`, `room rent ${en} Dhaka`,
    ...campuses.slice(0, 2).map((c) => `${c} এর কাছে বাসা`),
    ...RENT_KEYWORDS.slice(0, 6),
  ]);
}

/**
 * Body copy. Four sections, and the first two change depending on whether this
 * area is a campus area, an office area, or neither — so a Mirpur page and a
 * Motijheel page do not read like the same page with the name swapped.
 */
function sections(area, campuses, offices) {
  const { en, bn } = area;
  const out = [];

  if (campuses.length) {
    out.push({
      h2: {
        bn: `${bn} এ ছাত্রদের জন্য বাসা, মেস ও সিট`,
        en: `Student housing, mess and seats in ${en}`,
      },
      paragraphs: [
        {
          bn: `${campuses.slice(0, 3).join(', ')} — ${bn} এবং আশপাশের এলাকায় পড়তে আসা `
            + `শিক্ষার্থীদের প্রথম কাজই হলো ক্যাম্পাসের কাছে একটা সিট বা মেস খুঁজে নেওয়া। `
            + `নতুন সেমিস্টারের আগে এই এলাকায় চাহিদা হঠাৎ বেড়ে যায়, তাই আগেভাগে খোঁজা `
            + `শুরু করলে ভালো সিট পাওয়ার সম্ভাবনা অনেক বেশি থাকে।`,
          en: `${campuses.slice(0, 3).join(', ')} — for students coming to ${en} the first `
            + `task is a seat or a mess close to campus. Demand here spikes just before `
            + `each semester, so starting the search early is the difference between a `
            + `good seat and whatever is left.`,
        },
        {
          bn: `এখানে সিট, মেস, সাবলেট আর পুরো ফ্ল্যাট আলাদা ক্যাটাগরিতে ভাগ করা, তাই `
            + `একা থাকার রুম খুঁজলে ফ্যামিলি ফ্ল্যাটের বিজ্ঞাপন মাঝখানে এসে ভিড় করে না। `
            + `"ব্যাচেলর" ফিল্টার দিলে শুধু সেই বাসাগুলোই দেখা যায় যেগুলোতে ব্যাচেলর `
            + `উঠতে পারবেন — প্রতিটা বিজ্ঞাপনে ফোন করে জিজ্ঞেস করতে হয় না।`,
          en: `Seats, mess, sublets and whole flats are separate categories here, so `
            + `looking for a single room does not bury you in family listings. The `
            + `bachelor filter leaves only places that will actually take you, instead `
            + `of ringing every ad to ask.`,
        },
      ],
    });
  }

  if (offices.length) {
    out.push({
      h2: {
        bn: `${bn} এ চাকরিজীবীদের জন্য`,
        en: `For working people in ${en}`,
      },
      paragraphs: [
        {
          bn: `${bn} ${offices[0]} এর এলাকা, তাই নতুন চাকরি নিয়ে ঢাকায় আসা অনেকেই `
            + `অফিসের হাঁটা দূরত্বে বা এক বাসের দূরত্বে থাকতে চান। ঢাকার যানজটে দিনে `
            + `দুই-তিন ঘণ্টা রাস্তায় নষ্ট করার চেয়ে একটু বেশি ভাড়ায় কাছাকাছি থাকা `
            + `অনেকের কাছেই লাভজনক হিসাব।`,
          en: `${en} is an area of ${offices[0]}, so people starting a new job in Dhaka `
            + `often want to live within walking distance or one bus ride of the office. `
            + `Given Dhaka traffic, paying a little more to live close usually works out `
            + `better than losing two or three hours a day to the road.`,
        },
        {
          bn: `ছোট ফ্ল্যাট, সাবলেট আর শেয়ার করা রুম — একা বা দুজন মিলে থাকার মতো `
            + `বিজ্ঞাপনগুলো ভাড়ার সীমা দিয়ে ফিল্টার করে দেখে নিতে পারেন।`,
          en: `Small flats, sublets and shared rooms — filter by rent range to see only `
            + `what fits a single person or a pair sharing.`,
        },
      ],
    });
  }

  out.push({
    h2: {
      bn: `${bn} এ কী কী পাওয়া যায়`,
      en: `What you will find in ${en}`,
    },
    paragraphs: [
      {
        bn: `${bn} এ ফ্যামিলি ফ্ল্যাট, ব্যাচেলর বাসা, একক রুম, মেসের সিট, সাবলেট এবং `
          + `দোকান-অফিসের মতো কমার্শিয়াল স্পেস — সব ধরনের টু-লেট বিজ্ঞাপন এক তালিকায়। `
          + `প্রতিটি বিজ্ঞাপনে ছবি, মাসিক ভাড়া, রুম ও বাথরুমের সংখ্যা এবং কী কী সুবিধা `
          + `আছে তা লেখা থাকে, আর বাড়িওয়ালার সাথে সরাসরি চ্যাট বা কল করা যায়।`,
        en: `Family flats, bachelor houses, single rooms, mess seats, sublets and `
          + `commercial space in ${en}, all in one list. Every listing carries photos, `
          + `the monthly rent, the room and bathroom count and what is included — and `
          + `you contact the landlord directly, with no broker and no commission.`,
      },
      {
        // The sub-area names themselves are rendered as chips by
        // LocationSeoBlock (loaded on demand — see dhakaSubAreas.js), so this
        // paragraph sets them up rather than listing them inline.
        bn: `${bn} এর ভেতরের ছোট এলাকাগুলোতেও আলাদা করে খোঁজা যায় — নিচের এলাকার `
          + `নামে ট্যাপ করলে বা সার্চে লিখলে ওই এলাকার বিজ্ঞাপনগুলো আগে দেখানো হয়।`,
        en: `You can search within ${en} too — tap any of the area names below, or `
          + `type one into the search, and listings there come first.`,
      },
    ],
  });

  out.push({
    h2: {
      bn: 'বাসা পাওয়ার পরের হিসাবটাও এখানেই',
      en: 'And the accounts after you move in',
    },
    paragraphs: [
      {
        bn: `বেশিরভাগ টু-লেট সাইটের কাজ চাবি হাতে পাওয়ার দিনই শেষ। কিন্তু ${bn} এ মেসে `
          + `বা শেয়ার করা বাসায় উঠলে আসল হিসাব তখনই শুরু হয় — মাসের মিল কয়টা, বাজারে `
          + `কত গেল, মিল রেট কত দাঁড়াল, কারেন্ট-গ্যাস-ওয়াইফাইয়ের বিল কে কত দেবে। `
          + `TO-LET PRO তে মিল ম্যানেজার আর রুমমেট ওয়ালেট একই অ্যাকাউন্টে, সম্পূর্ণ ফ্রি।`,
        en: `Most to-let sites are finished the day you get the keys. Moving into a mess `
          + `or a shared flat in ${en} is where the accounting starts — the meal count, `
          + `the bazar, the meal rate, and who owes what on the electricity, gas and `
          + `WiFi. The meal manager and roommate wallet are in the same account here, `
          + `completely free.`,
      },
    ],
  });

  return out;
}

function faq(area, campuses, offices) {
  const { en, bn } = area;
  const items = [
    {
      q: `${bn} এ বাসা ভাড়া কিভাবে খুঁজব? (How do I find a house to rent in ${en}?)`,
      a: `এই পাতাতেই ${bn} এর টু-লেট বিজ্ঞাপনগুলো ফিল্টার হয়ে আছে। ভাড়ার সীমা, রুম `
        + `সংখ্যা আর ফ্যামিলি/ব্যাচেলর ফিল্টার দিয়ে তালিকা আরও ছোট করে আনতে পারেন, `
        + `তারপর পছন্দ হলে বাড়িওয়ালার সাথে সরাসরি চ্যাট বা কল করুন। খোঁজা ও যোগাযোগ ফ্রি।`,
    },
    {
      q: `${bn} এ ব্যাচেলর বা ছাত্রদের বাসা ভাড়া দেওয়া হয়? (Are bachelors and students accepted in ${en}?)`,
      a: `হ্যাঁ, ${bn} এ ব্যাচেলর ফ্ল্যাট, একক রুম, মেসের সিট ও সাবলেটের আলাদা ক্যাটাগরি `
        + `আছে। "ব্যাচেলর" ফিল্টার দিলে শুধু সেই বাসাগুলোই দেখা যাবে যেগুলোতে ব্যাচেলর `
        + `উঠতে পারবেন, তাই "ব্যাচেলর ভাড়া হবে না" শুনে সময় নষ্ট হয় না।`,
    },
    {
      q: `${bn} এ ভাড়া কেমন? (What is the rent like in ${en}?)`,
      a: `একই ${bn} এর ভেতরেও সিটের ভাড়া আর ফ্যামিলি ফ্ল্যাটের ভাড়ায় বিশাল পার্থক্য `
        + `থাকে, আর রাস্তা ও ভবনভেদেও বদলায়। তাই ভাড়ার সীমা দিয়ে ফিল্টার করাই সবচেয়ে `
        + `কাজের — প্রতিটি বিজ্ঞাপনে মাসিক ভাড়া স্পষ্ট করে লেখা থাকে।`,
    },
  ];

  if (campuses.length) {
    items.push({
      q: `${campuses[0]} এর কাছে সিট বা মেস পাওয়া যাবে? (Can I find a seat or mess near ${campuses[0]}?)`,
      a: `${bn} ও আশপাশের এলাকায় ছাত্রদের জন্য মেস ও সিটের বিজ্ঞাপন নিয়মিত যোগ হয়। `
        + `"মেস" বা "সিট" ক্যাটাগরি বেছে নিলে শুধু সেগুলোই দেখা যাবে। সেমিস্টার শুরুর `
        + `আগে চাহিদা বাড়ে, তাই আগেভাগে খোঁজা ভালো।`,
    });
  }

  if (offices.length) {
    items.push({
      q: `${bn} এ অফিসের কাছে ছোট ফ্ল্যাট বা সাবলেট আছে? (Are there small flats or sublets near the offices in ${en}?)`,
      a: `আছে। ${bn} এ একক ব্যক্তি বা ছোট পরিবারের জন্য ছোট ফ্ল্যাট ও সাবলেটের বিজ্ঞাপন `
        + `আলাদা ক্যাটাগরিতে পাওয়া যায় — ভাড়ার সীমা দিয়ে ফিল্টার করে নিলে বাজেটের `
        + `মধ্যেরগুলোই দেখা যাবে।`,
    });
  }

  items.push({
    q: `বাড়িওয়ালা হিসেবে ${bn} এ বিজ্ঞাপন দেব কিভাবে? (How do I post a to-let ad in ${en}?)`,
    a: `অ্যাকাউন্ট খুলে "List your property" থেকে ছবি, ভাড়া ও সুবিধা যোগ করলেই বিজ্ঞাপন `
      + `লাইভ হয়। ফ্রি অ্যাকাউন্টে একটি বিজ্ঞাপন ৫টি ছবিসহ দেওয়া যায়। এরপর একই অ্যাপ `
      + `থেকে ভাড়াটিয়া, ভাড়ার খাতা ও রশিদও ম্যানেজ করা যায়।`,
  });

  return items;
}

/* ── the builder ─────────────────────────────────────────────────────────── */

/**
 * SEO payload for a Dhaka area page.
 * @param {string} slug e.g. 'mirpur-dhaka'
 */
export function areaSeo(slug) {
  const area = BY_SLUG.get(String(slug || '').toLowerCase());
  if (!area) return null;

  const campuses = CAMPUSES[area.slug] || [];
  const offices = OFFICE_HUBS[area.slug] || [];
  const path = areaPath(area.slug);

  return {
    kind: 'area',
    id: area.slug,
    path,
    en: area.en,
    bn: area.bn,
    aka: [],
    areaKind: area.kind,
    thana: area.thana,
    campuses,
    offices,
    // Sub-area names (the long tail) are NOT here: they live in the lazily
    // loaded dhakaSubAreas.js and are rendered as chips by LocationSeoBlock.
    // Bundling 669 bilingual names cost 41 KB gzipped on every page.
    areas: [],
    areasBn: [],
    divisionEn: 'Dhaka',
    divisionBn: 'ঢাকা',
    divisionId: 'dhaka',
    title: title(area.en, area.bn),
    description: description(area, campuses, offices),
    keywords: keywords(area, campuses),
    h1: `${area.bn} (${area.en}) — বাসা ভাড়া ও টু-লেট`,
    breadcrumb: [
      { name: 'Home', path: '/' },
      { name: 'To-Let', path: '/to-let' },
      { name: 'Dhaka', path: '/properties/dhaka' },
      { name: area.en, path },
    ],
    sections: sections(area, campuses, offices),
    faq: faq(area, campuses, offices),
  };
}

/** Every Dhaka area page, for the sitemap, the prerender and the hub links. */
export const ALL_AREA_PAGES = DHAKA_AREAS.map((a) => areaSeo(a.slug)).filter(Boolean);

/** Areas next to a campus — surfaced first for the student audience. */
export const CAMPUS_AREA_SLUGS = Object.keys(CAMPUSES);

/** Areas next to an office district. */
export const OFFICE_AREA_SLUGS = Object.keys(OFFICE_HUBS);
