/**
 * keywords.js — the vocabulary TO-LET PRO wants to rank for.
 * ─────────────────────────────────────────────────────────────────────────────
 * Bangladeshi renters search in three registers, often in the same session:
 *
 *   English   "flat rent in dhaka", "family flat rent mirpur"
 *   Bangla    "ঢাকায় বাসা ভাড়া", "মেস ভাড়া", "টু-লেট"
 *   Banglish  "basa vara dhaka", "bachelor bari vara", "to let dhaka"
 *
 * Missing any one of them means missing the search. Every cluster below
 * therefore carries all three, and the copy generators in locationSeo.js /
 * featurePages.js weave them into real sentences rather than stuffing them.
 *
 * `<meta name="keywords">` itself is ignored by Google — these strings earn
 * their keep in titles, descriptions, H1s and body copy, which is where the
 * ranking actually happens. The meta tag is emitted anyway because Bing and
 * several Bangladeshi aggregators still read it, and it costs nothing.
 */

/** Core rental-marketplace terms — used on the homepage and every location page. */
export const RENT_KEYWORDS = [
  'to let', 'to-let', 'tolet', 'টু-লেট', 'টুলেট',
  'house rent', 'বাসা ভাড়া', 'basa vara', 'basha vara', 'bari vara', 'বাড়ি ভাড়া',
  'flat rent', 'ফ্ল্যাট ভাড়া', 'flat vara', 'apartment rent', 'অ্যাপার্টমেন্ট ভাড়া',
  'room rent', 'রুম ভাড়া', 'sublet', 'সাবলেট', 'seat rent', 'সিট ভাড়া',
  'mess rent', 'মেস ভাড়া', 'hostel', 'হোস্টেল',
  'bachelor flat', 'ব্যাচেলর বাসা', 'bachelor basa vara',
  'family flat', 'ফ্যামিলি বাসা', 'family basa vara',
  'office space rent', 'অফিস ভাড়া', 'shop rent', 'দোকান ভাড়া',
  'to let sign', 'rental property Bangladesh', 'বাংলাদেশে বাসা ভাড়া',
];

/** Property-management terms — the half of the product that is not a marketplace. */
export const MANAGEMENT_KEYWORDS = [
  'house manager', 'হাউস ম্যানেজার', 'বাড়ি ম্যানেজার',
  'house management app', 'বাসা ব্যবস্থাপনা', 'বাড়ি ব্যবস্থাপনা অ্যাপ',
  'property management app Bangladesh', 'প্রপার্টি ম্যানেজমেন্ট অ্যাপ',
  'tenant manager', 'টেন্যান্ট ম্যানেজার', 'ভাড়াটিয়া ম্যানেজমেন্ট',
  'tenant management app', 'ভাড়াটিয়া তালিকা', 'ভাড়াটিয়া হিসাব',
  'landlord app', 'বাড়িওয়ালা অ্যাপ', 'বাড়িওয়ালার হিসাব',
  'rent collection app', 'ভাড়া আদায়', 'ভাড়া কালেকশন', 'bhara collection',
  'rent receipt', 'ভাড়ার রশিদ', 'rent ledger', 'ভাড়ার হিসাব',
  'building management', 'বিল্ডিং ম্যানেজমেন্ট', 'flat management',
];

/** Meal-manager cluster — mess life, the strongest organic hook in this app. */
export const MEAL_KEYWORDS = [
  'meal manager', 'মিল ম্যানেজার', 'meal manager app', 'মিল ম্যানেজার অ্যাপ',
  'mess manager', 'মেস ম্যানেজার', 'mess management app', 'মেস ম্যানেজমেন্ট',
  'meal rate calculator', 'মিল রেট', 'মিল রেট হিসাব', 'meal rate hisab',
  'bazar list', 'বাজার লিস্ট', 'বাজার খরচ', 'bazar khoroch',
  'mess hisab', 'মেসের হিসাব', 'meal hisab', 'মিলের হিসাব',
  'mess bill split', 'মেস বিল ভাগ', 'monthly meal chart', 'মিল চার্ট',
  'bachelor mess', 'ব্যাচেলর মেস', 'student mess management',
];

/** Roommate wallet / shared-expense cluster. */
export const WALLET_KEYWORDS = [
  'roommate wallet', 'রুমমেট ওয়ালেট', 'roommate expense split',
  'expense split app', 'খরচ ভাগ', 'খরচ ভাগাভাগি', 'khoroch bhag',
  'shared expense', 'শেয়ার্ড খরচ', 'roommate hisab', 'রুমমেট হিসাব',
  'bill split app Bangladesh', 'বিল ভাগ করার অ্যাপ',
  'utility bill split', 'কারেন্ট বিল ভাগ', 'gas bill', 'গ্যাস বিল',
  'who owes whom', 'কে কত পাবে', 'settle up', 'পাওনা হিসাব',
  'monthly expense report', 'মাসিক খরচের হিসাব',
];

/** Home-services / facilities cluster (ServicesPage). */
export const SERVICE_KEYWORDS = [
  'home services', 'হোম সার্ভিস', 'house shifting', 'বাসা শিফটিং',
  'movers Bangladesh', 'মুভার্স', 'home cleaning', 'বাসা পরিষ্কার',
  'pest control', 'পেস্ট কন্ট্রোল', 'plumber', 'প্লাম্বার',
  'electrician', 'ইলেকট্রিশিয়ান', 'internet connection', 'ইন্টারনেট সংযোগ',
  'broadband', 'ব্রডব্যান্ড', 'wifi', 'ওয়াইফাই',
  'gas line', 'গ্যাস লাইন', 'water pump', 'পানির পাম্প',
  'cctv security', 'সিসিটিভি', 'laundry', 'লন্ড্রি',
  'home tutor', 'হোম টিউটর', 'cook', 'রান্নার লোক',
];

/** Everything, de-duplicated — the homepage keyword bag. */
export const ALL_KEYWORDS = Array.from(new Set([
  ...RENT_KEYWORDS,
  ...MANAGEMENT_KEYWORDS,
  ...MEAL_KEYWORDS,
  ...WALLET_KEYWORDS,
  ...SERVICE_KEYWORDS,
]));

/**
 * Meta-keyword strings should stay short enough that a crawler reads them as a
 * topic hint rather than a spam signal. 25 terms is a comfortable ceiling.
 */
export const toKeywordString = (list, limit = 25) =>
  list.slice(0, limit).join(', ');
