import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Check, House, Search, Wallet } from 'lucide-react';
import { useIsBn } from '../../context/LanguageContext';
import useNativeExperience from '../../hooks/useNativeExperience';
import { getNativeHome } from '../../utils/nativeExperience';

export default function NativeStart() {
  const navigate = useNavigate();
  const isBn = useIsBn();
  const { isNative, experience, homePath, selectExperience } = useNativeExperience();
  const [stage, setStage] = useState('role');
  const [role, setRole] = useState(experience?.role || null);
  const [intent, setIntent] = useState(experience?.role === 'tenant' ? experience.mode : null);
  if (!isNative) return <Navigate to="/" replace />;

  const finish = (nextRole, mode) => {
    const preference = selectExperience(nextRole, mode);
    navigate(getNativeHome(preference), { replace: true });
  };
  const proceed = () => {
    if (stage === 'role') {
      if (role === 'landlord') finish(role, 'host');
      else if (role === 'tenant') setStage('intent');
    } else if (intent) finish('tenant', intent);
  };
  const options = stage === 'role' ? [
    { id: 'tenant', icon: House, title: isBn ? 'আমি ভাড়াটিয়া' : 'I am a tenant', body: isBn ? 'বাসা খুঁজুন অথবা নিজের ও যৌথ খরচের হিসাব রাখুন।' : 'Find a home or keep track of personal and shared expenses.' },
    { id: 'landlord', icon: Building2, title: isBn ? 'আমি বাড়িওয়ালা' : 'I am a landlord', body: isBn ? 'প্রপার্টি, ভাড়াটিয়া ও ভাড়ার হিসাব এক জায়গায় সামলান।' : 'Manage your properties, tenants and rent in one place.' },
  ] : [
    { id: 'living', icon: Wallet, title: isBn ? 'হিসাব রাখব — Living' : 'Track expenses — Living', body: isBn ? 'নিজের খাতা বা মেসের মিল, বাজার ও বিলের হিসাব।' : 'Your own ledger, or meals, groceries and bills with housemates.' },
    { id: 'search', icon: Search, title: isBn ? 'বাসা খুঁজব' : 'Find a home', body: isBn ? 'এলাকা ও বাজেট অনুযায়ী ভাড়ার বাসা খুঁজে দেখুন।' : 'Explore rental homes by location and budget.' },
  ];
  const selected = stage === 'role' ? role : intent;

  return (
    <main className="min-h-[100dvh] bg-[#f7f3f1] dark:bg-slate-950 text-slate-900 dark:text-white px-5 pt-safe pb-safe">
      {/* The page already reserves both insets, so the column is the screen
          minus them — a bare 100dvh pushed the button and hint under the
          Android navigation bar. */}
      <div className="max-w-md mx-auto flex min-h-[calc(100dvh-var(--sat)-var(--sab))] flex-col py-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-black tracking-[0.14em] text-[#ba0036]">TO-LET PRO</span>
          {(stage === 'intent' || experience) && (
            <button type="button" onClick={() => stage === 'intent' ? setStage('role') : navigate(homePath, { replace: true })}
              className="flex min-h-11 items-center gap-1.5 px-3 rounded-full bg-white dark:bg-slate-900 text-sm font-semibold">
              <ArrowLeft size={16} />{isBn ? 'ফিরে যান' : 'Back'}
            </button>
          )}
        </div>
        <div className="mt-10 mb-7">
          <div className="flex gap-1.5 mb-6" aria-hidden="true">
            <span className="h-1.5 w-9 rounded-full bg-[#ba0036]" />
            <span className={`h-1.5 w-9 rounded-full ${stage === 'intent' ? 'bg-[#ba0036]' : 'bg-[#ba0036]/15'}`} />
          </div>
          <p className="text-sm font-semibold text-[#ba0036] mb-2">{isBn ? 'আপনার মতো করে শুরু করুন' : 'Make yourself at home'}</p>
          <h1 className="text-[32px] leading-tight font-black tracking-tight">
            {stage === 'role' ? (isBn ? 'আপনি কে?' : 'Which describes you?') : (isBn ? 'কী করতে চান?' : 'What brings you here?')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {isBn ? 'আপনার নির্বাচন অনুযায়ী অ্যাপ সাজানো হবে। পরে প্রোফাইল থেকে বদলাতে পারবেন।' : 'We will open the app around your choice. You can change it later from Profile.'}
          </p>
        </div>
        <div role="group" aria-label={stage === 'role' ? (isBn ? 'পরিচয়' : 'Your role') : (isBn ? 'ব্যবহারের উদ্দেশ্য' : 'Your purpose')} className="space-y-3">
          {options.map(({ id, icon: Icon, title, body }) => (
            <button key={id} type="button" aria-pressed={selected === id}
              onClick={() => stage === 'role' ? setRole(id) : setIntent(id)}
              className={`w-full flex items-start gap-4 text-left rounded-3xl border-2 p-5 transition active:scale-[0.99] ${selected === id ? 'border-[#ba0036] bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent bg-white/70 dark:bg-slate-900/70'}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ba0036]/10 text-[#ba0036]"><Icon size={24} /></span>
              <span className="flex-1"><span className="block text-base font-bold">{title}</span><span className="block mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{body}</span></span>
              <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected === id ? 'border-[#ba0036] bg-[#ba0036] text-white' : 'border-slate-300'}`}>{selected === id && <Check size={13} />}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto pt-8 pb-3">
          <button type="button" disabled={!selected} onClick={proceed}
            className="w-full min-h-14 flex items-center justify-center gap-3 rounded-2xl bg-[#ba0036] text-white font-bold disabled:opacity-40 active:scale-[0.99] transition">
            {isBn ? 'শুরু করুন' : 'Get started'}<ArrowRight size={19} />
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400 mt-4">
            {isBn ? 'ঘুরে দেখতে লগইন লাগবে না। কিছু যোগ বা সেভ করতে লগইন করুন।' : 'Explore without signing in. Sign in when you want to add or save something.'}
          </p>
        </div>
      </div>
    </main>
  );
}
