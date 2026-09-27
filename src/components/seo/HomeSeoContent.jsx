/**
 * HomeSeoContent.jsx — "so what actually is this?"
 * ─────────────────────────────────────────────────────────────────────────────
 * Copy lives in src/seo/homeContent.js so the prerender script can emit the
 * same words. This file is only presentation.
 *
 * ── Two variants, three placements ──
 *
 *   variant="full"     Desktop homepage (inside HeroSection) and /how-it-works.
 *                      Pillars + the long story (collapsed) + the free card.
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
 * ── Video explains, text points ──
 * People watch; they don't read. Each pillar card carries ONE line — the
 * problem the reader already has — and an explainer video an admin attaches
 * in the AI Video Guides manager (placements feature_search / feature_mess /
 * feature_rent_book). A card without a video still works: it just has none,
 * and if a sibling has one it gets a branded panel so the row stays aligned.
 *
 * The long story (~900 words) is folded into a <details> the reader opens by
 * choice: nobody is made to scroll past it, and it stays in the DOM, so it is
 * still indexed — /how-it-works renders it at every width, and that is the
 * page Google actually indexes it from. (The desktop homepage copy sits inside
 * `hidden md:flex`, so it is display:none at the ~375px viewport Google crawls
 * with and cannot duplicate /how-it-works in the index.)
 *
 * The nudges are honest ones: name a pain the reader recognises, say who each
 * thing is for, let them watch before they commit, and let them choose to read
 * more. No invented numbers, countdowns or guilt-trip buttons.
 *
 * ── The grey second-language line (`echo`) ──
 * On the desktop website nobody read the grey copy of every line in the other
 * language, so it was dropped there. The app and the phone homepage keep it —
 * asked for explicitly. scripts/prerender-seo.mjs emits both languages for
 * crawlers either way.
 *
 * ── Bangla is never letter-spaced ──
 * `tracking-*` pulls the parts of a Bangla word apart (টু-লেট rendered as
 * "টু - লে ট"). Tracking and uppercase are applied to English only.
 *
 * ── Dark mode ──
 * index.css retrofits dark mode by remapping specific utilities (bg-white,
 * bg-gray-50, text-gray-*, border-gray-*, text-[#ba0036]) with !important.
 * Stick to those, and to translucent brand tints, or a surface stays light.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, UtensilsCrossed, NotebookPen, Check, ArrowRight, ArrowUpRight, Wallet,
  ChevronRight, MapPin, ShieldCheck, BadgeCheck,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { isNativeApp } from '../../utils/nativeExperience';
import {
  useExplainerVideos, ExplainerVideo, ReadMoreFold, Eyebrow,
} from '../shared/Explainer';
import {
  PILLARS, FREE_LIST, BODY_SECTIONS, POPULAR_LINKS,
} from '../../seo/homeContent';

/** homeContent.js keeps icons as strings so Node build scripts can read it. */
const ICONS = { search: Search, utensils: UtensilsCrossed, notebook: NotebookPen };

/** Split so the payoff phrase can carry the brand colour. */
const HEADLINE = {
  bn: { lead: 'বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব —', accent: 'তিনটাই এক অ্যাপে।' },
  en: { lead: 'House rent, property management and mess accounts —', accent: 'all in one app.' },
};

const INTRO = {
  bn: 'বাসা খোঁজা থেকে মাস শেষের হিসাব পর্যন্ত — ভাড়াটিয়া, বাড়িওয়ালা আর মেসের সবার '
    + 'জন্য একটাই অ্যাকাউন্ট। আলাদা আলাদা অ্যাপ নামানোর দরকার নেই।',
  en: 'From finding a place to settling the month’s accounts — one account for '
    + 'tenants, landlords and everyone in the mess. No second app to install.',
};

/** Only claims the pillar copy already makes. */
const HIGHLIGHTS = [
  { Icon: MapPin, bn: '৬৪ জেলা', en: 'All 64 districts' },
  { Icon: ShieldCheck, bn: 'দালাল ছাড়া', en: 'No brokers' },
  { Icon: BadgeCheck, bn: 'মেসের হিসাব ফ্রি', en: 'Free mess accounts' },
];

const SECTION_NO = { bn: ['০১', '০২', '০৩', '০৪'], en: ['01', '02', '03', '04'] };

/** Faint dot grid fading out from the top — texture without a picture. */
const DOT_GRID = {
  backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.07) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
  WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, #000 30%, transparent 75%)',
  maskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, #000 30%, transparent 75%)',
};

const HomeSeoContent = ({ variant = 'full' }) => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const L = (o) => (bn ? o.bn : o.en);
  const other = (o) => (bn ? o.en : o.bn);
  const compact = variant === 'compact';
  const echo = compact || isNativeApp();
  const headline = L(HEADLINE);
  const otherHeadline = other(HEADLINE);

  const videos = useExplainerVideos(PILLARS.map((p) => p.video));
  const anyVideo = videos.some(Boolean);
  const watchLabel = bn ? 'ভিডিওতে দেখুন' : 'Watch the video';

  return (
    <section
      aria-labelledby="what-is-toletpro"
      className={`relative w-full overflow-hidden bg-gray-50 ${compact ? '' : 'border-t border-gray-100'}`}
    >
      {/* safe-area-ok — pinned to the top of this section, not the screen: it
          sits below the whole homepage, is desktop-only (compact never renders
          it) and is a non-interactive background texture. */}
      {!compact && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px]">
          <div className="absolute inset-0" style={DOT_GRID} />
          <div className="absolute -top-48 right-[-6%] w-[560px] h-[560px] rounded-full bg-[#ba0036]/[0.06] blur-[120px]" />
        </div>
      )}

      {/* pb-28 on the compact variant clears the fixed MobileBottomNav.
          MobileHome carries its own pb-28 for exactly this reason, but this
          section renders AFTER it and so sits outside that padding — which
          left the last element of the page (the "read the full story" button)
          under the nav bar: half hidden and not clickable, with no scroll left
          to reveal it. Measured: button 734–776px, nav top at 748px. */}
      <div className={`relative max-w-[1400px] mx-auto px-4 md:px-8 ${compact ? 'pt-8 pb-28' : 'py-16 md:py-24'}`}>

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <div className={compact ? '' : 'grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 lg:gap-16 lg:items-end'}>
          <div>
            <Eyebrow bn={bn} size={compact ? 'sm' : 'md'} className={compact ? 'mb-3' : 'mb-5'}>
              {bn ? 'কেন টু-লেট প্রো' : 'Why TO-LET PRO'}
            </Eyebrow>
            <h2
              id="what-is-toletpro"
              className={`font-black text-gray-900 ${bn ? 'leading-[1.35]' : 'tracking-tight leading-[1.12]'} ${
                compact ? 'text-[21px]' : 'text-[28px] md:text-[36px] lg:text-[40px] xl:text-[46px]'
              }`}
            >
              {headline.lead}{' '}
              <span className={`text-[#ba0036] ${compact ? '' : 'lg:block'}`}>{headline.accent}</span>
            </h2>
            {echo && (
              <p className={`font-semibold text-gray-400 leading-relaxed ${compact ? 'mt-2 text-[12px]' : 'mt-3 text-base md:text-lg'}`}>
                {otherHeadline.lead} {otherHeadline.accent}
              </p>
            )}
          </div>

          {!compact && (
            <div className="lg:pb-2">
              <p className={`text-[15px] md:text-base text-gray-500 ${bn ? 'leading-[1.85]' : 'leading-relaxed'}`}>
                {L(INTRO)}
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {HIGHLIGHTS.map(({ Icon, ...label }) => (
                  <li
                    key={label.en}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <Icon size={13} strokeWidth={2.4} className="text-[#ba0036]" />
                    {L(label)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Three pillars ────────────────────────────────────────────── */}
        {/* Each card is a stretched link (the title's ::after covers the card)
            with the video button stacked above it, so the whole card still
            opens the page while the preview plays the video — without putting
            a button inside an <a>. */}
        {compact ? (
          // One grouped list, like a native settings screen, rather than three
          // floating cards.
          <ul className="mt-5 overflow-hidden rounded-3xl border border-gray-100 bg-white divide-y divide-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {PILLARS.map((p, i) => {
              const Icon = ICONS[p.icon] || Search;
              const video = videos[i];
              return (
                <li key={p.to} className="relative flex items-start gap-3.5 p-4 active:bg-[#ba0036]/[0.04] transition-colors">
                  {video ? (
                    <ExplainerVideo guide={video} variant="row" bn={bn} label={`${watchLabel}: ${L(p).t}`} />
                  ) : (
                    <span className="w-11 h-11 shrink-0 rounded-2xl bg-[#ba0036]/[0.07] ring-1 ring-inset ring-[#ba0036]/10 text-[#ba0036] flex items-center justify-center">
                      <Icon size={19} strokeWidth={2.2} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={p.to}
                      className="block text-[15px] font-black text-gray-900 leading-snug after:absolute after:inset-0"
                    >
                      {L(p).t}
                    </Link>
                    {echo && <p className="text-[11px] font-semibold text-gray-400">{other(p).t}</p>}
                    <p className="mt-1.5 text-[12.5px] text-gray-500 leading-[1.7]">{L(p).hook}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[#ba0036]">
                      {L(p).cta}
                      <ChevronRight size={14} strokeWidth={2.6} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-12 md:mt-14 grid md:grid-cols-3 gap-4 lg:gap-6">
            {PILLARS.map((p, i) => {
              const Icon = ICONS[p.icon] || Search;
              const video = videos[i];
              return (
                <article
                  key={p.to}
                  className="group relative flex flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:border-[#ba0036]/20 hover:shadow-[0_24px_60px_-24px_rgba(186,0,54,0.3)] transition-all duration-300"
                >
                  {video && (
                    <ExplainerVideo guide={video} bn={bn} label={`${watchLabel}: ${L(p).t}`} chip={watchLabel} />
                  )}
                  {/* A sibling has a video and this one doesn't: a branded
                      panel of the same shape keeps the three rows aligned. */}
                  {!video && anyVideo && (
                    <div aria-hidden="true" className="relative aspect-video w-full bg-gradient-to-br from-[#ba0036]/[0.09] to-[#ba0036]/[0.02] flex items-center justify-center">
                      <Icon size={44} strokeWidth={1.6} className="text-[#ba0036]/40" />
                    </div>
                  )}

                  <div className="relative flex flex-1 flex-col p-6 lg:p-7">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[#ba0036]/[0.08] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-[#ba0036]/[0.07] ring-1 ring-inset ring-[#ba0036]/10 text-[#ba0036] flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <Icon size={22} strokeWidth={2.1} />
                      </span>
                      <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                        {L(p).audience}
                      </span>
                    </div>

                    <h3 className={`mt-6 text-xl font-black text-gray-900 ${bn ? 'leading-snug' : 'tracking-tight leading-tight'}`}>
                      <Link to={p.to} className="after:absolute after:inset-0">{L(p).t}</Link>
                    </h3>
                    {echo && <p className="mt-0.5 text-[12px] font-semibold text-gray-400">{other(p).t}</p>}
                    <p className={`mt-2.5 text-[15px] text-gray-600 ${bn ? 'leading-[1.75]' : 'leading-relaxed'}`}>
                      {L(p).hook}
                    </p>

                    {/* mt-auto pins the CTA row to the bottom, so the three line
                        up however long each line runs. */}
                    <div className="mt-auto pt-7">
                      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
                        <span className="text-[13px] font-bold text-[#ba0036]">{L(p).cta}</span>
                        <span className="w-9 h-9 shrink-0 rounded-full bg-[#ba0036]/[0.07] text-[#ba0036] flex items-center justify-center group-hover:bg-[#ba0036]/[0.14] transition-colors">
                          <ArrowUpRight size={16} strokeWidth={2.4} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── The long story + the free card — full variant only ───────── */}
        {!compact && (
          <div className="mt-16 md:mt-20 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-10 items-start">
            <ReadMoreFold
              bn={bn}
              title={bn ? 'পুরো গল্পটা পড়ুন — কেন তিনটা কাজ এক অ্যাপে' : 'Read the whole story — why all three live in one app'}
            >
              <div className="max-w-2xl">
                {BODY_SECTIONS.map((sec, i) => (
                  <article key={i} className={i > 0 ? 'mt-12 pt-12 border-t border-gray-100' : ''}>
                    <p className="mb-2 text-[13px] font-bold text-[#ba0036] tabular-nums">{L(SECTION_NO)[i]}</p>
                    <h3 className={`text-2xl md:text-[28px] font-black text-gray-900 ${bn ? 'leading-[1.35]' : 'tracking-tight leading-tight'}`}>
                      {L(sec.h2)}
                    </h3>
                    {echo && <p className="mt-1 text-[13px] font-semibold text-gray-400">{other(sec.h2)}</p>}
                    <div className="mt-5 space-y-4">
                      {sec.paragraphs.map((para, j) => (
                        <div key={j}>
                          <p className={`text-[15px] md:text-base text-gray-600 ${bn ? 'leading-[1.9]' : 'leading-[1.75]'}`}>
                            {L(para)}
                          </p>
                          {echo && (
                            <p className="mt-2 text-[13px] text-gray-400 leading-[1.75]">{other(para)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </ReadMoreFold>

            {/* Free/paid card. Competing mess apps bury the paid tier behind a
                trial; saying exactly what is free is what earns the click. */}
            <aside className="lg:sticky lg:top-24 rounded-[28px] border border-emerald-200 bg-white p-6 md:p-7 shadow-[0_24px_60px_-32px_rgba(5,150,105,0.35)]">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <BadgeCheck size={19} strokeWidth={2.3} />
                </span>
                <div>
                  <p className="text-[15px] font-black text-gray-900">
                    {bn ? 'যা সবসময় ফ্রি' : 'Always free'}
                  </p>
                  <p className="text-[12px] text-gray-500">
                    {bn ? 'ছাত্র ও ভাড়াটিয়াদের কাছ থেকে কিছু নিই না' : 'We never charge students or tenants'}
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                {L(FREE_LIST).map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13.5px] font-semibold text-gray-700 leading-snug">
                    <span className="mt-px w-[18px] h-[18px] shrink-0 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
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
          className={compact ? 'mt-7' : 'mt-16 pt-10 border-t border-gray-100'}
        >
          <h3 className="text-[13px] font-black text-gray-900 mb-3">
            {bn ? 'জনপ্রিয় পাতা' : 'Popular pages'}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {POPULAR_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-block px-3.5 py-2 rounded-full border border-gray-200 bg-white text-[12px] font-semibold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
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
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gray-900 text-white font-black text-[13px] active:scale-95 transition-all"
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
