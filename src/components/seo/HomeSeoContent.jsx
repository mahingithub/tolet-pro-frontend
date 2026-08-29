/**
 * HomeSeoContent.jsx — "so what actually is this?"
 * ─────────────────────────────────────────────────────────────────────────────
 * Copy lives in src/seo/homeContent.js so the prerender script can emit the
 * same words. This file is only presentation.
 *
 * ── Two variants, three placements ──
 *
 *   variant="full"     Desktop homepage (inside HeroSection) and /how-it-works.
 *                      Pillars + ~900 words of body copy + the free/paid card.
 *
 *   variant="compact"  Mobile homepage, under the property feed. Pillars and
 *                      the links row ONLY — no long prose.
 *
 * Why compact on mobile: a wall of explanatory text directly beneath a feed of
 * property cards reads as an ad break in the middle of browsing. The three
 * pillars answer "does this do more than listings?" in one glance, which is
 * the whole job on that surface, and they still carry the internal links a
 * mobile-first crawler needs.
 *
 * The long version is not lost — /how-it-works renders it in full at every
 * width, and that is the page Google actually indexes it from. (The desktop
 * homepage copy sits inside `hidden md:flex`, so it is display:none at the
 * ~375px viewport Google crawls with: it is a pure UX choice, and it cannot
 * duplicate /how-it-works in the index because a crawler never sees both.)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, UtensilsCrossed, NotebookPen, Check, ArrowRight, Wallet,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import {
  PILLARS, FREE_LIST, BODY_SECTIONS, POPULAR_LINKS,
} from '../../seo/homeContent';

/** homeContent.js keeps icons as strings so Node build scripts can read it. */
const ICONS = { search: Search, utensils: UtensilsCrossed, notebook: NotebookPen };

const HomeSeoContent = ({ variant = 'full' }) => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const L = (o) => (bn ? o.bn : o.en);
  const other = (o) => (bn ? o.en : o.bn);
  const compact = variant === 'compact';

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
      className={`w-full bg-white border-t border-gray-100 ${compact ? '' : ''}`}
    >
      {/* pb-28 on the compact variant clears the fixed MobileBottomNav.
          MobileHome carries its own pb-28 for exactly this reason, but this
          section renders AFTER it and so sits outside that padding — which
          left the last element of the page (the "read the full story" button)
          under the nav bar: half hidden and not clickable, with no scroll left
          to reveal it. Measured: button 734–776px, nav top at 748px. */}
      <div className={`max-w-[1400px] mx-auto px-4 md:px-8 ${compact ? 'pt-9 pb-28' : 'py-14 md:py-20'}`}>

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <div className="max-w-3xl">
          <p className={`font-black uppercase tracking-[0.2em] text-[#ba0036] mb-2 ${compact ? 'text-[10px]' : 'text-[11px] mb-3'}`}>
            {bn ? 'টু-লেট প্রো কী' : 'What TO-LET PRO is'}
          </p>
          <h2
            id="what-is-toletpro"
            className={`font-black tracking-tight text-gray-900 leading-[1.2] ${
              compact ? 'text-[19px]' : 'text-2xl md:text-4xl leading-[1.15]'
            }`}
          >
            {bn
              ? 'বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব — তিনটাই এক অ্যাপে'
              : 'House rent, property management and mess accounts — all in one app'}
          </h2>
          <p className={`mt-1.5 font-bold text-gray-400 ${compact ? 'text-[11px]' : 'mt-2 text-base md:text-lg'}`}>
            {bn
              ? 'House rent, property management and mess accounts — all in one app'
              : 'বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব — তিনটাই এক অ্যাপে'}
          </p>
        </div>

        {/* ── Three pillars ────────────────────────────────────────────── */}
        <div className={`grid md:grid-cols-3 ${compact ? 'mt-5 gap-2.5' : 'mt-10 gap-4 md:gap-5'}`}>
          {PILLARS.map((p) => {
            const Icon = ICONS[p.icon] || Search;
            return (
              <Link
                key={p.to}
                to={p.to}
                className={`group rounded-3xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-[#ba0036]/25 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all ${
                  compact ? 'p-4 flex items-start gap-3.5' : 'p-6 md:p-7'
                }`}
              >
                <div
                  className={`rounded-2xl bg-[#ba0036] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(186,0,54,0.25)] shrink-0 ${
                    compact ? 'w-10 h-10' : 'w-12 h-12 mb-5'
                  }`}
                >
                  <Icon size={compact ? 18 : 22} strokeWidth={2.3} />
                </div>

                <div className="min-w-0">
                  <h3 className={`font-black text-gray-900 leading-tight ${compact ? 'text-[14px]' : 'text-lg'}`}>
                    {L(p).t}
                  </h3>
                  <p className={`font-bold text-gray-400 mt-0.5 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {other(p).t}
                  </p>
                  <p className={`font-medium text-gray-600 leading-relaxed ${compact ? 'mt-1.5 text-[12px]' : 'mt-3 text-[13px]'}`}>
                    {L(p).d}
                  </p>
                  <span className={`inline-flex items-center gap-1.5 font-black text-[#ba0036] ${compact ? 'mt-2 text-[11px]' : 'mt-4 text-[12px]'}`}>
                    {L(p).cta}
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── The body copy — full variant only ────────────────────────── */}
        {!compact && (
          <div className="mt-14 md:mt-20 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-16 items-start">
            <div className="max-w-3xl">
              {BODY_SECTIONS.map((sec, i) => (
                <div key={i} className={i > 0 ? 'mt-10' : ''}>
                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 mb-1">
                    {L(sec.h2)}
                  </h3>
                  <p className="text-[12px] font-bold text-gray-400 mb-5">{other(sec.h2)}</p>
                  {sec.paragraphs.map((para, j) => <Para key={j} copy={para} />)}
                </div>
              ))}
            </div>

            {/* Free/paid card. Competing mess apps bury the paid tier behind a
                trial; saying exactly what is free is what earns the click. */}
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
        )}

        {/* ── Internal links out ───────────────────────────────────────── */}
        <nav
          aria-label={bn ? 'জনপ্রিয় পাতা' : 'Popular pages'}
          className={compact ? 'mt-6 pt-5 border-t border-gray-100' : 'mt-12 pt-8 border-t border-gray-100'}
        >
          <h3 className="text-[13px] font-black text-gray-900 mb-3">
            {bn ? 'জনপ্রিয় পাতা' : 'Popular pages'}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {POPULAR_LINKS.map((l) => (
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

          {/* On mobile the long explanation is one tap away rather than inline. */}
          {compact && (
            <Link
              to="/how-it-works"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-900 text-white font-black text-[12px] active:scale-95 transition-all"
            >
              {bn ? 'বিস্তারিত জানুন' : 'Read the full story'}
              <ArrowRight size={14} />
            </Link>
          )}
        </nav>
      </div>
    </section>
  );
};

export default HomeSeoContent;
