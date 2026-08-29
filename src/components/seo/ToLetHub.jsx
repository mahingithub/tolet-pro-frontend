/**
 * ToLetHub.jsx — `/to-let`, the index of every location page.
 * ─────────────────────────────────────────────────────────────────────────────
 * A sitemap tells a crawler that 71 location pages exist. An internal link
 * tells it they matter. This page is that link — every division and district in
 * Bangladesh, grouped, in one crawlable list, one hop from the homepage.
 *
 * It is also a genuinely useful page for a human: "show me every place you
 * cover" is a reasonable thing to want from a rental site, and a renter who
 * does not know which division Cox's Bazar is in can just scan for the name.
 *
 * The links point at `/properties/:slug` — the listing route that already
 * exists — so nothing here is a parallel universe of duplicate URLs.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, ArrowRight } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { DIVISIONS } from '../../data/bdGeo';
import {
  divisionSeo, districtSeo, districtPath, ALL_DISTRICTS, PRIORITY_DISTRICTS,
} from '../../seo/locationSeo';
import { FEATURE_PAGES } from '../../seo/featurePages';
import useSeo from '../../seo/useSeo';
import { breadcrumbSchema, faqSchema, webPageSchema } from '../../seo/schema';
import { toKeywordString, RENT_KEYWORDS } from '../../seo/keywords';
import Footer from '../Footer';

const TITLE = 'সারা বাংলাদেশে টু-লেট — To-Let & House Rent in All 64 Districts';

const DESCRIPTION =
  'বাংলাদেশের ৮ বিভাগ ও ৬৪ জেলার বাসা ভাড়া, ফ্ল্যাট, রুম, সিট, মেস ও সাবলেটের '
  + 'টু-লেট বিজ্ঞাপন — জেলা ধরে খুঁজুন। Browse to-let listings across all 8 divisions '
  + 'and 64 districts of Bangladesh: flats, rooms, mess seats, bachelor and family '
  + 'houses, with photos, rent and direct landlord contact.';

const HUB_FAQ = [
  {
    q: 'TO-LET PRO কোন কোন জেলায় আছে? (Which districts does TO-LET PRO cover?)',
    a: 'বাংলাদেশের ৮টি বিভাগ ও ৬৪টি জেলার জন্যই আলাদা তালিকা আছে — ঢাকা, চট্টগ্রাম, '
      + 'সিলেট, রাজশাহী, খুলনা, বরিশাল, রংপুর ও ময়মনসিংহ বিভাগের প্রতিটি জেলা। '
      + 'বিজ্ঞাপনের সংখ্যা এলাকাভেদে আলাদা, তবে যেকোনো জেলায় বাড়িওয়ালা ফ্রিতে বিজ্ঞাপন দিতে পারেন।',
  },
  {
    q: 'বাসা খুঁজতে কি টাকা লাগে? (Does it cost anything to search?)',
    a: 'না। বাসা খোঁজা, ছবি দেখা, ফিল্টার করা ও বাড়িওয়ালার সাথে যোগাযোগ — সবই ফ্রি, '
      + 'কোনো দালাল বা মধ্যস্থতাকারী নেই।',
  },
  {
    q: 'ব্যাচেলর, ফ্যামিলি ও মেস — আলাদা করে খোঁজা যায়? (Can I filter bachelor, family and mess separately?)',
    a: 'যায়। প্রতিটি জেলার তালিকায় ক্যাটাগরি ফিল্টার আছে — ফ্যামিলি, ব্যাচেলর, সাবলেট, '
      + 'মেস/সিট ও কমার্শিয়াল আলাদা করে দেখা যায়, সাথে ভাড়ার সীমা ও রুম সংখ্যার ফিল্টার।',
  },
];

const ToLetHub = () => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  useSeo({
    title: TITLE,
    appendBrand: true,
    description: DESCRIPTION,
    keywords: toKeywordString(RENT_KEYWORDS),
    canonical: '/to-let',
    jsonLd: [
      webPageSchema({ name: TITLE, description: DESCRIPTION, url: '/to-let' }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'To-Let', path: '/to-let' },
      ]),
      faqSchema(HUB_FAQ),
    ],
  });

  const popular = PRIORITY_DISTRICTS
    .map((id) => districtSeo(id))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#ba0036] selection:text-white">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#ba0036] via-[#a1002f] to-[#3a0011] text-white">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-12 md:pb-16">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center gap-2 text-[11px] font-bold text-rose-200/80">
              <li><Link to="/" className="hover:text-white">{bn ? 'হোম' : 'Home'}</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-white/90">{bn ? 'টু-লেট' : 'To-Let'}</li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-3xl">
            {bn ? 'সারা বাংলাদেশে বাসা ভাড়া ও টু-লেট' : 'To-let and house rent across Bangladesh'}
          </h1>
          <p className="mt-2 text-base md:text-xl font-bold text-white/70">
            {bn ? 'To-let and house rent across Bangladesh' : 'সারা বাংলাদেশে বাসা ভাড়া ও টু-লেট'}
          </p>
          <p className="mt-5 text-sm md:text-lg font-medium text-white/85 leading-relaxed max-w-2xl">
            {bn
              ? '৮ বিভাগ, ৬৪ জেলা — আপনার জেলা বেছে নিয়ে ফ্ল্যাট, রুম, সিট, মেস, সাবলেট বা '
                + 'ফ্যামিলি বাসার টু-লেট বিজ্ঞাপন দেখুন। ছবি, ভাড়া ও বাড়িওয়ালার সাথে সরাসরি যোগাযোগ — দালাল ছাড়াই।'
              : 'Eight divisions, sixty-four districts. Pick yours to see flats, rooms, '
                + 'mess seats, sublets and family houses to rent — with photos, monthly '
                + 'rent and a direct line to the landlord, no broker in between.'}
          </p>

          <Link
            to="/properties/all"
            className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#ba0036] font-black text-sm hover:bg-rose-50 active:scale-95 transition-all shadow-lg"
          >
            <Search size={16} /> {bn ? 'সব বিজ্ঞাপন দেখুন' : 'Browse all listings'}
          </Link>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-16">
        {/* ── Popular districts ────────────────────────────────────────── */}
        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-6">
            {bn ? 'জনপ্রিয় শহর ও জেলা' : 'Popular cities & districts'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {popular.map((d) => (
              <Link
                key={d.id}
                to={d.path}
                className="group p-4 rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] hover:border-[#ba0036]/30 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-2 text-[#ba0036] mb-1.5">
                  <MapPin size={14} strokeWidth={2.6} />
                  <span className="text-[13px] font-black text-gray-900 group-hover:text-[#ba0036] transition-colors">
                    {bn ? d.bn : d.en}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-gray-400">
                  {bn ? `${d.en} বাসা ভাড়া` : `${d.bn} — house rent`}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Every division, with its districts ───────────────────────── */}
        <section aria-labelledby="all-heading" className="mt-14 md:mt-20">
          <h2 id="all-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-2">
            {bn ? 'সব বিভাগ ও জেলা' : 'All divisions & districts'}
          </h2>
          <p className="text-sm font-bold text-gray-500 mb-8">
            {bn ? '৮ বিভাগ · ৬৪ জেলা' : '8 divisions · 64 districts'}
          </p>

          <div className="space-y-8">
            {DIVISIONS.map((div) => {
              const divSeo = divisionSeo(div.id);
              const districts = ALL_DISTRICTS.filter((d) => d.divisionId === div.id);
              return (
                <div key={div.id}>
                  <h3 className="text-base md:text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
                    <Link to={divSeo.path} className="hover:text-[#ba0036] transition-colors">
                      {bn ? `${div.bn} বিভাগ` : `${div.en} Division`}
                    </Link>
                    <ArrowRight size={14} className="text-gray-300" />
                    <span className="text-[11px] font-bold text-gray-400">
                      {bn ? `${districts.length} জেলা` : `${districts.length} districts`}
                    </span>
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {districts.map((d) => (
                      <li key={d.id}>
                        <Link
                          to={districtPath(d.id)}
                          className="inline-block px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                          title={bn ? `${d.en} বাসা ভাড়া` : `House rent in ${d.en}`}
                        >
                          {bn ? d.bn : d.en}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="hub-faq-heading" className="mt-14 md:mt-20">
          <h2 id="hub-faq-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-8">
            {bn ? 'সাধারণ প্রশ্ন' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {HUB_FAQ.map((item, i) => (
              <details key={i} className="group rounded-2xl border border-gray-100 bg-white p-5" open={i === 0}>
                <summary className="cursor-pointer list-none text-sm md:text-base font-black text-gray-900 flex items-start justify-between gap-4">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-[#ba0036] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-[13px] md:text-sm font-medium text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── The other half of the app ────────────────────────────────── */}
        <section aria-labelledby="tools-heading" className="mt-14 md:mt-20">
          <h2 id="tools-heading" className="text-lg font-black tracking-tight mb-4">
            {bn ? 'বাসা পাওয়ার পরেও কাজে লাগে' : 'Useful after you move in'}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {FEATURE_PAGES.map((p) => (
              <Link
                key={p.slug}
                to={p.slug}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
              >
                {bn ? p.h1.bn : p.h1.en}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ToLetHub;
