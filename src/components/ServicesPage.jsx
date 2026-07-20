// ServicesPage.jsx
//
// Tenant "Services" hub — a catalogue of everyday home services a renter
// commonly needs (education/tutoring, internet, utilities, cleaning,
// repairs, moving, etc.), shown as tappable icon boxes.
//
// Reached from the tenant dashboard's "Services" nav card (→ /services).
//
// There is no dedicated services backend yet, so tapping a category routes
// the user into the existing Help & Support request flow (/support) with the
// chosen service passed along as context. When a real services API lands,
// swap the onSelect handler for the matching endpoint — the grid + i18n stay.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft, ChevronRight, Sparkles, GraduationCap, Wifi, Zap, Flame,
  Droplets, Wrench, ShieldCheck, Truck, Shirt, Bug, Utensils, LifeBuoy,
} from 'lucide-react';

// Each service: stable id, bilingual label + one-line description, an icon,
// and a soft tint (bg + text) for the icon chip.
const SERVICES = [
  { id: 'education',   Icon: GraduationCap, tint: 'bg-indigo-50 text-indigo-600 border-indigo-100',   en: 'Education',        bn: 'শিক্ষা',          descEn: 'Tutors & coaching',     descBn: 'টিউটর ও কোচিং' },
  { id: 'internet',    Icon: Wifi,          tint: 'bg-blue-50 text-blue-600 border-blue-100',         en: 'Internet',         bn: 'ইন্টারনেট',        descEn: 'Broadband & WiFi',      descBn: 'ব্রডব্যান্ড ও ওয়াইফাই' },
  { id: 'electricity', Icon: Zap,           tint: 'bg-amber-50 text-amber-600 border-amber-100',      en: 'Electricity',      bn: 'বিদ্যুৎ',          descEn: 'Wiring & fixes',        descBn: 'ওয়্যারিং ও মেরামত' },
  { id: 'gas',         Icon: Flame,         tint: 'bg-orange-50 text-orange-600 border-orange-100',   en: 'Gas',              bn: 'গ্যাস',           descEn: 'Line & cylinder',       descBn: 'লাইন ও সিলিন্ডার' },
  { id: 'water',       Icon: Droplets,      tint: 'bg-cyan-50 text-cyan-600 border-cyan-100',         en: 'Water',            bn: 'পানি',            descEn: 'Supply & pumps',        descBn: 'সরবরাহ ও পাম্প' },
  { id: 'cleaning',    Icon: Sparkles,      tint: 'bg-emerald-50 text-emerald-600 border-emerald-100', en: 'Home Cleaning',    bn: 'ক্লিনিং',          descEn: 'Deep & regular',        descBn: 'ডিপ ও নিয়মিত' },
  { id: 'repairs',     Icon: Wrench,        tint: 'bg-gray-100 text-gray-600 border-gray-200',        en: 'Repairs',          bn: 'মেরামত',          descEn: 'Plumbing & more',       descBn: 'প্লাম্বিং ও আরও' },
  { id: 'security',    Icon: ShieldCheck,   tint: 'bg-rose-50 text-rose-600 border-rose-100',         en: 'Security',         bn: 'নিরাপত্তা',        descEn: 'CCTV & guards',         descBn: 'সিসিটিভি ও গার্ড' },
  { id: 'movers',      Icon: Truck,         tint: 'bg-violet-50 text-violet-600 border-violet-100',   en: 'Movers',           bn: 'শিফটিং',          descEn: 'Shifting & packing',    descBn: 'শিফটিং ও প্যাকিং' },
  { id: 'laundry',     Icon: Shirt,         tint: 'bg-sky-50 text-sky-600 border-sky-100',            en: 'Laundry',          bn: 'লন্ড্রি',          descEn: 'Wash & iron',           descBn: 'ওয়াশ ও আয়রন' },
  { id: 'pest',        Icon: Bug,           tint: 'bg-lime-50 text-lime-600 border-lime-100',         en: 'Pest Control',     bn: 'পেস্ট কন্ট্রোল',    descEn: 'Safe & certified',      descBn: 'নিরাপদ ও সার্টিফায়েড' },
  { id: 'cook',        Icon: Utensils,      tint: 'bg-pink-50 text-pink-600 border-pink-100',         en: 'Cook / Chef',      bn: 'রান্না',          descEn: 'Home cooking help',     descBn: 'ঘরের রান্নার সহায়তা' },
];

const ServicesPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/tenant-dashboard');
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  // No services backend yet → confirm the pick and route into the existing
  // support/request flow so the tenant can actually describe what they need.
  const onSelect = (svc) => {
    const label = bn ? svc.bn : svc.en;
    toast.success(
      bn ? `${label} সার্ভিসের অনুরোধ নেওয়া হচ্ছে…` : `Requesting ${label} service…`,
    );
    navigate('/support', { state: { source: 'services', service: svc.id, serviceLabel: label } });
  };

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans text-gray-900 selection:bg-[#ba0036] selection:text-white">
      {/* Decorative glow, matching the dashboard shell */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-24">
        {/* Back */}
        <button
          onClick={goBack}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95 mb-5"
        >
          <ArrowLeft size={14} className="-ml-1 group-hover:-translate-x-0.5 transition-transform" />
          {bn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to dashboard'}
        </button>

        {/* Hero */}
        <div className="mb-6 md:mb-8 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-7 bg-gradient-to-br from-[#ba0036] via-[#a1002f] to-[#3a0011] text-white shadow-[0_20px_50px_-20px_rgba(186,0,54,0.5)] relative overflow-hidden">
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
                {bn ? 'আপনার প্রয়োজনীয় সার্ভিস বেছে নিন' : 'Everything your home needs'}
              </h1>
              <p className="mt-1.5 text-[12px] md:text-sm font-bold text-white/75 leading-snug max-w-prose">
                {bn
                  ? 'যেকোনো সার্ভিসে ট্যাপ করে অনুরোধ পাঠান — আমরা ভেরিফাইড প্রোভাইডারের সাথে যুক্ত করে দেব।'
                  : 'Tap any service to request it — we\u2019ll connect you with verified providers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {SERVICES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => onSelect(svc)}
              className="group relative text-left bg-white/90 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] active:scale-[0.98] transition-all duration-300 flex flex-col gap-3 overflow-hidden"
            >
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl border flex items-center justify-center shadow-sm ${svc.tint} group-hover:scale-105 transition-transform`}>
                <svc.Icon size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2.3} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] md:text-sm font-black text-gray-900 leading-tight">{bn ? svc.bn : svc.en}</p>
                <p className="text-[10px] md:text-[11px] font-bold text-gray-400 leading-tight mt-0.5 truncate">{bn ? svc.descBn : svc.descEn}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#ba0036] mt-auto">
                {bn ? 'অনুরোধ করুন' : 'Request'}
                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>

        {/* Custom request */}
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
    </div>
  );
};

export default ServicesPage;
