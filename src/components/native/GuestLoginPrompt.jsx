import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import { useIsBn } from '../../context/LanguageContext';
import { GUEST_SAVE_EVENT } from '../../utils/guestSave';
import { nativeLoginUrl } from '../../utils/nativeExperience';

/**
 * The one "sign in to save" ask in the app. Mounted globally, raised by
 * utils/guestSave.js from wherever a write was attempted.
 *
 * Dismissible by design: browsing continues, only that save is held back. The
 * login it opens carries `next`, so the user lands back on the screen they were
 * on — and the Add Property wizard republishes its parked draft by itself.
 */
export default function GuestLoginPrompt() {
  const navigate = useNavigate();
  const isBn = useIsBn();
  const [ask, setAsk] = useState(null);

  useEffect(() => {
    const onAsk = (e) => setAsk(e.detail || {});
    window.addEventListener(GUEST_SAVE_EVENT, onAsk);
    return () => window.removeEventListener(GUEST_SAVE_EVENT, onAsk);
  }, []);

  if (!ask) return null;

  const close = () => setAsk(null);
  const goLogin = (mode) => {
    const url = nativeLoginUrl({ next: ask.next });
    setAsk(null);
    navigate(mode === 'signup' ? `${url}&mode=signup` : url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
        onClick={close}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      {/* safe-area-ok — the sheet reserves the bottom inset itself (pb-safe-5). */}
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] px-6 pt-6 pb-safe-5 shadow-[0_-10px_40px_-12px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          onClick={close}
          aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
        >
          <X size={17} />
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ba0036]/10 text-[#ba0036]">
          <LogIn size={24} />
        </span>
        <h2 className="mt-4 text-xl font-black tracking-tight text-slate-900 dark:text-white">
          {isBn ? 'সেভ করতে লগইন করুন' : 'Sign in to save'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {isBn
            ? 'ঘুরে দেখা চালিয়ে যেতে পারেন — শুধু তথ্য সেভ করতে অ্যাকাউন্ট লাগবে। লগইনের পর আপনি এখানেই ফিরে আসবেন।'
            : 'Keep looking around — an account is only needed to save. You will come back to this screen afterwards.'}
        </p>

        <button
          type="button"
          onClick={() => goLogin('login')}
          className="mt-5 w-full min-h-14 flex items-center justify-center gap-2 rounded-2xl bg-[#ba0036] text-white font-bold active:scale-[0.99] transition"
        >
          {isBn ? 'লগইন করুন' : 'Log in'}
        </button>
        <button
          type="button"
          onClick={() => goLogin('signup')}
          className="mt-2 w-full min-h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-[0.99] transition"
        >
          {isBn ? 'নতুন অ্যাকাউন্ট খুলুন' : 'Create an account'}
        </button>
        <button
          type="button"
          onClick={close}
          className="mt-2 w-full min-h-12 text-sm font-bold text-slate-500 dark:text-slate-400"
        >
          {isBn ? 'এখন নয়, ঘুরে দেখি' : 'Not now, keep looking'}
        </button>
      </div>
    </div>
  );
}
