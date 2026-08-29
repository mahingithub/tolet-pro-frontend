/**
 * featurePages.js — long-form content for the standalone landing pages.
 * ─────────────────────────────────────────────────────────────────────────────
 * Half of what TO-LET PRO does has nothing to do with searching for a house:
 * the meal manager, the roommate wallet, the rent ledger, tenant records. All
 * of it lives behind a login, so a crawler had never seen a single word about
 * it — "মিল ম্যানেজার অ্যাপ" or "ভাড়ার খাতা" could not find this app no
 * matter how good those features are.
 *
 * ── The positioning problem these pages exist to solve ──
 * The name says "TO-LET", so everyone assumes listings and stops there. The
 * search landscape (see keywords.js) is split into three silos — listing sites,
 * mess/meal apps, and landlord rent ledgers — and nothing spans more than one.
 * TO-LET PRO spans all three. Every page below therefore has to do two jobs:
 * rank for its own term, AND tell the visitor that the other two halves exist.
 * That is what the `allInOne` section on each page is for.
 *
 * ── Length is deliberate ──
 * Each page runs 700–1000 words per language. A 150-word page does not rank
 * against messmonitor.com or bari-wala.com, both of which publish long Bangla
 * explainers. Sections are written to be read, not padded — every paragraph
 * answers something a real user wonders about.
 *
 * ── ⚠️ EVERY CLAIM HERE MUST BE TRUE ──
 * Checked against the real screens and against SubscriptionPage.jsx's plan
 * matrix. The honest split, which the `pricing` block on each page states
 * plainly rather than hiding:
 *
 *   FREE, no subscription, no trial:
 *     • searching and contacting landlords
 *     • the ENTIRE meal manager + roommate wallet (Living.jsx has no paywall —
 *       meals, bazar, bills, balances, monthly report, reminders)
 *     • one active listing with 5 photos
 *   PAID (Plus / Pro):
 *     • more than one listing, more photos, video, search boost
 *     • rent collection, bookings pipeline, smart alerts, analytics, AI pricing
 *
 * Do NOT write "rent collection is free" anywhere. It is not — SubscriptionPage
 * lists it as free:'✗', plus:'✓', pro:'✓'.
 *
 * Icons are STRING keys, not imports, so the Node build scripts can read this
 * file without pulling in React or lucide.
 */

import {
  MEAL_KEYWORDS, WALLET_KEYWORDS, MANAGEMENT_KEYWORDS, SERVICE_KEYWORDS,
  RENT_KEYWORDS, RENT_LEDGER_KEYWORDS, ALL_IN_ONE_KEYWORDS, toKeywordString,
} from './keywords.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Shared "this is not just a to-let site" section.
 * Appended to every landing page, phrased from that page's point of view so it
 * reads as a natural closing thought rather than a boilerplate paste.
 *
 * @param {{bn: string, en: string}} fromTheirSide the middle paragraph, naming
 *   the specific gap in whatever competing product this page's visitor is
 *   likely to already be using.
 * ────────────────────────────────────────────────────────────────────────── */
const allInOne = (fromTheirSide) => ({
  h2: {
    bn: 'শুধু একটা টু-লেট সাইট নয়',
    en: 'Not just another to-let site',
  },
  paragraphs: [
    {
      bn: 'বাংলাদেশে এখন যা আছে তা তিন ভাগে ভাগ করা। এক দিকে টু-লেট সাইট — বাসা '
        + 'খুঁজে দেয়, তারপর আর কোনো কাজে আসে না। আরেক দিকে মেস বা মিল ম্যানেজার '
        + 'অ্যাপ — মিলের হিসাব রাখে, কিন্তু বাসা খুঁজে দিতে পারে না। তৃতীয় দিকে '
        + 'বাড়িওয়ালাদের ভাড়ার খাতার সফটওয়্যার — ভাড়া তোলে, কিন্তু ভাড়াটিয়ার '
        + 'দৈনন্দিন জীবনের সাথে তার কোনো সম্পর্ক নেই। তিনটার জন্য তিনটা আলাদা '
        + 'অ্যাকাউন্ট, তিন জায়গায় তথ্য।',
      en: 'What exists in Bangladesh today comes in three separate pieces. To-let '
        + 'sites find you a house and are useless the day after you move in. Mess '
        + 'and meal apps count meals but cannot find you a room. Landlord ledger '
        + 'software collects rent but knows nothing about the people living there. '
        + 'Three products, three accounts, three places your information sits.',
    },
    fromTheirSide,
    {
      bn: 'TO-LET PRO তে বাসা খোঁজা, বাসা ম্যানেজ করা আর বাসায় থাকার হিসাব — '
        + 'তিনটাই এক অ্যাকাউন্টে। ব্যাচেলর হিসেবে মেসের সিট খুঁজে সেখানেই মিলের '
        + 'হিসাব শুরু করতে পারেন; পরিবার নিয়ে ফ্ল্যাট নিয়ে কারেন্ট-গ্যাস-ওয়াইফাইয়ের '
        + 'বিল ভাগ করতে পারেন; বাড়িওয়ালা হিসেবে খালি ফ্ল্যাটের বিজ্ঞাপন দিয়ে সেই '
        + 'ভাড়াটিয়াকেই ভাড়ার খাতায় তুলে রাখতে পারেন। একই জায়গা, একই অ্যাকাউন্ট।',
      en: 'TO-LET PRO puts all three in one account: find the place, manage the '
        + 'place, and run the day-to-day money of living in it. Find a mess seat '
        + 'and start the meal ledger in the same app. Take a family flat and split '
        + 'the electricity, gas and WiFi in it. List a vacant flat as a landlord '
        + 'and keep that same tenant in your rent book afterwards.',
    },
  ],
});

/** The honest free/paid split, restated per page in that page's terms. */
const PRICING_FREE_TOOLS = {
  h2: { bn: 'খরচ কত?', en: 'What does it cost?' },
  free: {
    bn: [
      'মিল ম্যানেজার — মিল, বাজার, মিল রেট, ব্যালেন্স, মাসিক রিপোর্ট',
      'রুমমেট ওয়ালেট — খরচ ভাগ, বিল, পাওনা-দেনার হিসাব',
      'বাসা খোঁজা, ছবি দেখা ও বাড়িওয়ালার সাথে যোগাযোগ',
      'একটি টু-লেট বিজ্ঞাপন, ৫টি ছবিসহ',
    ],
    en: [
      'Meal manager — meals, bazar, meal rate, balances, monthly report',
      'Roommate wallet — expense splitting, bills, who-owes-whom',
      'Searching, photos and contacting landlords',
      'One to-let listing with 5 photos',
    ],
  },
  paid: {
    bn: [
      'একাধিক লিস্টিং, বেশি ছবি ও ভিডিও',
      'সার্চ বুস্ট ও ফেসবুক বুস্ট পোস্ট',
      'ভাড়া কালেকশন ও বুকিং পাইপলাইন',
      'স্মার্ট অ্যালার্ট, অ্যানালিটিক্স ও এআই প্রাইসিং',
    ],
    en: [
      'More than one listing, more photos and video',
      'Search boost and Facebook boost post',
      'Rent collection and the bookings pipeline',
      'Smart alerts, analytics and AI pricing',
    ],
  },
  note: {
    bn: 'পেইড প্ল্যানগুলো বাড়িওয়ালাদের জন্য। ভাড়াটিয়া, ছাত্র বা মেসের সদস্য '
      + 'হিসেবে আপনার কখনো কিছু কিনতে হবে না — মিল ম্যানেজার ও ওয়ালেটে কোনো '
      + 'ফ্রি ট্রায়াল নেই, কারণ পুরোটাই ফ্রি।',
    en: 'The paid plans are for landlords. As a tenant, student or mess member '
      + 'you never have to buy anything — there is no free trial on the meal '
      + 'manager or the wallet, because there is nothing to upgrade to.',
  },
};

/* ─────────────────────────── মিল ম্যানেজার ──────────────────────────────── */

const mealManager = {
  slug: '/meal-manager',
  // Where the primary button goes. NOT /login — see the note in
  // FeatureLanding.jsx. RequireAuth turns this into
  // /login?next=%2Fliving%3Fm%3Dmeals for a signed-out visitor, and LoginPage
  // returns them here afterwards, so a search for "মিল ম্যানেজার" ends inside
  // the meal manager rather than on a generic sign-in screen.
  cta: { to: '/living?m=meals', bn: 'মিল ম্যানেজার খুলুন', en: 'Open the meal manager' },
  serviceType: 'Meal and mess management',
  eyebrow: { bn: 'মেস ও ব্যাচেলর লাইফ', en: 'For mess & bachelor life' },

  title: 'মিল ম্যানেজার — ফ্রি মেস ম্যানেজার ও মিল হিসাবের অ্যাপ',
  description:
    'মেসের মিল, বাজার খরচ আর মিল রেট আর খাতায় নয়। প্রতিদিনের মিল তুলুন, বাজার যোগ '
    + 'করুন — মিল রেট, প্রত্যেকের খরচ আর কে কত পাবে অ্যাপ নিজেই হিসাব করে দেবে। '
    + 'সম্পূর্ণ ফ্রি, কোনো সাবস্ক্রিপশন বা ট্রায়াল নেই। Free meal manager and mess '
    + 'hisab app for Bangladeshi messes, hostels and bachelor flats — Bangla & English.',
  keywords: toKeywordString([...MEAL_KEYWORDS, ...WALLET_KEYWORDS.slice(0, 8)]),

  h1: {
    bn: 'মিল ম্যানেজার — মেসের হিসাব আর খাতায় নয়',
    en: 'Meal Manager for messes, hostels & bachelor flats',
  },
  intro: {
    bn: 'মাসের শেষ দিনটাই মেসের সবচেয়ে খারাপ দিন। খাতা বের হয়, কেউ বলে আমি ওই '
      + 'সপ্তাহে ছিলাম না, কারও মিল লেখা হয়নি, বাজারের কোন স্লিপ কোথায় গেছে কেউ '
      + 'জানে না — আর মিল রেট নিয়ে তর্ক শুরু হয়। TO-LET PRO এর মিল ম্যানেজারে '
      + 'প্রতিদিনের মিল আর বাজার শুধু তুলে রাখুন; মিল রেট, প্রত্যেকের মোট খরচ আর '
      + 'কে কত পাবে বা দেবে — পুরো হিসাব অ্যাপ নিজেই করে রাখে, রোজ, সবার চোখের সামনে।',
    en: 'The last day of the month is the worst day in any mess. The register comes '
      + 'out, someone was away that week, someone else’s meals were never written '
      + 'down, nobody knows where the bazar slips went — and then the argument about '
      + 'the meal rate starts. Log meals and bazar as they happen and TO-LET PRO '
      + 'keeps the meal rate, each member’s total and every balance updated daily, '
      + 'in the open, where the whole group can see it.',
  },

  features: [
    {
      icon: 'utensils',
      bn: { t: 'দৈনিক মিল এন্ট্রি', d: 'সকাল, দুপুর, রাত — প্রতিটি সদস্যের মিল আলাদা করে, অর্ধেক মিলসহ।' },
      en: { t: 'Daily meal entry', d: 'Breakfast, lunch and dinner per member, half-meals included.' },
    },
    {
      icon: 'basket',
      bn: { t: 'বাজার খরচ', d: 'কে বাজার করল, কত টাকার — যোগ করলেই মোট খরচে বসে যায়।' },
      en: { t: 'Bazar expenses', d: 'Who shopped and for how much, straight into the month’s total.' },
    },
    {
      icon: 'calculator',
      bn: { t: 'অটো মিল রেট', d: 'মোট বাজার ÷ মোট মিল — প্রতিটি এন্ট্রিতে নিজে থেকেই আপডেট হয়।' },
      en: { t: 'Automatic meal rate', d: 'Total bazar ÷ total meals, recalculated on every entry.' },
    },
    {
      icon: 'scale',
      bn: { t: 'কে কত পাবে', d: 'জমা আর খরচ মিলিয়ে ব্যালেন্স — পাওনা ও দেনা আলাদা করে।' },
      en: { t: 'Balances', d: 'Deposits against consumption, so each member sees what they owe.' },
    },
    {
      icon: 'chart',
      bn: { t: 'মাসিক রিপোর্ট', d: 'মাস শেষের পুরো হিসাব এক পাতায়, গ্রুপে শেয়ার করার মতো।' },
      en: { t: 'Monthly report', d: 'The whole month on one page, ready to share with the group.' },
    },
    {
      icon: 'bell',
      bn: { t: 'রিমাইন্ডার', d: 'বাজারের পালা বা জমা দেওয়ার তারিখ — অ্যাপ মনে করিয়ে দেয়।' },
      en: { t: 'Reminders', d: 'Whose turn it is to shop, and when deposits are due.' },
    },
  ],

  sections: [
    {
      h2: { bn: 'মিল রেট আসলে কিভাবে বের হয়', en: 'How the meal rate is actually calculated' },
      paragraphs: [
        {
          bn: 'নিয়মটা সব মেসেই এক: মাসের মোট বাজার খরচকে সবার মোট মিল সংখ্যা দিয়ে '
            + 'ভাগ করলে যা আসে সেটাই মিল রেট। এরপর প্রত্যেকের খরচ = তার মোট মিল × '
            + 'মিল রেট, আর সেটা তার জমা দেওয়া টাকার সাথে মিলিয়ে দেখলেই বোঝা যায় সে '
            + 'পাবে না দেবে। হিসাবটা কঠিন নয় — কঠিন হলো মাসজুড়ে সংখ্যাগুলো ঠিকঠাক '
            + 'জমা রাখা।',
          en: 'The rule is the same in every mess: the month’s total bazar cost '
            + 'divided by everyone’s total meals gives the meal rate. Each member’s '
            + 'share is then their meal count times that rate, set against what they '
            + 'deposited. The arithmetic was never the hard part — keeping the '
            + 'numbers honest for thirty days is.',
        },
        {
          bn: 'সেখানেই খাতা হেরে যায়। একদিন লেখা বাদ পড়ে, একটা বাজারের স্লিপ হারায়, '
            + 'আর মাস শেষে সেই ফাঁকটা কেউ ধরতে পারে না। অ্যাপে প্রতিটি এন্ট্রির সাথে '
            + 'সাথে মিল রেট আপডেট হয়ে যায়, তাই মাসের ১০ তারিখেও আপনি জানেন এখন পর্যন্ত '
            + 'রেট কত আর আপনার কত বাকি। মাসের শেষে কোনো চমক থাকে না।',
          en: 'That is where a paper register loses. A day gets skipped, a bazar slip '
            + 'goes missing, and by month end nobody can find the gap. Here the rate '
            + 'updates the moment anything is entered, so on the 10th you already know '
            + 'what the rate is running at and what you owe. No surprises on the 30th.',
        },
      ],
    },
    {
      h2: { bn: 'ঝগড়াটা টাকার নয়, স্বচ্ছতার', en: 'The argument is never about money — it is about visibility' },
      paragraphs: [
        {
          bn: 'মেসে টাকার ঝামেলা প্রায় কখনোই অসততা থেকে হয় না। হয় এই কারণে যে হিসাবটা '
            + 'একজনের খাতায় থাকে আর বাকিরা মাসের শেষে প্রথমবার সেটা দেখে। তখন প্রশ্ন '
            + 'করলে মনে হয় ম্যানেজারকে অবিশ্বাস করা হচ্ছে, আর প্রশ্ন না করলে মনে খুঁতখুঁত '
            + 'থেকে যায়।',
          en: 'Money trouble in a mess almost never comes from dishonesty. It comes '
            + 'from the ledger living in one person’s notebook, where everyone else '
            + 'sees it for the first time on the last day. Ask a question then and it '
            + 'sounds like an accusation; stay quiet and the doubt stays with you.',
        },
        {
          bn: 'এখানে প্রতিটি এন্ট্রি সব সদস্য দেখতে পান — কে কখন কী যোগ করল, কত টাকার '
            + 'বাজার হলো, কার কয়টা মিল বসল। ম্যানেজারের কাজ কমে যায়, কারণ তাকে আর কারও '
            + 'কাছে কৈফিয়ত দিতে হয় না; সংখ্যাগুলোই কথা বলে। বেশিরভাগ মেসে এই একটা '
            + 'পরিবর্তনই মাস শেষের তর্ক শেষ করে দেয়।',
          en: 'Here every entry is visible to every member — who added what, when, and '
            + 'how many meals landed against whose name. It takes work off the manager, '
            + 'because there is nothing left to justify; the numbers speak. In most '
            + 'messes that single change is what ends the end-of-month argument.',
        },
      ],
    },
    {
      h2: { bn: 'কাদের জন্য', en: 'Who this is for' },
      paragraphs: [
        {
          bn: 'ঢাকা, চট্টগ্রাম, রাজশাহী, সিলেট বা খুলনার যেকোনো ব্যাচেলর মেস; '
            + 'বিশ্ববিদ্যালয় ও মেডিকেলের আশপাশের স্টুডেন্ট মেস ও হোস্টেল; শেয়ার করা '
            + 'ফ্ল্যাট যেখানে চার-পাঁচজন মিলে রান্না হয়; এমনকি অফিসের ছোট ক্যান্টিন — '
            + 'যেখানেই মিল গুনে খরচ ভাগ হয়, সেখানেই এটা কাজে লাগে।',
          en: 'Any bachelor mess in Dhaka, Chattogram, Rajshahi, Sylhet or Khulna; the '
            + 'student messes and hostels around every university and medical college; '
            + 'shared flats where four or five people cook together; even a small office '
            + 'canteen. Anywhere meals are counted and costs are split.',
        },
        {
          bn: 'বাড়িওয়ালার সাথে যুক্ত থাকার দরকার নেই। মেসের যেকোনো সদস্য নিজেই গ্রুপ '
            + 'খুলে বাকিদের যোগ করতে পারেন — TO-LET PRO তে বাসা না খুঁজেও শুধু মিল '
            + 'ম্যানেজার ব্যবহার করা যায়।',
          en: 'No landlord involvement required. Any member can start a group and add '
            + 'the others — you can use the meal manager on its own without ever '
            + 'searching for a house here.',
        },
      ],
    },
    allInOne({
      bn: 'মিল ম্যানেজার অ্যাপগুলোর সমস্যা হলো, সিট বদলালে বা নতুন মেস খুঁজতে হলে সেগুলো '
        + 'আপনাকে আর কোনো সাহায্য করতে পারে না — তখন আবার আলাদা টু-লেট সাইটে গিয়ে খুঁজতে হয়। '
        + 'আর বেশ কিছু মেস অ্যাপে ভালো ফিচারগুলো সাবস্ক্রিপশন বা ট্রায়ালের পেছনে আটকানো।',
      en: 'The limit of a meal-manager app is that it cannot help you the day you change '
        + 'seats or go looking for a new mess — for that you are back on a separate '
        + 'to-let site. Several of them also keep the useful parts behind a subscription '
        + 'or an expiring trial.',
    }),
  ],

  pricing: PRICING_FREE_TOOLS,

  steps: [
    { bn: 'TO-LET PRO তে ফ্রি অ্যাকাউন্ট খুলুন', en: 'Create a free TO-LET PRO account' },
    { bn: 'মেসের সদস্যদের যুক্ত করুন', en: 'Add your mess members' },
    { bn: 'প্রতিদিনের মিল ও বাজার তুলুন', en: 'Log meals and bazar as they happen' },
    { bn: 'মাস শেষে রিপোর্ট দেখুন — হিসাব রেডি', en: 'Open the report at month end — the maths is done' },
  ],

  faq: [
    {
      q: 'মিল ম্যানেজার ব্যবহার করতে কি টাকা লাগে? (Is the meal manager free?)',
      a: 'না, এক টাকাও লাগে না। মিল, বাজার, বিল, ব্যালেন্স ও মাসিক রিপোর্ট — পুরো মিল '
        + 'ম্যানেজার সম্পূর্ণ ফ্রি। কোনো ফ্রি ট্রায়াল নেই, কারণ আপগ্রেড করার মতো কিছু নেই। '
        + 'TO-LET PRO তে পেইড প্ল্যান আছে শুধু বাড়িওয়ালাদের জন্য (একাধিক বিজ্ঞাপন, '
        + 'ভাড়া কালেকশন, বুস্ট) — মেসের সদস্য হিসেবে সেগুলোর কোনো দরকার নেই।',
    },
    {
      q: 'মিল রেট কিভাবে হিসাব হয়? (How is the meal rate calculated?)',
      a: 'মাসের মোট বাজার খরচ ÷ সবার মোট মিল = মিল রেট। প্রত্যেকের খরচ = তার মিল × '
        + 'মিল রেট। নতুন খরচ বা মিল যোগ করলেই রেট সাথে সাথে আপডেট হয়, তাই মাসের যেকোনো '
        + 'দিন বর্তমান রেট ও নিজের ব্যালেন্স দেখা যায়।',
    },
    {
      q: 'অর্ধেক মিল বা কেউ বাইরে খেলে কী হবে? (What about half-meals or someone eating out?)',
      a: 'প্রতিটি সদস্যের জন্য সকাল, দুপুর ও রাতের মিল আলাদা করে বসানো যায়, আর অর্ধেক '
        + 'মিলও তোলা যায়। কেউ কয়েকদিন মেসে না থাকলে ওই দিনগুলোতে তার মিল শূন্য থাকবে, '
        + 'ফলে তার ভাগের খরচও সেই অনুযায়ী কমে যাবে।',
    },
    {
      q: 'বাড়িওয়ালা ছাড়া শুধু মেসের জন্য ব্যবহার করা যাবে? (Can we use it just for a mess?)',
      a: 'যাবে। মিল ম্যানেজার আর রুমমেট ওয়ালেট বাসা ভাড়ার বিজ্ঞাপন থেকে সম্পূর্ণ আলাদা। '
        + 'যেকোনো মেস, হোস্টেল বা শেয়ার করা ফ্ল্যাটের সদস্যরা নিজেরাই গ্রুপ খুলে '
        + 'ব্যবহার করতে পারেন।',
    },
    {
      q: 'সব সদস্য কি হিসাব দেখতে পান, নাকি শুধু ম্যানেজার? (Can everyone see the accounts?)',
      a: 'সবাই দেখতে পান। কে কখন কী এন্ট্রি দিল তার একটিভিটি লগ থাকে, তাই হিসাব কারও '
        + 'ব্যক্তিগত খাতায় আটকে থাকে না। এতে ম্যানেজারের উপর চাপ কমে এবং মাস শেষের '
        + 'তর্কও কমে যায়।',
    },
    {
      q: 'বাসা ভাড়া ও কারেন্ট বিলও কি এখানে রাখা যায়? (Can it handle rent and utility bills too?)',
      a: 'যায়। একই গ্রুপে রুমমেট ওয়ালেট আছে — বিদ্যুৎ, গ্যাস, পানি, ওয়াইফাই, বুয়ার '
        + 'বেতন বা বাসা ভাড়ার মতো খরচ সেখানে যোগ করে সমান, শতাংশ বা কাস্টম হারে ভাগ '
        + 'করা যায়। মিল আর অন্যান্য খরচের ব্যালেন্স একসাথেই দেখানো হয়।',
    },
    {
      q: 'হিসাব কি বাংলায় দেখা যায়? (Is it available in Bangla?)',
      a: 'হ্যাঁ। পুরো অ্যাপ বাংলা ও ইংরেজি দুই ভাষায় চলে এবং যেকোনো সময় ভাষা বদলানো যায়।',
    },
    {
      q: 'মেসের সিট খুঁজতেও কি এই অ্যাপ কাজে লাগবে? (Can it also help me find a mess seat?)',
      a: 'এটাই TO-LET PRO র মূল পার্থক্য। অন্য মিল ম্যানেজার অ্যাপ শুধু হিসাব রাখে; '
        + 'এখানে একই অ্যাকাউন্ট থেকে ৬৪ জেলার মেস, সিট, সাবলেট ও ব্যাচেলর বাসার টু-লেট '
        + 'বিজ্ঞাপনও খোঁজা যায়। সিট বদলালে নতুন অ্যাপ নামাতে হয় না।',
    },
  ],

  related: ['/roommate-wallet', '/tenant-manager', '/to-let'],
};

/* ────────────────────────── রুমমেট ওয়ালেট ──────────────────────────────── */

const roommateWallet = {
  slug: '/roommate-wallet',
  cta: { to: '/living?m=expenses', bn: 'ওয়ালেট খুলুন', en: 'Open the wallet' },
  serviceType: 'Shared expense and bill splitting',
  eyebrow: { bn: 'শেয়ার্ড খরচ', en: 'Shared expenses' },

  title: 'রুমমেট ওয়ালেট — খরচ ও বিল ভাগ করার ফ্রি অ্যাপ',
  description:
    'কারেন্ট বিল, গ্যাস, পানি, ওয়াইফাই, বুয়ার বেতন, বাজার — রুমমেটদের সব খরচ এক '
    + 'ওয়ালেটে। সমান, শতাংশ বা কাস্টম হারে ভাগ করুন, কে কত পাবে অ্যাপ হিসাব করে দেবে। '
    + 'সম্পূর্ণ ফ্রি। Split rent, utility bills and shared costs with roommates in '
    + 'Bangladesh — free, in Bangla and English.',
  keywords: toKeywordString([...WALLET_KEYWORDS, ...MEAL_KEYWORDS.slice(0, 8)]),

  h1: {
    bn: 'রুমমেট ওয়ালেট — খরচ ভাগাভাগি, ঝগড়া ছাড়াই',
    en: 'Roommate Wallet — shared expenses, settled',
  },
  intro: {
    bn: 'কারেন্ট বিল কে দিল, ওয়াইফাইয়ের টাকা কার কাছে বাকি, বুয়ার বেতন এই মাসে কার '
      + 'দেওয়ার কথা — শেয়ার করা বাসায় টাকার কথা তোলাই সবচেয়ে অস্বস্তিকর কাজ। বন্ধুর '
      + 'কাছে তিনশো টাকা চাইতে গিয়ে সম্পর্ক নষ্ট হওয়ার ভয়ে অনেকে চুপ থাকেন, আর হিসাবটা '
      + 'জমতে জমতে বড় হয়ে যায়। রুমমেট ওয়ালেটে প্রতিটি খরচ একবার তুলে রাখলেই কে কত '
      + 'দিয়েছে আর কার কাছে কত পাওনা, সেটা কাউকে মুখে বলতে হয় না — সবার সামনেই থাকে।',
    en: 'Who paid the electricity bill, who still owes for WiFi, whose turn the maid’s '
      + 'salary is this month — money is the most awkward thing to bring up in a shared '
      + 'flat. People stay quiet rather than ask a friend for three hundred taka, and '
      + 'the imbalance quietly grows. Log each cost once and nobody has to say it out '
      + 'loud: who paid what, and who owes whom, is simply on the screen.',
  },

  features: [
    {
      icon: 'receipt',
      bn: { t: 'যেকোনো খরচ যোগ করুন', d: 'বিদ্যুৎ, গ্যাস, পানি, ওয়াইফাই, বাজার, বুয়া, পরিষ্কার — সব ক্যাটাগরি আছে।' },
      en: { t: 'Log any expense', d: 'Electricity, gas, water, WiFi, groceries, maid, cleaning and more.' },
    },
    {
      icon: 'split',
      bn: { t: 'সমান, শতাংশ বা কাস্টম ভাগ', d: 'সবার সমান নয় এমন খরচও ঠিকভাবে ভাগ করা যায়।' },
      en: { t: 'Equal, percentage or custom split', d: 'Because not every cost is split evenly.' },
    },
    {
      icon: 'scale',
      bn: { t: 'ব্যালেন্স ও সেটেলমেন্ট', d: 'কে কত পাবে, কে কত দেবে — এক নজরে, হিসাব মেলানোর ঝামেলা ছাড়াই।' },
      en: { t: 'Balances & settle up', d: 'A single view of who owes whom, no spreadsheet needed.' },
    },
    {
      icon: 'wallet',
      bn: { t: 'বিকাশ, নগদ, ক্যাশ, ব্যাংক', d: 'কোন মাধ্যমে টাকা দেওয়া হয়েছে সেটাও রেকর্ড থাকে।' },
      en: { t: 'bKash, Nagad, cash, bank', d: 'Record how a payment was actually made.' },
    },
    {
      icon: 'chart',
      bn: { t: 'মাসিক রিপোর্ট', d: 'কোন খাতে কত গেল — মাস শেষে পুরো ছবি এক জায়গায়।' },
      en: { t: 'Monthly report', d: 'Where the month’s money actually went, by category.' },
    },
    {
      icon: 'activity',
      bn: { t: 'একটিভিটি লগ', d: 'কে কখন কী যোগ করল সবাই দেখতে পায় — কোনো গোপন এন্ট্রি নেই।' },
      en: { t: 'Activity log', d: 'Every entry is visible to the whole group — nothing hidden.' },
    },
  ],

  sections: [
    {
      h2: { bn: 'সব খরচ সমান ভাগ হয় না', en: 'Not every cost splits evenly' },
      paragraphs: [
        {
          bn: 'তিনজনের বাসায় একজনের ঘরে এসি চলে, দুজন থাকেন এক রুমে আর একজন আলাদা, '
            + 'কেউ ওয়াইফাই প্রায় ব্যবহারই করেন না। সব খরচ তিন ভাগ করলে হিসাব সহজ হয় '
            + 'কিন্তু ন্যায্য হয় না — আর এই ছোট অন্যায্যতাগুলো জমেই মাস শেষে মন খারাপ হয়।',
          en: 'Three people share a flat: one room has an air conditioner, two people '
            + 'share a room while the third has their own, and one of them barely '
            + 'touches the WiFi. Splitting everything three ways is simple but not '
            + 'fair, and it is the accumulation of those small unfairnesses that sours '
            + 'a house.',
        },
        {
          bn: 'তাই প্রতিটি খরচের জন্য আলাদা করে ভাগের নিয়ম বেছে নেওয়া যায় — সমান, '
            + 'শতাংশ, বা একদম কাস্টম অঙ্ক। কারেন্ট বিল রুম অনুযায়ী, বাজার সমান, '
            + 'ওয়াইফাই শুধু যারা ব্যবহার করেন তাদের মধ্যে — একই মাসে তিন রকম নিয়ম '
            + 'চললেও ব্যালেন্স ঠিকই মিলে যায়।',
          en: 'So the split rule is chosen per expense — equal, by percentage, or fully '
            + 'custom amounts. Electricity by room, bazar equally, WiFi only among the '
            + 'people who use it: three different rules in the same month, and the '
            + 'balances still reconcile.',
        },
      ],
    },
    {
      h2: { bn: 'টাকা অ্যাপের ভেতর দিয়ে যায় না', en: 'The money does not move through the app' },
      paragraphs: [
        {
          bn: 'অনেকে ভাবেন এ ধরনের অ্যাপে টাকা জমা দিতে হয় বা লেনদেন করতে হয়। এখানে '
            + 'তা নয়। টাকা আপনি আগের মতোই বিকাশ, নগদ, ব্যাংক বা হাতে হাতে দেবেন — '
            + 'অ্যাপ শুধু লিখে রাখে কে কাকে কত দিল, কোন মাধ্যমে দিল, আর তার পরে '
            + 'ব্যালেন্স কত দাঁড়াল।',
          en: 'People often assume an app like this holds your money. It does not. You '
            + 'pay the way you already do — bKash, Nagad, bank transfer, cash in hand — '
            + 'and the app simply records who paid whom, through which channel, and '
            + 'what the balance is afterwards.',
        },
        {
          bn: 'এর ফলে কোনো চার্জ নেই, কোনো অ্যাকাউন্ট ভেরিফিকেশন নেই, আর টাকা আটকে '
            + 'থাকার ঝুঁকিও নেই। যা থাকে তা হলো একটা পরিষ্কার, শেয়ার করা হিসাব — যেটা '
            + 'ঠিক এই জিনিসটারই অভাব ছিল।',
          en: 'Which means no fees, no account verification, and no risk of money being '
            + 'stuck somewhere. What you get is a clean shared record — which was the '
            + 'only thing missing in the first place.',
        },
      ],
    },
    {
      h2: { bn: 'রুমমেট বদলালে হিসাব হারায় না', en: 'Balances survive people moving out' },
      paragraphs: [
        {
          bn: 'শেয়ার করা বাসায় লোক বদলায় — কেউ চাকরি পেয়ে চলে যায়, কেউ সেমিস্টার '
            + 'শেষে বাড়ি যায়। খাতায় হিসাব থাকলে সেই মানুষটার সাথে সাথেই হিসাবও চলে যায়, '
            + 'আর পরে কে কত দিয়েছিল তা প্রমাণ করার কোনো উপায় থাকে না।',
          en: 'Shared flats turn over — someone gets a job and leaves, someone goes home '
            + 'after the semester. When the ledger lives in a notebook it leaves with '
            + 'that person, and there is no way to establish later who had paid what.',
        },
        {
          bn: 'এখানে পুরনো এন্ট্রি, রিপোর্ট আর সেটেলমেন্ট থেকে যায়। কেউ চলে গেলেও কোন '
            + 'মাসে কার কত পাওনা ছিল সেটা পরেও দেখা যায়, তাই বিদায়ের সময় হিসাব মেটানো '
            + 'অনেক সহজ হয়।',
          en: 'Here the old entries, reports and settlements stay. Even after someone '
            + 'leaves you can look up exactly what was owed in which month, which makes '
            + 'settling up on the way out far less painful.',
        },
      ],
    },
    allInOne({
      bn: 'খরচ ভাগ করার আন্তর্জাতিক অ্যাপগুলো টাকার হিসাব ভালোই রাখে, কিন্তু সেগুলো '
        + 'বাংলাদেশের বাস্তবতা জানে না — বিকাশ-নগদ নেই, বুয়ার বেতন বা মিল রেটের ধারণা '
        + 'নেই, আর নতুন বাসা খুঁজতে তো একেবারেই কাজে আসে না।',
      en: 'International expense-splitting apps keep the arithmetic well enough, but they '
        + 'do not know this country — no bKash or Nagad, no concept of a maid’s salary or '
        + 'a meal rate, and no help at all when you need to find the next place to live.',
    }),
  ],

  pricing: PRICING_FREE_TOOLS,

  steps: [
    { bn: 'ফ্রি অ্যাকাউন্ট খুলে গ্রুপ তৈরি করুন', en: 'Create a free account and start a group' },
    { bn: 'রুমমেটদের যুক্ত করুন', en: 'Add your roommates' },
    { bn: 'খরচ হলেই তুলে রাখুন, ভাগের নিয়ম বেছে নিন', en: 'Log a cost, pick how it splits' },
    { bn: 'ব্যালেন্স দেখে হিসাব মিটিয়ে ফেলুন', en: 'Open balances and settle up' },
  ],

  faq: [
    {
      q: 'রুমমেট ওয়ালেট কি ফ্রি? (Is the roommate wallet free?)',
      a: 'হ্যাঁ, সম্পূর্ণ ফ্রি। খরচ যোগ করা, ভাগ করা, ব্যালেন্স দেখা ও মাসিক রিপোর্ট — '
        + 'কোনো কিছুর জন্য টাকা লাগে না এবং কোনো ফ্রি ট্রায়ালের মেয়াদও শেষ হয় না।',
    },
    {
      q: 'অ্যাপের ভেতরে কি টাকা লেনদেন হয়? (Does money move inside the app?)',
      a: 'না। টাকা আপনি বিকাশ, নগদ, ব্যাংক বা ক্যাশে যেভাবে খুশি দেবেন — অ্যাপ শুধু '
        + 'হিসাব রাখে কে কাকে কত দিয়েছে, কোন মাধ্যমে এবং কত বাকি আছে।',
    },
    {
      q: 'বাসা ভাড়াও কি ভাগ করা যায়? (Can we split the house rent too?)',
      a: 'যায়। বাসা ভাড়া একটি খরচ হিসেবে যোগ করে সমান বা কাস্টম হারে ভাগ করা যায় — '
        + 'যার রুম বড় তার ভাগ বেশি রাখতে চাইলে সেটাও সম্ভব।',
    },
    {
      q: 'মিলের হিসাবও কি এখানে রাখা যায়? (Can it handle meal accounts too?)',
      a: 'যায়। একই গ্রুপে মিল ম্যানেজার আছে — মিল, বাজার ও মিল রেট সেখানে, আর '
        + 'বিদ্যুৎ-গ্যাস-ওয়াইফাইয়ের মতো খরচ ওয়ালেটে। দুটোর ব্যালেন্স একসাথে দেখানো হয়।',
    },
    {
      q: 'রুমমেট বদলালে পুরনো হিসাব কী হয়? (What happens when a roommate leaves?)',
      a: 'পুরনো এন্ট্রি ও রিপোর্ট থেকে যায়, তাই কে কোন মাসে কত দিয়েছিল পরেও দেখা যায় '
        + 'এবং বিদায়ের সময় হিসাব মেটানো সহজ হয়।',
    },
    {
      q: 'কতজন রুমমেট যোগ করা যায়? (How many roommates can we add?)',
      a: 'দুইজনের সাবলেট থেকে শুরু করে বড় মেস — সদস্য সংখ্যার জন্য আলাদা কোনো পেইড '
        + 'প্ল্যান কিনতে হয় না।',
    },
    {
      q: 'সবাই কি সব খরচ দেখতে পায়? (Is everything visible to everyone?)',
      a: 'হ্যাঁ। প্রতিটি এন্ট্রি ও তার একটিভিটি লগ গ্রুপের সবাই দেখতে পান, তাই হিসাব '
        + 'নিয়ে সন্দেহের জায়গা থাকে না।',
    },
  ],

  related: ['/meal-manager', '/tenant-manager', '/to-let'],
};

/* ─────────────────────── বাড়ি / হাউস ম্যানেজার ─────────────────────────── */

const houseManager = {
  slug: '/house-manager',
  cta: { to: '/host-dashboard?tab=properties', bn: 'বাড়ি ম্যানেজ করুন', en: 'Manage your property' },
  serviceType: 'Property and building management',
  eyebrow: { bn: 'বাড়িওয়ালাদের জন্য', en: 'For landlords' },

  title: 'হাউস ম্যানেজার — বাড়ি, ফ্ল্যাট ও ইউনিট ম্যানেজমেন্ট অ্যাপ',
  description:
    'বিল্ডিং, ফ্ল্যাট, রুম ও সিট এক জায়গায় সাজান — কোনটা খালি, কোনটা ভাড়া, কার চুক্তি '
    + 'কবে শেষ। খালি ইউনিট এক ট্যাপে টু-লেট বিজ্ঞাপন হিসেবে প্রকাশ করুন, চুক্তিপত্র ও '
    + 'কাগজপত্র ডিজিটাল ভল্টে রাখুন। A house and building management app for '
    + 'Bangladeshi landlords — units, vacancies, documents and alerts.',
  keywords: toKeywordString([...MANAGEMENT_KEYWORDS, ...RENT_LEDGER_KEYWORDS.slice(0, 10)]),

  h1: {
    bn: 'হাউস ম্যানেজার — পুরো বাড়ি এক অ্যাপে',
    en: 'House Manager — your whole building in one app',
  },
  intro: {
    bn: 'এক-দুইটা ফ্ল্যাট পর্যন্ত মাথায় রাখা যায়। এরপর শুরু হয় আসল ঝামেলা — কোন ফ্ল্যাট '
      + 'এই মাসে খালি হচ্ছে, কার চুক্তির মেয়াদ শেষ, তিনতলার ভাড়াটিয়ার এনআইডির ফটোকপি '
      + 'কোথায় রাখা হয়েছিল, গত বছর কার কাছে অ্যাডভান্স কত ছিল। TO-LET PRO এর হাউস '
      + 'ম্যানেজারে বিল্ডিং, ইউনিট, ভাড়াটিয়া ও কাগজপত্র একসাথে থাকে — আর খালি ইউনিট '
      + 'সরাসরি টু-লেট বিজ্ঞাপন হিসেবে প্রকাশ করা যায়, নতুন করে কিছু টাইপ না করেই।',
    en: 'You can hold one or two flats in your head. After that the real work starts: '
      + 'which flat falls vacant this month, whose lease is expiring, where the third-'
      + 'floor tenant’s NID copy went, how much advance was held last year and by whom. '
      + 'House Manager keeps buildings, units, tenants and documents together — and a '
      + 'vacant unit can be published as a to-let listing without re-typing anything.',
  },

  features: [
    {
      icon: 'building',
      bn: { t: 'বিল্ডিং ও ইউনিট সেটআপ', d: 'ফ্লোর, ফ্ল্যাট, রুম বা সিট — যেভাবে আপনার বাড়ি সাজানো, সেভাবেই।' },
      en: { t: 'Buildings & units', d: 'Floors, flats, rooms or seats — modelled the way your property works.' },
    },
    {
      icon: 'door',
      bn: { t: 'খালি ইউনিট ট্র্যাকিং', d: 'কোনটা খালি, কোনটা ভাড়া — এক নজরে, খালি হলে অ্যালার্টসহ।' },
      en: { t: 'Vacancy tracking', d: 'Occupied vs vacant at a glance, with alerts when one frees up.' },
    },
    {
      icon: 'megaphone',
      bn: { t: 'এক ট্যাপে টু-লেট বিজ্ঞাপন', d: 'খালি ইউনিট সরাসরি প্রকাশ করুন — সারা দেশের ভাড়াটিয়া দেখবে।' },
      en: { t: 'Publish a to-let ad', d: 'Turn a vacant unit into a public listing in one step.' },
    },
    {
      icon: 'file',
      bn: { t: 'ডকুমেন্ট ভল্ট', d: 'চুক্তিপত্র, ভাড়াটিয়ার এনআইডি, পেমেন্ট রেকর্ড ও লিগ্যাল কাগজ এক জায়গায়।' },
      en: { t: 'Document vault', d: 'Agreements, tenant IDs, payment records and legal papers in one place.' },
    },
    {
      icon: 'bell',
      bn: { t: 'স্মার্ট অ্যালার্ট', d: 'চুক্তির মেয়াদ, বকেয়া ভাড়া ও খালি ইউনিটের আগাম সতর্কতা।' },
      en: { t: 'Smart alerts', d: 'Lease expiry, overdue rent and vacancies, before they cost you.' },
    },
    {
      icon: 'chart',
      bn: { t: 'রিপোর্ট ও অ্যানালিটিক্স', d: 'মাসিক আয়, বকেয়া ও ইউনিটভিত্তিক পারফরম্যান্স।' },
      en: { t: 'Reports & analytics', d: 'Monthly income, dues and per-unit performance.' },
    },
  ],

  sections: [
    {
      h2: { bn: 'খালি থাকা মাসটাই আসল ক্ষতি', en: 'The empty month is the real loss' },
      paragraphs: [
        {
          bn: 'ভাড়াটিয়া চলে যাওয়ার পর ফ্ল্যাট এক মাস খালি থাকা মানে ওই বছরের আয় থেকে '
            + 'পুরো এক মাসের ভাড়া মুছে যাওয়া। অথচ বেশিরভাগ ক্ষেত্রে বাড়িওয়ালা জানেন '
            + 'ভাড়াটিয়া এক মাস আগেই — শুধু বিজ্ঞাপন দেওয়াটা পিছিয়ে যায়, কারণ ছবি তোলা, '
            + 'বিবরণ লেখা আর কোথাও পোস্ট করা একটা আলাদা কাজ।',
          en: 'A flat sitting empty for a month erases a full month of rent from that '
            + 'year’s income. In most cases the landlord knew a month in advance — what '
            + 'slipped was the advertising, because photographing, describing and posting '
            + 'it somewhere is a separate chore that keeps getting postponed.',
        },
        {
          bn: 'এখানে ইউনিটের তথ্য আগে থেকেই সাজানো থাকে, তাই খালি হওয়ার নোটিশ পাওয়ার '
            + 'সাথে সাথেই সেটিকে টু-লেট বিজ্ঞাপন হিসেবে প্রকাশ করা যায়। ভাড়াটিয়া বের '
            + 'হওয়ার আগেই নতুন ভাড়াটিয়া খোঁজা শুরু হয়ে যায় — এক মাসের ফাঁকটাই তখন '
            + 'কয়েক দিনে নেমে আসে।',
          en: 'Here the unit’s details already exist, so the moment notice is given it '
            + 'can be published as a to-let ad. The search for the next tenant starts '
            + 'before the current one leaves, and the month-long gap becomes a few days.',
        },
      ],
    },
    {
      h2: { bn: 'কাগজপত্র হারানোর সমস্যা', en: 'The paperwork problem' },
      paragraphs: [
        {
          bn: 'ভাড়ার চুক্তিপত্র, ভাড়াটিয়ার এনআইডির কপি, অ্যাডভান্সের রশিদ, থানায় জমা '
            + 'দেওয়া তথ্য ফরম — প্রতিটা কাগজ কোনো না কোনো সময় দরকার হয়, আর দরকারের '
            + 'দিনেই সেটা খুঁজে পাওয়া যায় না। ফাইলে থাকলে ভেজা-ছেঁড়া, ফোনে থাকলে ছবির '
            + 'ভিড়ে হারানো।',
          en: 'The lease, the tenant’s NID copy, the advance receipt, the information '
            + 'form for the police station — every one of them is needed at some point, '
            + 'and never findable on the day it is needed. In a file they get torn or '
            + 'damp; on a phone they are lost among thousands of photos.',
        },
        {
          bn: 'ডকুমেন্ট ভল্টে প্রতিটি কাগজ তার ভাড়াটিয়া ও ইউনিটের সাথে যুক্ত থাকে — '
            + 'চুক্তিপত্র, আইডি, পেমেন্ট রেকর্ড ও লিগ্যাল কাগজ আলাদা ভাগে। কোন ফ্ল্যাটের '
            + 'কোন ভাড়াটিয়ার কাগজ, সেটা খুঁজতে হয় না, একসাথেই থাকে। এগুলো শুধু আপনি '
            + 'দেখতে পান।',
          en: 'In the document vault each paper is attached to its tenant and its unit — '
            + 'agreements, IDs, payment records and legal documents kept apart. You never '
            + 'have to work out which tenant of which flat a document belongs to. Only you '
            + 'can see them.',
        },
      ],
    },
    {
      h2: { bn: 'ছোট বাড়িওয়ালাদের জন্যও', en: 'Built for small landlords too' },
      paragraphs: [
        {
          bn: 'বাংলাদেশে বেশিরভাগ বাড়িওয়ালা বড় ডেভেলপার নন — একটা বাড়ি, ছয়-আটটা '
            + 'ফ্ল্যাট, হয়তো নিজেই একতলায় থাকেন। অথচ প্রপার্টি ম্যানেজমেন্ট সফটওয়্যারগুলো '
            + 'তৈরি হয় বড় কোম্পানির কথা ভেবে, যেখানে সেটআপ করতেই কয়েক দিন লেগে যায়।',
          en: 'Most landlords in Bangladesh are not developers — one building, six or '
            + 'eight flats, often living on the ground floor themselves. Property '
            + 'management software is usually built for large companies, where setup '
            + 'alone takes days.',
        },
        {
          bn: 'এখানে সেটআপ মানে বাড়ির নাম, কয়টা ফ্লোর আর কয়টা ইউনিট — ব্যস। মেস বা সিট '
            + 'ভাড়ার বাড়িও একইভাবে সাজানো যায়, যেখানে একটা রুমে চারটা সিট আলাদা করে '
            + 'ভাড়া হয়। যত ছোট বা যত অগোছালো কাঠামোই হোক, সেটাকে যেমন আছে তেমনভাবেই '
            + 'তোলা যায়।',
          en: 'Here setup means the building’s name, how many floors, how many units. '
            + 'Mess and seat-rental buildings model the same way, where one room holds '
            + 'four separately rented seats. However small or irregular the arrangement, '
            + 'it goes in as it actually is.',
        },
      ],
    },
    allInOne({
      bn: 'বাড়িওয়ালাদের সফটওয়্যারগুলো ভাড়া তোলা পর্যন্তই — নতুন ভাড়াটিয়া খুঁজতে হলে '
        + 'আবার আলাদা টু-লেট সাইটে বিজ্ঞাপন দিতে হয়, আর ভাড়াটিয়ার নিজের কোনো কাজে '
        + 'সেগুলো আসে না।',
      en: 'Landlord software stops at collecting the rent — to find the next tenant you '
        + 'are advertising on a separate to-let site again, and none of it is of any use '
        + 'to the tenant themselves.',
    }),
  ],

  pricing: PRICING_FREE_TOOLS,

  steps: [
    { bn: 'বাড়িওয়ালা হিসেবে অ্যাকাউন্ট খুলুন', en: 'Sign up as a landlord' },
    { bn: 'বিল্ডিং ও ইউনিট যোগ করুন', en: 'Add your buildings and units' },
    { bn: 'ভাড়াটিয়া যুক্ত করুন বা খালি ইউনিট প্রকাশ করুন', en: 'Add tenants, or publish the vacant ones' },
    { bn: 'কাগজ ও অ্যালার্ট এক ড্যাশবোর্ড থেকে চালান', en: 'Run documents and alerts from one dashboard' },
  ],

  faq: [
    {
      q: 'বিজ্ঞাপন দিতে কি টাকা লাগে? (Does listing a property cost money?)',
      a: 'একটি অ্যাক্টিভ বিজ্ঞাপন ৫টি ছবিসহ সম্পূর্ণ ফ্রি। একাধিক বিজ্ঞাপন, বেশি ছবি, '
        + 'ভিডিও, সার্চ বুস্ট বা ভাড়া কালেকশনের মতো ফিচার Plus ও Pro প্ল্যানে আছে — '
        + 'পুরো তালিকা সাবস্ক্রিপশন পাতায় দেখা যায়।',
    },
    {
      q: 'কয়টা বাড়ি বা ফ্ল্যাট যোগ করা যায়? (How many properties can I add?)',
      a: 'একাধিক বিল্ডিং এবং প্রতিটিতে একাধিক ফ্ল্যাট, রুম বা সিট যোগ করা যায়। মেস ও '
        + 'সিট ভাড়ার বাড়িও একইভাবে সাজানো যায়। একসাথে কতগুলো পাবলিক বিজ্ঞাপন চালু '
        + 'রাখা যাবে সেটা আপনার প্ল্যানের উপর নির্ভর করে।',
    },
    {
      q: 'ভাড়াটিয়ার কাগজপত্র কি নিরাপদ? (Are tenant documents secure?)',
      a: 'ডকুমেন্ট আপনার অ্যাকাউন্টের সাথে যুক্ত থাকে এবং শুধু আপনি দেখতে পান। কী কী '
        + 'তথ্য রাখা হয় ও মুছে ফেলার নিয়ম প্রাইভেসি পলিসিতে বিস্তারিত আছে।',
    },
    {
      q: 'মেস বা সিট ভাড়ার বাড়িও কি ম্যানেজ করা যায়? (Can I manage a seat-rental building?)',
      a: 'যায়। ইউনিট হিসেবে ফ্ল্যাট, রুম বা একক সিট — তিনটাই সাজানো যায়, তাই একটি '
        + 'রুমের চারটি সিট আলাদা ভাড়াটিয়ার নামে রাখা সম্ভব।',
    },
    {
      q: 'ভাড়ার হিসাব আলাদা করে রাখতে হবে? (Do I still need a separate rent ledger?)',
      a: 'না। ভাড়া আদায়, রশিদ ও বকেয়ার হিসাব ভাড়াটিয়া ম্যানেজমেন্টের ভেতরেই আছে '
        + '(Plus ও Pro প্ল্যানে)। পুরনো ভাড়ার খাতার ছবি তুলে সেখানকার এন্ট্রিও ডিজিটাল '
        + 'করা যায়।',
    },
    {
      q: 'ভাড়াটিয়ারা কি আমার বাড়ির তথ্য দেখতে পান? (Can tenants see my building data?)',
      a: 'না। ভাড়াটিয়া শুধু নিজের ইউনিট, নিজের ভাড়া ও নিজের রশিদ দেখতে পান। বিল্ডিংয়ের '
        + 'সামগ্রিক হিসাব, অন্য ভাড়াটিয়ার তথ্য বা আয়ের রিপোর্ট শুধু আপনার।',
    },
  ],

  related: ['/tenant-manager', '/to-let', '/roommate-wallet'],
};

/* ────────────────────── ভাড়ার খাতা / ভাড়াটিয়া ─────────────────────────── */

const tenantManager = {
  slug: '/tenant-manager',
  // Landlord surface: RequireAuth appends role=landlord so the login screen
  // opens on the landlord side instead of defaulting to tenant.
  cta: { to: '/host-dashboard?tab=rent', bn: 'ভাড়ার খাতা খুলুন', en: 'Open the rent book' },
  serviceType: 'Tenant and rent management',
  eyebrow: { bn: 'ভাড়ার খাতা', en: 'The rent book' },

  title: 'ভাড়ার খাতা — ডিজিটাল ভাড়া কালেকশন ও ভাড়াটিয়া ম্যানেজমেন্ট',
  description:
    'কাগজের ভাড়ার খাতা এবার ফোনে। ভাড়াটিয়ার তালিকা, মাসিক ভাড়া, বকেয়া, ডিজিটাল রশিদ '
    + 'ও রিমাইন্ডার এক জায়গায় — পুরনো খাতার ছবি তুলে এন্ট্রিও ডিজিটাল করা যায়। Digital '
    + 'bhara khata: tenant management and rent collection for landlords in Bangladesh.',
  keywords: toKeywordString([...RENT_LEDGER_KEYWORDS, ...MANAGEMENT_KEYWORDS.slice(0, 8)]),

  h1: {
    bn: 'ভাড়ার খাতা এবার ডিজিটাল',
    en: 'Your rent book, digital',
  },
  intro: {
    bn: 'প্রতিটি বাড়িতে একটা খাতা আছে। কারও লাল মলাটের রেজিস্টার, কারও সাধারণ নোটবুক — '
      + 'কে কোন মাসে ভাড়া দিল, কার কত বাকি, অ্যাডভান্স কত ছিল, সব ওই খাতায়। সমস্যা '
      + 'হলো খাতা ভেজে, ছেঁড়ে, হারায়; আর "আমি তো দিয়েছিলাম" বনাম "না, পাইনি" — এই '
      + 'তর্কে খাতার লেখা ছাড়া প্রমাণ থাকে না। TO-LET PRO তে প্রতিটি ভাড়াটিয়ার নিজস্ব '
      + 'রেকর্ড থাকে: মাসিক ভাড়া, জমা, বকেয়া ও রশিদ — সব ডিজিটাল, সবসময় হাতের কাছে।',
    en: 'Every rented building has a book. A red-covered register for some, an ordinary '
      + 'notebook for others — who paid which month, who is behind, how much advance was '
      + 'held. The trouble is that books get damp, torn and lost, and in an "I paid it" '
      + 'versus "no you didn’t" argument there is no evidence beyond what is written in '
      + 'it. Here every tenant has their own record: monthly rent, payments, dues and '
      + 'receipts, all digital and always to hand.',
  },

  features: [
    {
      icon: 'users',
      bn: { t: 'ভাড়াটিয়ার তালিকা', d: 'কে কোন ইউনিটে, কবে থেকে, ভাড়া কত — সব এক জায়গায়।' },
      en: { t: 'Tenant directory', d: 'Who is in which unit, since when, at what rent.' },
    },
    {
      icon: 'wallet',
      bn: { t: 'ভাড়া কালেকশন', d: 'মাসভিত্তিক আদায় — ক্যাশ, বিকাশ, নগদ বা ব্যাংক, সব রেকর্ড হয়।' },
      en: { t: 'Rent collection', d: 'Month by month, in cash, bKash, Nagad or bank — all recorded.' },
    },
    {
      icon: 'receipt',
      bn: { t: 'ডিজিটাল রশিদ', d: 'টাকা নেওয়ার সাথে সাথে রশিদ তৈরি ও শেয়ার — কাগজের ঝামেলা নেই।' },
      en: { t: 'Digital receipts', d: 'Generate and share a receipt the moment rent is paid.' },
    },
    {
      icon: 'alert',
      bn: { t: 'বকেয়া ট্র্যাকিং', d: 'কার কত বাকি, কত দিন ধরে — আলাদা তালিকায় স্পষ্ট।' },
      en: { t: 'Dues tracking', d: 'Who owes what, and for how long, on its own list.' },
    },
    {
      icon: 'qr',
      bn: { t: 'QR দিয়ে ভাড়াটিয়া যোগ', d: 'একটি লিংক বা QR পাঠালেই ভাড়াটিয়া নিজে যুক্ত হয়ে যান।' },
      en: { t: 'Add tenants by QR', d: 'Share a link or QR and the tenant onboards themselves.' },
    },
    {
      icon: 'scan',
      bn: { t: 'পুরনো খাতা স্ক্যান', d: 'খাতার পাতার ছবি তুললে এন্ট্রিগুলো ডিজিটাল হয়ে যায়।' },
      en: { t: 'Scan your old rent book', d: 'Photograph a ledger page and lift the entries in.' },
    },
  ],

  sections: [
    {
      h2: { bn: 'পুরনো খাতা ফেলে দিতে হবে না', en: 'You do not have to abandon the old book' },
      paragraphs: [
        {
          bn: 'ডিজিটাল করতে গিয়ে সবচেয়ে বড় বাধা হলো শুরুর কাজটা — বছরের পর বছরের '
            + 'হিসাব নতুন করে টাইপ করা কার্যত অসম্ভব, তাই বেশিরভাগ বাড়িওয়ালা চেষ্টাই '
            + 'করেন না। এই কারণেই এখানে ভাড়ার খাতার পাতার ছবি তুললেই অ্যাপ এন্ট্রিগুলো '
            + 'পড়ে ডিজিটাল রেকর্ডে যোগ করার প্রস্তাব দেয়।',
          en: 'The real barrier to going digital is the beginning — retyping years of '
            + 'entries is effectively impossible, so most landlords never start. That is '
            + 'why photographing a page of the rent book here produces a proposed set of '
            + 'digital entries instead.',
        },
        {
          bn: 'প্রস্তাবগুলো আপনি দেখে, ঠিক করে, তারপর সেভ করেন — অ্যাপ নিজে থেকে কিছু '
            + 'বসিয়ে দেয় না। ফলে পুরনো হিসাব হারায় না, আর নতুন করে সব লিখতেও হয় না।',
          en: 'You review and correct those before saving — nothing is written on your '
            + 'behalf. The old record survives without anyone retyping it.',
        },
      ],
    },
    {
      h2: { bn: 'ভাড়াটিয়াও নিজের হিসাব দেখতে পান', en: 'The tenant sees the same record' },
      paragraphs: [
        {
          bn: 'কাগজের খাতার আরেকটা দুর্বলতা হলো সেটা একতরফা — হিসাব শুধু বাড়িওয়ালার '
            + 'কাছে থাকে, ভাড়াটিয়ার কাছে বড়জোর কিছু রশিদ। বিরোধ হলে দুই পক্ষের কাছে '
            + 'দুই রকম তথ্য থাকে, আর সেটাই তিক্ততার শুরু।',
          en: 'A paper book is one-sided: the record sits with the landlord, while the '
            + 'tenant holds a few receipts at best. When there is a dispute the two sides '
            + 'hold different versions of the truth, and that is where the bitterness '
            + 'begins.',
        },
        {
          bn: 'QR বা লিংকে যুক্ত হলে ভাড়াটিয়া নিজের ভাড়া, জমা, বকেয়া ও রশিদ নিজেই '
            + 'দেখতে পান। বাড়িওয়ালাকে বারবার মনে করিয়ে দিতে হয় না, আর ভাড়াটিয়াকেও '
            + 'জিজ্ঞেস করতে হয় না — একই সংখ্যা দুজনেই দেখছেন।',
          en: 'Once a tenant joins by QR or link they can see their own rent, payments, '
            + 'dues and receipts. The landlord stops having to remind, the tenant stops '
            + 'having to ask — both are looking at the same numbers.',
        },
      ],
    },
    {
      h2: { bn: 'বকেয়া জমতে দেওয়ার আগেই', en: 'Before the arrears pile up' },
      paragraphs: [
        {
          bn: 'ভাড়া বকেয়া সাধারণত একবারে বড় হয় না — এক মাস দেরি, পরের মাসে অর্ধেক, '
            + 'তারপর হঠাৎ তিন মাসের হিসাব জমে যায়। ততদিনে টাকাটা এত বড় হয়ে যায় যে '
            + 'ভাড়াটিয়ার পক্ষে একসাথে শোধ করা কঠিন, আর সম্পর্কও নষ্ট হয়।',
          en: 'Arrears rarely arrive all at once — one month late, half the next, and '
            + 'then suddenly three months have accumulated. By then the amount is too '
            + 'large for the tenant to clear in one go, and the relationship has soured '
            + 'along the way.',
        },
        {
          bn: 'বকেয়ার আলাদা তালিকা আর রিমাইন্ডার থাকায় দেরিটা প্রথম মাসেই চোখে পড়ে। '
            + 'ছোট অবস্থায় একটা মনে করিয়ে দেওয়া বার্তা যথেষ্ট — উচ্ছেদ বা তর্ক পর্যন্ত '
            + 'যেতে হয় না।',
          en: 'A separate dues list and reminders make the first late month visible while '
            + 'it is still small, when a polite nudge is enough — long before anyone is '
            + 'talking about eviction.',
        },
      ],
    },
    allInOne({
      bn: 'ভাড়ার খাতার অ্যাপগুলো শুধু বাড়িওয়ালার দিকটা দেখে; ভাড়াটিয়ার মেসের হিসাব, '
        + 'বিল ভাগাভাগি বা পরের বাসা খোঁজা — এসবের কিছুই সেখানে নেই। অথচ ভাড়াটিয়া খুশি '
        + 'থাকলে আর হিসাব পরিষ্কার থাকলে বাড়িওয়ালারও কাজ কমে।',
      en: 'Rent-ledger apps only look at the landlord’s side; the tenant’s mess accounts, '
        + 'their shared bills, their search for the next place — none of that exists '
        + 'there. Yet a tenant with clear accounts is less work for the landlord too.',
    }),
  ],

  pricing: PRICING_FREE_TOOLS,

  steps: [
    { bn: 'বাড়িওয়ালা অ্যাকাউন্ট খুলে ইউনিট যোগ করুন', en: 'Sign up as a landlord and add your units' },
    { bn: 'ভাড়াটিয়াকে QR বা লিংক পাঠিয়ে যুক্ত করুন', en: 'Invite tenants with a QR or link' },
    { bn: 'প্রতি মাসে ভাড়া তুলে রশিদ শেয়ার করুন', en: 'Record rent each month and share receipts' },
    { bn: 'বকেয়া ও রিমাইন্ডার ড্যাশবোর্ড থেকে দেখুন', en: 'Watch dues and reminders from the dashboard' },
  ],

  faq: [
    {
      q: 'ভাড়া কালেকশন কি ফ্রি? (Is rent collection free?)',
      a: 'না — ভাড়া কালেকশন ও বুকিং পাইপলাইন Plus ও Pro প্ল্যানের ফিচার। ফ্রি '
        + 'অ্যাকাউন্টে একটি টু-লেট বিজ্ঞাপন (৫টি ছবিসহ) দেওয়া যায়, আর মিল ম্যানেজার ও '
        + 'রুমমেট ওয়ালেট সবার জন্যই সম্পূর্ণ ফ্রি। কোন প্ল্যানে কী আছে তার পুরো তালিকা '
        + 'সাবস্ক্রিপশন পাতায় দেওয়া আছে।',
    },
    {
      q: 'ভাড়াটিয়ার কি আলাদা অ্যাপ লাগবে? (Does the tenant need a different app?)',
      a: 'না, ভাড়াটিয়া একই TO-LET PRO অ্যাপ ব্যবহার করেন। QR বা লিংকে যুক্ত হলে তিনি '
        + 'নিজের ভাড়া, রশিদ ও বকেয়া নিজেই দেখতে পান।',
    },
    {
      q: 'অ্যাপ কি ভাড়ার টাকা নেয়? (Does the app collect the money?)',
      a: 'না। টাকা আগের মতোই ক্যাশ, বিকাশ, নগদ বা ব্যাংকে সরাসরি আপনার কাছে আসে; '
        + 'অ্যাপ শুধু কে কত দিল তার রেকর্ড ও রশিদ রাখে।',
    },
    {
      q: 'পুরনো খাতার হিসাব যোগ করা যাবে? (Can I import my old rent book?)',
      a: 'যাবে। ভাড়ার খাতার পাতার ছবি তুলে দিলে অ্যাপ এন্ট্রিগুলো পড়ে যোগ করার প্রস্তাব '
        + 'দেয় — আপনি দেখে নিশ্চিত করলেই সেভ হয়।',
    },
    {
      q: 'রিমাইন্ডার কি ভাড়াটিয়া পান? (Do tenants get reminders?)',
      a: 'হ্যাঁ, ভাড়ার তারিখ ও বকেয়ার নোটিফিকেশন ভাড়াটিয়ার কাছে যায়, আর আপনি '
        + 'ড্যাশবোর্ডে দেখতে পান কে এখনো দেননি।',
    },
    {
      q: 'একাধিক বাড়ির ভাড়া একসাথে দেখা যায়? (Can I see several buildings at once?)',
      a: 'যায়। প্রতিটি বিল্ডিং আলাদা করে সাজানো থাকে, আর ড্যাশবোর্ডে সব মিলিয়ে মাসিক '
        + 'আদায় ও মোট বকেয়া দেখা যায়।',
    },
    {
      q: 'রশিদ কি ভাড়াটিয়াকে পাঠানো যায়? (Can I send the receipt to the tenant?)',
      a: 'যায়। ভাড়া তোলার সাথে সাথেই ডিজিটাল রশিদ তৈরি হয় এবং সেটি শেয়ার করা যায়, '
        + 'পাশাপাশি ভাড়াটিয়ার নিজের রেকর্ডেও জমা থাকে।',
    },
  ],

  related: ['/house-manager', '/roommate-wallet', '/to-let'],
};

/* ─────────────────────────── হোম সার্ভিস ────────────────────────────────── */

const homeServices = {
  slug: '/home-services',
  // Public route — no auth gate, so this opens straight away.
  cta: { to: '/services', bn: 'সার্ভিস দেখুন', en: 'Browse services' },
  serviceType: 'Home services marketplace',
  eyebrow: { bn: 'বাসার সার্ভিস', en: 'Home services' },

  title: 'হোম সার্ভিস — বাসা শিফটিং, ক্লিনিং, ইন্টারনেট ও মেরামত',
  description:
    'নতুন বাসায় ওঠার পর যা যা লাগে — শিফটিং, ক্লিনিং, ইলেকট্রিশিয়ান, প্লাম্বার, '
    + 'ইন্টারনেট, গ্যাস, পানি, সিসিটিভি, লন্ড্রি, টিউটর ও রান্নার লোক — এক জায়গা থেকে '
    + 'অনুরোধ করুন। Home services for renters in Bangladesh: movers, cleaning, repairs, '
    + 'internet and more.',
  keywords: toKeywordString([...SERVICE_KEYWORDS, ...RENT_KEYWORDS.slice(0, 6)]),

  h1: {
    bn: 'হোম সার্ভিস — বাসার সব দরকার এক জায়গায়',
    en: 'Home services for your new place',
  },
  intro: {
    bn: 'বাসা পাওয়ার পরের কাজগুলোই আসল ঝামেলা — মালপত্র শিফট করা, ঘর পরিষ্কার করানো, '
      + 'ইন্টারনেটের লাইন টানা, গ্যাস-পানির সমস্যা, আর এমন একজন ইলেকট্রিশিয়ান খোঁজা '
      + 'যিনি আসলেই সময়মতো আসেন। TO-LET PRO এর সার্ভিস হাব থেকে যেকোনো সার্ভিসের '
      + 'অনুরোধ পাঠান, আমরা ভেরিফাইড প্রোভাইডারের সাথে যুক্ত করে দিই।',
    en: 'Finding the flat is only half of it — then comes shifting, cleaning, getting '
      + 'the internet line in, sorting the gas and water, and finding an electrician who '
      + 'actually turns up. Request any of it from the services hub and we connect you '
      + 'with a verified provider.',
  },

  features: [
    { icon: 'truck', bn: { t: 'শিফটিং ও মুভার্স', d: 'প্যাকিং থেকে নতুন বাসায় পৌঁছানো।' }, en: { t: 'Movers & shifting', d: 'Packing through to the new address.' } },
    { icon: 'sparkles', bn: { t: 'ক্লিনিং', d: 'ডিপ ক্লিন বা নিয়মিত পরিষ্কার।' }, en: { t: 'Cleaning', d: 'Deep clean or a regular schedule.' } },
    { icon: 'wrench', bn: { t: 'মেরামত', d: 'প্লাম্বিং, ইলেকট্রিক ও টুকিটাকি কাজ।' }, en: { t: 'Repairs', d: 'Plumbing, electrical and odd jobs.' } },
    { icon: 'wifi', bn: { t: 'ইন্টারনেট', d: 'ব্রডব্যান্ড ও ওয়াইফাই সংযোগ।' }, en: { t: 'Internet', d: 'Broadband and WiFi connections.' } },
    { icon: 'shield', bn: { t: 'নিরাপত্তা', d: 'সিসিটিভি ও গার্ড সার্ভিস।' }, en: { t: 'Security', d: 'CCTV and guard services.' } },
    { icon: 'utensils', bn: { t: 'রান্না ও টিউটর', d: 'ঘরের রান্নার সহায়তা ও হোম টিউটর।' }, en: { t: 'Cooks & tutors', d: 'Home cooking help and tutors.' } },
  ],

  sections: [
    {
      h2: { bn: 'শিফটিংয়ের দিনটা', en: 'Moving day' },
      paragraphs: [
        {
          bn: 'ঢাকায় বাসা বদলের দিনটা প্রায় সবার জন্যই একরকম — সকালে ট্রাক আসার কথা, '
            + 'আসে দুপুরে; দাম আগে ঠিক হয়েছিল এক, নামানোর সময় দাবি করা হয় আরেক; আর '
            + 'কোনো জিনিস ভাঙলে দায় কারও নয়। পরিচিত কারও রেফারেন্স ছাড়া ভালো মুভার '
            + 'পাওয়া ভাগ্যের ব্যাপার হয়ে দাঁড়ায়।',
          en: 'Moving day in Dhaka goes the same way for almost everyone: the truck was '
            + 'due in the morning and arrives at noon, the price agreed beforehand is not '
            + 'the price demanded at the other end, and nothing broken is anyone’s fault. '
            + 'Without a personal reference, finding a decent mover is luck.',
        },
        {
          bn: 'সার্ভিস হাব থেকে অনুরোধ পাঠালে আমরা প্রোভাইডারের সাথে যোগাযোগ করিয়ে দিই, '
            + 'যাতে কাজটা পরিচিত-অপরিচিতের ভাগ্যের উপর না থেকে যায়।',
          en: 'Sending a request from the services hub puts you in touch with a provider, '
            + 'so the job does not come down to whether you happen to know someone.',
        },
      ],
    },
    {
      h2: { bn: 'এখনো সব এলাকায় সব সার্ভিস নেই', en: 'Not every service is live everywhere yet' },
      paragraphs: [
        {
          bn: 'সৎভাবে বললে, আমরা এখনো প্রতিটি ক্যাটাগরিতে প্রোভাইডার যুক্ত করছি। তাই '
            + 'আপনার এলাকায় এই মুহূর্তে সব সার্ভিস নাও পাওয়া যেতে পারে — অনুরোধ পাঠালে '
            + 'ব্যবস্থা হওয়ামাত্র আমরা জানাই।',
          en: 'To be straight about it: we are still onboarding providers in every '
            + 'category, so not all of them are available in every area yet. Send a '
            + 'request and we will come back to you as soon as it is covered.',
        },
        {
          bn: 'কোন এলাকায় কোন সার্ভিসের চাহিদা বেশি, সেটাই ঠিক করে দেয় আমরা কোথায় আগে '
            + 'প্রোভাইডার যুক্ত করব — তাই অনুরোধ পাঠানোটাই সবচেয়ে কাজের।',
          en: 'Which requests come from which areas is what decides where we onboard '
            + 'providers next, so sending one is the most useful thing you can do.',
        },
      ],
    },
    allInOne({
      bn: 'বাসা খোঁজার সাইটগুলো চাবি হাতে পাওয়ার পরেই কাজ শেষ মনে করে, অথচ ভাড়াটিয়ার '
        + 'আসল খরচ ও ঝামেলা শুরু হয় তার পরের দিন থেকে — শিফটিং, বিল, মিল, মেরামত।',
      en: 'Listing sites consider the job done the moment the keys change hands, when in '
        + 'fact a renter’s real costs and headaches start the next day — the shifting, '
        + 'the bills, the meals, the repairs.',
    }),
  ],

  pricing: PRICING_FREE_TOOLS,

  steps: [
    { bn: 'সার্ভিস হাব খুলুন', en: 'Open the services hub' },
    { bn: 'যে সার্ভিসটি দরকার সেটি বেছে নিন', en: 'Pick the service you need' },
    { bn: 'অনুরোধ পাঠান', en: 'Send the request' },
    { bn: 'আমরা প্রোভাইডারের সাথে যোগাযোগ করিয়ে দিই', en: 'We connect you with a provider' },
  ],

  faq: [
    {
      q: 'সব এলাকায় কি সার্ভিস পাওয়া যায়? (Are services available everywhere?)',
      a: 'আমরা এখনো প্রতিটি ক্যাটাগরিতে প্রোভাইডার যুক্ত করছি, তাই সব এলাকায় সব সার্ভিস '
        + 'এখনই নাও থাকতে পারে। অনুরোধ পাঠালে আপনার এলাকায় ব্যবস্থা হওয়ামাত্র জানাব।',
    },
    {
      q: 'সার্ভিস অনুরোধ করতে কি টাকা লাগে? (Is requesting a service free?)',
      a: 'অনুরোধ পাঠানো ফ্রি। সার্ভিসের খরচ প্রোভাইডারের সাথে সরাসরি ঠিক হয়।',
    },
    {
      q: 'তালিকায় নেই এমন কিছু দরকার হলে? (What if I need something not on the list?)',
      a: 'কাস্টম অনুরোধ পাঠানো যায় — কী দরকার লিখে দিলে সাপোর্ট টিম দেখে ব্যবস্থা করে।',
    },
    {
      q: 'বাড়িওয়ালারাও কি সার্ভিস নিতে পারেন? (Can landlords use this too?)',
      a: 'পারেন। ভাড়াটিয়া বের হওয়ার পর ফ্ল্যাট পরিষ্কার, রঙ বা মেরামতের কাজেও একইভাবে '
        + 'অনুরোধ পাঠানো যায়।',
    },
  ],

  related: ['/to-let', '/house-manager', '/meal-manager'],
};

/* ────────────────────────────── exports ─────────────────────────────────── */

export const FEATURE_PAGES = [
  mealManager, roommateWallet, tenantManager, houseManager, homeServices,
];

export const FEATURE_PAGE_BY_SLUG = Object.fromEntries(
  FEATURE_PAGES.map((p) => [p.slug, p]),
);

/** '/meal-manager' → page, and also 'meal-manager' → page. */
export const featurePageFor = (slug) => {
  const key = String(slug || '');
  return FEATURE_PAGE_BY_SLUG[key] || FEATURE_PAGE_BY_SLUG[`/${key}`] || null;
};
