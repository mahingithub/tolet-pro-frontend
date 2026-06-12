import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bot, X, Video, Sparkles, ArrowRight,
  MapPin, MessageCircle, BadgeCheck, PlusCircle, LayoutDashboard,
} from 'lucide-react';
import VideoModal from './shared/VideoModal';

/* ═══════════════════════════════════════════════════════════════
   ⚙️ কনফিগারেশন
═══════════════════════════════════════════════════════════════ */

// মিনিমাইজ হলে মিনি রোবট কোন এলিমেন্টের ওপর গিয়ে নামবে।
// GlobalAIAssistant.jsx-এর ভাসমান লঞ্চার বাটনে শুধু `data-ai-assistant`
// অ্যাট্রিবিউট যোগ করলেই রোবট ঠিক ওই বাটনের ওপর নামবে।
const ASSISTANT_SELECTOR = '[data-ai-assistant], #global-ai-assistant';

// অ্যাসিস্ট্যান্ট বাটন স্ক্রিনে না থাকলে (যেমন ড্যাশবোর্ড রুটে) মিনি রোবট
// এই fallback পজিশনে নামবে — MobileBottomNav-এর ঠিক ওপরে, ডান পাশে।
const FALLBACK_TARGET = { right: 24, bottom: 112 };

const MINI_ICON_SIZE = 56;       // মিনি রোবটের সাইজ (px)
const MINI_LINGER_MS = 5000;     // মিনি রোবট কতক্ষণ থেকে তারপর মিলিয়ে যাবে
const AUTO_WAKE_MS = 6000;       // intro-তে ট্যাপ না করলে কত ms পরে নিজে খুলবে (ভয়েস ছাড়া)

// ভিডিও গাইড — এখনো placeholder, admin পরে আসল লিংক বসাবে
const VIDEO_GUIDES = {
  tenant: {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    title: 'কীভাবে বাসা খুঁজবেন?',
  },
  landlord: {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    title: 'হোস্ট ড্যাশবোর্ড গাইড',
  },
};

const ROLE_COPY = {
  tenant: {
    question: 'কীভাবে সহজে বাসা খুঁজে পাবেন এবং ভাড়া নেবেন?',
    videoLabel: 'নির্দেশিকা ভিডিও দেখুন',
    chips: [
      { icon: MapPin, label: 'নিয়ার মি সার্চ' },
      { icon: MessageCircle, label: 'সরাসরি চ্যাট' },
      { icon: BadgeCheck, label: 'ভেরিফায়েড লিস্টিং' },
    ],
  },
  landlord: {
    question: 'কীভাবে খুব সহজেই বাসা ভাড়া দেবেন এবং ম্যানেজ করবেন?',
    videoLabel: 'হোস্ট গাইড ভিডিও দেখুন',
    chips: [
      { icon: PlusCircle, label: 'ফ্রি প্রপার্টি লিস্টিং' },
      { icon: LayoutDashboard, label: 'স্মার্ট ড্যাশবোর্ড' },
      { icon: MessageCircle, label: 'ভাড়াটিয়ার সাথে চ্যাট' },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
   🔊 বাংলা ভয়েস হেল্পার (আগের voice-picking লজিকই, এক জায়গায়)
═══════════════════════════════════════════════════════════════ */

function speakBn(text, onDone) {
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };

  try {
    if (!('speechSynthesis' in window)) {
      setTimeout(done, 300);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const start = () => {
      const voices = window.speechSynthesis.getVoices();
      const bnVoices = voices.filter((v) => v.lang?.includes('bn'));
      const bestVoice = bnVoices.find((v) => v.name.includes('Google')) || bnVoices[0];
      if (bestVoice) utterance.voice = bestVoice;
      utterance.lang = 'bn-BD';
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      start();
    } else {
      let fired = false;
      const onVoicesChanged = () => {
        if (fired) return;
        fired = true;
        start();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged, { once: true });
      setTimeout(onVoicesChanged, 1000);
    }

    utterance.onend = done;
    utterance.onerror = done;
    setTimeout(done, 3000); // ভয়েস আটকে গেলেও ফ্লো থেমে থাকবে না
  } catch {
    setTimeout(done, 300);
  }
}

/* ═══════════════════════════════════════════════════════════════
   🤖 WelcomeRobotOverlay
   ফেইজ: hidden → intro (ট্যাপ করে জাগান) → open (কার্ড)
          → minimized (অ্যাসিস্ট্যান্ট আইকনে উড়ে যায়, ৫ সে. থাকে) → hidden
═══════════════════════════════════════════════════════════════ */

const WelcomeRobotOverlay = () => {
  const { user, isAdmin, activeRole } = useAuth();
  const location = useLocation();

  const [phase, setPhase] = useState('hidden');
  const [showOptions, setShowOptions] = useState(false);
  const [typed, setTyped] = useState('');
  const [eventInfo, setEventInfo] = useState(null); // { role, name, type }
  const [fly, setFly] = useState(null);             // { from:{x,y}, to:{x,y} }
  const [activeVideo, setActiveVideo] = useState({ isOpen: false, url: '', title: '' });

  const phaseRef = useRef(phase);
  const headRef = useRef(null);          // রোবটের মাথা — উড়ান শুরুর পজিশন মাপতে
  const voiceEnabledRef = useRef(false); // ইউজার ট্যাপ করেছে কি না (TTS-এর জন্য gesture লাগে)
  const minimizingRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* ── ট্রিগার লিসেনার ──────────────────────────────────────── */
  useEffect(() => {
    const handleTrigger = (e) => {
      const detail = e?.detail || {};
      // ডিফেন্স: admin-জাতীয় role detail-এ এলে দেখাবো না
      // (মূল গেট AuthContext-এ isAdminRole দিয়ে)
      if (detail.role && /admin|moderator|support/i.test(String(detail.role))) return;
      if (window.location.pathname.startsWith('/admin')) return;

      window.speechSynthesis?.cancel?.();
      minimizingRef.current = false;
      voiceEnabledRef.current = false;
      setEventInfo({
        role: detail.role || null,
        name: detail.name || '',
        type: detail.type || 'login',
      });
      setShowOptions(false);
      setTyped('');
      setFly(null);
      setPhase('intro');
    };

    window.addEventListener('triggerWelcomeRobot', handleTrigger);
    return () => {
      window.removeEventListener('triggerWelcomeRobot', handleTrigger);
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  /* ── রোবট জাগানো ─────────────────────────────────────────── */
  const wake = useCallback((withVoice) => {
    if (phaseRef.current !== 'intro') return;
    setPhase('open');
    if (withVoice) {
      voiceEnabledRef.current = true; // ট্যাপ = user gesture, তাই ভয়েস চলবে
      speakBn('স্বাগতম!', () => setShowOptions(true));
    } else {
      setTimeout(() => setShowOptions(true), 500);
    }
  }, []);

  // intro-তে কেউ ট্যাপ না করলে নিজে নিজেই খুলবে (ভয়েস ছাড়া)
  useEffect(() => {
    if (phase !== 'intro') return undefined;
    const id = setTimeout(() => wake(false), AUTO_WAKE_MS);
    return () => clearTimeout(id);
  }, [phase, wake]);

  /* ── মিনিমাইজ: কার্ড → মিনি রোবট → অ্যাসিস্ট্যান্ট আইকনে ── */
  const minimize = useCallback(() => {
    if (minimizingRef.current) return;
    if (phaseRef.current !== 'intro' && phaseRef.current !== 'open') return;
    minimizingRef.current = true;

    // বিদায়ী ভয়েস — শুধু যদি ইউজার আগে ট্যাপ করে ভয়েস চালু করে থাকে
    if (voiceEnabledRef.current) speakBn('সি ইউ এগেইন!');
    else window.speechSynthesis?.cancel?.();

    // আগের আচরণ অক্ষুণ্ণ: নির্ভরশীল UI এখনই জানুক যে রোবট শেষ
    window.dispatchEvent(new Event('welcomeRobotFinished'));

    const half = MINI_ICON_SIZE / 2;
    const headRect = headRef.current?.getBoundingClientRect();
    const from = headRect
      ? { x: headRect.left + headRect.width / 2, y: headRect.top + headRect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 - 80 };

    // অ্যাসিস্ট্যান্ট বাটন মাউন্ট হওয়ার জন্য এক মুহূর্ত দিয়ে টার্গেট মাপা
    setTimeout(() => {
      const el = document.querySelector(ASSISTANT_SELECTOR);
      let to;
      if (el) {
        const r = el.getBoundingClientRect();
        to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      } else {
        to = {
          x: window.innerWidth - FALLBACK_TARGET.right - half,
          y: window.innerHeight - FALLBACK_TARGET.bottom - half,
        };
      }
      setFly({ from, to });
      setPhase('minimized');
    }, 180);
  }, []);

  // মিনি রোবট ৫ সেকেন্ড থেকে মিলিয়ে যাবে
  useEffect(() => {
    if (phase !== 'minimized') return undefined;
    const id = setTimeout(() => {
      setPhase('hidden');
      setFly(null);
      setShowOptions(false);
      minimizingRef.current = false;
      voiceEnabledRef.current = false;
    }, MINI_LINGER_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Escape চাপলে মিনিমাইজ
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'open') return undefined;
    const onKey = (e) => e.key === 'Escape' && minimize();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, minimize]);

  /* ── role-ভিত্তিক কনটেন্ট ─────────────────────────────────── */
  const effectiveRole = eventInfo?.role || activeRole;
  const isTenant = effectiveRole !== 'landlord';
  const copy = isTenant ? ROLE_COPY.tenant : ROLE_COPY.landlord;
  const video = isTenant ? VIDEO_GUIDES.tenant : VIDEO_GUIDES.landlord;
  const firstName = (eventInfo?.name || user?.name || '').trim().split(/\s+/)[0] || '';

  /* ── টাইপরাইটার (প্রশ্নের লাইনটা টাইপ হয়ে লেখা হয়) ───────── */
  useEffect(() => {
    if (!showOptions) {
      setTyped('');
      return undefined;
    }
    const full = copy.question;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [showOptions, copy.question]);

  /* ── অ্যাডমিন গার্ড (রেন্ডার লেভেলে) ─────────────────────── */
  // অ্যাডমিন ইউজার বা /admin রুটে এই ওভারলে কখনোই রেন্ডার হবে না।
  if (isAdmin || location.pathname.startsWith('/admin')) return null;

  return (
    <>
      {/* ═════════ মূল ওভারলে (intro + open) ═════════ */}
      <AnimatePresence>
        {(phase === 'intro' || phase === 'open') && (
          <motion.div
            key="wr-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          >
            {/* ব্যাকড্রপ — ক্লিক করলে মিনিমাইজ */}
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
              onClick={minimize}
            />

            {/* কোণার ক্লোজ (মিনিমাইজ) বাটন */}
            <motion.button
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={minimize}
              className="absolute top-5 right-5 z-[100000] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-lg transition-all"
              aria-label="বন্ধ করুন"
            >
              <X size={22} />
            </motion.button>

            {/* ───── INTRO: ভাসমান রোবট, ট্যাপ করে জাগাতে হয় ───── */}
            {phase === 'intro' && (
              <div className="relative z-10 flex flex-col items-center">
                <motion.button
                  layoutId="wr-orb"
                  ref={headRef}
                  onClick={() => wake(true)}
                  initial={{ scale: 0.6, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 140 }}
                  whileTap={{ scale: 0.92 }}
                  className="relative outline-none"
                  aria-label="রোবট চালু করুন"
                >
                  {/* ঘূর্ণায়মান এনার্জি হেলো */}
                  <div
                    className="absolute -inset-5 rounded-full blur-md opacity-70 animate-[spin_4s_linear_infinite]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, #ff4d6d 110deg, #ba0036 200deg, transparent 290deg)',
                    }}
                  />
                  {/* পালস রিং */}
                  <span className="absolute inset-0 rounded-[2rem] border-2 border-[#ff4d6d]/50 animate-ping" />
                  <div className="absolute inset-0 bg-[#ba0036] blur-[40px] opacity-40 rounded-full scale-150 animate-pulse" />
                  {/* রোবটের মাথা */}
                  <div className="relative w-28 h-28 bg-gradient-to-br from-[#ba0036] to-[#7a0026] rounded-[2rem] flex items-center justify-center shadow-2xl border-4 border-white/20 overflow-hidden">
                    <Bot size={56} className="text-white relative z-10" />
                    <motion.div
                      className="absolute left-3 right-3 h-[2px] bg-white/40 rounded"
                      animate={{ y: [-30, 30, -30] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </motion.button>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-7 px-5 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white text-sm font-bold tracking-wide"
                >
                  🤖 আমাকে ট্যাপ করুন
                </motion.p>
              </div>
            )}

            {/* ───── OPEN: রোবট + ফিউচারিস্টিক কার্ড ───── */}
            {phase === 'open' && (
              <div className="relative z-10 flex flex-col items-center w-full max-w-[350px]">
                {/* রোবটের মাথা (intro থেকে layoutId দিয়ে মর্ফ হয়ে আসে) */}
                <motion.div layoutId="wr-orb" ref={headRef} className="relative z-20">
                  <div
                    className="absolute -inset-4 rounded-full blur-md opacity-60 animate-[spin_4s_linear_infinite]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, #ff4d6d 110deg, #ba0036 200deg, transparent 290deg)',
                    }}
                  />
                  <div className="absolute inset-0 bg-[#ba0036] blur-[40px] opacity-40 rounded-full scale-150 animate-pulse" />
                  <div className="relative w-28 h-28 bg-gradient-to-br from-[#ba0036] to-[#7a0026] rounded-[2rem] flex items-center justify-center shadow-2xl border-4 border-white/20 overflow-hidden">
                    <Bot size={56} className="text-white relative z-10" />
                    <motion.div
                      className="absolute left-3 right-3 h-[2px] bg-white/40 rounded"
                      animate={{ y: [-30, 30, -30] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </motion.div>

                {/* কার্ড */}
                <motion.div
                  initial={{ opacity: 0, y: 28, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 170, delay: 0.08 }}
                  className="relative w-full -mt-10 pt-16 px-7 pb-7 rounded-[2rem] bg-slate-950/90 backdrop-blur-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)] text-center overflow-hidden"
                >
                  {/* কোণার গ্লো */}
                  <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#ba0036]/30 blur-[60px]" />
                  <div className="pointer-events-none absolute -bottom-20 -right-16 w-52 h-52 rounded-full bg-rose-400/20 blur-[70px]" />

                  {eventInfo?.type === 'signup' && (
                    <div className="relative inline-flex items-center gap-1.5 mb-2 px-3.5 py-1.5 rounded-full bg-[#ba0036]/15 border border-[#ff4d6d]/30 text-[#ff8aa0] text-[11px] font-bold">
                      <Sparkles size={12} /> অ্যাকাউন্ট তৈরি সম্পন্ন
                    </div>
                  )}

                  <h3 className="relative text-3xl font-black text-white tracking-tight">
                    স্বাগতম{firstName ? `, ${firstName}` : ''}!
                  </h3>
                  <p className="relative mt-1 text-[12px] font-semibold text-rose-200/60">
                    TO-LET PRO–তে আপনার যাত্রা শুরু হলো
                  </p>

                  <AnimatePresence>
                    {showOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative mt-5 space-y-4"
                      >
                        <p className="min-h-[40px] text-[13px] font-bold text-slate-300 leading-relaxed px-1">
                          {typed}
                          {typed.length < copy.question.length && (
                            <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-[2px] bg-[#ff4d6d] animate-pulse" />
                          )}
                        </p>

                        <div className="flex flex-wrap justify-center gap-2">
                          {copy.chips.map(({ icon: Icon, label }, i) => (
                            <motion.span
                              key={label}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + i * 0.12 }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11.5px] font-semibold text-slate-200"
                            >
                              <Icon size={12} className="text-[#ff4d6d]" />
                              {label}
                            </motion.span>
                          ))}
                        </div>

                        <button
                          onClick={() =>
                            setActiveVideo({ isOpen: true, url: video.url, title: video.title })
                          }
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[1.2rem] bg-white/[0.07] border border-white/15 text-white font-bold text-[13px] hover:bg-white/[0.13] transition-all"
                        >
                          <Video size={16} />
                          {copy.videoLabel}
                        </button>

                        <button
                          onClick={minimize}
                          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-[1.2rem] bg-gradient-to-r from-[#ba0036] to-[#ff2d55] text-white font-bold text-[14px] shadow-[0_12px_30px_rgba(186,0,54,0.45)] hover:shadow-[0_16px_40px_rgba(186,0,54,0.6)] hover:-translate-y-0.5 transition-all"
                        >
                          ঠিক আছে, শুরু করি! <ArrowRight size={16} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═════════ মিনি রোবট: অ্যাসিস্ট্যান্ট আইকনে উড়ে যায় ═════════ */}
      <AnimatePresence>
        {phase === 'minimized' && fly && (
          <motion.div
            key="wr-mini"
            className="fixed top-0 left-0 z-[99999] pointer-events-none"
            initial={{
              x: fly.from.x - MINI_ICON_SIZE / 2,
              y: fly.from.y - MINI_ICON_SIZE / 2,
              scale: 1.7,
              opacity: 1,
            }}
            animate={{
              x: fly.to.x - MINI_ICON_SIZE / 2,
              y: fly.to.y - MINI_ICON_SIZE / 2,
              scale: 1,
              opacity: 1,
            }}
            exit={{ scale: 0.2, opacity: 0, transition: { duration: 0.35 } }}
            transition={{ type: 'spring', damping: 17, stiffness: 110 }}
          >
            <div className="relative" style={{ width: MINI_ICON_SIZE, height: MINI_ICON_SIZE }}>
              <span className="absolute inset-0 rounded-2xl bg-[#ba0036] blur-xl opacity-50 animate-pulse" />
              <span className="absolute -inset-1.5 rounded-2xl border-2 border-[#ff4d6d]/60 animate-ping" />
              <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-[#ba0036] to-[#7a0026] border-2 border-white/25 shadow-xl flex items-center justify-center">
                <Bot size={26} className="text-white" />
              </div>

              {/* টুলটিপ: ইউজারকে দেখায় অ্যাসিস্ট্যান্ট এখানেই থাকে */}
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 }}
                className="absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-white/15 text-white text-[11px] font-bold shadow-lg"
              >
                আমি এখানেই থাকবো! 👋
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* শেয়ার্ড VideoModal — আগের মতোই */}
      <VideoModal
        isOpen={activeVideo.isOpen}
        onClose={() => setActiveVideo((v) => ({ ...v, isOpen: false }))}
        videoUrl={activeVideo.url}
        title={activeVideo.title}
      />
    </>
  );
};

export default WelcomeRobotOverlay;