/**
 * homeContent.js — the "so what actually is this?" copy.
 * ─────────────────────────────────────────────────────────────────────────────
 * The brand is called TO-LET PRO, so every visitor assumes listings and stops
 * there. The meal manager, roommate wallet and digital ভাড়ার খাতা are the
 * parts no competitor offers alongside listings, and they were invisible to
 * anyone who had not already signed up.
 *
 * Lives here as plain data rather than inside the JSX for two reasons:
 *   • scripts/prerender-seo.mjs emits the same words for crawlers that never
 *     run JavaScript, and it cannot import a component;
 *   • the same copy is rendered in three places at different sizes — the
 *     desktop homepage, a compact strip on the mobile homepage, and in full on
 *     /how-it-works — and it should only be written once.
 *
 * ── Where each one is used, and why ──
 * Google indexes mobile-first, from a ~375px viewport. The desktop homepage
 * lives inside `hidden md:flex`, so its copy is display:none to the crawler and
 * is a pure UX choice with no SEO weight either way. /how-it-works renders the
 * full version at every width, so that is the page actually carrying this
 * content in the index — which is also why the same words appearing on the
 * desktop homepage costs nothing: a crawler never sees both.
 *
 * Icons are STRING keys so this file stays free of React and lucide imports.
 */

/** The three pillars. Order matters: listings first, because that is why they came. */
export const PILLARS = [
  {
    icon: 'search',
    to: '/to-let',
    bn: {
      t: 'বাসা খুঁজুন',
      d: 'ঢাকা থেকে শুরু করে ৬৪ জেলা — ফ্ল্যাট, রুম, সিট, মেস, সাবলেট, ফ্যামিলি ও '
        + 'ব্যাচেলর বাসা। ছবি, ভাড়া আর বাড়িওয়ালার সাথে সরাসরি কথা, দালাল ছাড়া।',
      cta: 'সব জেলার টু-লেট',
    },
    en: {
      t: 'Find a place',
      d: 'All 64 districts — flats, rooms, seats, mess, sublets, family and bachelor '
        + 'houses. Photos, rent, and a direct line to the landlord with no broker.',
      cta: 'To-let in every district',
    },
  },
  {
    icon: 'utensils',
    to: '/meal-manager',
    bn: {
      t: 'মেসের হিসাব রাখুন',
      d: 'মিল, বাজার, মিল রেট, কারেন্ট-গ্যাস-ওয়াইফাইয়ের বিল আর কে কত পাবে — সব '
        + 'অ্যাপ নিজেই হিসাব করে। সম্পূর্ণ ফ্রি, কোনো সাবস্ক্রিপশন নেই।',
      cta: 'মিল ম্যানেজার দেখুন',
    },
    en: {
      t: 'Run the mess accounts',
      d: 'Meals, bazar, meal rate, utility bills and who owes whom — worked out for '
        + 'you. Completely free, with no subscription.',
      cta: 'See the meal manager',
    },
  },
  {
    icon: 'notebook',
    to: '/tenant-manager',
    bn: {
      t: 'বাড়ি ম্যানেজ করুন',
      d: 'ভাড়ার খাতা ফোনে — ভাড়াটিয়ার তালিকা, মাসিক ভাড়া, বকেয়া, ডিজিটাল রশিদ, '
        + 'চুক্তিপত্র ও খালি ইউনিটের অ্যালার্ট।',
      cta: 'ভাড়ার খাতা দেখুন',
    },
    en: {
      t: 'Manage the building',
      d: 'The rent book on your phone — tenants, monthly rent, dues, digital receipts, '
        + 'agreements and vacancy alerts.',
      cta: 'See the rent book',
    },
  },
];

/** What is free, stated plainly. Checked against SubscriptionPage.jsx's matrix. */
export const FREE_LIST = {
  bn: [
    'বাসা খোঁজা ও বাড়িওয়ালার সাথে যোগাযোগ',
    'পুরো মিল ম্যানেজার — মিল, বাজার, মিল রেট, রিপোর্ট',
    'রুমমেট ওয়ালেট — খরচ ভাগ ও পাওনার হিসাব',
    'একটি টু-লেট বিজ্ঞাপন, ৫টি ছবিসহ',
  ],
  en: [
    'Searching and contacting landlords',
    'The entire meal manager — meals, bazar, meal rate, reports',
    'Roommate wallet — expense splitting and balances',
    'One to-let listing with 5 photos',
  ],
};

/** The long-form body. Rendered in full on desktop home and /how-it-works. */
export const BODY_SECTIONS = [
  {
    h2: {
      bn: 'কেন সব আলাদা আলাদা অ্যাপে?',
      en: 'Why is all of this in separate apps?',
    },
    paragraphs: [
      {
        bn: 'একজন ছাত্র ঢাকায় এসে প্রথমে একটা টু-লেট সাইটে সিট খোঁজে। সিট পাওয়ার '
          + 'পর মেসের মিলের হিসাবের জন্য আলাদা একটা মিল ম্যানেজার অ্যাপ নামায়। '
          + 'কারেন্ট বিল আর ওয়াইফাইয়ের টাকা ভাগ করতে হয়তো তৃতীয় কোনো অ্যাপ, নয়তো '
          + 'একটা হোয়াটসঅ্যাপ গ্রুপ আর খাতা। আর তার বাড়িওয়ালা ভাড়ার হিসাব রাখেন '
          + 'সম্পূর্ণ আলাদা একটা খাতায়, যেটা ওই ছাত্র কোনোদিন দেখতেই পায় না।',
        en: 'A student arrives in Dhaka and finds a seat through a to-let site. Once '
          + 'in, they download a separate meal manager for the mess accounts. '
          + 'Splitting the electricity and WiFi takes a third app, or a WhatsApp '
          + 'group and a notebook. Meanwhile the landlord keeps the rent in an '
          + 'entirely separate book that the student never sees.',
      },
      {
        bn: 'একই বাসা, একই মানুষগুলো, একই টাকা — অথচ চারটা আলাদা জায়গায়। '
          + 'বাংলাদেশে এখন যা আছে সবই এক-একটা টুকরো: টু-লেট সাইটগুলো বাসা খুঁজে '
          + 'দিয়েই কাজ শেষ মনে করে, মেস অ্যাপগুলো বাসা খুঁজে দিতে পারে না, আর '
          + 'বাড়িওয়ালাদের সফটওয়্যার ভাড়াটিয়ার জীবনের কিছুই জানে না।',
        en: 'The same house, the same people, the same money — kept in four different '
          + 'places. Everything available here today is a single piece of the '
          + 'problem: listing sites consider the job done once you have the keys, '
          + 'mess apps cannot find you a room, and landlord software knows nothing '
          + 'about the people actually living there.',
      },
      {
        bn: 'TO-LET PRO সেই টুকরোগুলো এক জায়গায় এনেছে। ৬৪ জেলার টু-লেট বিজ্ঞাপন, '
          + 'মেসের মিল ও বাজারের হিসাব, রুমমেটদের খরচ ভাগাভাগি, আর বাড়িওয়ালার '
          + 'ভাড়ার খাতা — সবই একটা অ্যাকাউন্টে। মেসের সিট খুঁজে সেখানেই মিলের হিসাব '
          + 'শুরু করা যায়; বাড়িওয়ালা খালি ফ্ল্যাটের বিজ্ঞাপন দিয়ে সেই ভাড়াটিয়াকেই '
          + 'খাতায় তুলে রাখতে পারেন। নতুন অ্যাপ নামানোর দরকার হয় না।',
        en: 'TO-LET PRO puts those pieces together. To-let listings across all 64 '
          + 'districts, mess meals and bazar, roommate expense splitting, and the '
          + 'landlord’s rent book — in one account. Find a mess seat and start its '
          + 'meal ledger in the same place; list a vacant flat and keep that same '
          + 'tenant in your rent book afterwards. No second app to install.',
      },
    ],
  },
  {
    h2: {
      bn: 'ছাত্র ও ব্যাচেলরদের জন্য কেন আলাদা',
      en: 'Why students and bachelors get the most out of it',
    },
    paragraphs: [
      {
        bn: 'ঢাকায় "ব্যাচেলর ভাড়া হবে না" কথাটা যারা শুনেছেন, তারা জানেন সিট বা '
          + 'সাবলেট খোঁজা কতটা কঠিন। তাই এখানে ফ্যামিলি, ব্যাচেলর, সাবলেট, মেস ও '
          + 'সিট আলাদা ক্যাটাগরিতে রাখা — ব্যাচেলর ফিল্টার দিলে শুধু সেই বাসাগুলোই '
          + 'দেখা যায় যেগুলোতে ব্যাচেলর উঠতে পারবেন, প্রতিটা বিজ্ঞাপনে ফোন করে '
          + 'জিজ্ঞেস করতে হয় না।',
        en: 'Anyone who has been told "no bachelors" in Dhaka knows how hard finding a '
          + 'seat or a sublet can be. So family, bachelor, sublet, mess and seat are '
          + 'separate categories here — filter to bachelor and you only see places '
          + 'that will actually take you, instead of ringing every ad to ask.',
      },
      {
        bn: 'আর সিট পাওয়ার পরের অংশটা, যেটা নিয়ে কেউ কথা বলে না: মাসের শেষে মিল '
          + 'রেট নিয়ে তর্ক, বাজারের স্লিপ হারানো, বন্ধুর কাছে তিনশো টাকা চাইতে '
          + 'গিয়ে সংকোচ। মিল ম্যানেজার আর রুমমেট ওয়ালেট ঠিক এই জায়গাটার জন্য — '
          + 'এবং দুটোই সম্পূর্ণ ফ্রি। বাজারে যে মেস অ্যাপগুলো আছে তার বেশ কিছুতে '
          + 'ভালো ফিচারগুলো সাবস্ক্রিপশন বা ফুরিয়ে যাওয়া ট্রায়ালের পেছনে আটকানো; '
          + 'এখানে আটকানোর মতো কিছু নেই, কারণ ছাত্র বা ভাড়াটিয়া হিসেবে আপনার কাছ '
          + 'থেকে আমরা কিছু নিই না।',
        en: 'And then the part nobody talks about: arguing over the meal rate on the '
          + 'last day, losing the bazar slips, the awkwardness of asking a friend for '
          + 'three hundred taka. The meal manager and roommate wallet exist for '
          + 'exactly that — and both are completely free. Several mess apps on the '
          + 'market keep their useful parts behind a subscription or an expiring '
          + 'trial. There is nothing to unlock here, because we do not charge '
          + 'students or tenants at all.',
      },
    ],
  },
  {
    h2: { bn: 'বাড়িওয়ালাদের জন্য', en: 'For landlords' },
    paragraphs: [
      {
        bn: 'বাড়িওয়ালার দিক থেকে দুটো কাজ সবসময় আলাদা ছিল — ভাড়াটিয়া খোঁজা আর '
          + 'ভাড়ার হিসাব রাখা। বিজ্ঞাপন এক জায়গায়, খাতা আরেক জায়গায়। এখানে খালি '
          + 'ইউনিট এক ট্যাপে টু-লেট বিজ্ঞাপন হয়ে যায়, ভাড়াটিয়া QR স্ক্যান করে নিজেই '
          + 'যুক্ত হন, আর তারপর তার ভাড়া, বকেয়া ও রশিদ একই জায়গায় জমতে থাকে। '
          + 'পুরনো কাগজের খাতা থাকলে তার পাতার ছবি তুলে দিলেই এন্ট্রিগুলো ডিজিটাল '
          + 'করার প্রস্তাব চলে আসে।',
        en: 'From the landlord’s side two jobs have always been separate: finding a '
          + 'tenant, and keeping the rent accounts. The ad lives one place, the book '
          + 'another. Here a vacant unit becomes a to-let ad in one tap, the tenant '
          + 'joins by scanning a QR, and from then on their rent, dues and receipts '
          + 'accumulate in the same place. Photograph a page of your old paper book '
          + 'and it offers to bring those entries across.',
      },
      {
        bn: 'বিজ্ঞাপন দেওয়া ও বেসিক ব্যবহার ফ্রি। ভাড়া কালেকশন, একাধিক বিজ্ঞাপন, '
          + 'সার্চ বুস্ট, স্মার্ট অ্যালার্ট ও অ্যানালিটিক্সের মতো ফিচারগুলো Plus ও Pro '
          + 'প্ল্যানে — কারণ আমাদের আয়ের জায়গা সেটাই, ভাড়াটিয়ার পকেট নয়।',
        en: 'Listing and basic use are free. Rent collection, multiple listings, '
          + 'search boost, smart alerts and analytics sit on the Plus and Pro plans — '
          + 'because that is where our revenue comes from, rather than from tenants.',
      },
    ],
  },
];

/** Crawlable links out. Also genuinely the pages people want next. */
export const POPULAR_LINKS = [
  { to: '/to-let', bn: 'সব জেলার টু-লেট', en: 'To-let in all districts' },
  { to: '/properties/dhaka', bn: 'ঢাকায় বাসা ভাড়া', en: 'House rent in Dhaka' },
  { to: '/properties/chittagong', bn: 'চট্টগ্রামে বাসা ভাড়া', en: 'House rent in Chattogram' },
  { to: '/meal-manager', bn: 'মিল ম্যানেজার', en: 'Meal manager' },
  { to: '/roommate-wallet', bn: 'রুমমেট ওয়ালেট', en: 'Roommate wallet' },
  { to: '/tenant-manager', bn: 'ভাড়ার খাতা', en: 'Rent book' },
  { to: '/house-manager', bn: 'হাউস ম্যানেজার', en: 'House manager' },
  { to: '/home-services', bn: 'হোম সার্ভিস', en: 'Home services' },
  { to: '/how-it-works', bn: 'কিভাবে কাজ করে', en: 'How it works' },
];
