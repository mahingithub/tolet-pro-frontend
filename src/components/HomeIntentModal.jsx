/**
 * HomeIntentModal — the one question a brand-new tenant is asked.
 * ──────────────────────────────────────────────────────────────────────────
 * Signup already establishes WHO the person is: the form makes them pick
 * tenant or landlord before an account exists (LoginPage's role toggle). So
 * this never asks that again, and never appears for a landlord at all — their
 * home is the host dashboard and there is nothing to decide.
 *
 * What signup does NOT establish is what a tenant came for. Two people pick
 * "ভাড়াটিয়া" for completely different reasons: one is hunting for a flat, the
 * other shares a mess and wants somewhere to write down the bazar. Sending the
 * second one to a listings feed — or the first one to a meal-rate screen — is
 * how an app gets deleted on day one.
 *
 * Timing matters as much as the question. It waits for `welcomeRobotFinished`
 * rather than firing on signup directly, because the welcome robot is already
 * on screen at that moment and two overlays stacked on a new user is worse
 * than no onboarding at all.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wallet, X } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext.jsx';
import useLivingStore from '../store/useLivingStore';
import { ModeChooser } from './living/LivingMode';

export default function HomeIntentModal() {
  const [open, setOpen] = useState(false);
  // 'intent' = the one question; 'wallet' = the solo/joint fork that follows it.
  const [stage, setStage] = useState('intent');
  const navigate = useNavigate();
  const { update } = useSettings();
  const setLivingMode = useLivingStore((s) => s.setLivingMode);
  const lang = useLanguage();
  const isBn = lang?.language === 'বাংলা' || lang?.language === 'bn';

  useEffect(() => {
    // Only after a SIGNUP, and only for a tenant. A landlord's home is settled
    // by the role they picked on the form; asking them anything here is noise.
    let pending = false;
    let cancelled = false;
    const onTriggered = (e) => {
      const { role, type } = e.detail || {};
      pending = type === 'signup' && role === 'tenant';
    };

    const onFinished = async () => {
      if (!pending) return;
      pending = false;
      // `welcomeRobotFinished` fires when the robot STARTS leaving, not when it
      // is gone — it then plays a fade and a fly-to-corner animation, and its
      // overlay sits at z-[99999], well above this one. Opening now would put
      // the question behind the robot. So wait for the overlay to actually
      // unmount, but never longer than a beat: if the robot ever changes shape,
      // a new user must still get asked rather than silently skipped.
      for (let i = 0; i < 30 && !cancelled; i++) {
        if (!document.getElementById('welcome-robot-overlay')) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled) return;
      setStage('intent');
      setOpen(true);
    };

    window.addEventListener('triggerWelcomeRobot', onTriggered);
    window.addEventListener('welcomeRobotFinished', onFinished);
    return () => {
      cancelled = true;
      window.removeEventListener('triggerWelcomeRobot', onTriggered);
      window.removeEventListener('welcomeRobotFinished', onFinished);
    };
  }, []);

  // Skipping is a real answer too: it means "leave it as it was", which is the
  // 'auto' behaviour the app has always had. Nothing is written.
  const dismiss = useCallback(() => setOpen(false), []);

  const chooseBrowsing = useCallback(() => {
    update({ app: { defaultHome: 'explore' } }).catch(() => {});
    setOpen(false);
  }, [update]);

  const chooseLedger = useCallback(() => {
    update({ app: { defaultHome: 'living' } }).catch(() => {});
    // Straight into the একা / যৌথ fork rather than dropping them on /living to
    // meet it cold — it is the same question, so it belongs in the same breath.
    setStage('wallet');
  }, [update]);

  const chooseWallet = useCallback(
    (walletMode) => {
      setLivingMode(walletMode);
      update({ app: { livingMode: walletMode } }).catch(() => {});
      setOpen(false);
      navigate('/living');
    },
    [navigate, setLivingMode, update],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? 'শুরু করি' : 'Getting started'}
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-[#eaeff5] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl">
        <div className="sticky top-0 bg-[#eaeff5]/95 backdrop-blur-xl px-5 pt-4 pb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#ba0036] bg-[#ba0036]/10 px-3 py-1.5 rounded-full">
              {isBn ? 'স্বাগতম' : 'Welcome'}
            </span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-2 rounded-xl bg-white/70 border border-white/80 text-gray-400 hover:text-gray-700 active:scale-90 transition shrink-0"
            aria-label={isBn ? 'পরে ঠিক করব' : 'Decide later'}
          >
            <X size={17} />
          </button>
        </div>

        {stage === 'intent' ? (
          <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <h2 className="text-[22px] md:text-[26px] font-black text-gray-900 tracking-tight leading-tight mt-1">
              {isBn ? 'কী করতে এসেছেন?' : 'What brings you here?'}
            </h2>
            <p className="text-[13px] font-semibold text-gray-500 mt-1.5 mb-5 leading-relaxed">
              {isBn
                ? 'এটা দিয়ে ঠিক হবে অ্যাপ খুললে প্রথমে কী দেখবেন। দুটোই সবসময় পাবেন — যখন খুশি বদলাতে পারবেন।'
                : 'This just sets what you see first. Both are always available, and you can change it whenever you like.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <IntentCard
                icon={Search}
                title={isBn ? 'বাসা খুঁজছি' : 'I am looking for a place'}
                body={
                  isBn
                    ? 'ভাড়ার বিজ্ঞাপন দেখব, বাড়িওয়ালার সাথে কথা বলব।'
                    : 'Browse to-let listings and talk to landlords.'
                }
                onClick={chooseBrowsing}
              />
              <IntentCard
                icon={Wallet}
                title={isBn ? 'খরচের হিসাব রাখব' : 'I want to track my costs'}
                body={
                  isBn
                    ? 'মিল, বাজার, বিল আর মাসের খরচ — সব এক খাতায়।'
                    : 'Meals, bazar, bills and monthly spending in one ledger.'
                }
                onClick={chooseLedger}
              />
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="w-full mt-4 py-3 text-[12.5px] font-bold text-gray-400 hover:text-gray-600 transition"
            >
              {isBn ? 'এখন থাক, পরে ঠিক করব' : 'Skip — I will decide later'}
            </button>
          </div>
        ) : (
          <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* The same picker Living itself uses — one description of solo vs
                shared in the whole app, so the two can never drift apart. */}
            <ModeChooser isBn={isBn} onPick={chooseWallet} />
          </div>
        )}
      </div>
    </div>
  );
}

const IntentCard = ({ icon: Icon, title, body, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full text-left rounded-[2rem] border border-gray-100 bg-white p-5 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)] hover:border-[#ba0036]/40 transition active:scale-[0.99]"
  >
    <span className="w-12 h-12 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center group-hover:bg-[#ba0036] group-hover:text-white transition">
      <Icon size={22} strokeWidth={2.3} />
    </span>
    <p className="text-[16px] font-black text-gray-900 tracking-tight mt-3.5">{title}</p>
    <p className="text-[12px] font-semibold text-gray-500 mt-1 leading-relaxed">{body}</p>
  </button>
);
