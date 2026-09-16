import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CalendarCheck, PlusCircle, RefreshCw, Users, Wallet } from 'lucide-react';
import { useIsBn } from '../../context/LanguageContext';
import { NATIVE_START_PATH, nativeLoginUrl } from '../../utils/nativeExperience';

/**
 * What a signed-out landlord sees in the installed app at /host-dashboard.
 * The real dashboard is account data from the first request, so this shows the
 * same jobs with empty numbers. Every job goes straight to login as a landlord
 * and returns to that exact tab (useTabHistory reads ?tab=) afterwards.
 */
export default function NativeHostPreview() {
  const navigate = useNavigate();
  const isBn = useIsBn();
  const login = (next) => navigate(nativeLoginUrl({ next }));

  const stats = [
    { label: isBn ? 'প্রপার্টি' : 'Properties' },
    { label: isBn ? 'ভাড়াটিয়া' : 'Tenants' },
    { label: isBn ? 'এ মাসের ভাড়া' : 'Rent this month' },
  ];
  const jobs = [
    { icon: Wallet, next: '/host-dashboard?tab=rent', title: isBn ? 'ভাড়ার হিসাব' : 'Rent ledger', body: isBn ? 'কে দিল, কার বাকি — মাস ধরে।' : 'Who has paid and who owes, month by month.' },
    { icon: CalendarCheck, next: '/host-dashboard?tab=bookings', title: isBn ? 'ভাড়াটিয়া ও বুকিং' : 'Tenants & bookings', body: isBn ? 'ভাড়াটিয়া যোগ করুন, ইউনিট বুঝিয়ে দিন।' : 'Add tenants and hand over units.' },
    { icon: Building2, next: '/host-dashboard?tab=properties', title: isBn ? 'আমার প্রপার্টি' : 'My properties', body: isBn ? 'বিল্ডিং, ফ্লোর ও ইউনিট সাজান।' : 'Set up buildings, floors and units.' },
  ];

  return (
    // dark: on the page background too — html.dark turns bg-white cards and
    // text-slate-900 dark/light, but not an arbitrary colour, which left light
    // text on a light page with the phone in dark mode.
    <main className="min-h-screen bg-[#f7f3f1] dark:bg-slate-950 text-slate-900 px-4 pt-safe-4 pb-rail-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ba0036] text-white"><Building2 size={20} /></span>
            <div>
              <p className="text-base font-black leading-none">{isBn ? 'বাড়িওয়ালার খাতা' : 'Landlord desk'}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#ba0036]">TO-LET PRO</p>
            </div>
          </div>
          <button type="button" onClick={() => login('/host-dashboard?tab=dashboard')}
            className="min-h-11 px-4 rounded-full bg-white text-sm font-bold text-[#ba0036] shadow-sm active:scale-95 transition">
            {isBn ? 'লগইন' : 'Log in'}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {stats.map(({ label }) => (
            <div key={label} className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xl font-black text-slate-300">—</p>
              <p className="mt-1 text-[11px] font-bold leading-tight text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => login('/list-property')}
          className="mt-4 w-full flex items-center gap-4 rounded-3xl bg-gradient-to-br from-[#ba0036] to-[#7a0024] p-5 text-left text-white shadow-[0_14px_30px_-12px_rgba(186,0,54,0.55)] active:scale-[0.99] transition">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><PlusCircle size={26} /></span>
          <span className="flex-1">
            <span className="block text-base font-black">{isBn ? 'প্রপার্টি যোগ করুন' : 'Add a property'}</span>
            <span className="block mt-1 text-sm text-white/80">{isBn ? 'বিজ্ঞাপন দিন, ভাড়াটিয়া খুঁজুন।' : 'List it and find tenants.'}</span>
          </span>
          <ArrowRight size={20} />
        </button>

        <div className="mt-4 space-y-3">
          {jobs.map(({ icon: Icon, next, title, body }) => (
            <button key={next} type="button" onClick={() => login(next)}
              className="w-full flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm active:scale-[0.99] transition">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ba0036]/10 text-[#ba0036]"><Icon size={22} /></span>
              <span className="flex-1">
                <span className="block text-[15px] font-bold">{title}</span>
                <span className="block mt-1 text-sm leading-relaxed text-slate-500">{body}</span>
              </span>
              <ArrowRight size={18} className="text-slate-300" />
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Users size={14} />
          <span>{isBn ? 'ঘুরে দেখতে লগইন লাগবে না।' : 'No login needed to look around.'}</span>
        </div>
        <button type="button" onClick={() => navigate(NATIVE_START_PATH)}
          className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 px-3 text-sm font-bold text-[#ba0036]">
          <RefreshCw size={15} />{isBn ? 'অ্যাপ ব্যবহারের ধরন বদলান' : 'Change how I use the app'}
        </button>
      </div>
    </main>
  );
}
