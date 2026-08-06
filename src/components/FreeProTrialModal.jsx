/**
 * FreeProTrialModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The "earn a free Pro trial by sharing the app" flow. Two screens in one
 * modal:
 *
 *   1. BANNER — the offer. "Skip" leaves the host on Free, "Get Free Pro"
 *      moves to the task.
 *   2. TASK   — an admin-managed walkthrough video (AI Video Guides →
 *      placement "free_trial_mode") plus the one action that earns the
 *      reward: sharing the app link. Clicking Share opens the native share
 *      sheet and starts a {UNLOCK_DELAY_MS} countdown; when it lands we call
 *      the backend, which is what actually grants the trial.
 *
 * The grant is server-side on purpose (POST /api/billing/share-trial). Photo /
 * video caps are enforced in the API on publish, so a local-only "hasProTrial"
 * flag would unlock the wizard and then fail at Publish.
 *
 * Opened from the listing wizard (AddProperty — on entry and when a free host
 * hits the 5-photo / no-video ceiling) and from the host dashboard.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crown, Share2, Sparkles, Check, Loader2, PlayCircle, Images, Video, TrendingUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getSectionGuides } from '../services/aiGuideService';
import { subscriptionService } from '../services/subscriptionService';
import { PLAY_STORE_URL } from '../hooks/useAppInstall';

// How long after the share tap the reward lands. Deliberately short — it is a
// "thanks for sharing" beat, not an anti-abuse delay (the backend's one-claim
// -per-account latch is what stops repeat grants).
const UNLOCK_DELAY_MS = 5000;

// Months of Pro the share task grants. Mirrors TRIAL_MONTHS in
// tolet-pro-backend/utils/subscriptionTier.js, which is what actually sets the
// expiry — this copy only words the marketing line.
const TRIAL_MONTHS = 2;

/** YouTube watch/short links → embeddable form. Anything else is passed through. */
const toEmbedUrl = (url) => {
  if (!url) return '';
  try {
    if (url.includes('youtube.com/watch')) {
      const id = new URL(url).searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1].split(/[?&]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
  } catch {
    return url;
  }
  return url;
};

// Why the modal was opened — drives the sub-headline so the host understands
// what they just bumped into.
const REASON_COPY = {
  photos: {
    en: 'Free listings include 5 photos. Unlock 50 photos per property with Pro.',
    bn: 'ফ্রি লিস্টিংয়ে ৫টি ছবি দেওয়া যায়। প্রো নিলে প্রতি প্রপার্টিতে ৫০টি ছবি।',
  },
  video: {
    en: 'Video tours are a Pro feature. Unlock up to 5 videos per property.',
    bn: 'ভিডিও ট্যুর প্রো ফিচার। প্রো নিলে প্রতি প্রপার্টিতে ৫টি ভিডিও।',
  },
  entry: {
    en: 'Publish a stronger listing — more photos, video tours and top position in search.',
    bn: 'আরও ভালো লিস্টিং দিন — বেশি ছবি, ভিডিও ট্যুর আর সার্চে শীর্ষ অবস্থান।',
  },
  manual: {
    en: 'Share ToLet Pro with one tap and get Pro free — no card, no payment.',
    bn: 'এক ট্যাপে ToLet Pro শেয়ার করুন, ফ্রিতে প্রো পান — কার্ড বা পেমেন্ট লাগবে না।',
  },
};

const FreeProTrialModal = ({ open, onSkip, onUnlocked, reason = 'entry' }) => {
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';

  // 'banner' → 'task' → 'unlocking' → 'done' (or 'error')
  const [step, setStep] = useState('banner');
  const [videoUrl, setVideoUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // One interval + one timeout own the countdown; both are cleared on close and
  // unmount so a modal dismissed mid-countdown never claims behind the host's
  // back or setStates after teardown.
  const tickRef = useRef(null);
  const unlockRef = useRef(null);
  const aliveRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (unlockRef.current) { clearTimeout(unlockRef.current); unlockRef.current = null; }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; clearTimers(); };
  }, [clearTimers]);

  // Reset to the banner every time the modal is (re)opened, and lock the page
  // behind it. A host who skipped at the photo cap and comes back from the
  // dashboard should see the offer again, not a stale countdown.
  useEffect(() => {
    if (!open) { clearTimers(); return; }
    setStep('banner');
    setSecondsLeft(null);
    setCopied(false);
    setError('');
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [open, clearTimers]);

  // Admin-managed task video. Fetched once per open; a missing/empty guide list
  // is fine — the task panel falls back to an illustrated placeholder so the
  // flow never depends on content being configured.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getSectionGuides('free_trial_mode').then((guides) => {
      if (!alive) return;
      const first = Array.isArray(guides) ? guides.find((g) => g?.videoUrl) : null;
      setVideoUrl(first?.videoUrl || '');
    });
    return () => { alive = false; };
  }, [open]);

  const claim = useCallback(async () => {
    setStep('unlocking');
    try {
      await subscriptionService.claimShareTrial();
      if (!aliveRef.current) return;
      setStep('done');
      onUnlocked?.();
    } catch (err) {
      if (!aliveRef.current) return;
      // Already claimed / no longer eligible means the server state is ahead of
      // ours — resync so the CTA disappears instead of re-offering a reward
      // that can't be granted.
      if (err?.code === 'share_trial_already_claimed' || err?.code === 'share_trial_not_eligible') {
        subscriptionService.fetchStatus();
      }
      setError(err?.message || (isBn ? 'ট্রায়াল চালু করা যায়নি।' : 'Could not activate the trial.'));
      setStep('error');
    }
  }, [isBn, onUnlocked]);

  const handleShare = useCallback(() => {
    if (secondsLeft !== null) return; // countdown already running

    const url = PLAY_STORE_URL;
    const title = isBn ? 'ToLet Pro — বাসা ভাড়ার সহজ সমাধান' : 'ToLet Pro — find your next home';
    const text = isBn
      ? 'ToLet Pro দিয়ে সহজেই বাসা ভাড়া খুঁজুন বা নিজের বাসা ভাড়া দিন।'
      : 'Find a home to rent — or list yours — with ToLet Pro.';

    // Start the countdown BEFORE the share sheet opens. navigator.share only
    // settles once the sheet is dismissed, and on phones that sheet covers the
    // whole screen — waiting for it would leave the host staring at an
    // unchanged modal for as long as they browse their contacts.
    setSecondsLeft(Math.round(UNLOCK_DELAY_MS / 1000));
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    unlockRef.current = setTimeout(() => { clearTimers(); claim(); }, UNLOCK_DELAY_MS);

    if (navigator.share) {
      // A cancelled sheet rejects with AbortError. We swallow it: the host
      // still tapped Share, and the reward is a goodwill gesture, not a
      // verified referral (the Web Share API reports no delivery signal).
      navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    // Desktop / unsupported browsers — copy the link so the tap still does
    // something useful.
    navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {});
  }, [claim, clearTimers, isBn, secondsLeft]);

  if (!open) return null;

  const reasonCopy = REASON_COPY[reason] || REASON_COPY.entry;
  const embedUrl = toEmbedUrl(videoUrl);
  const isYouTube = embedUrl.includes('youtube.com/embed');
  const counting = secondsLeft !== null;

  const PERKS = [
    { icon: Images, en: '50 photos per property', bn: 'প্রতি প্রপার্টিতে ৫০টি ছবি' },
    { icon: Video, en: 'Up to 5 video tours', bn: 'সর্বোচ্চ ৫টি ভিডিও ট্যুর' },
    { icon: TrendingUp, en: 'Top position in search', bn: 'সার্চে শীর্ষ অবস্থান' },
    { icon: Crown, en: 'Pro badge & gold card', bn: 'প্রো ব্যাজ ও গোল্ড কার্ড' },
  ];

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-tp-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-[1.75rem] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.55)] animate-tp-modal-in">

        {/* ── HEADER — gold band, shared by every step ── */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white">
          {step !== 'unlocking' && step !== 'done' && (
            <button
              type="button"
              onClick={onSkip}
              aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/35 transition-colors"
            >
              <X size={16} strokeWidth={3} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Crown size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                {isBn ? 'ফ্রি প্রো ট্রায়াল' : 'Free Pro Trial'}
              </p>
              <h2 className="text-xl font-black leading-tight">
                {isBn ? `${TRIAL_MONTHS} মাস প্রো — একদম ফ্রি` : `${TRIAL_MONTHS} months of Pro — free`}
              </h2>
            </div>
          </div>
        </div>

        {/* ── STEP 1: THE OFFER ── */}
        {step === 'banner' && (
          <div className="p-6 space-y-5">
            <p className="text-sm font-bold text-gray-600 leading-relaxed">
              {isBn ? reasonCopy.bn : reasonCopy.en}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {PERKS.map((perk) => (
                <div key={perk.en} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <perk.icon size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-black text-gray-700 leading-snug">
                    {isBn ? perk.bn : perk.en}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
              <Sparkles size={15} className="text-amber-600 shrink-0" />
              <p className="text-[11px] font-black text-amber-800 leading-snug">
                {isBn
                  ? 'একটি ছোট কাজ করলেই আনলক — কোনো পেমেন্ট লাগবে না।'
                  : 'One small task unlocks it — no payment needed.'}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onSkip}
                className="sm:flex-1 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {isBn ? 'এখন না' : 'Skip'}
              </button>
              <button
                type="button"
                onClick={() => setStep('task')}
                className="sm:flex-[1.6] px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-[0_10px_25px_-8px_rgba(245,158,11,0.7)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Crown size={15} /> {isBn ? 'ফ্রি ট্রায়াল নিন' : 'Get Free Trial'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: THE TASK ── */}
        {step === 'task' && (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-base font-black text-gray-900">
                {isBn ? 'যা করতে হবে' : 'How to unlock it'}
              </h3>
              <p className="text-xs font-bold text-gray-500 mt-1 leading-relaxed">
                {isBn
                  ? `বন্ধুদের সাথে অ্যাপের লিংক শেয়ার করুন — সাথে সাথেই ${TRIAL_MONTHS} মাসের প্রো চালু হয়ে যাবে।`
                  : `Share the app link with a friend and ${TRIAL_MONTHS} months of Pro switches on right away.`}
              </p>
            </div>

            {/* Task video (admin-managed) or an honest placeholder. */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-900">
              {embedUrl ? (
                isYouTube ? (
                  <iframe
                    src={embedUrl}
                    title={isBn ? 'ফ্রি প্রো ট্রায়াল গাইড' : 'Free Pro Trial guide'}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={embedUrl} controls playsInline className="absolute inset-0 w-full h-full object-cover" />
                )
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 bg-gradient-to-br from-gray-800 to-gray-900">
                  <PlayCircle size={40} strokeWidth={1.6} />
                  <p className="text-[11px] font-black uppercase tracking-widest">
                    {isBn ? 'ভিডিও গাইড শীঘ্রই আসছে' : 'Video guide coming soon'}
                  </p>
                </div>
              )}
            </div>

            <ol className="space-y-2.5">
              {[
                { en: 'Tap “Share App Link” below.', bn: 'নিচের “অ্যাপ লিংক শেয়ার করুন” বাটনে ট্যাপ করুন।' },
                { en: 'Send it to a friend or a group.', bn: 'বন্ধু বা গ্রুপে পাঠিয়ে দিন।' },
                { en: `Come back — Pro unlocks in ${Math.round(UNLOCK_DELAY_MS / 1000)} seconds.`, bn: `ফিরে আসুন — ${Math.round(UNLOCK_DELAY_MS / 1000)} সেকেন্ডে প্রো আনলক হবে।` },
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-600 leading-snug">{isBn ? line.bn : line.en}</span>
                </li>
              ))}
            </ol>

            {copied && (
              <p className="text-[11px] font-black text-emerald-600 flex items-center gap-1.5">
                <Check size={13} strokeWidth={3} />
                {isBn ? 'লিংক কপি হয়েছে — বন্ধুকে পাঠিয়ে দিন।' : 'Link copied — paste it to a friend.'}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onSkip}
                disabled={counting}
                className="sm:flex-1 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isBn ? 'এখন না' : 'Skip'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={counting}
                className="sm:flex-[1.6] px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-gray-900 hover:bg-[#ba0036] disabled:bg-gray-900 disabled:cursor-wait shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {counting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {isBn ? `আনলক হচ্ছে · ${secondsLeft}s` : `Unlocking · ${secondsLeft}s`}
                  </>
                ) : (
                  <>
                    <Share2 size={15} /> {isBn ? 'অ্যাপ লিংক শেয়ার করুন' : 'Share App Link'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: GRANTING ── */}
        {step === 'unlocking' && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <Loader2 size={34} className="animate-spin text-amber-500" />
            <p className="text-sm font-black text-gray-700">
              {isBn ? 'প্রো চালু করা হচ্ছে...' : 'Activating Pro...'}
            </p>
          </div>
        )}

        {/* ── STEP 4: DONE ── */}
        {step === 'done' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Check size={30} className="text-emerald-600" strokeWidth={3} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">
                {isBn ? 'প্রো আনলক হয়েছে!' : 'Pro unlocked!'}
              </h3>
              <p className="text-xs font-bold text-gray-500 mt-1.5 leading-relaxed">
                {isBn
                  ? `${TRIAL_MONTHS} মাস প্রো চালু হলো — এখন ৫০টি ছবি ও ভিডিও ট্যুর যোগ করতে পারবেন।`
                  : `${TRIAL_MONTHS} months of Pro are live — 50 photos and video tours are now yours.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="w-full mt-1 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-[0_10px_25px_-8px_rgba(245,158,11,0.7)] active:scale-95 transition-all"
            >
              {isBn ? 'চালিয়ে যান' : 'Continue'}
            </button>
          </div>
        )}

        {/* ── STEP 5: GRANT FAILED ── */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <X size={30} className="text-[#ba0036]" strokeWidth={3} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">
                {isBn ? 'ট্রায়াল চালু হয়নি' : "Couldn't start the trial"}
              </h3>
              <p className="text-xs font-bold text-gray-500 mt-1.5 leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="w-full mt-1 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {isBn ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeProTrialModal;
