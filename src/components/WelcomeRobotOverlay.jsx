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

// API বেস — AIGuidesManager-এর মতোই, যাতে env কনফিগ এক জায়গায় মেলে।
const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════════
   🔑 "একবারই দেখাও" / "আর দেখাবেন না" মেমরি (localStorage)
   ─────────────────────────────────────────────────────────────
   • signup ওয়েলকাম প্রতি অ্যাকাউন্টে একবারই দেখাবে।
   • login ওয়েলকাম প্রতিবার লগইনে দেখাবে, যতক্ষণ না ইউজার
     "আর দেখাবেন না" চাপে — তখন device-লেভেলে চিরতরে বন্ধ।
     (KEY_LOGIN_HIDDEN authService-এর DEVICE_KEEP_KEYS-এ আছে, তাই
      logout-এর ডেটা মোছা সত্ত্বেও এই পছন্দ টিকে থাকে।)
═══════════════════════════════════════════════════════════════ */
const KEY_SIGNUP_SEEN  = 'welcome:signup:seen';
const KEY_LOGIN_HIDDEN = 'welcome:login:hidden';

const isSignupWelcomeSeen = () => {
  try { return window.localStorage.getItem(KEY_SIGNUP_SEEN) === '1'; } catch { return false; }
};
const markSignupWelcomeSeen = () => {
  try { window.localStorage.setItem(KEY_SIGNUP_SEEN, '1'); } catch { /* ignore */ }
};
const isLoginWelcomeHidden = () => {
  try { return window.localStorage.getItem(KEY_LOGIN_HIDDEN) === '1'; } catch { return false; }
};
const hideLoginWelcomeForever = () => {
  try { window.localStorage.setItem(KEY_LOGIN_HIDDEN, '1'); } catch { /* ignore */ }
};

// ভিডিও এখন আর হার্ডকোড নয় — অ্যাডমিন প্যানেল (AI Video Guides → Placement
// "Welcome") থেকে আসে, role অনুযায়ী `GET /ai-guides/welcome?audience=...`।
// শুধুমাত্র signup ওয়েলকামে দেখাই; login ওয়েলকাম হালকা রাখা হয়।

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

// login "welcome back" কার্ডের কনটেন্ট — signup থেকে আলাদা, হালকা ও দ্রুত।
const LOGIN_COPY = {
  tenant: {
    tagline: 'নতুন ভেরিফায়েড লিস্টিং আর মেসেজ আপনার জন্য অপেক্ষা করছে।',
    chips: [
      { icon: MapPin, label: 'নিয়ার মি সার্চ' },
      { icon: MessageCircle, label: 'নতুন মেসেজ' },
    ],
  },
  landlord: {
    tagline: 'আপনার প্রপার্টি আর ভাড়াটিয়ার আপডেট এক ঝলকে দেখে নিন।',
    chips: [
      { icon: LayoutDashboard, label: 'ড্যাশবোর্ড' },
      { icon: MessageCircle, label: 'নতুন মেসেজ' },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
   🤖 WelcomeRobotOverlay
   ─────────────────────────────────────────────────────────────
   ভয়েস (TTS) ও "ট্যাপ করে জাগান" ইন্ট্রো সরানো হয়েছে — পপআপ এখন
   সরাসরি খোলে।

   ফেইজ:
     • signup : hidden → open → minimized (অ্যাসিস্ট্যান্ট আইকনে
                উড়ে যায়, ৫ সে. থাকে) → hidden
     • login  : hidden → open → hidden (সিম্পল ফেড, আলাদা ডিজাইন)
═══════════════════════════════════════════════════════════════ */

const WelcomeRobotOverlay = () => {
  const { user, isAdmin, activeRole } = useAuth();
  const location = useLocation();

  const [phase, setPhase] = useState('hidden');   // 'hidden' | 'open' | 'minimized'
  const [showOptions, setShowOptions] = useState(false);
  const [typed, setTyped] = useState('');
  const [eventInfo, setEventInfo] = useState(null); // { role, name, type }
  const [fly, setFly] = useState(null);             // { from:{x,y}, to:{x,y} }
  const [activeVideo, setActiveVideo] = useState({ isOpen: false, url: '', title: '' });
  const [welcomeGuides, setWelcomeGuides] = useState([]); // অ্যাডমিন থেকে আসা ভিডিও (signup-এ)

  const phaseRef = useRef(phase);
  const headRef = useRef(null);          // রোবটের মাথা — উড়ান শুরুর পজিশন মাপতে
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

      const type = detail.type === 'signup' ? 'signup' : 'login';

      // "একবারই / আর দেখাবেন না" মেমরি যাচাই
      if (type === 'signup' && isSignupWelcomeSeen()) return;
      if (type === 'login' && isLoginWelcomeHidden()) return;

      minimizingRef.current = false;
      setEventInfo({
        role: detail.role || null,
        name: detail.name || '',
        type,
      });
      setShowOptions(false);
      setTyped('');
      setFly(null);
      setPhase('open');

      // signup ওয়েলকাম একবারই — ট্রিগার হওয়ামাত্রই "seen" মার্ক করি।
      if (type === 'signup') markSignupWelcomeSeen();
    };

    window.addEventListener('triggerWelcomeRobot', handleTrigger);
    return () => window.removeEventListener('triggerWelcomeRobot', handleTrigger);
  }, []);

  /* ── কার্ড খোলার পর কনটেন্ট রিভিল (signup-এর স্ট্যাগার্ড অ্যানিমেশন) ── */
  useEffect(() => {
    if (phase !== 'open') return undefined;
    const id = setTimeout(() => setShowOptions(true), 350);
    return () => clearTimeout(id);
  }, [phase]);

  /* ── signup: মিনিমাইজ → মিনি রোবট → অ্যাসিস্ট্যান্ট আইকনে উড়ে যায় ── */
  const dismissToAssistant = useCallback(() => {
    if (minimizingRef.current) return;
    if (phaseRef.current !== 'open') return;
    minimizingRef.current = true;

    // নির্ভরশীল UI (GlobalAIAssistant আইকন টাইমার) জানুক রোবট শেষ
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

  /* ── login: সিম্পল ফেড-আউট ক্লোজ (forever হলে চিরতরে বন্ধ) ── */
  const closeLogin = useCallback((forever) => {
    if (forever) hideLoginWelcomeForever();
    window.dispatchEvent(new Event('welcomeRobotFinished'));
    setShowOptions(false);
    setPhase('hidden');
    minimizingRef.current = false;
  }, []);

  // মিনি রোবট ৫ সেকেন্ড থেকে মিলিয়ে যাবে (signup only)
  useEffect(() => {
    if (phase !== 'minimized') return undefined;
    const id = setTimeout(() => {
      setPhase('hidden');
      setFly(null);
      setShowOptions(false);
      minimizingRef.current = false;
    }, MINI_LINGER_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Escape চাপলে টাইপ অনুযায়ী বন্ধ হবে
  useEffect(() => {
    if (phase !== 'open') return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (eventInfo?.type === 'signup') dismissToAssistant();
      else closeLogin(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, eventInfo, dismissToAssistant, closeLogin]);

  /* ── role-ভিত্তিক কনটেন্ট ─────────────────────────────────── */
  const effectiveRole = eventInfo?.role || activeRole;
  const isTenant = effectiveRole !== 'landlord';
  const copy = isTenant ? ROLE_COPY.tenant : ROLE_COPY.landlord;
  const loginCopy = isTenant ? LOGIN_COPY.tenant : LOGIN_COPY.landlord;
  const firstName = (eventInfo?.name || user?.name || '').trim().split(/\s+/)[0] || '';
  const avatarInitial = (firstName || 'T').charAt(0).toUpperCase();
  const isSignup = eventInfo?.type === 'signup';

  // সময়-সচেতন শুভেচ্ছা — login "welcome back" ব্যানারকে আরও ব্যক্তিগত করে তোলে।
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return { emoji: '🌅', label: 'শুভ সকাল' };
    if (h < 16) return { emoji: '☀️', label: 'শুভ দুপুর' };
    if (h < 19) return { emoji: '🌇', label: 'শুভ বিকাল' };
    return { emoji: '🌙', label: 'শুভ সন্ধ্যা' };
  })();

  /* ── অ্যাডমিন-কনফিগার করা welcome ভিডিও fetch (শুধু signup-এ) ──
     signup ছাড়া fetch করি না — login ওয়েলকাম হালকা রাখতে ও প্রতি
     লগইনে অকারণ API কল এড়াতে। */
  useEffect(() => {
    if (!eventInfo || eventInfo.type !== 'signup') {
      setWelcomeGuides([]);
      return undefined;
    }
    const aud = (eventInfo.role || activeRole) === 'landlord' ? 'landlord' : 'tenant';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/ai-guides/welcome?audience=${aud}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setWelcomeGuides(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) setWelcomeGuides([]);
        console.warn('[WelcomeRobot] welcome ভিডিও আনা যায়নি:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [eventInfo, activeRole]);

  /* ── টাইপরাইটার (signup কার্ডের প্রশ্ন লাইনটা টাইপ হয়ে লেখা হয়) ── */
  useEffect(() => {
    if (!showOptions || eventInfo?.type !== 'signup') {
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
  }, [showOptions, copy.question, eventInfo]);

  /* ── অ্যাডমিন গার্ড (রেন্ডার লেভেলে) ─────────────────────── */
  // অ্যাডমিন ইউজার বা /admin রুটে এই ওভারলে কখনোই রেন্ডার হবে না।
  if (isAdmin || location.pathname.startsWith('/admin')) return null;

  const handleBackdrop = () => (isSignup ? dismissToAssistant() : closeLogin(false));

  return (
    <>
      {/* ═════════ মূল ওভারলে (open) ═════════ */}
      <AnimatePresence>
        {phase === 'open' && eventInfo && (
          <motion.div
            key="wr-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          >
            {/* ব্যাকড্রপ — ক্লিক করলে বন্ধ */}
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
              onClick={handleBackdrop}
            />

            {/* কোণার ক্লোজ বাটন */}
            <motion.button
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleBackdrop}
              className="absolute top-5 right-5 z-[100000] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-lg transition-all"
              aria-label="বন্ধ করুন"
            >
              <X size={22} />
            </motion.button>

            {/* ═════════════ SIGNUP: উদযাপন কার্ড ═════════════ */}
            {isSignup && (
              <div className="relative z-10 flex flex-col items-center w-full max-w-[350px]">
                {/* রোবটের মাথা (সরাসরি ঢুকে আসে — আর ট্যাপ লাগে না) */}
                <motion.div
                  ref={headRef}
                  initial={{ scale: 0.6, opacity: 0, y: 24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 150 }}
                  className="relative z-20"
                >
                  <div
                    className="absolute -inset-4 rounded-full blur-md opacity-60 animate-[spin_4s_linear_infinite]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, #ff4d6d 110deg, #ba0036 200deg, transparent 290deg)',
                    }}
                  />
                  <div className="absolute inset-0 bg-[#ba0036] blur-[40px] opacity-40 rounded-full scale-150 animate-pulse" />
                  <div className="relative w-28 h-28 bg-gradient-to-br from-[#ba0036] to-[#7a0026] rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20 overflow-hidden">
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

                  <div className="relative inline-flex items-center gap-1.5 mb-2 px-3.5 py-1.5 rounded-full bg-[#ba0036]/15 border border-[#ff4d6d]/30 text-[#ff8aa0] text-[11px] font-bold">
                    <Sparkles size={12} /> অ্যাকাউন্ট তৈরি সম্পন্ন
                  </div>

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

                        {welcomeGuides.length > 0 && (
                          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1 w-full">
                            {welcomeGuides.map((guide, idx) => (
                              <button
                                key={idx}
                                onClick={() =>
                                  setActiveVideo({
                                    isOpen: true,
                                    url: guide.videoUrl,
                                    title: guide.title || copy.videoLabel,
                                  })
                                }
                                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[1.2rem] bg-white/[0.07] border border-white/15 text-white font-bold text-[13px] hover:bg-white/[0.13] transition-all shrink-0"
                              >
                                <Video size={16} />
                                {guide.suggestionText || copy.videoLabel}
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={dismissToAssistant}
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

            {/* ═════════════ LOGIN: প্রিমিয়াম "welcome back" ব্যানার ═════════════ */}
            {!isSignup && (
              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96, transition: { duration: 0.25 } }}
                transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                className="relative z-10 w-full max-w-[372px] rounded-[2rem] bg-white shadow-[0_40px_100px_-20px_rgba(186,0,54,0.55)] overflow-hidden"
              >
                {/* ── গ্রেডিয়েন্ট হিরো হেডার ── */}
                <div className="relative px-6 pt-6 pb-14 bg-gradient-to-br from-[#ba0036] via-[#9a002d] to-[#5e001b] overflow-hidden">
                  {/* সাজসজ্জা: গ্লো অর্ব + সূক্ষ্ম ডট-গ্রিড */}
                  <div className="pointer-events-none absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-8 -left-12 w-40 h-40 rounded-full bg-[#ff4d6d]/30 blur-3xl" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.13]"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                      backgroundSize: '18px 18px',
                    }}
                  />

                  {/* সময়-সচেতন শুভেচ্ছা পিল */}
                  <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white text-[11px] font-bold">
                    <span aria-hidden="true">{greeting.emoji}</span> {greeting.label}
                  </div>

                  {/* অ্যাভাটার + নাম */}
                  <div className="relative mt-4 flex items-center gap-3.5">
                    <motion.div
                      className="relative shrink-0"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="absolute inset-0 rounded-2xl bg-white/40 blur-lg" />
                      <div className="relative w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-[#ba0036] text-2xl font-black shadow-xl ring-2 ring-white/50">
                        {avatarInitial}
                      </div>
                      <motion.span
                        className="absolute -bottom-1.5 -right-1.5 text-2xl drop-shadow"
                        animate={{ rotate: [0, 20, -6, 20, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.4 }}
                        aria-hidden="true"
                      >
                        👋
                      </motion.span>
                    </motion.div>
                    <div className="min-w-0">
                      <p className="text-white/75 text-[12.5px] font-bold">আবার স্বাগতম,</p>
                      <h3 className="text-white text-[26px] leading-tight font-black tracking-tight truncate">
                        {firstName || 'বন্ধু'}!
                      </h3>
                    </div>
                  </div>
                </div>

                {/* ── বডি (হেডারের ওপর গোলাকারভাবে ওভারল্যাপ করে) ── */}
                <div className="relative -mt-6 rounded-t-[1.75rem] bg-white px-6 pt-5 pb-6">
                  <p className="text-[13.5px] font-medium text-slate-600 leading-relaxed text-center">
                    {loginCopy.tagline}
                  </p>

                  {/* কুইক চিপস */}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {loginCopy.chips.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-100 text-[12px] font-bold text-[#ba0036]"
                      >
                        <Icon size={13} />
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* প্রাইমারি CTA */}
                  <button
                    onClick={() => closeLogin(false)}
                    className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#ba0036] to-[#ff2d55] text-white font-black text-[14.5px] shadow-[0_14px_30px_-6px_rgba(186,0,54,0.6)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-6px_rgba(186,0,54,0.7)] active:translate-y-0 transition-all"
                  >
                    চলুন, শুরু করি <ArrowRight size={17} />
                  </button>

                  {/* "আর দেখাবেন না" — চিরতরে বন্ধ */}
                  <button
                    onClick={() => closeLogin(true)}
                    className="mt-3 w-full text-center text-[12.5px] font-semibold text-slate-400 hover:text-[#ba0036] transition-colors"
                  >
                    আর দেখাবেন না
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═════════ মিনি রোবট: অ্যাসিস্ট্যান্ট আইকনে উড়ে যায় (signup only) ═════════ */}
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
              <span className="absolute inset-0 rounded-full bg-[#ba0036] blur-xl opacity-50 animate-pulse" />
              <span className="absolute -inset-1.5 rounded-full border-2 border-[#ff4d6d]/60 animate-ping" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0026] border-2 border-white/25 shadow-xl flex items-center justify-center">
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
