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
  Lock, PhoneCall, Flag, HelpCircle, ChevronDown, LifeBuoy,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext.jsx';

export default function HowItWorks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isBn = language === 'বাংলা' || language === 'bn';
  const tr = (en, bn) => (isBn ? bn : en);
  const [openFaq, setOpenFaq] = useState(null);

  // Scroll to #pricing (or any hash) when arriving via a hash link.
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.hash]);

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
    { q: { en: 'Is TO-LET PRO free to use?', bn: 'টু-লেট প্রো ব্যবহার কি ফ্রি?' }, a: { en: 'Yes. Searching, contacting verified owners and listing a property are all free. Landlords can optionally upgrade for premium placement and tools.', bn: 'হ্যাঁ। সার্চ করা, ভেরিফাইড মালিকের সাথে যোগাযোগ ও বাড়ি লিস্ট করা সবই ফ্রি। মালিকরা চাইলে প্রিমিয়াম প্লেসমেন্ট ও টুলসের জন্য আপগ্রেড করতে পারেন।' } },
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

      {/* For landlords */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="bg-white/60 backdrop-blur rounded-[2rem] p-2 md:p-4">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('For landlords', 'বাড়িওয়ালাদের জন্য')}</p>
            <h2 className="text-xl md:text-2xl font-black text-gray-900">{tr('List and let out with ease', 'সহজে বাড়ি লিস্ট ও ভাড়া দিন')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
            {landlordSteps.map((s, i) => (
              <StepCard key={i} n={i + 1} Icon={s.Icon} title={tr(s.en, s.bn)} desc={tr(s.den, s.dbn)} />
            ))}
          </div>
        </div>
      </section>

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
        <div className="text-center mb-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#ba0036] mb-1">{tr('Pricing', 'মূল্য')}</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{tr('Simple, honest pricing', 'সহজ ও স্বচ্ছ মূল্য')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tenant plan */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-black text-gray-900">{tr('Tenants', 'ভাড়াটিয়া')}</h3>
            <p className="mt-1 text-3xl font-black text-gray-900">{tr('Free', 'ফ্রি')}</p>
            <p className="text-xs font-medium text-gray-400 mb-4">{tr('Always. No brokerage, ever.', 'সবসময়। কোনো দালাল ফি নেই।')}</p>
            <ul className="space-y-2.5 mb-6">
              {[
                tr('Unlimited search & saved homes', 'আনলিমিটেড সার্চ ও সেভ করা বাড়ি'),
                tr('Message verified owners', 'ভেরিফাইড মালিকের সাথে মেসেজ'),
                tr('Smart alerts for new listings', 'নতুন লিস্টিং-এর স্মার্ট অ্যালার্ট'),
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Check size={16} className="text-emerald-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/properties/all')}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-black text-sm active:scale-95 transition-transform"
            >
              {tr('Start searching', 'সার্চ শুরু করুন')}
            </button>
          </div>

          {/* Landlord plan */}
          <div className="relative bg-gradient-to-br from-[#ba0036] to-[#e60045] text-white rounded-3xl shadow-[0_16px_40px_rgba(186,0,54,0.28)] p-6 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} />
              <h3 className="text-lg font-black">{tr('Landlords', 'বাড়িওয়ালা')}</h3>
            </div>
            <p className="mt-1 text-3xl font-black">{tr('Free to list', 'লিস্টিং ফ্রি')}</p>
            <p className="text-xs font-medium text-red-100 mb-4">{tr('Upgrade for premium placement & tools.', 'প্রিমিয়াম প্লেসমেন্ট ও টুলসের জন্য আপগ্রেড করুন।')}</p>
            <ul className="space-y-2.5 mb-6">
              {[
                tr('Unlimited free listings', 'আনলিমিটেড ফ্রি লিস্টিং'),
                tr('Verified-owner badge', 'ভেরিফাইড-মালিক ব্যাজ'),
                tr('Listing analytics & premium boosts', 'লিস্টিং অ্যানালিটিক্স ও প্রিমিয়াম বুস্ট'),
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm font-medium text-red-50">
                  <Check size={16} className="text-white shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate(isAuthenticated ? '/subscription' : '/login?mode=signup&role=landlord')}
              className="w-full bg-white text-[#ba0036] py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              {tr('Become a landlord', 'বাড়িওয়ালা হোন')} <ArrowRight size={16} />
            </button>
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
            onClick={() => navigate('/properties/all')}
            className="w-full sm:w-auto bg-[#ba0036] text-white px-6 py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-transform"
          >
            {tr('Browse homes', 'বাড়ি দেখুন')}
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
