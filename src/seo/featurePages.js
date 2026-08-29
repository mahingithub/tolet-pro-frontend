/**
 * featurePages.js — content for the standalone landing pages.
 * ─────────────────────────────────────────────────────────────────────────────
 * Half of what TO-LET PRO does has nothing to do with searching for a house:
 * the meal manager, the roommate wallet, rent collection, tenant records. Those
 * features live behind a login, which means a crawler has never seen a single
 * word about them — so "মিল ম্যানেজার অ্যাপ" or "roommate expense split
 * bangladesh" could never find this app, no matter how good the feature is.
 *
 * Each entry below becomes a public, indexable page that explains one feature
 * to a signed-out visitor: what it does, how it works, what it costs, with an
 * FAQ block that answers the question they actually typed.
 *
 * ⚠️  EVERY CLAIM HERE MUST BE TRUE. The copy was written against the real
 * screens — Living.jsx's tabs (expenses / meals / bills / balances / report /
 * reminders), the host dashboard's tenant + rent + receipt + document tabs, and
 * ServicesPage's request flow, which is still onboarding providers and is
 * described that way. If a feature changes, change the copy with it.
 *
 * Icons are STRING keys, not imports, so `scripts/generate-sitemap.mjs` can
 * read this file in Node without pulling in React or lucide.
 */

import {
  MEAL_KEYWORDS, WALLET_KEYWORDS, MANAGEMENT_KEYWORDS, SERVICE_KEYWORDS,
  RENT_KEYWORDS, toKeywordString,
} from './keywords.js';

/* ─────────────────────────── মিল ম্যানেজার ──────────────────────────────── */

const mealManager = {
  slug: '/meal-manager',
  serviceType: 'Meal and mess management',
  eyebrow: { bn: 'মেস ও ব্যাচেলর লাইফ', en: 'For mess & bachelor life' },

  title: 'মিল ম্যানেজার — Meal Manager & Mess Hisab App (Free)',
  description:
    'মেসের মিল, বাজার খরচ আর মিল রেট আর খাতায় নয় — TO-LET PRO এর ফ্রি মিল ম্যানেজারে '
    + 'প্রতিদিনের মিল তুলুন, বাজারের খরচ যোগ করুন, মাস শেষে মিল রেট ও কে কত পাবে অ্যাপ '
    + 'নিজেই হিসাব করে দেবে। Free meal manager and mess accounting app for Bangladeshi '
    + 'messes, hostels and bachelor flats — in Bangla and English.',
  keywords: toKeywordString([...MEAL_KEYWORDS, ...WALLET_KEYWORDS.slice(0, 6)]),

  h1: { bn: 'মিল ম্যানেজার — মেসের হিসাব আর খাতায় নয়', en: 'Meal Manager for messes & bachelor flats' },
  intro: {
    bn: 'প্রতি মাসের শেষে মিল রেট বের করতে গিয়ে ঝগড়া, খাতা হারানো, কে কয়টা মিল খেয়েছে '
      + 'মনে না থাকা — মেসে থাকলে এটাই সবচেয়ে বড় ঝামেলা। TO-LET PRO এর মিল ম্যানেজারে '
      + 'প্রতিদিনের মিল আর বাজারের খরচ শুধু তুলে রাখুন; মিল রেট, প্রত্যেকের মোট খরচ আর '
      + 'কে কত পাবে বা দেবে — পুরো হিসাব অ্যাপ নিজেই করে দেয়।',
    en: 'Counting meals on a wall chart and arguing about the meal rate on the last '
      + 'day of the month is the oldest problem in mess life. Log meals and bazar '
      + 'costs as they happen and TO-LET PRO works out the meal rate, each member’s '
      + 'total and who owes whom — automatically.',
  },

  features: [
    {
      icon: 'utensils',
      bn: { t: 'দৈনিক মিল এন্ট্রি', d: 'সকাল, দুপুর, রাত — প্রতিটি সদস্যের মিল আলাদা করে তোলা যায়, অর্ধেক মিলও।' },
      en: { t: 'Daily meal entry', d: 'Breakfast, lunch and dinner per member, half-meals included.' },
    },
    {
      icon: 'basket',
      bn: { t: 'বাজার খরচ', d: 'কে বাজার করল, কত টাকার — যোগ করলেই মোট খরচে যুক্ত হয়ে যায়।' },
      en: { t: 'Bazar expenses', d: 'Who shopped and for how much, added straight into the month’s total.' },
    },
    {
      icon: 'calculator',
      bn: { t: 'অটো মিল রেট', d: 'মোট বাজার ÷ মোট মিল = মিল রেট, প্রতিবার নিজে হিসাব করার দরকার নেই।' },
      en: { t: 'Automatic meal rate', d: 'Total bazar ÷ total meals, recalculated on every entry.' },
    },
    {
      icon: 'scale',
      bn: { t: 'কে কত পাবে', d: 'প্রত্যেকের জমা আর খরচ মিলিয়ে ব্যালেন্স — পাওনা ও দেনা আলাদা করে দেখায়।' },
      en: { t: 'Balances', d: 'Deposits against consumption, so each member sees exactly what they owe.' },
    },
    {
      icon: 'chart',
      bn: { t: 'মাসিক রিপোর্ট', d: 'মাস শেষের পুরো হিসাব এক পাতায়, শেয়ার বা সেভ করার মতো।' },
      en: { t: 'Monthly report', d: 'The whole month on one page, ready to share with the group.' },
    },
    {
      icon: 'bell',
      bn: { t: 'রিমাইন্ডার', d: 'বাজারের পালা বা জমা দেওয়ার তারিখ — অ্যাপ মনে করিয়ে দেয়।' },
      en: { t: 'Reminders', d: 'Whose turn it is to shop, and when deposits are due.' },
    },
  ],

  steps: [
    { bn: 'TO-LET PRO তে ফ্রি অ্যাকাউন্ট খুলুন', en: 'Create a free TO-LET PRO account' },
    { bn: 'মেসের সদস্যদের যুক্ত করুন', en: 'Add your mess members' },
    { bn: 'প্রতিদিনের মিল ও বাজার তুলুন', en: 'Log meals and bazar as they happen' },
    { bn: 'মাস শেষে রিপোর্ট দেখুন — হিসাব রেডি', en: 'Open the report at month end — the maths is done' },
  ],

  faq: [
    {
      q: 'মিল ম্যানেজার ব্যবহার করতে কি টাকা লাগে? (Is the meal manager free?)',
      a: 'না, মিল ম্যানেজার সম্পূর্ণ ফ্রি। TO-LET PRO তে অ্যাকাউন্ট খুলেই মেসের মিল, '
        + 'বাজার ও বিলের হিসাব রাখা যায় — কোনো সাবস্ক্রিপশন লাগে না।',
    },
    {
      q: 'মিল রেট কিভাবে হিসাব হয়? (How is the meal rate calculated?)',
      a: 'মাসের মোট বাজার খরচকে মোট মিল সংখ্যা দিয়ে ভাগ করে মিল রেট বের হয়। নতুন খরচ বা '
        + 'মিল যোগ করলেই রেট সাথে সাথে আপডেট হয়ে যায়, তাই মাসের মাঝেও আনুমানিক হিসাব দেখা যায়।',
    },
    {
      q: 'বাড়িওয়ালা ছাড়া শুধু মেসের জন্য ব্যবহার করা যাবে? (Can we use it just for a mess, without a landlord?)',
      a: 'যাবে। মিল ম্যানেজার আর রুমমেট ওয়ালেট বাসা ভাড়ার বিজ্ঞাপন থেকে আলাদা — যেকোনো '
        + 'মেস, হোস্টেল বা শেয়ার করা ফ্ল্যাটের সদস্যরা নিজেরাই গ্রুপ খুলে ব্যবহার করতে পারেন।',
    },
    {
      q: 'হিসাব কি বাংলায় দেখা যায়? (Is it available in Bangla?)',
      a: 'হ্যাঁ। পুরো অ্যাপ বাংলা ও ইংরেজি দুই ভাষায় চলে, টাকার অঙ্ক বাংলা নিয়মে দেখানো হয়।',
    },
  ],

  related: ['/roommate-wallet', '/house-manager', '/to-let'],
};

/* ────────────────────────── রুমমেট ওয়ালেট ──────────────────────────────── */

const roommateWallet = {
  slug: '/roommate-wallet',
  serviceType: 'Shared expense and bill splitting',
  eyebrow: { bn: 'শেয়ার্ড খরচ', en: 'Shared expenses' },

  title: 'রুমমেট ওয়ালেট — Roommate Expense & Bill Split App',
  description:
    'কারেন্ট বিল, গ্যাস, পানি, ওয়াইফাই, বুয়ার বেতন, বাজার — রুমমেটদের সব খরচ এক ওয়ালেটে। '
    + 'সমান, শতাংশ বা কাস্টম ভাগ করুন, কে কত পাবে অ্যাপ হিসাব করে দেবে। Split rent, '
    + 'utility bills and shared costs with roommates in Bangladesh — free, in Bangla and English.',
  keywords: toKeywordString([...WALLET_KEYWORDS, ...MEAL_KEYWORDS.slice(0, 6)]),

  h1: { bn: 'রুমমেট ওয়ালেট — খরচ ভাগাভাগি, ঝগড়া ছাড়াই', en: 'Roommate Wallet — shared expenses, settled' },
  intro: {
    bn: 'কারেন্ট বিল কে দিল, ওয়াইফাইয়ের টাকা কার কাছে বাকি, বুয়ার বেতন এই মাসে কে দেবে — '
      + 'শেয়ার করা বাসায় টাকার হিসাব সবচেয়ে অস্বস্তিকর আলোচনা। রুমমেট ওয়ালেটে প্রতিটি খরচ '
      + 'একবার তুলে রাখলেই কে কত দিয়েছে আর কার কাছে কত পাওনা — সব পরিষ্কার হয়ে যায়।',
    en: 'Who paid the electricity bill, who still owes for WiFi, whose turn is the '
      + 'maid’s salary — money is the most awkward conversation in a shared flat. '
      + 'Log each cost once and the wallet keeps a running, public record of who '
      + 'paid what and who owes whom.',
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

  steps: [
    { bn: 'ফ্রি অ্যাকাউন্ট খুলে গ্রুপ তৈরি করুন', en: 'Create a free account and start a group' },
    { bn: 'রুমমেটদের যুক্ত করুন', en: 'Add your roommates' },
    { bn: 'খরচ হলেই তুলে রাখুন, ভাগের নিয়ম বেছে নিন', en: 'Log a cost, pick how it splits' },
    { bn: 'ব্যালেন্স দেখে হিসাব মিটিয়ে ফেলুন', en: 'Open balances and settle up' },
  ],

  faq: [
    {
      q: 'রুমমেট ওয়ালেট কি ফ্রি? (Is the roommate wallet free?)',
      a: 'হ্যাঁ, খরচ যোগ করা, ভাগ করা ও ব্যালেন্স দেখা সম্পূর্ণ ফ্রি।',
    },
    {
      q: 'অ্যাপের ভেতরে কি টাকা লেনদেন হয়? (Does money move inside the app?)',
      a: 'না। টাকা আপনি বিকাশ, নগদ, ব্যাংক বা ক্যাশে যেভাবে খুশি দেবেন — অ্যাপ শুধু হিসাব '
        + 'রাখে যে কে কাকে কত দিয়েছে এবং কত বাকি আছে।',
    },
    {
      q: 'মিলের হিসাবও কি এখানে রাখা যায়? (Can it handle meal accounts too?)',
      a: 'যায়। একই গ্রুপে মিল ম্যানেজার আছে — মিল, বাজার ও মিল রেট সেখানে, আর বিদ্যুৎ-গ্যাস-'
        + 'ওয়াইফাইয়ের মতো খরচ ওয়ালেটে। দুইটার ব্যালেন্স একসাথেই দেখানো হয়।',
    },
    {
      q: 'রুমমেট বদলালে পুরনো হিসাব কী হয়? (What happens to old balances when a roommate leaves?)',
      a: 'পুরনো এন্ট্রি ও রিপোর্ট থেকে যায়, তাই কে কোন মাসে কত দিয়েছিল পরেও দেখা যায়।',
    },
  ],

  related: ['/meal-manager', '/tenant-manager', '/to-let'],
};

/* ─────────────────────── বাড়ি / হাউস ম্যানেজার ─────────────────────────── */

const houseManager = {
  slug: '/house-manager',
  serviceType: 'Property and building management',
  eyebrow: { bn: 'বাড়িওয়ালাদের জন্য', en: 'For landlords' },

  title: 'হাউস ম্যানেজার — বাড়ি ও ফ্ল্যাট ম্যানেজমেন্ট অ্যাপ',
  description:
    'বিল্ডিং, ফ্ল্যাট ও রুম এক জায়গায় সাজান — কোনটা খালি, কোনটা ভাড়া হয়েছে, কার চুক্তি '
    + 'কবে শেষ। চুক্তিপত্র, NID ও পেমেন্ট রেকর্ড ডিজিটাল ফাইলে, খালি ইউনিটের অ্যালার্টসহ। '
    + 'A house management app for Bangladeshi landlords — buildings, units, documents and alerts.',
  keywords: toKeywordString([...MANAGEMENT_KEYWORDS, ...RENT_KEYWORDS.slice(0, 6)]),

  h1: { bn: 'হাউস ম্যানেজার — পুরো বাড়ি এক অ্যাপে', en: 'House Manager — your whole building in one app' },
  intro: {
    bn: 'একাধিক বাড়ি বা অনেকগুলো ফ্ল্যাট থাকলে খাতায় হিসাব রাখা কঠিন — কোন ফ্ল্যাট খালি, '
      + 'কার চুক্তি শেষ হচ্ছে, কোন কাগজ কোথায়। TO-LET PRO এর হাউস ম্যানেজারে বিল্ডিং, ইউনিট '
      + 'ও ভাড়াটিয়া একসাথে থাকে, আর খালি ইউনিট সরাসরি টু-লেট বিজ্ঞাপন হিসেবে পাবলিশ করা যায়।',
    en: 'Once you have more than a couple of units, a notebook stops working: which '
      + 'flat is vacant, whose lease is ending, where that document went. House '
      + 'Manager keeps buildings, units and tenants together — and a vacant unit '
      + 'can be published as a to-let listing without re-typing anything.',
  },

  features: [
    {
      icon: 'building',
      bn: { t: 'বিল্ডিং ও ইউনিট সেটআপ', d: 'ফ্লোর, ফ্ল্যাট, রুম বা সিট — যেভাবে আপনার বাড়ি সাজানো, সেভাবেই।' },
      en: { t: 'Buildings & units', d: 'Floors, flats, rooms or seats — modelled the way your property works.' },
    },
    {
      icon: 'door',
      bn: { t: 'খালি ইউনিট ট্র্যাকিং', d: 'কোনটা খালি, কোনটা ভাড়া — এক নজরে, আর খালি হলে অ্যালার্ট।' },
      en: { t: 'Vacancy tracking', d: 'Occupied vs vacant at a glance, with alerts when one frees up.' },
    },
    {
      icon: 'megaphone',
      bn: { t: 'এক ট্যাপে টু-লেট বিজ্ঞাপন', d: 'খালি ইউনিট সরাসরি পাবলিশ করুন — সারা দেশের ভাড়াটিয়া দেখবে।' },
      en: { t: 'Publish a to-let ad', d: 'Turn a vacant unit into a public listing in one step.' },
    },
    {
      icon: 'file',
      bn: { t: 'ডকুমেন্ট ভল্ট', d: 'চুক্তিপত্র, ভাড়াটিয়ার NID, পেমেন্ট রেকর্ড ও লিগ্যাল কাগজ এক জায়গায়।' },
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

  steps: [
    { bn: 'বাড়িওয়ালা হিসেবে অ্যাকাউন্ট খুলুন', en: 'Sign up as a landlord' },
    { bn: 'বিল্ডিং ও ইউনিট যোগ করুন', en: 'Add your buildings and units' },
    { bn: 'ভাড়াটিয়া যুক্ত করুন বা খালি ইউনিট পাবলিশ করুন', en: 'Add tenants, or publish the vacant ones' },
    { bn: 'ভাড়া, কাগজ ও অ্যালার্ট এক ড্যাশবোর্ড থেকে চালান', en: 'Run rent, documents and alerts from one dashboard' },
  ],

  faq: [
    {
      q: 'বিজ্ঞাপন দিতে কি টাকা লাগে? (Does listing a property cost money?)',
      a: 'না, টু-লেট বিজ্ঞাপন দেওয়া ফ্রি। বড় বাড়িওয়ালাদের জন্য কিছু অতিরিক্ত ফিচারসহ '
        + 'পেইড প্ল্যান আছে, তবে বিজ্ঞাপন ও বেসিক ম্যানেজমেন্টের জন্য কোনো খরচ নেই।',
    },
    {
      q: 'কয়টা বাড়ি বা ফ্ল্যাট যোগ করা যায়? (How many properties can I add?)',
      a: 'একাধিক বিল্ডিং এবং প্রতিটি বিল্ডিংয়ে একাধিক ফ্ল্যাট, রুম বা সিট যোগ করা যায় — '
        + 'মেস ও সিট ভাড়ার বাড়িও একইভাবে সাজানো যায়।',
    },
    {
      q: 'ভাড়াটিয়ার কাগজপত্র কি নিরাপদ? (Are tenant documents secure?)',
      a: 'ডকুমেন্ট আপনার অ্যাকাউন্টের সাথে যুক্ত থাকে এবং শুধু আপনি দেখতে পান। কী কী তথ্য '
        + 'রাখা হয় ও মুছে ফেলার নিয়ম প্রাইভেসি পলিসিতে বিস্তারিত আছে।',
    },
    {
      q: 'ভাড়ার হিসাব আলাদা করে রাখতে হবে? (Do I still need a separate rent ledger?)',
      a: 'না। ভাড়া আদায়, রশিদ ও বকেয়ার হিসাব ভাড়াটিয়া ম্যানেজমেন্টের ভেতরেই আছে।',
    },
  ],

  related: ['/tenant-manager', '/to-let', '/roommate-wallet'],
};

/* ────────────────────── ভাড়াটিয়া ম্যানেজমেন্ট ──────────────────────────── */

const tenantManager = {
  slug: '/tenant-manager',
  serviceType: 'Tenant and rent management',
  eyebrow: { bn: 'ভাড়া ও ভাড়াটিয়া', en: 'Rent & tenants' },

  title: 'ভাড়াটিয়া ম্যানেজমেন্ট — Tenant & Rent Collection App',
  description:
    'ভাড়াটিয়ার তালিকা, মাসিক ভাড়া আদায়, বকেয়া, ডিজিটাল রশিদ ও রিমাইন্ডার এক অ্যাপে। '
    + 'ভাড়ার খাতা ছবি তুলে ডিজিটাল করুন, ভাড়াটিয়াকে QR দিয়ে যুক্ত করুন। Tenant management '
    + 'and rent collection for landlords in Bangladesh — dues, receipts and reminders.',
  keywords: toKeywordString([
    ...MANAGEMENT_KEYWORDS.slice(6), ...MANAGEMENT_KEYWORDS.slice(0, 6),
  ]),

  h1: { bn: 'ভাড়াটিয়া ম্যানেজমেন্ট ও ভাড়া কালেকশন', en: 'Tenant management & rent collection' },
  intro: {
    bn: 'কে এই মাসের ভাড়া দিয়েছে, কার কত বাকি, কাকে মনে করিয়ে দিতে হবে — ভাড়ার খাতা '
      + 'হারিয়ে গেলে পুরো হিসাবই হারায়। TO-LET PRO তে প্রতিটি ভাড়াটিয়ার নিজস্ব রেকর্ড '
      + 'থাকে: মাসিক ভাড়া, জমা, বকেয়া, রশিদ — সব ডিজিটাল, সবসময় হাতের কাছে।',
    en: 'Who has paid this month, who is behind, who needs a reminder — when the '
      + 'rent book goes missing, the whole record goes with it. Every tenant gets a '
      + 'record here: monthly rent, payments, dues and receipts, all digital.',
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
      bn: { t: 'QR দিয়ে ভাড়াটিয়া যোগ', d: 'একটি লিংক বা QR পাঠালেই ভাড়াটিয়া নিজে যুক্ত হয়ে যায়।' },
      en: { t: 'Add tenants by QR', d: 'Share a link or QR and the tenant onboards themselves.' },
    },
    {
      icon: 'scan',
      bn: { t: 'ভাড়ার খাতা স্ক্যান', d: 'পুরনো খাতার ছবি তুলে দিলে এন্ট্রিগুলো ডিজিটাল হয়ে যায়।' },
      en: { t: 'Scan your rent book', d: 'Photograph an old ledger and lift the entries into the app.' },
    },
  ],

  steps: [
    { bn: 'বাড়িওয়ালা অ্যাকাউন্ট খুলে ইউনিট যোগ করুন', en: 'Sign up as a landlord and add your units' },
    { bn: 'ভাড়াটিয়াকে QR বা লিংক পাঠিয়ে যুক্ত করুন', en: 'Invite tenants with a QR or link' },
    { bn: 'প্রতি মাসে ভাড়া তুলে রশিদ শেয়ার করুন', en: 'Record rent each month and share receipts' },
    { bn: 'বকেয়া ও রিমাইন্ডার ড্যাশবোর্ড থেকে দেখুন', en: 'Watch dues and reminders from the dashboard' },
  ],

  faq: [
    {
      q: 'ভাড়াটিয়ার কি আলাদা অ্যাপ লাগবে? (Does the tenant need their own app?)',
      a: 'ভাড়াটিয়া একই TO-LET PRO অ্যাপ ব্যবহার করেন। QR বা লিংকে ঢুকে যুক্ত হলে তিনি '
        + 'নিজের ভাড়া, রশিদ ও বকেয়া নিজেই দেখতে পান — আপনাকে বারবার জানাতে হয় না।',
    },
    {
      q: 'অ্যাপ কি ভাড়ার টাকা নেয়? (Does the app collect the rent money?)',
      a: 'না। টাকা আগের মতোই ক্যাশ, বিকাশ, নগদ বা ব্যাংকে আপনার কাছে আসে; অ্যাপ শুধু '
        + 'কে কত দিল তার রেকর্ড ও রশিদ রাখে।',
    },
    {
      q: 'পুরনো খাতার হিসাব যোগ করা যাবে? (Can I import my old rent book?)',
      a: 'যাবে। ভাড়ার খাতার পাতার ছবি তুলে দিলে অ্যাপ এন্ট্রিগুলো পড়ে ডিজিটাল রেকর্ডে '
        + 'যোগ করার প্রস্তাব দেয় — আপনি দেখে নিশ্চিত করলেই সেভ হয়।',
    },
    {
      q: 'রিমাইন্ডার কি ভাড়াটিয়া পান? (Do tenants get reminders?)',
      a: 'হ্যাঁ, ভাড়ার তারিখ ও বকেয়ার নোটিফিকেশন ভাড়াটিয়ার কাছে যায়, আর আপনি ড্যাশবোর্ডে '
        + 'দেখতে পান কে এখনো দেয়নি।',
    },
  ],

  related: ['/house-manager', '/roommate-wallet', '/to-let'],
};

/* ─────────────────────────── হোম সার্ভিস ────────────────────────────────── */

const homeServices = {
  slug: '/home-services',
  serviceType: 'Home services marketplace',
  eyebrow: { bn: 'বাসার সার্ভিস', en: 'Home services' },

  title: 'হোম সার্ভিস — বাসা শিফটিং, ক্লিনিং, ইন্টারনেট ও মেরামত',
  description:
    'নতুন বাসায় ওঠার পর যা যা লাগে — শিফটিং, ক্লিনিং, ইলেকট্রিশিয়ান, প্লাম্বার, '
    + 'ইন্টারনেট, গ্যাস, পানি, সিসিটিভি, লন্ড্রি, টিউটর ও রান্নার লোক — এক জায়গা থেকে '
    + 'অনুরোধ করুন। Home services for renters in Bangladesh: movers, cleaning, repairs, '
    + 'internet and more.',
  keywords: toKeywordString([...SERVICE_KEYWORDS, ...RENT_KEYWORDS.slice(0, 5)]),

  h1: { bn: 'হোম সার্ভিস — বাসার সব দরকার এক জায়গায়', en: 'Home services for your new place' },
  intro: {
    bn: 'বাসা পাওয়ার পরের কাজগুলোই আসল ঝামেলা — মালপত্র শিফট করা, ঘর পরিষ্কার করানো, '
      + 'ইন্টারনেটের লাইন, গ্যাস-পানির সমস্যা, ইলেকট্রিশিয়ান খোঁজা। TO-LET PRO এর সার্ভিস '
      + 'হাব থেকে যেকোনো সার্ভিসের অনুরোধ পাঠান, আমরা ভেরিফাইড প্রোভাইডারের সাথে যুক্ত করে দিই।',
    en: 'Finding the flat is only half of it — then comes shifting, cleaning, the '
      + 'internet line, the gas and water, finding an electrician who turns up. '
      + 'Request any of it from the services hub and we connect you with a verified '
      + 'provider.',
  },

  features: [
    { icon: 'truck', bn: { t: 'শিফটিং ও মুভার্স', d: 'প্যাকিং থেকে নতুন বাসায় পৌঁছানো।' }, en: { t: 'Movers & shifting', d: 'Packing through to the new address.' } },
    { icon: 'sparkles', bn: { t: 'ক্লিনিং', d: 'ডিপ ক্লিন বা নিয়মিত পরিষ্কার।' }, en: { t: 'Cleaning', d: 'Deep clean or a regular schedule.' } },
    { icon: 'wrench', bn: { t: 'মেরামত', d: 'প্লাম্বিং, ইলেকট্রিক ও টুকিটাকি কাজ।' }, en: { t: 'Repairs', d: 'Plumbing, electrical and odd jobs.' } },
    { icon: 'wifi', bn: { t: 'ইন্টারনেট', d: 'ব্রডব্যান্ড ও ওয়াইফাই সংযোগ।' }, en: { t: 'Internet', d: 'Broadband and WiFi connections.' } },
    { icon: 'shield', bn: { t: 'নিরাপত্তা', d: 'সিসিটিভি ও গার্ড সার্ভিস।' }, en: { t: 'Security', d: 'CCTV and guard services.' } },
    { icon: 'utensils', bn: { t: 'রান্না ও টিউটর', d: 'ঘরের রান্নার সহায়তা ও হোম টিউটর।' }, en: { t: 'Cooks & tutors', d: 'Home cooking help and tutors.' } },
  ],

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
        + 'এখনই নাও থাকতে পারে। অনুরোধ পাঠালে আপনার এলাকায় ব্যবস্থা হওয়ামাত্র আমরা জানাব।',
    },
    {
      q: 'সার্ভিস অনুরোধ করতে কি টাকা লাগে? (Is requesting a service free?)',
      a: 'অনুরোধ পাঠানো ফ্রি। সার্ভিসের খরচ প্রোভাইডারের সাথে সরাসরি ঠিক হয়।',
    },
    {
      q: 'তালিকায় নেই এমন কিছু দরকার হলে? (What if I need something not on the list?)',
      a: 'কাস্টম অনুরোধ পাঠানো যায় — কী দরকার লিখে দিলে সাপোর্ট টিম দেখে ব্যবস্থা করে।',
    },
  ],

  related: ['/to-let', '/house-manager', '/meal-manager'],
};

/* ────────────────────────────── exports ─────────────────────────────────── */

export const FEATURE_PAGES = [
  mealManager, roommateWallet, houseManager, tenantManager, homeServices,
];

export const FEATURE_PAGE_BY_SLUG = Object.fromEntries(
  FEATURE_PAGES.map((p) => [p.slug, p]),
);

/** '/meal-manager' → page, and also 'meal-manager' → page. */
export const featurePageFor = (slug) => {
  const key = String(slug || '');
  return FEATURE_PAGE_BY_SLUG[key] || FEATURE_PAGE_BY_SLUG[`/${key}`] || null;
};
