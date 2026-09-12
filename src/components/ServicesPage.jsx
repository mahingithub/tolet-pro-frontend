// ServicesPage.jsx
//
// The tenant's entry to the service marketplace — গ্যাস, পানির জার, মুদি দোকান,
// গৃহকর্মী, ইলেকট্রিশিয়ান, প্লাম্বার, ইন্টারনেট, খাবার হোটেল.
//
// ─── THIS WAS A LIST OF PICTURES ────────────────────────────────────────────
// Until now this page was twelve hardcoded tiles that all opened the same
// "Coming Soon" modal and recorded a SellInterest click. The providers, their
// prices, the orders and the reviews are all real now, so the tiles lead to
// actual shops — but the demand gauge is KEPT for the categories that have not
// opened yet. That signal is how we decide which category to open next, and
// deleting the tile would delete the signal.
//
// ─── WHAT DECIDES WHETHER A TILE IS LIVE ────────────────────────────────────
// The server's registry (config/serviceCategories.js), never a list in this
// file. `status: 'live'` means registration is open; a live category with
// nobody nearby still shows, because "কেউ নেই" in your area is a true and
// useful answer, and hiding the tile would just look like the app forgot the
// category exists.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Sparkles, LifeBuoy, X, ClipboardList, Loader2,
} from 'lucide-react';

import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import useServiceLocation from '../hooks/useServiceLocation';
import { getServiceCategories, getNearbyCategories } from '../services/marketplaceService';
import LocationBar from './services/LocationBar';
import { iconFor, tintFor } from './services/serviceIcons';

const toBn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

const ServicesPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/tenant-dashboard');
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const { location, query, precise, asking, request, setThana } = useServiceLocation();

  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planned, setPlanned] = useState(null);   // the "coming soon" modal

  // The registry is static for the life of the deploy and heavily cached
  // server-side (ETag + a day of s-maxage), so this is one cheap call.
  useEffect(() => {
    let cancelled = false;
    getServiceCategories()
      .then((data) => { if (!cancelled) setCategories(data.categories || []); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Counts depend on WHERE the tenant is, so they are a separate call that
  // re-runs when the location changes — and one that is allowed to fail
  // quietly. A tile without a count is still a usable tile.
  const loadCounts = useCallback(() => {
    if (!query) { setCounts(null); return undefined; }
    let cancelled = false;
    getNearbyCategories(query)
      .then((data) => {
        if (cancelled) return;
        setCounts(Object.fromEntries((data.categories || []).map((c) => [c.id, c])));
      })
      .catch(() => { if (!cancelled) setCounts({}); });
    return () => { cancelled = true; };
  }, [query?.lat, query?.lng, query?.thana]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(loadCounts, [loadCounts]);

  const { live, soon } = useMemo(() => ({
    live: categories.filter((c) => c.status === 'live'),
    soon: categories.filter((c) => c.status !== 'live'),
  }), [categories]);

  const openPlanned = (cat) => {
    setPlanned(cat);
    // The demand gauge the admin console reads. `service_<id>` matches the
    // legacy source keys so the old clicks and the new ones are one series
    // rather than two halves of the same question.
    import('../services/sellInterestService').then(({ recordSellInterest }) => {
      recordSellInterest({ source: `service_${cat.id}`, kind: 'service' }).catch(() => {});
    });
  };

  const Tile = ({ cat, comingSoon }) => {
    const Icon = iconFor(cat.icon);
    const near = counts?.[cat.id];
    return (
      <button
        type="button"
        onClick={() => (comingSoon ? openPlanned(cat) : navigate(`/services/c/${cat.id}`))}
        className="group relative text-left bg-white/90 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] active:scale-[0.98] transition-all duration-300 flex flex-col gap-3 overflow-hidden"
      >
        <div className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl border flex items-center justify-center shadow-sm ${tintFor(cat.id)} group-hover:scale-105 transition-transform`}>
          <Icon size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2.3} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] md:text-sm font-black text-gray-900 leading-tight">
            {bn ? cat.label?.bn : cat.label?.en}
          </p>
          <p className="text-[10px] md:text-[11px] font-bold text-gray-400 leading-tight mt-0.5 line-clamp-2">
            {bn ? cat.blurb?.bn : cat.blurb?.en}
          </p>
        </div>

        {comingSoon ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400 mt-auto">
            {bn ? 'শীঘ্রই আসছে' : 'Coming soon'}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 text-[10px] font-black mt-auto ${
            near && near.count > 0 ? 'text-emerald-600' : 'text-[#ba0036]'
          }`}
          >
            {/* The count is the reason to tap. "৪ জন কাছে আছে" is a different
                proposition from a tile that merely exists — and when the answer
                is zero, saying so beats sending somebody into an empty list. */}
            {near
              ? (near.count > 0
                ? (bn ? `${toBn(near.count)} জন কাছে আছে` : `${near.count} nearby`)
                : (bn ? 'এখানে কেউ নেই' : 'Nobody here yet'))
              : (bn ? 'দেখুন' : 'Browse')}
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans text-gray-900 selection:bg-[#ba0036] selection:text-white">
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-24">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            onClick={goBack}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95"
          >
            <ArrowLeft size={14} className="-ml-1 group-hover:-translate-x-0.5 transition-transform" />
            {bn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to dashboard'}
          </button>

          <button
            onClick={() => navigate('/services/orders')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95"
          >
            <ClipboardList size={14} />
            {bn ? 'আমার অর্ডার' : 'My orders'}
          </button>
        </div>

        {/* Hero */}
        <div className="mb-4 md:mb-5 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-7 bg-gradient-to-br from-[#ba0036] via-[#a1002f] to-[#3a0011] text-white shadow-[0_20px_50px_-20px_rgba(186,0,54,0.5)] relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/15">
              <Sparkles size={24} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-200 mb-1">
                {bn ? 'হোম সার্ভিস' : 'Home Services'}
              </p>
              <h1 className="text-xl md:text-3xl font-black leading-tight">
                {bn ? 'আপনার এলাকার দোকান ও সেবা' : 'Shops and services in your area'}
              </h1>
              <p className="mt-1.5 text-[12px] md:text-sm font-bold text-white/75 leading-snug max-w-prose">
                {/* No commission, said on the way in. The provider pays a
                    registration fee and nothing else — the tenant pays the shop
                    directly, and knowing that is what makes the prices here
                    believable. */}
                {bn
                  ? 'সরাসরি দোকানদারের সাথে — কোনো কমিশন নেই, দাম যা দেখছেন তাই।'
                  : 'Straight to the shopkeeper — no commission, the price you see is the price.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <LocationBar
            location={location}
            precise={precise}
            asking={asking}
            onUseGps={request}
            onPickThana={setThana}
            bn={bn}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white/90 border border-gray-100 p-8 text-center">
            <p className="text-sm font-black text-gray-900">
              {bn ? 'সার্ভিস তালিকা আনা গেল না' : 'Could not load services'}
            </p>
            <p className="text-[12px] font-bold text-gray-500 mt-1">{error.message}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {live.map((cat) => <Tile key={cat.id} cat={cat} />)}
            </div>

            {soon.length ? (
              <>
                <p className="mt-8 mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                  {bn ? 'শীঘ্রই আসছে' : 'Coming soon'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 opacity-80">
                  {soon.map((cat) => <Tile key={cat.id} cat={cat} comingSoon />)}
                </div>
              </>
            ) : null}
          </>
        )}

        {/* Custom request — unchanged. Some needs will never be a category. */}
        <div className="mt-6 md:mt-8 rounded-[1.5rem] border border-gray-100 bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><LifeBuoy size={18} /></div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900">{bn ? 'অন্য কিছু দরকার?' : 'Need something else?'}</p>
              <p className="text-[11px] font-bold text-gray-500 leading-snug">{bn ? 'আপনার প্রয়োজন লিখে পাঠান, আমরা সাহায্য করব।' : 'Tell us what you need and our team will help.'}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/support', { state: { source: 'services' } })}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#ba0036] text-white font-black text-xs uppercase tracking-widest hover:bg-[#a1002f] active:scale-95 transition-all"
          >
            {bn ? 'কাস্টম অনুরোধ' : 'Custom request'} <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Coming Soon — kept, because the tap is the demand signal */}
      {planned ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setPlanned(null)} />
          <div className="relative bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl">
            <button
              onClick={() => setPlanned(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-5 ${tintFor(planned.id)}`}>
                {React.createElement(iconFor(planned.icon), { size: 28, strokeWidth: 2.5 })}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
                {bn ? 'শীঘ্রই আসছে!' : 'Coming Soon!'}
              </h2>
              <p className="text-xs md:text-sm font-bold text-gray-500 mb-6 leading-relaxed">
                {bn
                  ? `${planned.label?.bn} এর জন্য প্রোভাইডার যোগ করা হচ্ছে। আপনার আগ্রহ আমরা গুনে রাখলাম — যে সেবার চাহিদা বেশি, সেটাই আগে চালু হবে।`
                  : `We are onboarding providers for ${planned.label?.en}. Your interest is counted — the categories people ask for most are the ones we open next.`}
              </p>
              <button
                onClick={() => setPlanned(null)}
                className="w-full py-3 md:py-3.5 rounded-xl bg-gray-900 text-white text-xs md:text-[13px] font-black uppercase tracking-widest hover:bg-[#ba0036] transition-colors active:scale-95 shadow-lg"
              >
                {bn ? 'ধন্যবাদ' : 'Thank You'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ServicesPage;
