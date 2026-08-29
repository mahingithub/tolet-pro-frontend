/**
 * keywords.js — the vocabulary TO-LET PRO wants to rank for.
 * ─────────────────────────────────────────────────────────────────────────────
 * Grounded in what Bangladeshi renters, students and landlords actually type,
 * checked against the sites and apps currently ranking for those terms
 * (Aug 2026). Not guessed.
 *
 * ── What the search landscape looks like ──
 * The market splits into three silos, and nothing sits in more than one:
 *
 *   1. TO-LET LISTINGS — thetolet.com, thetoletbd.com, toletbd.app,
 *      baribodol.com, basarkhuj.com, BDToLet. They list houses. They do not
 *      help you after you move in.
 *   2. MESS / MEAL MANAGERS — MealKhata, Mess Monitor, BDMess, মেস মামা,
 *      Mess Hisab, MessMaster, Mess Mate. They count meals. They cannot find
 *      you a room, and several of them gate the useful parts behind a
 *      subscription or a free trial (a recurring complaint in their reviews).
 *   3. RENT LEDGERS FOR LANDLORDS — BharaKhata, বাড়িওয়ালা অ্যাপ (bari-wala.com),
 *      Nibaash. They digitise the ভাড়ার খাতা. They have no listings and no
 *      mess side.
 *
 * TO-LET PRO is the only one spanning all three, and its meal manager and
 * roommate wallet are free. That is the story every page here has to tell,
 * because "just another to-let site" is the assumption a visitor arrives with.
 *
 * ── Three registers, always ──
 * A single renter searches in all three within one session:
 *   English   "flat rent in dhaka", "mess manager app"
 *   Bangla    "ঢাকায় বাসা ভাড়া", "মিল হিসাবের অ্যাপ", "ভাড়ার খাতা"
 *   Banglish  "basa vara dhaka", "mess hisab", "bari vara"
 * Missing one register means missing the search, so every cluster carries all
 * three. These strings earn their keep in titles, H1s and body copy — the
 * <meta name="keywords"> tag is ignored by Google and emitted only because
 * Bing and some Bangladeshi aggregators still read it.
 */

/* ── 1. Finding a place ──────────────────────────────────────────────────── */

export const RENT_KEYWORDS = [
  'to let', 'to-let', 'tolet', 'টু-লেট', 'টুলেট', 'টু লেট',
  'house rent', 'বাসা ভাড়া', 'basa vara', 'basha vara', 'bari vara', 'বাড়ি ভাড়া',
  'flat rent', 'ফ্ল্যাট ভাড়া', 'flat vara', 'apartment rent', 'অ্যাপার্টমেন্ট ভাড়া',
  'room rent', 'রুম ভাড়া', 'single room rent', 'সিঙ্গেল রুম',
  'sublet', 'সাবলেট', 'সাবলেট ভাড়া',
  'seat rent', 'সিট ভাড়া', 'বেড ভাড়া',
  'mess rent', 'মেস ভাড়া', 'মেসে সিট', 'hostel', 'হোস্টেল', 'হোস্টেল সিট',
  'bachelor flat', 'ব্যাচেলর বাসা', 'ব্যাচেলর বাসা ভাড়া', 'bachelor basa vara',
  'ব্যাচেলর রুম', 'ছাত্রদের জন্য বাসা', 'student room rent',
  'family flat', 'ফ্যামিলি বাসা', 'ফ্যামিলি বাসা ভাড়া', 'family basa vara',
  'office space rent', 'অফিস ভাড়া', 'shop rent', 'দোকান ভাড়া', 'গোডাউন ভাড়া',
  'বাসা খুঁজছি', 'বাসা ভাড়া দেওয়া হবে', 'to let sign', 'বাড়ি ভাড়ার বিজ্ঞাপন',
  'rental property Bangladesh', 'বাংলাদেশে বাসা ভাড়া', 'দালাল ছাড়া বাসা ভাড়া',
];

/**
 * Dhaka neighbourhoods carry enormous long-tail volume — "মিরপুর বাসা ভাড়া"
 * is its own search, not a variant of "ঢাকা বাসা ভাড়া". The competing
 * listing sites hold tens of thousands of ads in exactly these areas.
 */
export const DHAKA_AREA_KEYWORDS = [
  'মিরপুর বাসা ভাড়া', 'mirpur to let', 'মোহাম্মদপুর বাসা ভাড়া', 'mohammadpur to let',
  'উত্তরা বাসা ভাড়া', 'uttara flat rent', 'বাড্ডা বাসা ভাড়া', 'badda to let',
  'ধানমন্ডি বাসা ভাড়া', 'dhanmondi flat rent', 'বসুন্ধরা বাসা ভাড়া',
  'খিলগাঁও বাসা ভাড়া', 'রামপুরা বাসা ভাড়া', 'মগবাজার বাসা ভাড়া',
  'শেওড়াপাড়া সিট ভাড়া', 'কাজীপাড়া সাবলেট', 'খিলক্ষেত মেস',
  'ফার্মগেট মেস', 'নিউমার্কেট সাবলেট', 'যাত্রাবাড়ী বাসা ভাড়া',
];

/* ── 2. The landlord side: ভাড়ার খাতা ───────────────────────────────────── */

/**
 * "ভাড়ার খাতা" — the paper rent book — is the single most valuable term on
 * this side. It is what a Bangladeshi landlord calls the thing they are trying
 * to replace, and it is the name BharaKhata and বাড়িওয়ালা অ্যাপ have built
 * their whole positioning on.
 */
export const RENT_LEDGER_KEYWORDS = [
  'ভাড়ার খাতা', 'বাড়ি ভাড়ার খাতা', 'বাসা ভাড়ার খাতা', 'bhara khata', 'bara khata',
  'ডিজিটাল খাতা', 'digital khata', 'ভাড়ার হিসাব', 'বাসা ভাড়ার হিসাব',
  'ভাড়া কালেকশন', 'rent collection app', 'bhara collection',
  'ভাড়ার রশিদ', 'rent receipt', 'ভাড়ার বিল', 'মাসিক ভাড়ার হিসাব',
  'বকেয়া ভাড়া', 'ভাড়া বাকি', 'rent due tracker',
  'বাড়িওয়ালা অ্যাপ', 'bariwala app', 'landlord app Bangladesh',
  'ভাড়াটিয়া ম্যানেজমেন্ট', 'tenant management app', 'ভাড়াটিয়ার তথ্য',
  'ভাড়াটিয়া তালিকা', 'tenant list', 'ভাড়াটিয়ার এনআইডি',
];

export const MANAGEMENT_KEYWORDS = [
  'house manager', 'হাউস ম্যানেজার', 'বাড়ি ম্যানেজার',
  'house management app', 'বাসা ব্যবস্থাপনা', 'বাড়ি ব্যবস্থাপনা অ্যাপ',
  'property management app Bangladesh', 'প্রপার্টি ম্যানেজমেন্ট সফটওয়্যার',
  'বিল্ডিং ম্যানেজমেন্ট', 'building management Bangladesh', 'flat management',
  'ইউনিট ম্যানেজমেন্ট', 'খালি ফ্ল্যাট', 'vacant flat tracking',
  'রেন্ট ম্যানেজমেন্ট সিস্টেম', 'rent management system',
  'বাড়ি ভাড়া দেওয়ার নিয়ম', 'ভাড়া চুক্তিপত্র', 'rental agreement Bangladesh',
];

/* ── 3. Mess life: মিল, বাজার, হিসাব ────────────────────────────────────── */

/**
 * The strongest organic hook in the whole app. Every competing app is a
 * single-purpose mess tool, several of them paid — and none of them can also
 * find you the room. The formula "মোট বাজার খরচ ÷ মোট মিল = মিল রেট" is
 * itself a search: people look up how to calculate it.
 */
export const MEAL_KEYWORDS = [
  'মিল ম্যানেজার', 'meal manager', 'meal manager app', 'মিল ম্যানেজার অ্যাপ',
  'মেস ম্যানেজার', 'mess manager', 'mess manager app', 'মেস ম্যানেজার অ্যাপ',
  'মিল হিসাব', 'মিল হিসাবের অ্যাপ', 'meal hisab', 'মেসের হিসাব', 'mess hisab',
  'মেস খরচের হিসাব', 'মেস ম্যানেজমেন্ট', 'mess management app',
  'মেস ম্যানেজমেন্ট সিস্টেম', 'ডিজিটাল মেস',
  'মিল রেট', 'meal rate', 'মিল রেট হিসাব', 'meal rate calculator',
  'মিল রেট বের করার নিয়ম', 'মোট বাজার ভাগ মোট মিল',
  'বাজার খরচ', 'bazar khoroch', 'বাজার লিস্ট', 'bazar list', 'মাসের বাজার হিসাব',
  'মিল চার্ট', 'meal chart', 'ডেইলি মিল', 'daily meal tracker',
  'মেসের জমা', 'ডিপোজিট হিসাব', 'মেস মেম্বার',
  'ব্যাচেলর মেস', 'bachelor mess', 'স্টুডেন্ট মেস', 'student mess management',
  'ফ্রি মিল ম্যানেজার', 'free mess manager', 'সাবস্ক্রিপশন ছাড়া মিল অ্যাপ',
];

/* ── 4. Shared living: খরচ ভাগাভাগি ─────────────────────────────────────── */

export const WALLET_KEYWORDS = [
  'রুমমেট ওয়ালেট', 'roommate wallet', 'roommate expense split',
  'খরচ ভাগ', 'খরচ ভাগাভাগি', 'khoroch bhag', 'শেয়ার্ড খরচ',
  'expense split app', 'bill split app Bangladesh', 'বিল ভাগ করার অ্যাপ',
  'রুমমেট হিসাব', 'roommate hisab', 'বন্ধুদের খরচের হিসাব',
  'কারেন্ট বিল ভাগ', 'বিদ্যুৎ বিল', 'গ্যাস বিল', 'পানির বিল', 'ওয়াইফাই বিল ভাগ',
  'utility bill split', 'বুয়ার বেতন', 'maid salary split',
  'কে কত পাবে', 'পাওনা হিসাব', 'settle up', 'বকেয়া হিসাব',
  'মাসিক খরচের হিসাব', 'monthly expense report', 'হিসাবের অ্যাপ',
];

/* ── 5. Home services ────────────────────────────────────────────────────── */

export const SERVICE_KEYWORDS = [
  'হোম সার্ভিস', 'home services Bangladesh',
  'বাসা শিফটিং', 'house shifting', 'মুভার্স', 'movers Bangladesh', 'বাসা বদল',
  'বাসা পরিষ্কার', 'home cleaning', 'ডিপ ক্লিন',
  'পেস্ট কন্ট্রোল', 'pest control', 'প্লাম্বার', 'plumber', 'ইলেকট্রিশিয়ান', 'electrician',
  'ইন্টারনেট সংযোগ', 'broadband', 'ব্রডব্যান্ড', 'ওয়াইফাই লাইন',
  'গ্যাস লাইন', 'পানির পাম্প', 'সিসিটিভি', 'cctv security', 'লন্ড্রি', 'laundry',
  'হোম টিউটর', 'home tutor', 'রান্নার লোক', 'বুয়া', 'cook',
];

/* ── 6. The positioning terms ────────────────────────────────────────────── */

/**
 * What someone types when they want the whole thing rather than one piece.
 * These are low-volume today because nobody offers it — which is exactly why
 * they are cheap to own.
 */
export const ALL_IN_ONE_KEYWORDS = [
  'অল ইন ওয়ান বাসা ভাড়া অ্যাপ', 'all in one house rent app',
  'বাসা ভাড়া ও ম্যানেজমেন্ট অ্যাপ', 'rent and manage app Bangladesh',
  'টু-লেট ও মিল ম্যানেজার', 'to let and mess manager',
  'বাড়িওয়ালা ও ভাড়াটিয়ার অ্যাপ', 'landlord and tenant app',
  'ফ্রি বাসা ভাড়ার অ্যাপ', 'free house rent app Bangladesh',
  'ফ্রি মেস ও ভাড়া ম্যানেজমেন্ট', 'tolet pro', 'টু-লেট প্রো',
];

/** Everything, de-duplicated — the homepage keyword bag. */
export const ALL_KEYWORDS = Array.from(new Set([
  ...RENT_KEYWORDS,
  ...MEAL_KEYWORDS,
  ...RENT_LEDGER_KEYWORDS,
  ...WALLET_KEYWORDS,
  ...MANAGEMENT_KEYWORDS,
  ...ALL_IN_ONE_KEYWORDS,
  ...SERVICE_KEYWORDS,
  ...DHAKA_AREA_KEYWORDS,
]));

/**
 * Meta-keyword strings should read as a topic hint, not a spam signal.
 * ~28 terms is a comfortable ceiling.
 */
export const toKeywordString = (list, limit = 28) =>
  Array.from(new Set(list)).slice(0, limit).join(', ');
