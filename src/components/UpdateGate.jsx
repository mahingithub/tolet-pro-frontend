import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, Check, Sparkles, X } from 'lucide-react';

import ModalPortal from './shared/ModalPortal';
import { useLanguage } from '../context/LanguageContext';
import { checkForUpdate, isSnoozed, openStore, snooze } from '../services/appUpdate';

/**
 * UpdateGate — tells an installed user that a newer build exists, and sends
 * them straight to the Play Store page.
 *
 * Two shapes, decided by services/appUpdate.js:
 *
 *   required     a full-screen panel with NO close button and no backdrop
 *                dismiss. There is exactly one action: update.
 *   recommended  a bottom sheet listing what is new, with "later" — which
 *                postpones it for a day rather than forever, so the nudge
 *                actually lands eventually.
 *
 * The required screen deliberately does not register a back guard: Back should
 * not dismiss it. It cannot trap the user either — Back still exits the app,
 * because hooks/useAndroidBackButton.js owns that and this renders no history
 * entry of its own.
 *
 * Native only. On the website there is nothing to update, and the check
 * short-circuits before any fetch.
 */
export default function UpdateGate() {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // DEV ONLY — preview either shape without waiting for a real release:
    //   ?forceUpdateGate=recommended
    //   ?forceUpdateGate=required
    // Guarded by import.meta.env.DEV, which Vite replaces with the literal
    // `false` in a production build, so the whole branch is dropped. Without
    // this the gate is unreachable off a device and ships unseen.
    if (import.meta.env.DEV) {
      const forced = new URLSearchParams(window.location.search).get('forceUpdateGate');
      if (forced === 'recommended' || forced === 'required') {
        setState({
          status: forced,
          currentCode: 1,
          latestCode: 11,
          latestName: '1.0.9 (preview)',
          notes: {
            bn: ['ব্যাক বাটনে এখন অ্যাপ ঠিকমতো বন্ধ হয়', 'উপরের হেডার ঘড়ির নিচে ঢোকা ঠিক হয়েছে'],
            en: ['The back button now closes the app properly', 'Fixed the header sitting under the status bar'],
          },
        });
        return undefined;
      }
    }

    let cancelled = false;
    // A beat after launch: the first seconds belong to the app's own content,
    // not to a dialog about the app.
    const timer = setTimeout(async () => {
      const result = await checkForUpdate();
      if (cancelled || result.status === 'none') return;
      if (result.status === 'recommended' && isSnoozed()) return;
      setState(result);
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  if (!state || dismissed) return null;

  const required = state.status === 'required';
  const notes = (isBn ? state.notes.bn : state.notes.en).filter(Boolean).slice(0, 5);

  const t = isBn
    ? {
        title: required ? 'আপডেট করা জরুরি' : 'নতুন আপডেট এসেছে',
        version: `সংস্করণ ${state.latestName}`,
        blurb: required
          ? 'এই সংস্করণটি আর চলবে না। চালিয়ে যেতে অ্যাপটি আপডেট করুন।'
          : 'আপডেট করলে নতুন ফিচারগুলো চালু হবে আর আগের সমস্যাগুলো ঠিক হয়ে যাবে।',
        whatsNew: 'এই আপডেটে যা আছে',
        cta: 'এখনই আপডেট করুন',
        later: 'পরে দেখব',
      }
    : {
        title: required ? 'Update required' : 'A new update is ready',
        version: `Version ${state.latestName}`,
        blurb: required
          ? 'This version can no longer be used. Please update to continue.'
          : 'Updating unlocks the new features and fixes the problems you have been hitting.',
        whatsNew: "What's in this update",
        cta: 'Update now',
        later: 'Maybe later',
      };

  const Notes = () =>
    notes.length === 0 ? null : (
      <div className="w-full text-left">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{t.whatsNew}</p>
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-2">
              <Check size={15} className="text-[#ba0036] shrink-0 mt-0.5" />
              <span className="text-[13px] font-semibold text-gray-700 leading-snug">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  const Cta = () => (
    <button
      onClick={openStore}
      className="w-full bg-[#ba0036] hover:bg-[#90002a] text-white py-3.5 rounded-2xl font-black text-[15px] shadow-[0_10px_28px_-10px_rgba(186,0,54,0.7)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
    >
      <ArrowUpCircle size={18} /> {t.cta}
    </button>
  );

  if (required) {
    return (
      <ModalPortal>
        {/* pt-safe/pb-safe: this covers the whole screen, so it owns both
            system-bar insets itself. */}
        <div className="fixed inset-0 z-[9998] bg-white flex flex-col items-center justify-center px-6 pt-safe pb-safe">
          <div className="w-full max-w-sm flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ba0036] to-[#ff004c] flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(186,0,54,0.6)]">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">{t.title}</h2>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#ba0036] mt-1">{t.version}</p>
              <p className="text-sm font-semibold text-gray-500 mt-2 leading-relaxed">{t.blurb}</p>
            </div>
            <Notes />
            <Cta />
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9998] flex items-end justify-center">
        <button
          type="button"
          aria-label={t.later}
          onClick={() => { snooze(); setDismissed(true); }}
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        />
        {/* pb-safe-5 so the actions clear the gesture bar on every phone. */}
        <div className="relative w-full max-w-md bg-white rounded-t-[2rem] px-5 pt-5 pb-safe-5 shadow-[0_-20px_60px_rgba(0,0,0,0.25)] animate-in slide-in-from-bottom-10 duration-300">
          <button
            onClick={() => { snooze(); setDismissed(true); }}
            aria-label={t.later}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:bg-gray-100 active:scale-90 transition-all"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ba0036] to-[#ff004c] flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-gray-900 tracking-tight leading-tight">{t.title}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ba0036]">{t.version}</p>
            </div>
          </div>

          <p className="text-[13px] font-semibold text-gray-500 leading-relaxed mb-4">{t.blurb}</p>
          <div className="mb-5"><Notes /></div>
          <Cta />
          <button
            onClick={() => { snooze(); setDismissed(true); }}
            className="w-full mt-2 py-2.5 text-[13px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t.later}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
