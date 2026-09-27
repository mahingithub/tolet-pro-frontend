/**
 * FeatureLanding.jsx — one renderer for every feature landing page.
 * ─────────────────────────────────────────────────────────────────────────────
 * `/meal-manager`, `/roommate-wallet`, `/house-manager`, `/tenant-manager` and
 * `/home-services` all render through here, driven by src/seo/featurePages.js.
 * One component, five indexable pages, and no copy duplicated between the data
 * and the markup.
 *
 * Written for a signed-out visitor arriving cold from Google, so it explains
 * the feature before it asks for anything — and it explains with a VIDEO:
 *
 *   hero      the headline, ONE line naming the pain the visitor already has
 *             (`hook`), and the feature's explainer video beside it — watching
 *             is the first action, signing up the second. Until an admin
 *             attaches a video (AI Video Guides → page.video), the same slot
 *             shows the four steps, so the hero is never half-empty.
 *   glance    what you get, one line per feature.
 *   story     the long intro and sections, folded — opened by choice, and
 *             still in the DOM, so still indexed.
 *   pricing   what is free and what is not, stated plainly.
 *   faq       mirrors the FAQPage schema.
 *
 * Headings carry both languages under the H1 because that is how these terms
 * are actually searched — "মিল ম্যানেজার" and "meal manager" are the same
 * intent typed two ways. Elsewhere the second-language line is app-only (the
 * website dropped it; the app keeps it, as asked), except inside the folded
 * story, where the bilingual paragraphs are the search copy.
 */

import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import {
  UtensilsCrossed, ShoppingBasket, Calculator, Scale, PieChart, BellRing,
  Receipt, Split, Wallet, Activity, Building2, DoorOpen, Megaphone, FileText,
  Users, AlertTriangle, QrCode, ScanLine, Truck, Sparkles, Wrench, Wifi,
  ShieldCheck, ArrowRight, Check, Crown, BadgeCheck,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { isNativeApp } from '../../utils/nativeExperience';
import { featurePageFor } from '../../seo/featurePages';
import useSeo from '../../seo/useSeo';
import { breadcrumbSchema, faqSchema, serviceSchema } from '../../seo/schema';
import {
  useExplainerVideo, ExplainerVideo, ReadMoreFold, Eyebrow,
} from '../shared/Explainer';
import Footer from '../Footer';

/** featurePages.js stores icons as strings so Node build scripts can read it. */
const ICONS = {
  utensils: UtensilsCrossed, basket: ShoppingBasket, calculator: Calculator,
  scale: Scale, chart: PieChart, bell: BellRing, receipt: Receipt,
  split: Split, wallet: Wallet, activity: Activity, building: Building2,
  door: DoorOpen, megaphone: Megaphone, file: FileText, users: Users,
  alert: AlertTriangle, qr: QrCode, scan: ScanLine, truck: Truck,
  sparkles: Sparkles, wrench: Wrench, wifi: Wifi, shield: ShieldCheck,
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Faint white dot grid for the red hero — texture without a picture. */
const HERO_DOTS = {
  backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
  WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 70% 30%, #000 20%, transparent 75%)',
  maskImage: 'radial-gradient(ellipse 80% 90% at 70% 30%, #000 20%, transparent 75%)',
};

/** The steps — in the hero while there is no video, below it once there is. */
const StepList = ({ steps, bn, onDark = false }) => (
  <ol className="space-y-3">
    {steps.map((s, i) => (
      <li key={i} className="flex items-start gap-3.5">
        <span
          className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-[13px] font-black tabular-nums ${
            onDark ? 'bg-white text-[#ba0036]' : 'bg-[#ba0036] text-white'
          }`}
        >
          {bn ? String(i + 1).replace(/\d/g, (d) => BN_DIGITS[d]) : i + 1}
        </span>
        <p className={`pt-1 text-[14px] font-bold leading-snug ${onDark ? 'text-white' : 'text-gray-800'}`}>
          {bn ? s.bn : s.en}
        </p>
      </li>
    ))}
  </ol>
);

const FeatureLanding = () => {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const page = featurePageFor(pathname);
  const guide = useExplainerVideo(page?.video);
  const echo = isNativeApp();

  const L = (obj) => (bn ? obj.bn : obj.en);
  const other = (obj) => (bn ? obj.en : obj.bn);
  const num = (n) => (bn ? String(n).replace(/\d/g, (d) => BN_DIGITS[d]) : String(n));

  // Hooks run unconditionally — the unknown-slug bail-out below has to come
  // AFTER this call, not before it.
  useSeo(page ? {
    title: page.title,
    appendBrand: false, // these titles already carry the brand where it helps
    description: page.description,
    keywords: page.keywords,
    canonical: page.slug,
    jsonLd: [
      serviceSchema({
        name: page.title,
        description: page.description,
        url: page.slug,
        serviceType: page.serviceType,
      }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: L(page.h1), path: page.slug },
      ]),
      faqSchema(page.faq),
    ],
  } : { noindex: true });

  // An unknown slug bounces home rather than rendering an empty shell that
  // Google would happily index as a thin duplicate of the homepage.
  if (!page) return <Navigate to="/" replace />;

  const hook = page.hook ? L(page.hook) : L(page.intro);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#ba0036] selection:text-white">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#ba0036] via-[#a1002f] to-[#3a0011] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={HERO_DOTS} />
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        {/* Three children, one grid. On a phone they stack in reading order —
            pitch, video, buttons — so the video comes before the ask. On
            desktop the video spans both rows of the right column. */}
        <div className="relative max-w-[1200px] mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-14 md:pb-20 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto] lg:gap-x-14 lg:gap-y-8">
          <div className="lg:self-end">
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex items-center gap-2 text-[11px] font-bold text-rose-200/80">
                <li><Link to="/" className="hover:text-white">{bn ? 'হোম' : 'Home'}</Link></li>
                <li aria-hidden="true">/</li>
                <li className="text-white/90">{L(page.eyebrow)}</li>
              </ol>
            </nav>

            <Eyebrow bn={bn} tone="light" className="mb-4">{L(page.eyebrow)}</Eyebrow>
            <h1 className={`text-[32px] md:text-5xl font-black max-w-3xl ${bn ? 'leading-[1.3]' : 'leading-[1.08] tracking-tight'}`}>
              {L(page.h1)}
            </h1>
            {/* The other language sits right under the H1 — same meaning, and it
                is the only way this page is findable in both search vocabularies. */}
            <p className="mt-2 text-sm md:text-base font-bold text-white/60">
              {other(page.h1)}
            </p>
            <p className={`mt-5 text-lg md:text-xl font-semibold text-white/90 max-w-xl ${bn ? 'leading-[1.7]' : 'leading-relaxed'}`}>
              {hook}
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            {guide === undefined && (
              <div aria-hidden="true" className="aspect-video w-full rounded-[28px] bg-white/10 ring-1 ring-white/15" />
            )}
            {guide && (
              <ExplainerVideo
                guide={guide}
                variant="hero"
                bn={bn}
                label={`${bn ? 'ভিডিওতে দেখুন' : 'Watch the video'}: ${L(page.h1)}`}
                chip={bn ? 'দেখুন কিভাবে কাজ করে' : 'See how it works'}
              />
            )}
            {guide === null && (
              <div className="rounded-[28px] bg-white/10 ring-1 ring-white/15 backdrop-blur-sm p-6 md:p-8">
                <p className="text-[13px] font-bold text-white/70">
                  {bn ? `${num(page.steps.length)} ধাপে শুরু` : `Up and running in ${page.steps.length} steps`}
                </p>
                <p className={`mt-1 mb-6 text-xl font-black ${bn ? '' : 'tracking-tight'}`}>
                  {bn ? 'কিভাবে কাজ করে' : 'How it works'}
                </p>
                <StepList steps={page.steps} bn={bn} onDark />
              </div>
            )}
          </div>

          {/* ── The primary button goes to the FEATURE, not to /login ────
              Someone who searched "মিল ম্যানেজার" and clicked this result
              wants the meal manager, and a bare sign-in screen is where that
              intent goes to die. This links straight to /living?m=meals; the
              existing plumbing does the rest:

                RequireAuth  → /login?next=%2Fliving%3Fm%3Dmeals&role=tenant
                LoginPage    → reads `next`, and lands them back on the meal
                               manager the moment they are signed in.

              Role is inferred from the destination too — a landlord surface
              like /host-dashboard opens the login on the landlord side, while
              /living defaults to tenant, which is what someone arriving from
              the roommate-wallet page almost always is. */}
          <div className="lg:self-start">
            <div className="flex flex-wrap gap-3">
              <Link
                to={page.cta.to}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#ba0036] font-black text-sm hover:bg-rose-50 active:scale-95 transition-all shadow-lg"
              >
                {L(page.cta)} <ArrowRight size={16} />
              </Link>
              <Link
                to="/to-let"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 border border-white/25 text-white font-black text-sm hover:bg-white/20 active:scale-95 transition-all backdrop-blur-sm"
              >
                {bn ? 'বাসা ভাড়া খুঁজুন' : 'Find a house to rent'}
              </Link>
            </div>
            {/* Risk reversal, and only what is true for every page: signing
                up costs nothing. What is and isn't free is spelled out below. */}
            <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
              <BadgeCheck size={14} className="text-white/80" />
              {bn ? 'অ্যাকাউন্ট খোলা ফ্রি · বাংলা ও English' : 'Free to sign up · Bangla & English'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-16">
        {/* ── At a glance ──────────────────────────────────────────────── */}
        <section aria-labelledby="features-heading">
          <Eyebrow bn={bn} className="mb-3">{bn ? 'এক নজরে' : 'At a glance'}</Eyebrow>
          <h2 id="features-heading" className={`text-2xl md:text-3xl font-black ${bn ? 'leading-snug' : 'tracking-tight'}`}>
            {bn ? 'কী কী আছে' : 'What you get'}
          </h2>
          {echo && <p className="mt-1 text-sm font-semibold text-gray-400">{bn ? 'What you get' : 'কী কী আছে'}</p>}

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {page.features.map((f, i) => {
              const Icon = ICONS[f.icon] || Check;
              return (
                <article
                  key={i}
                  className="p-5 md:p-6 rounded-3xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#ba0036]/20 hover:shadow-[0_20px_50px_-24px_rgba(186,0,54,0.25)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#ba0036]/[0.07] ring-1 ring-inset ring-[#ba0036]/10 text-[#ba0036] flex items-center justify-center mb-4">
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 leading-snug">{L(f).t}</h3>
                  <p className={`mt-1.5 text-[13.5px] text-gray-500 ${bn ? 'leading-[1.7]' : 'leading-relaxed'}`}>{L(f).d}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── How it works — here only when the hero is showing the video;
            without one, the same steps are already in the hero. ─────────── */}
        {guide && (
          <section aria-labelledby="steps-heading" className="mt-14 md:mt-20">
            <Eyebrow bn={bn} className="mb-3">{bn ? `${num(page.steps.length)} ধাপ` : `${page.steps.length} steps`}</Eyebrow>
            <h2 id="steps-heading" className={`text-2xl md:text-3xl font-black mb-8 ${bn ? 'leading-snug' : 'tracking-tight'}`}>
              {bn ? 'কিভাবে কাজ করে' : 'How it works'}
            </h2>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6 md:p-8">
              <StepList steps={page.steps} bn={bn} />
            </div>
          </section>
        )}

        {/* ── The long story, folded ───────────────────────────────────────
            The body copy that lets these pages compete in search, opened by
            choice. The intro — the visitor's own bad day, told in full —
            leads, then the sections. Paragraphs keep their second-language
            copy here: a Bangladeshi renter searches in both registers
            ("মিল ম্যানেজার" / "meal manager"), and this is real, visible text
            the moment the reader opens it — never hidden text. */}
        <ReadMoreFold
          bn={bn}
          className="mt-14 md:mt-20"
          title={bn ? `${L(page.h1).split(' — ')[0]} — পুরো গল্পটা পড়ুন` : `${L(page.h1).split(' — ')[0]} — read the whole story`}
        >
          <div className="max-w-3xl">
            <h2 className="sr-only">
              {bn ? `${L(page.h1)} সম্পর্কে` : `About ${L(page.h1)}`}
            </h2>
            <p className={`text-[16px] md:text-[17px] font-medium text-gray-800 ${bn ? 'leading-[1.9]' : 'leading-[1.75]'}`}>
              {L(page.intro)}
            </p>
            {page.sections?.map((sec, i) => (
              <article key={i} className="mt-10 pt-10 border-t border-gray-100">
                <h3 className={`text-xl md:text-2xl font-black text-gray-900 ${bn ? 'leading-[1.35]' : 'tracking-tight leading-tight'}`}>
                  {L(sec.h2)}
                </h3>
                <p className="mt-1 mb-4 text-[12px] font-bold text-gray-400">{other(sec.h2)}</p>
                {sec.paragraphs.map((para, j) => (
                  <div key={j} className="mb-5">
                    <p className={`text-[15px] text-gray-700 ${bn ? 'leading-[1.9]' : 'leading-[1.75]'}`}>
                      {L(para)}
                    </p>
                    {other(para) && (
                      <p className="mt-2 text-[12.5px] text-gray-400 leading-[1.75]">
                        {other(para)}
                      </p>
                    )}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </ReadMoreFold>

        {/* ── Pricing, stated plainly ──────────────────────────────────────
            Competing mess apps bury the paid tier behind a trial, which is a
            recurring complaint in their reviews. Saying exactly what is free
            and what is not — including that rent collection is NOT free — is
            both the honest thing and the thing that earns the click. */}
        {page.pricing && (
          <section aria-labelledby="pricing-heading" className="mt-14 md:mt-20">
            <Eyebrow bn={bn} className="mb-3">{bn ? 'খরচ' : 'Pricing'}</Eyebrow>
            <h2 id="pricing-heading" className={`text-2xl md:text-3xl font-black ${bn ? 'leading-snug' : 'tracking-tight'}`}>
              {L(page.pricing.h2)}
            </h2>
            {echo && <p className="mt-1 text-sm font-semibold text-gray-400">{other(page.pricing.h2)}</p>}

            <div className="mt-8 grid md:grid-cols-2 gap-4 md:gap-5">
              <div className="p-6 md:p-7 rounded-3xl border border-emerald-200 bg-white shadow-[0_24px_60px_-32px_rgba(5,150,105,0.35)]">
                <p className="inline-flex items-center gap-2 text-[15px] font-black text-gray-900 mb-4">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <BadgeCheck size={16} strokeWidth={2.4} />
                  </span>
                  {bn ? 'সম্পূর্ণ ফ্রি' : 'Free forever'}
                </p>
                <ul className="space-y-3">
                  {L(page.pricing.free).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] font-semibold text-gray-700 leading-snug">
                      <span className="mt-px w-[18px] h-[18px] shrink-0 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <Check size={11} strokeWidth={3.5} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 md:p-7 rounded-3xl border border-gray-200 bg-white">
                <p className="inline-flex items-center gap-2 text-[15px] font-black text-gray-900 mb-4">
                  <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Crown size={16} strokeWidth={2.4} />
                  </span>
                  {bn ? 'Plus ও Pro প্ল্যানে' : 'On the Plus & Pro plans'}
                </p>
                <ul className="space-y-3">
                  {L(page.pricing.paid).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] font-semibold text-gray-500 leading-snug">
                      <Crown size={15} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-5 text-[13px] font-semibold text-gray-600 leading-relaxed max-w-2xl">
              {L(page.pricing.note)}
            </p>
            {echo && (
              <p className="mt-1.5 text-[12px] text-gray-400 leading-relaxed max-w-2xl">
                {other(page.pricing.note)}
              </p>
            )}
          </section>
        )}

        {/* ── FAQ (mirrors the FAQPage schema above) ───────────────────── */}
        <section aria-labelledby="faq-heading" className="mt-14 md:mt-20">
          <Eyebrow bn={bn} className="mb-3">{bn ? 'প্রশ্ন ও উত্তর' : 'FAQ'}</Eyebrow>
          <h2 id="faq-heading" className={`text-2xl md:text-3xl font-black mb-8 ${bn ? 'leading-snug' : 'tracking-tight'}`}>
            {bn ? 'সাধারণ প্রশ্ন' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {page.faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                open={i === 0}
              >
                <summary className="cursor-pointer list-none text-sm md:text-base font-black text-gray-900 flex items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-[#ba0036] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className={`mt-3 text-[13.5px] md:text-sm text-gray-600 ${bn ? 'leading-[1.8]' : 'leading-relaxed'}`}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Internal links: the crawl path out of this page ──────────── */}
        <section aria-labelledby="related-heading" className="mt-14 md:mt-20">
          <h2 id="related-heading" className="text-lg font-black tracking-tight mb-4">
            {bn ? 'আরও দেখুন' : 'Explore more'}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {page.related.map((slug) => {
              const rel = featurePageFor(slug);
              const label = rel
                ? L(rel.h1)
                : (bn ? 'সব জেলার টু-লেট' : 'To-let in every district');
              return (
                <Link
                  key={slug}
                  to={slug}
                  className="px-4 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                >
                  {label}
                </Link>
              );
            })}
            <Link
              to="/how-it-works"
              className="px-4 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
            >
              {bn ? 'কিভাবে কাজ করে' : 'How TO-LET PRO works'}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FeatureLanding;
