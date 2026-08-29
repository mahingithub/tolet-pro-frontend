/**
 * HomeSeoContent.jsx — "so what actually is this?" on the homepage.
 * ─────────────────────────────────────────────────────────────────────────────
 * The brand is called TO-LET PRO, so every visitor arrives assuming it is a
 * listings board and leaves with that assumption intact. The meal manager, the
 * roommate wallet and the digital ভাড়ার খাতা are the parts nobody else in
 * Bangladesh offers alongside listings — and they were completely invisible to
 * anyone who had not signed up.
 *
 * This block sits above the homepage footer and does two things at once:
 *
 *   1. FOR THE VISITOR — answers the question the hero cannot: is this just
 *      another to-let site, or does it do more? Three named pillars, in plain
 *      language, each linking to its own page.
 *   2. FOR SEARCH — gives the homepage ~800 words of real body copy. Before
 *      this, the homepage was a search box, a carousel and a footer: almost no
 *      indexable text, which is why it could only ever rank for the brand name
 *      itself. The competing sites all publish long Bangla explainers.
 *
 * Bilingual by design, not by duplication: a renter here searches in Bangla,
 * English and Banglish within one session, and both languages are visible text
 * — the second one smaller, never hidden.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, UtensilsCrossed, NotebookPen, Check, ArrowRight, Wallet,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';

/** The three pillars. Order matters: listings first, because that is what they came for. */
const PILLARS = [
  {
    icon: Search,
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
    icon: UtensilsCrossed,
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
    icon: NotebookPen,
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

const FREE_LIST = {
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

const HomeSeoContent = () => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const L = (o) => (bn ? o.bn : o.en);
  const other = (o) => (bn ? o.en : o.bn);

  /** Body paragraph pair: reader's language, then the other, smaller. */
  const Para = ({ copy }) => (
    <div className="mb-5">
      <p className="text-[14px] md:text-[15px] font-medium text-gray-700 leading-[1.85]">
        {L(copy)}
      </p>
      <p className="mt-2 text-[12px] md:text-[13px] font-medium text-gray-400 leading-[1.75]">
        {other(copy)}
      </p>
    </div>
  );

  return (
    <section
      aria-labelledby="what-is-toletpro"
      className="w-full bg-white border-t border-gray-100"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-14 md:py-20">

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ba0036] mb-3">
            {bn ? 'টু-লেট প্রো কী' : 'What TO-LET PRO is'}
          </p>
          <h2
            id="what-is-toletpro"
            className="text-2xl md:text-4xl font-black tracking-tight text-gray-900 leading-[1.15]"
          >
            {bn
              ? 'বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব — তিনটাই এক অ্যাপে'
              : 'House rent, property management and mess accounts — all in one app'}
          </h2>
          <p className="mt-2 text-base md:text-lg font-bold text-gray-400">
            {bn
              ? 'House rent, property management and mess accounts — all in one app'
              : 'বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব — তিনটাই এক অ্যাপে'}
          </p>
        </div>

        {/* ── Three pillars ────────────────────────────────────────────── */}
        <div className="mt-10 grid md:grid-cols-3 gap-4 md:gap-5">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.to}
                to={p.to}
                className="group p-6 md:p-7 rounded-3xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-[#ba0036]/25 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#ba0036] text-white flex items-center justify-center mb-5 shadow-[0_8px_20px_rgba(186,0,54,0.25)]">
                  <Icon size={22} strokeWidth={2.3} />
                </div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">
                  {L(p).t}
                </h3>
                <p className="text-[11px] font-bold text-gray-400 mt-0.5">{other(p).t}</p>
                <p className="mt-3 text-[13px] font-medium text-gray-600 leading-relaxed">
                  {L(p).d}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-black text-[#ba0036]">
                  {L(p).cta}
                  <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── The body copy ────────────────────────────────────────────── */}
        <div className="mt-14 md:mt-20 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-16 items-start">
          <div className="max-w-3xl">

            <h3 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 mb-1">
              {bn ? 'কেন সব আলাদা আলাদা অ্যাপে?' : 'Why is all of this in separate apps?'}
            </h3>
            <p className="text-[12px] font-bold text-gray-400 mb-5">
              {bn ? 'Why is all of this in separate apps?' : 'কেন সব আলাদা আলাদা অ্যাপে?'}
            </p>

            <Para copy={{
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
            }} />

            <Para copy={{
              bn: 'একই বাসা, একই মানুষগুলো, একই টাকা — অথচ চারটা আলাদা জায়গায়। '
                + 'বাংলাদেশে এখন যা আছে সবই এক-একটা টুকরো: টু-লেট সাইটগুলো বাসা খুঁজে '
                + 'দিয়েই কাজ শেষ মনে করে, মেস অ্যাপগুলো বাসা খুঁজে দিতে পারে না, আর '
                + 'বাড়িওয়ালাদের সফটওয়্যার ভাড়াটিয়ার জীবনের কিছুই জানে না।',
              en: 'The same house, the same people, the same money — kept in four different '
                + 'places. Everything available here today is a single piece of the '
                + 'problem: listing sites consider the job done once you have the keys, '
                + 'mess apps cannot find you a room, and landlord software knows nothing '
                + 'about the people actually living there.',
            }} />

            <Para copy={{
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
            }} />

            <h3 className="mt-10 text-xl md:text-2xl font-black tracking-tight text-gray-900 mb-1">
              {bn ? 'ছাত্র ও ব্যাচেলরদের জন্য কেন আলাদা' : 'Why students and bachelors get the most out of it'}
            </h3>
            <p className="text-[12px] font-bold text-gray-400 mb-5">
              {bn ? 'Why students and bachelors get the most out of it' : 'ছাত্র ও ব্যাচেলরদের জন্য কেন আলাদা'}
            </p>

            <Para copy={{
              bn: 'ঢাকায় "ব্যাচেলর ভাড়া হবে না" কথাটা যারা শুনেছেন, তারা জানেন সিট বা '
                + 'সাবলেট খোঁজা কতটা কঠিন। তাই এখানে ফ্যামিলি, ব্যাচেলর, সাবলেট, মেস ও '
                + 'সিট আলাদা ক্যাটাগরিতে রাখা — ব্যাচেলর ফিল্টার দিলে শুধু সেই বাসাগুলোই '
                + 'দেখা যায় যেগুলোতে ব্যাচেলর উঠতে পারবেন, প্রতিটা বিজ্ঞাপনে ফোন করে '
                + 'জিজ্ঞেস করতে হয় না।',
              en: 'Anyone who has been told "no bachelors" in Dhaka knows how hard finding a '
                + 'seat or a sublet can be. So family, bachelor, sublet, mess and seat are '
                + 'separate categories here — filter to bachelor and you only see places '
                + 'that will actually take you, instead of ringing every ad to ask.',
            }} />

            <Para copy={{
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
            }} />

            <h3 className="mt-10 text-xl md:text-2xl font-black tracking-tight text-gray-900 mb-1">
              {bn ? 'বাড়িওয়ালাদের জন্য' : 'For landlords'}
            </h3>
            <p className="text-[12px] font-bold text-gray-400 mb-5">
              {bn ? 'For landlords' : 'বাড়িওয়ালাদের জন্য'}
            </p>

            <Para copy={{
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
            }} />

            <Para copy={{
              bn: 'বিজ্ঞাপন দেওয়া ও বেসিক ব্যবহার ফ্রি। ভাড়া কালেকশন, একাধিক বিজ্ঞাপন, '
                + 'সার্চ বুস্ট, স্মার্ট অ্যালার্ট ও অ্যানালিটিক্সের মতো ফিচারগুলো Plus ও Pro '
                + 'প্ল্যানে — কারণ আমাদের আয়ের জায়গা সেটাই, ভাড়াটিয়ার পকেট নয়।',
              en: 'Listing and basic use are free. Rent collection, multiple listings, '
                + 'search boost, smart alerts and analytics sit on the Plus and Pro plans — '
                + 'because that is where our revenue comes from, rather than from tenants.',
            }} />
          </div>

          {/* ── Free/paid card ─────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-24 p-6 md:p-7 rounded-3xl border-2 border-emerald-200 bg-emerald-50/50">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 mb-1">
              {bn ? 'যা সবসময় ফ্রি' : 'Always free'}
            </p>
            <p className="text-[11px] font-bold text-emerald-600/70 mb-4">
              {bn ? 'Always free' : 'যা সবসময় ফ্রি'}
            </p>
            <ul className="space-y-3">
              {L(FREE_LIST).map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] font-bold text-gray-700 leading-snug">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/meal-manager"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#ba0036] text-white font-black text-[13px] hover:bg-[#a1002f] active:scale-95 transition-all"
            >
              <Wallet size={15} /> {bn ? 'ফ্রি টুলগুলো দেখুন' : 'See the free tools'}
            </Link>
          </aside>
        </div>

        {/* ── Internal links out ───────────────────────────────────────── */}
        <nav aria-label={bn ? 'জনপ্রিয় পাতা' : 'Popular pages'} className="mt-12 pt-8 border-t border-gray-100">
          <h3 className="text-[13px] font-black text-gray-900 mb-3">
            {bn ? 'জনপ্রিয় পাতা' : 'Popular pages'}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {[
              { to: '/to-let', bn: 'সব জেলার টু-লেট', en: 'To-let in all districts' },
              { to: '/properties/dhaka', bn: 'ঢাকায় বাসা ভাড়া', en: 'House rent in Dhaka' },
              { to: '/properties/chittagong', bn: 'চট্টগ্রামে বাসা ভাড়া', en: 'House rent in Chattogram' },
              { to: '/meal-manager', bn: 'মিল ম্যানেজার', en: 'Meal manager' },
              { to: '/roommate-wallet', bn: 'রুমমেট ওয়ালেট', en: 'Roommate wallet' },
              { to: '/tenant-manager', bn: 'ভাড়ার খাতা', en: 'Rent book' },
              { to: '/house-manager', bn: 'হাউস ম্যানেজার', en: 'House manager' },
              { to: '/home-services', bn: 'হোম সার্ভিস', en: 'Home services' },
              { to: '/how-it-works', bn: 'কিভাবে কাজ করে', en: 'How it works' },
            ].map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-block px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                >
                  {bn ? l.bn : l.en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
};

export default HomeSeoContent;
