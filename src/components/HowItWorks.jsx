// HowItWorks.jsx
//
// Public marketing page that explains how TO-LET PRO works for tenants and
// landlords, plus a Pricing section (id="pricing") the navbar links to via
// /how-it-works#pricing. Fully bilingual (English / বাংলা) following the same
// inline pattern used across the app.

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, MessageSquare, CalendarCheck, KeyRound,
  PlusCircle, BadgeCheck, Users, Handshake,
  ShieldCheck, Sparkles, ArrowRight, Check, Building2,
  Lock, PhoneCall, Flag, HelpCircle, ChevronDown, LifeBuoy, PlayCircle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext.jsx';
import { getSectionGuides } from '../services/aiGuideService';
import VideoGuides from './shared/VideoGuides';
import BackButton from './shared/BackButton';

export default function HowItWorks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated, user, activeRole } = useAuth();
  const isLandlord = activeRole === 'landlord';
  const isBn = language === 'বাংলা' || language === 'bn';
  const tr = (en, bn) => (isBn ? bn : en);
  const [openFaq, setOpenFaq] = useState(null);
  const [tenantVideos, setTenantVideos] = useState([]);
  const [landlordVideos, setLandlordVideos] = useState([]);

  // Scroll to #pricing (or any hash) when arriving via a hash link.
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.hash]);

  // Load admin-managed "How it Works" video guides and split them into
  // tenant / landlord sections (an "all"-audience guide shows in both).
  useEffect(() => {
    let alive = true;
    getSectionGuides('how_it_works').then((all) => {
      if (!alive) return;
      setTenantVideos(all.filter((g) => g.audience === 'tenant' || g.audience === 'all'));
      setLandlordVideos(all.filter((g) => g.audience === 'landlord' || g.audience === 'all'));
    });
    return () => { alive = false; };
  }, []);

  const tenantSteps = [
    { Icon: Search, en: 'Search & filter', bn: 'খুঁজুন ও ফিল্টার করুন', den: 'Browse verified listings by area, budget and property type.', dbn: 'এলাকা, বাজেট ও ধরন অনুযায়ী ভেরিফাইড লিস্টিং দেখুন।' },
    { Icon: MessageSquare, en: 'Contact owners', bn: 'মালিকের সাথে যোগাযোগ', den: 'Message verified owners directly — no brokers, no fees.', dbn: 'ভেরিফাইড মালিকের সাথে সরাসরি কথা বলুন — দালাল বা ফি নেই।' },
    { Icon: CalendarCheck, en: 'Schedule a visit', bn: 'ভিজিট নির্ধারণ করুন', den: 'Pick a time that works and tour the property in person.', dbn: 'সুবিধামতো সময়ে সরাসরি বাড়ি দেখে আসুন।' },
    { Icon: KeyRound, en: 'Move in', bn: 'উঠে যান', den: 'Finalise the deal and move into your next home with confidence.', dbn: 'চুক্তি চূড়ান্ত করে নিশ্চিন্তে নতুন বাড়িতে উঠুন।' },
  ];

  const landlordSteps = [
    { Icon: PlusCircle, en: 'List in 3 minutes', bn: '৩ মিনিটে লিস্ট করুন', den: 'Add photos, rent and details. Listing is completely free.', dbn: 'ছবি, ভাড়া ও তথ্য দিন। লিস্টিং সম্পূর্ণ ফ্রি।' },
    { Icon: BadgeCheck, en: 'Get verified', bn: 'ভেরিফাই হন', den: 'Our team verifies you so tenants trust and contact you first.', dbn: 'আমাদের টিম আপনাকে ভেরিফাই করে যাতে ভাড়াটিয়ারা আগে আপনাকেই বিশ্বাস করে।' },
    { Icon: Users, en: 'Receive leads', bn: 'লিড পান', den: 'Get inquiries from genuine, ready-to-move tenants.', dbn: 'সত্যিকারের, উঠতে প্রস্তুত ভাড়াটিয়াদের কাছ থেকে যোগাযোগ পান।' },
    { Icon: Handshake, en: 'Close the deal', bn: 'চুক্তি সম্পন্ন করুন', den: 'Chat, agree on terms and hand over the keys.', dbn: 'চ্যাট করুন, শর্তে একমত হন এবং চাবি হস্তান্তর করুন।' },
  ];

  // Detailed safety pillars — the "why you can trust us" story.
  const safetyItems = [
    { Icon: ShieldCheck, en: 'Verified owners & listings', bn: 'ভেরিফাইড মালিক ও লিস্টিং', den: 'Our team reviews ownership documents and property details before a listing earns its verified badge.', dbn: 'ভেরিফাইড ব্যাজ পাওয়ার আগে আমাদের টিম মালিকানার কাগজপত্র ও বাড়ির তথ্য যাচাই করে।' },
    { Icon: Lock, en: 'Your number stays private', bn: 'আপনার নম্বর গোপন থাকে', den: 'Chat and call inside the app — you never have to share your personal phone number to talk.', dbn: 'অ্যাপের ভেতরেই চ্যাট ও কল করুন — কথা বলতে কখনো ব্যক্তিগত নম্বর শেয়ার করতে হয় না।' },
    { Icon: PhoneCall, en: 'Secure in-app calls', bn: 'নিরাপদ অ্যাপ-কল', den: 'Voice and video calls run through TO-LET PRO, so every conversation stays protected.', dbn: 'ভয়েস ও ভিডিও কল টু-লেট প্রো-র মাধ্যমে হয়, তাই প্রতিটি কথোপকথন সুরক্ষিত থাকে।' },
    { Icon: Flag, en: 'Report & block anytime', bn: 'যেকোনো সময় রিপোর্ট ও ব্লক', den: 'See something off? Report or block any user in a tap and our moderation team steps in fast.', dbn: 'সন্দেহজনক কিছু দেখলেন? এক ট্যাপে যেকোনো ব্যবহারকারীকে রিপোর্ট বা ব্লক করুন, আমাদের মডারেশন টিম দ্রুত ব্যবস্থা নেয়।' },
  ];

  // Frequently asked questions shown on the marketing page.
  const faqs = [
    { q: { en: 'Is TO-LET PRO free to use?', bn: 'টু-লেট প্রো ব্যবহার কি ফ্রি?' }, a: { en: 'Yes. Searching, contacting verified owners and listing a property are all free. Owners can optionally upgrade for premium placement and tools.', bn: 'হ্যাঁ। সার্চ করা, ভেরিফাইড মালিকের সাথে যোগাযোগ ও প্রপার্টি লিস্ট করা সবই ফ্রি। মালিকরা চাইলে প্রিমিয়াম প্লেসমেন্ট ও টুলসের জন্য আপগ্রেড করতে পারেন।' } },
    { q: { en: 'Do I have to pay any brokerage?', bn: 'আমাকে কি কোনো দালাল ফি দিতে হবে?' }, a: { en: 'Never. Tenants deal directly with verified owners, so there is zero brokerage on TO-LET PRO.', bn: 'কখনো না। ভাড়াটিয়ারা সরাসরি ভেরিফাইড মালিকের সাথে লেনদেন করেন, তাই টু-লেট প্রো-তে কোনো দালাল ফি নেই।' } },
    { q: { en: 'How do I know a listing is genuine?', bn: 'একটি লিস্টিং আসল কিনা কীভাবে বুঝব?' }, a: { en: 'Look for the verified badge. It means our team has checked the owner\u2019s documents and the property details.', bn: 'ভেরিফাইড ব্যাজ খুঁজুন। এর মানে আমাদের টিম মালিকের কাগজপত্র ও বাড়ির তথ্য যাচাই করেছে।' } },
    { q: { en: 'How long does owner verification take?', bn: 'মালিক ভেরিফিকেশনে কত সময় লাগে?' }, a: { en: 'Most verifications are completed within 24\u201348 hours once you submit a valid NID and ownership proof.', bn: 'সঠিক এনআইডি ও মালিকানার প্রমাণ জমা দিলে বেশিরভাগ ভেরিফিকেশন ২৪–৪৮ ঘণ্টার মধ্যে সম্পন্ন হয়।' } },
    { q: { en: 'What if I need help?', bn: 'সাহায্য দরকার হলে কী করব?' }, a: { en: 'Open the Help & Support center anytime. Send us a request and our support team replies right inside the app.', bn: 'যেকোনো সময় সহায়তা ও সাপোর্ট সেন্টার খুলুন। একটি অনুরোধ পাঠান, আমাদের সাপোর্ট টিম অ্যাপের ভেতরেই উত্তর দেবে।' } },
  ];

  const StepCard = ({ Icon, title, desc, n }) => (
    <div className="relative bg-white rounded-3xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
      <span className="absolute top-4 right-5 text-4xl font-black text-gray-100 leading-none select-none">{n}</span>
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <Icon size={22} className="text-[#ba0036]" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">{title}</h3>
      <p className="text-sm font-medium text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28 md:pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#ba0036] to-[#e60045] text-white">
        <div className="max-w-5xl mx-auto px-5 pt-12 pb-16 md:pt-16 md:pb-24 relative overflow-hidden text-center">
          <div className="absolute -top-16 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-white/5 rounded-full blur-3xl" />
          <BackButton
            fallback="/"
            label={tr('Back', 'পেছনে')}
            ariaLabel={tr('Back', 'পেছনে')}
            size={16}
            className="absolute left-4 top-5 md:left-6 md:top-6 z-10 inline-flex items-center gap-1.5 text-white/90 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-2 rounded-full text-xs font-black active:scale-95 transition-all [-webkit-tap-highlight-color:transparent]"
          />
          <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-5">
            <Sparkles size={14} /> {tr('Simple. Safe. Free.', 'সহজ। নিরাপদ। ফ্রি।')}
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
            {tr('How TO-LET PRO works', 'টু-লেট প্রো যেভাবে কাজ করে')}
          </h1>
          <p className="text-sm md:text-lg font-medium text-red-100 max-w-2xl mx-auto leading-relaxed">
            {tr(
              'Bangladesh\u2019s trusted rental platform connects tenants with 100% verified owners — directly, with zero brokerage.',
              'বাংলাদেশের বিশ্বস্ত রেন্টাল প্ল্যাটফর্ম ভাড়াটিয়াদের ১০০% ভেরিফাইড মালিকের সাথে সরাসরি যুক্ত করে — কোনো দালাল ফি ছাড়াই।',
            )}
          </p>
        </div>
      </div>

      {/* For tenants */}
      <section className="max-w-5xl mx-auto px-4 -mt-8">
        <div className="bg-white/60 backdrop-blur rounded-[2rem] p-2 md:p-4">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('For tenants', 'ভাড়াটিয়াদের জন্য')}</p>
            <h2 className="text-xl md:text-2xl font-black text-gray-900">{tr('Find your next home in 4 steps', '৪টি ধাপে খুঁজে নিন পরবর্তী বাড়ি')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
            {tenantSteps.map((s, i) => (
              <StepCard key={i} n={i + 1} Icon={s.Icon} title={tr(s.en, s.bn)} desc={tr(s.den, s.dbn)} />
            ))}
          </div>
        </div>
      </section>

      {/* Tenant video guides (admin-managed via /admin/support → AI Video Guides) */}
      {tenantVideos.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 mt-8">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <PlayCircle size={20} className="text-[#ba0036] shrink-0" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036]">{tr('Watch & learn', 'দেখে শিখুন')}</p>
              <h3 className="text-lg font-black text-gray-900 leading-tight">{tr('Video guides for tenants', 'ভাড়াটিয়াদের জন্য ভিডিও গাইড')}</h3>
            </div>
          </div>
          <VideoGuides guides={tenantVideos} />
        </section>
      )}

      {/* For owners */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="bg-white/60 backdrop-blur rounded-[2rem] p-2 md:p-4">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('For owners', 'মালিকদের জন্য')}</p>
            <h2 className="text-xl md:text-2xl font-black text-gray-900">{tr('List and let out with ease', 'সহজে প্রপার্টি লিস্ট ও ভাড়া দিন')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
            {landlordSteps.map((s, i) => (
              <StepCard key={i} n={i + 1} Icon={s.Icon} title={tr(s.en, s.bn)} desc={tr(s.den, s.dbn)} />
            ))}
          </div>
        </div>
      </section>

      {/* Owner video guides (admin-managed via /admin/support → AI Video Guides) */}
      {landlordVideos.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 mt-8">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <PlayCircle size={20} className="text-[#ba0036] shrink-0" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036]">{tr('Watch & learn', 'দেখে শিখুন')}</p>
              <h3 className="text-lg font-black text-gray-900 leading-tight">{tr('Video guides for owners', 'মালিকদের জন্য ভিডিও গাইড')}</h3>
            </div>
          </div>
          <VideoGuides guides={landlordVideos} />
        </section>
      )}

      {/* Trust strip */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { Icon: ShieldCheck, en: 'Verified owners', bn: 'ভেরিফাইড মালিক', den: 'Documents checked by our team.', dbn: 'আমাদের টিম কাগজপত্র যাচাই করে।' },
            { Icon: MessageSquare, en: 'In-app chat & calls', bn: 'অ্যাপে চ্যাট ও কল', den: 'Talk safely without sharing your number.', dbn: 'নম্বর শেয়ার না করেই নিরাপদে কথা বলুন।' },
            { Icon: BadgeCheck, en: 'Zero brokerage', bn: 'কোনো দালাল ফি নেই', den: 'Tenants never pay a brokerage fee.', dbn: 'ভাড়াটিয়াদের কোনো দালাল ফি দিতে হয় না।' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <s.Icon size={20} className="text-[#ba0036]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">{tr(s.en, s.bn)}</h3>
                <p className="text-xs font-medium text-gray-500 leading-relaxed mt-0.5">{tr(s.den, s.dbn)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety & Trust */}
      <section id="safety" className="max-w-5xl mx-auto px-4 mt-12 scroll-mt-24">
        <div className="text-center mb-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('Safety & trust', 'নিরাপত্তা ও বিশ্বাস')}</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{tr('Built to keep you safe', 'আপনার নিরাপত্তার জন্য তৈরি')}</h2>
          <p className="text-sm font-medium text-gray-500 mt-2 max-w-2xl mx-auto leading-relaxed">
            {tr('Every step — from listing to move-in — is designed to protect both tenants and owners.', 'লিস্টিং থেকে বাড়িতে ওঠা পর্যন্ত প্রতিটি ধাপ ভাড়াটিয়া ও মালিক উভয়ের সুরক্ষার জন্য ডিজাইন করা।')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {safetyItems.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                <s.Icon size={20} className="text-[#ba0036]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 mb-1">{tr(s.en, s.bn)}</h3>
                <p className="text-sm font-medium text-gray-500 leading-relaxed">{tr(s.den, s.dbn)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 mt-12 scroll-mt-24">
        <div className="text-center mb-8">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('Pricing', 'মূল্য')}</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{tr('Simple, honest pricing', 'সহজ ও স্বচ্ছ মূল্য')}</h2>
          <p className="text-sm font-medium text-gray-500 mt-2 max-w-xl mx-auto">{tr('Everything tenants need is free. Owners can choose the plan that fits.', 'ভাড়াটিয়াদের সবকিছু ফ্রি। মালিকরা নিজের মতো প্ল্যান বেছে নিন।')}</p>
        </div>

        {/* ── ভাড়াটিয়া (Tenant) — Always Free ─────────────────────── */}
        <div className="mb-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-3 px-1">{tr('For Tenants', 'ভাড়াটিয়াদের জন্য')}</p>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Sparkles size={12} /> {tr('Always free', 'সবসময় ফ্রি')}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-gray-900">{tr('Free', 'ফ্রি')}</h3>
                <p className="text-sm font-medium text-gray-400 mt-0.5">{tr('No brokerage, no hidden fees — ever.', 'কোনো দালাল ফি নেই, কোনো লুকানো চার্জ নেই — কখনোই।')}</p>
              </div>
              <button
                onClick={() => navigate('/properties/all')}
                className="shrink-0 bg-gray-900 text-white px-6 py-3 rounded-xl font-black text-sm active:scale-95 transition-transform"
              >
                {tr('Start searching', 'সার্চ শুরু করুন')}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                { en: 'Unlimited property search & filters', bn: 'আনলিমিটেড প্রপার্টি সার্চ ও ফিল্টার' },
                { en: 'Save & bookmark favourite homes', bn: 'পছন্দের বাড়ি সেভ ও বুকমার্ক' },
                { en: 'Message verified owners directly', bn: 'ভেরিফাইড মালিকের সাথে সরাসরি মেসেজ' },
                { en: 'In-app voice & video calls', bn: 'অ্যাপে ভয়েস ও ভিডিও কল' },
                { en: 'Smart alerts for new listings', bn: 'নতুন লিস্টিং-এর স্মার্ট অ্যালার্ট' },
                { en: 'Schedule property visits', bn: 'প্রপার্টি ভিজিট শিডিউল করুন' },
                { en: 'Roommate Wallet (shared expenses)', bn: 'রুমমেট ওয়ালেট (শেয়ারড খরচ)' },
                { en: 'Report & block suspicious users', bn: 'সন্দেহজনক ব্যবহারকারী রিপোর্ট ও ব্লক' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-emerald-600" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{tr(f.en, f.bn)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── মালিক (Owner) — Free / Plus / Pro ────────────── */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-3 px-1">{tr('For Owners', 'মালিকদের জন্য')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Owner FREE */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 flex flex-col">
              <span className="inline-flex self-start items-center px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-wider mb-3">{tr('Free', 'ফ্রি')}</span>
              <p className="text-3xl font-black text-gray-900 mb-0.5">৳০</p>
              <p className="text-xs font-medium text-gray-400 mb-5">{tr('Forever free to list', 'লিস্ট করা চিরকাল ফ্রি')}</p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {[
                  { en: '1 active listing', bn: '১টি অ্যাক্টিভ লিস্টিং' },
                  { en: '5 photos per property', bn: 'প্রতি প্রপার্টিতে ৫টি ছবি' },
                  { en: 'Direct tenant messages', bn: 'সরাসরি ভাড়াটিয়া মেসেজ' },
                  { en: 'In-app chat & calls', bn: 'অ্যাপে চ্যাট ও কল' },
                  { en: 'Owner verification badge', bn: 'মালিক ভেরিফিকেশন ব্যাজ' },
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-gray-600">
                    <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-gray-500" strokeWidth={3} />
                    </div>
                    {tr(f.en, f.bn)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(isAuthenticated ? '/add-property' : '/login?mode=signup&role=landlord')}
                className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-black text-sm active:scale-95 transition-transform hover:bg-gray-200"
              >
                {tr('List for free', 'ফ্রিতে লিস্ট করুন')}
              </button>
            </div>

            {/* Owner PLUS */}
            <div className="bg-white rounded-3xl border-2 border-violet-200 shadow-[0_4px_20px_rgba(124,58,237,0.08)] p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
              <span className="inline-flex self-start items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-wider mb-3">
                <Sparkles size={10} /> {tr('Plus', 'প্লাস')}
              </span>
              <div className="flex items-baseline gap-1 mb-0.5">
                <p className="text-3xl font-black text-gray-900">৳১৯</p>
                <span className="text-sm font-bold text-gray-400">{tr('/month', '/মাস')}</span>
              </div>
              <p className="text-xs font-medium text-gray-400 mb-5">{tr('For 2-3 property owners', '২-৩টি প্রপার্টির মালিকদের জন্য')}</p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {[
                  { en: 'Up to 3 active listings', bn: 'সর্বোচ্চ ৩টি অ্যাক্টিভ লিস্টিং' },
                  { en: '15 photos + 1 video/property', bn: '১৫ ছবি + ১ ভিডিও/প্রপার্টি' },
                  { en: '1× top search boost/month', bn: 'মাসে ১টি টপ সার্চ বুস্ট' },
                  { en: 'Rent collection ledger', bn: 'ভাড়া কালেকশন লেজার' },
                  { en: 'Bookings pipeline', bn: 'বুকিং পাইপলাইন' },
                  { en: 'Facebook boost post', bn: 'ফেসবুক বুস্ট পোস্ট' },
                  { en: 'Plus badge on profile', bn: 'প্রোফাইলে প্লাস ব্যাজ' },
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-gray-600">
                    <div className="w-5 h-5 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-violet-600" strokeWidth={3} />
                    </div>
                    {tr(f.en, f.bn)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(isAuthenticated ? '/subscription' : '/login?mode=signup&role=landlord')}
                className="w-full bg-violet-600 text-white py-3 rounded-xl font-black text-sm shadow-md shadow-violet-600/20 active:scale-95 transition-transform hover:bg-violet-700"
              >
                {tr('Get Plus', 'প্লাস নিন')}
              </button>
            </div>

            {/* Owner PRO — highlighted */}
            <div className="relative bg-gradient-to-br from-[#ba0036] to-[#e60045] text-white rounded-3xl shadow-[0_16px_40px_rgba(186,0,54,0.28)] p-6 flex flex-col overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 backdrop-blur text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                  <Building2 size={10} /> {tr('Pro — Most Popular', 'প্রো — সবচেয়ে জনপ্রিয়')}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-0.5 relative z-10">
                <p className="text-3xl font-black">৳৪৯</p>
                <span className="text-sm font-bold text-red-200">{tr('/month', '/মাস')}</span>
              </div>
              <p className="text-xs font-medium text-red-100 mb-5 relative z-10">{tr('Unlimited properties, full power', 'আনলিমিটেড প্রপার্টি, সম্পূর্ণ ক্ষমতা')}</p>
              <ul className="space-y-2.5 flex-1 mb-6 relative z-10">
                {[
                  { en: 'Unlimited listings', bn: 'আনলিমিটেড লিস্টিং' },
                  { en: '50 photos + 5 videos/property', bn: '৫০ ছবি + ৫ ভিডিও/প্রপার্টি' },
                  { en: 'Super boost + top position', bn: 'সুপার বুস্ট + টপ পজিশন' },
                  { en: 'Smart alerts & notifications', bn: 'স্মার্ট অ্যালার্ট ও নোটিফিকেশন' },
                  { en: 'AI insights & pricing help', bn: 'এআই ইনসাইটস ও প্রাইসিং সাহায্য' },
                  { en: 'Advanced analytics dashboard', bn: 'অ্যাডভান্সড অ্যানালিটিক্স ড্যাশবোর্ড' },
                  { en: 'Rent collection & bookings', bn: 'ভাড়া কালেকশন ও বুকিং' },
                  { en: 'Facebook super boost post', bn: 'ফেসবুক সুপার বুস্ট পোস্ট' },
                  { en: 'Pro badge + Gold Card', bn: 'প্রো ব্যাজ + গোল্ড কার্ড' },
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-red-50">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                    {tr(f.en, f.bn)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(isAuthenticated ? '/subscription' : '/login?mode=signup&role=landlord')}
                className="w-full bg-white text-[#ba0036] py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 relative z-10 hover:bg-red-50"
              >
                {tr('Get Pro', 'প্রো নিন')} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 mt-14">
        <div className="text-center mb-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('FAQ', 'সাধারণ প্রশ্ন')}</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{tr('Questions, answered', 'প্রশ্নের উত্তর')}</h2>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-gray-50 transition-colors"
                >
                  <HelpCircle size={18} className="text-[#ba0036] shrink-0" />
                  <span className="flex-1 text-sm font-bold text-gray-900">{tr(f.q.en, f.q.bn)}</span>
                  <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <p className="px-5 pb-4 pl-[56px] text-sm font-medium text-gray-500 leading-relaxed">
                    {tr(f.a.en, f.a.bn)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Need help — links through to the Help & Support center */}
      <section className="max-w-3xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
            <LifeBuoy size={26} className="text-[#ba0036]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-gray-900">{tr('Still have questions?', 'এখনও প্রশ্ন আছে?')}</h3>
            <p className="text-sm font-medium text-gray-500 leading-relaxed mt-0.5">
              {tr('Our support team is one tap away. Send a request and track replies right here in the app.', 'আমাদের সাপোর্ট টিম এক ট্যাপ দূরে। একটি অনুরোধ পাঠান এবং অ্যাপেই উত্তর দেখুন।')}
            </p>
          </div>
          <button
            onClick={() => navigate('/support')}
            className="w-full sm:w-auto shrink-0 bg-[#ba0036] text-white px-5 py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
          >
            {tr('Get help', 'সাহায্য নিন')} <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 mt-12 text-center">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2">{tr('Ready to get started?', 'শুরু করতে প্রস্তুত?')}</h2>
        <p className="text-sm font-medium text-gray-500 mb-5">{tr('Join over a million Bangladeshis renting the smarter way.', '১০ লাখেরও বেশি বাংলাদেশির সাথে যুক্ত হয়ে স্মার্ট উপায়ে ভাড়া নিন।')}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(isLandlord ? '/add-property' : '/properties/all')}
            className="w-full sm:w-auto bg-[#ba0036] text-white px-6 py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-transform"
          >
            {isLandlord
              ? tr('List property', 'প্রপার্টি লিস্ট করুন')
              : tr('Browse properties', 'প্রপার্টি দেখুন')}
          </button>
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login?mode=signup')}
              className="w-full sm:w-auto bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-xl font-black text-sm active:scale-95 transition-transform"
            >
              {tr('Create an account', 'অ্যাকাউন্ট তৈরি করুন')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
