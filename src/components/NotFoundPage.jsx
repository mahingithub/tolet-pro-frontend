import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, MapPin, HelpCircle } from 'lucide-react';
import useSeo from '../seo/useSeo';
import { useLanguage } from '../context/LanguageContext';

/**
 * NotFoundPage — what an unknown URL shows.
 * ──────────────────────────────────────────────────────────────────────────
 * The catch-all route used to redirect to "/". Every mistyped or dead URL
 * therefore became another copy of the homepage — status 200, the homepage's
 * title, `index, follow` — which search engines treat as a soft 404 and hold
 * against the site. It also dropped the person on a page they never asked for,
 * with no hint that their link was wrong.
 *
 * Now the page says what happened, is marked noindex, and links onward to the
 * main public sections, so neither a visitor nor a crawler is left stranded.
 * (Vercel still answers 200 — the SPA serves index.html for every path — so
 * `noindex` is what keeps these URLs out of the index.)
 */

const LINKS = [
  { to: '/', Icon: Home, bn: 'হোম', en: 'Home' },
  { to: '/properties/all', Icon: Search, bn: 'সব বিজ্ঞাপন', en: 'All listings' },
  { to: '/to-let', Icon: MapPin, bn: 'জেলা ধরে টু-লেট', en: 'To-let by district' },
  { to: '/support', Icon: HelpCircle, bn: 'সাহায্য ও সাপোর্ট', en: 'Help & support' },
];

export default function NotFoundPage() {
  const { language } = useLanguage() || {};
  const bn = language === 'বাংলা';

  useSeo({ title: 'পাতাটি পাওয়া যায়নি — Page not found', noindex: true });

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-5 py-16 bg-slate-50">
      <div className="max-w-md w-full text-center">
        <p className="text-6xl font-black text-[#ba0036] tracking-tight" aria-hidden="true">404</p>
        <h1 className="mt-3 text-2xl font-black text-gray-900">
          {bn ? 'এই পাতাটি পাওয়া যায়নি' : 'This page could not be found'}
        </h1>
        <p className="mt-2 text-sm font-semibold text-gray-500">
          {bn
            ? 'লিংকটি ভুল হতে পারে, অথবা পাতাটি সরিয়ে ফেলা হয়েছে। নিচের যেকোনো জায়গা থেকে শুরু করুন।'
            : 'The link may be mistyped, or the page has moved. Pick up from one of these instead.'}
        </p>
        <nav aria-label={bn ? 'মূল পাতাগুলো' : 'Main pages'} className="mt-8 grid grid-cols-2 gap-3">
          {LINKS.map(({ to, Icon, bn: labelBn, en }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-gray-100 px-4 py-3 text-sm font-bold text-gray-800 hover:border-[#ba0036]/30 hover:text-[#ba0036] transition-colors"
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              {bn ? labelBn : en}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
