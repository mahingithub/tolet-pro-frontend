/**
 * FeatureLanding.jsx — one renderer for every feature landing page.
 * ─────────────────────────────────────────────────────────────────────────────
 * `/meal-manager`, `/roommate-wallet`, `/house-manager`, `/tenant-manager` and
 * `/home-services` all render through here, driven by src/seo/featurePages.js.
 * One component, five indexable pages, and no copy duplicated between the data
 * and the markup.
 *
 * Written for a signed-out visitor arriving cold from Google, so it explains
 * the feature before it asks for anything: what it does, how it works, what it
 * costs, then a sign-up CTA. Headings carry both languages because that is how
 * these terms are actually searched — "মিল ম্যানেজার" and "meal manager" are
 * the same intent typed two ways, and a page that only says one of them can
 * only be found by half its audience.
 */

import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import {
  UtensilsCrossed, ShoppingBasket, Calculator, Scale, PieChart, BellRing,
  Receipt, Split, Wallet, Activity, Building2, DoorOpen, Megaphone, FileText,
  Users, AlertTriangle, QrCode, ScanLine, Truck, Sparkles, Wrench, Wifi,
  ShieldCheck, ArrowRight, Check, Crown,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { featurePageFor } from '../../seo/featurePages';
import useSeo from '../../seo/useSeo';
import { breadcrumbSchema, faqSchema, serviceSchema } from '../../seo/schema';
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

const FeatureLanding = () => {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const page = featurePageFor(pathname);

  const L = (obj) => (bn ? obj.bn : obj.en);
  const other = (obj) => (bn ? obj.en : obj.bn);

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

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#ba0036] selection:text-white">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#ba0036] via-[#a1002f] to-[#3a0011] text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-14 md:pb-20">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center gap-2 text-[11px] font-bold text-rose-200/80">
              <li><Link to="/" className="hover:text-white">{bn ? 'হোম' : 'Home'}</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-white/90">{L(page.eyebrow)}</li>
            </ol>
          </nav>

          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-200 mb-3">
            {L(page.eyebrow)}
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-3xl">
            {L(page.h1)}
          </h1>
          {/* The other language sits right under the H1 — same meaning, and it
              is the only way this page is findable in both search vocabularies. */}
          <p className="mt-2 text-base md:text-xl font-bold text-white/70">
            {other(page.h1)}
          </p>
          <p className="mt-5 text-sm md:text-lg font-medium text-white/85 leading-relaxed max-w-2xl">
            {L(page.intro)}
          </p>

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
          <div className="mt-8 flex flex-wrap gap-3">
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
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-16">
        {/* ── Features ─────────────────────────────────────────────────── */}
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-2">
            {bn ? 'কী কী আছে' : 'What you get'}
          </h2>
          <p className="text-sm font-bold text-gray-500 mb-8">{other({ bn: 'কী কী আছে', en: 'What you get' })}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {page.features.map((f, i) => {
              const Icon = ICONS[f.icon] || Check;
              return (
                <article
                  key={i}
                  className="p-5 md:p-6 rounded-2xl border border-gray-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-[#ba0036] border border-rose-100 flex items-center justify-center mb-4">
                    <Icon size={20} strokeWidth={2.3} />
                  </div>
                  <h3 className="text-sm md:text-base font-black text-gray-900 leading-tight">
                    {L(f).t}
                  </h3>
                  <p className="mt-1.5 text-[13px] font-medium text-gray-500 leading-relaxed">
                    {L(f).d}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section aria-labelledby="steps-heading" className="mt-14 md:mt-20">
          <h2 id="steps-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-8">
            {bn ? 'কিভাবে কাজ করে' : 'How it works'}
          </h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {page.steps.map((s, i) => (
              <li key={i} className="relative p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#ba0036] text-white text-xs font-black mb-3">
                  {i + 1}
                </span>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{L(s)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Long-form sections ───────────────────────────────────────────
            The body copy that lets these pages compete. Each paragraph shows
            in the reader's language first, with the other language beneath in
            a smaller, muted style.

            That second copy is NOT a duplicate for crawlers — it is here
            because a Bangladeshi renter searches in both registers within one
            session ("মিল ম্যানেজার" and "meal manager" are the same person),
            and because plenty of readers here are comfortable in either. It
            is real, visible text, never hidden, so it stays on the right side
            of the line. */}
        <section aria-labelledby="about-heading" className="mt-14 md:mt-20 max-w-3xl">
          <h2 id="about-heading" className="sr-only">
            {bn ? `${L(page.h1)} সম্পর্কে` : `About ${L(page.h1)}`}
          </h2>
          {page.sections?.map((sec, i) => (
            <article key={i} className="mb-10 md:mb-14">
              <h3 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 mb-1">
                {L(sec.h2)}
              </h3>
              <p className="text-[12px] font-bold text-gray-400 mb-4">{other(sec.h2)}</p>
              {sec.paragraphs.map((para, j) => (
                <div key={j} className="mb-5">
                  <p className="text-[14px] md:text-[15px] font-medium text-gray-700 leading-[1.85]">
                    {L(para)}
                  </p>
                  {other(para) && (
                    <p className="mt-2 text-[12px] md:text-[13px] font-medium text-gray-400 leading-[1.75]">
                      {other(para)}
                    </p>
                  )}
                </div>
              ))}
            </article>
          ))}
        </section>

        {/* ── Pricing, stated plainly ──────────────────────────────────────
            Competing mess apps bury the paid tier behind a trial, which is a
            recurring complaint in their reviews. Saying exactly what is free
            and what is not — including that rent collection is NOT free — is
            both the honest thing and the thing that earns the click. */}
        {page.pricing && (
          <section aria-labelledby="pricing-heading" className="mt-14 md:mt-20">
            <h2 id="pricing-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-2">
              {L(page.pricing.h2)}
            </h2>
            <p className="text-sm font-bold text-gray-500 mb-8">{other(page.pricing.h2)}</p>

            <div className="grid md:grid-cols-2 gap-4 md:gap-5">
              <div className="p-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 mb-3">
                  {bn ? 'সম্পূর্ণ ফ্রি' : 'Free forever'}
                </p>
                <ul className="space-y-2.5">
                  {L(page.pricing.free).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] font-bold text-gray-700">
                      <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={3} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl border border-gray-200 bg-white">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 mb-3">
                  {bn ? 'Plus ও Pro প্ল্যানে' : 'On the Plus & Pro plans'}
                </p>
                <ul className="space-y-2.5">
                  {L(page.pricing.paid).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] font-bold text-gray-500">
                      <Crown size={15} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-5 text-[13px] font-bold text-gray-600 leading-relaxed max-w-2xl">
              {L(page.pricing.note)}
            </p>
            <p className="mt-1.5 text-[12px] font-medium text-gray-400 leading-relaxed max-w-2xl">
              {other(page.pricing.note)}
            </p>
          </section>
        )}

        {/* ── FAQ (mirrors the FAQPage schema above) ───────────────────── */}
        <section aria-labelledby="faq-heading" className="mt-14 md:mt-20">
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-black tracking-tight mb-8">
            {bn ? 'সাধারণ প্রশ্ন' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {page.faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]"
                open={i === 0}
              >
                <summary className="cursor-pointer list-none text-sm md:text-base font-black text-gray-900 flex items-start justify-between gap-4">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-[#ba0036] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-[13px] md:text-sm font-medium text-gray-600 leading-relaxed">
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
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                >
                  {label}
                </Link>
              );
            })}
            <Link
              to="/how-it-works"
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
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
