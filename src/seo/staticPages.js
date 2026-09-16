/**
 * staticPages.js — head copy for the public pages that have no data module.
 * ─────────────────────────────────────────────────────────────────────────────
 * Read by the React side (RouteSeoGuard, PropertyListing) AND by the build
 * (scripts/prerender-seo.mjs). It used to live only inside those components,
 * which the build cannot import, so none of these pages got a prerendered file:
 * each shipped the homepage's HTML — the homepage's title and a canonical of
 * "/" — to every crawler and link preview that does not run JavaScript.
 */

/** Support and the legal pages. Keyed by exact path. */
export const PUBLIC_PAGE_SEO = {
  '/support': {
    title: 'সাহায্য ও সাপোর্ট — Help & Support',
    description: 'TO-LET PRO ব্যবহারে কোনো সমস্যা? বাসা ভাড়া, বিজ্ঞাপন, অ্যাকাউন্ট, পেমেন্ট বা রিপোর্ট সংক্রান্ত সাহায্যের জন্য সাপোর্ট টিমের কাছে অনুরোধ পাঠান — বাংলা ও ইংরেজিতে।',
  },
  '/privacy-policy': {
    title: 'প্রাইভেসি পলিসি — Privacy Policy',
    description: 'TO-LET PRO কোন তথ্য সংগ্রহ করে, কেন করে, কতদিন রাখে এবং আপনি কিভাবে আপনার তথ্য দেখতে, সংশোধন করতে বা মুছে ফেলতে পারেন — সম্পূর্ণ প্রাইভেসি পলিসি।',
  },
  '/terms': {
    title: 'ব্যবহারের শর্তাবলী — Terms of Service',
    description: 'TO-LET PRO ব্যবহারের শর্তাবলী — বাড়িওয়ালা ও ভাড়াটিয়ার দায়িত্ব, বিজ্ঞাপনের নিয়ম, নিষিদ্ধ ব্যবহার এবং অ্যাকাউন্ট সংক্রান্ত শর্ত।',
  },
  '/refund': {
    title: 'রিফান্ড পলিসি — Refund Policy',
    description: 'TO-LET PRO এর পেইড প্ল্যান ও বুস্ট সংক্রান্ত রিফান্ড নীতি — কখন রিফান্ড প্রযোজ্য, কিভাবে অনুরোধ করবেন এবং কত সময় লাগে।',
  },
  '/trust-safety': {
    title: 'ট্রাস্ট ও নিরাপত্তা — Trust & Safety',
    description: 'ভেরিফিকেশন, প্রতারণা এড়ানোর উপায়, নিরাপদে বাসা দেখা ও রিপোর্ট করার নিয়ম — TO-LET PRO তে নিরাপদ থাকার নির্দেশিকা।',
  },
};

/** /properties/all — every listing, no location filter. */
export const ALL_LISTINGS_SEO = {
  // Was "Browse All To-Let Listings in Bangladesh": 68 characters with the brand.
  title: 'সব বিজ্ঞাপন — All To-Let Listings in Bangladesh',
  description: 'বাংলাদেশের সব জেলার বাসা, ফ্ল্যাট, রুম, সিট ও মেস ভাড়ার টু-লেট বিজ্ঞাপন এক তালিকায় — ভাড়া, এলাকা ও ধরন অনুযায়ী ফিল্টার করুন। Browse every to-let listing on TO-LET PRO: flats, rooms, mess seats, sublets and family houses.',
};
