import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, BellRing } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext.jsx';
import useLivingStore from '../../store/useLivingStore';
import callProvider from '../../services/callProvider';
import { buildReminders, initials } from './livingUtils';
import { MODULES } from './livingConfig';
import { cx } from './livingUI';

import WalletSummary from './WalletSummary';
import FeaturedRail from './FeaturedRail';
import ExpenseSplit from './ExpenseSplit';
import MealManagement from './MealManagement';
import Bills from './Bills';
import RoommateBalances from './RoommateBalances';
import MonthlyReport from './MonthlyReport';
import ActivityTimeline from './ActivityTimeline';
import SmartReminder from './SmartReminder';

export const ME = 'me';

const MODULE_COMPONENTS = {
  overview: WalletSummary,
  expenses: ExpenseSplit,
  meals: MealManagement,
  bills: Bills,
  balances: RoommateBalances,
  report: MonthlyReport,
  activity: ActivityTimeline,
  reminders: SmartReminder,
};

const VALID = MODULES.map((m) => m.id);

// Only the 5 daily-use modules live in the tab bar to keep it calm. Report,
// Activity and Reminders are reached from the Overview cards + the header bell
// (all still fully functional — just not competing for space in the rail).
const PRIMARY_IDS = ['overview', 'expenses', 'meals', 'bills', 'balances'];
const NAV_MODULES = MODULES.filter((m) => PRIMARY_IDS.includes(m.id));

/**
 * Living — the "Roommate Wallet" tab. A self-contained tenant surface for
 * managing shared living costs (expenses, meals, bills, balances, reports,
 * activity, reminders). Deliberately kept separate from TenantDashboard: this
 * is its own route (/living) with its own module sub-navigation.
 */
const Living = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const isBn = language === 'বাংলা';
  const { user } = useAuth();

  const setMyName = useLivingStore((s) => s.setMyName);
  const roommates = useLivingStore((s) => s.roommates);
  const connected = useLivingStore((s) => s.connected);
  const myId = useLivingStore((s) => s.myId);
  const hydrateHousehold = useLivingStore((s) => s.hydrateHousehold);
  // Whole-state snapshot for reminder badge (recomputes on any store change).
  const state = useLivingStore();

  // Identity used across every module: my member id when connected to a shared
  // household, else the local planner's 'me'.
  const me = connected ? myId : ME;

  // On mount: sync with the server. If the user belongs to a household we flip
  // into connected mode; otherwise we stay on the local planner. No-op for guests.
  useEffect(() => {
    const ctrl = new AbortController();
    hydrateHousehold(ctrl.signal);
    return () => ctrl.abort();
  }, [hydrateHousehold]);

  // Adopt the authenticated user's name for the LOCAL "You" roommate (connected
  // member names come from each user's real account, so skip it there).
  useEffect(() => {
    const meMember = roommates.find((r) => r.isMe);
    if (!connected && user?.name && meMember && meMember.name === 'You') setMyName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, connected]);

  // Live sync while connected: apply pushes from other members over the shared
  // call socket, plus a periodic poll as a backstop if the socket is asleep.
  useEffect(() => {
    if (!connected) return undefined;
    const socket = callProvider.getSocket();
    const onSync = (household) => {
      if (household) useLivingStore.getState().applyHousehold(household);
    };
    if (socket) socket.on('living:sync', onSync);
    const poll = setInterval(() => hydrateHousehold(), 25000);
    return () => {
      if (socket) socket.off('living:sync', onSync);
      clearInterval(poll);
    };
  }, [connected, hydrateHousehold]);

  const initialModule = useMemo(() => {
    const fromState = location.state?.module;
    const fromQuery = new URLSearchParams(location.search).get('m');
    const candidate = fromState || fromQuery;
    return VALID.includes(candidate) ? candidate : 'overview';
  }, [location.state, location.search]);

  const [module, setModule] = useState(initialModule);
  // Cross-module "quick action" intent (e.g. Overview → open Add Expense).
  // Consumed once by the target module, then cleared.
  const [intent, setIntent] = useState(null);

  // React to deep-links (bottom-nav / cross-module jumps) after mount.
  useEffect(() => {
    if (initialModule !== module) setModule(initialModule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModule]);

  const go = useCallback(
    (id, nextIntent = null) => {
      if (!VALID.includes(id)) return;
      setModule(id);
      setIntent(nextIntent);
      // keep the URL shareable without adding history spam
      const params = new URLSearchParams(location.search);
      params.set('m', id);
      navigate({ pathname: '/living', search: `?${params.toString()}` }, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [location.search, navigate]
  );

  const reminders = useMemo(() => buildReminders(state, ME), [state]);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/tenant-dashboard'));

  const ActiveModule = MODULE_COMPONENTS[module] || WalletSummary;

  return (
    <div className="flex flex-col min-h-screen bg-[#eaeff5] font-sans relative overflow-x-hidden text-gray-900 selection:bg-[#ba0036] selection:text-white">
      {/* Decorative orbs. Promoted to their own GPU layer (translateZ + will-change)
          so the browser re-composites instead of repainting the huge blur on every
          scroll frame — this is what made desktop scrolling feel janky. */}
      <div
        className="fixed top-[-18%] left-[-12%] w-[52vw] h-[52vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[100px] pointer-events-none z-0"
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      />
      <div
        className="fixed bottom-[-22%] right-[-12%] w-[52vw] h-[52vw] bg-gradient-to-tl from-emerald-500/10 to-transparent rounded-full blur-[100px] pointer-events-none z-0"
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      />

      {/* ── Header (full width) ─────────────────────────────────────── */}
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto z-40 relative px-4">
        <header className="mt-4 bg-white/60 backdrop-blur-3xl border border-white/80 rounded-[2rem] px-3.5 py-3 flex items-center justify-between gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={back}
              className="p-2.5 bg-white/70 rounded-xl border border-white/80 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-white active:scale-90 transition"
              aria-label={isBn ? 'পেছনে' : 'Back'}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-gradient-to-br from-[#ba0036] to-[#ff4d6d] p-2 rounded-xl shadow-[0_4px_15px_rgba(186,0,54,0.3)] shrink-0">
                <Wallet className="text-white w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-base md:text-lg tracking-tight leading-none truncate">
                  {isBn ? 'রুমমেট ওয়ালেট' : 'Roommate Wallet'}
                </h1>
                <p className="text-[10px] font-bold text-[#ba0036] uppercase tracking-widest mt-1">
                  {isBn ? 'লিভিং' : 'Living'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => go('reminders')}
              className="relative p-2.5 bg-white/70 rounded-xl border border-white/80 shadow-sm text-gray-500 hover:text-[#ba0036] hover:bg-white active:scale-90 transition"
              aria-label={isBn ? 'রিমাইন্ডার' : 'Reminders'}
            >
              <BellRing size={18} />
              {reminders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ba0036] text-white text-[10px] font-black border-2 border-white">
                  {reminders.length}
                </span>
              )}
            </button>

            {/* Profile — reachable straight from the Living tab (mobile + desktop). */}
            <button
              onClick={() => navigate('/tenant-dashboard?tab=profile')}
              className="rounded-full border border-white/80 shadow-sm active:scale-90 transition"
              aria-label={isBn ? 'প্রোফাইল' : 'Profile'}
            >
              <span className="relative w-9 h-9 rounded-full bg-[#ba0036] text-white flex items-center justify-center text-[12px] font-black overflow-hidden">
                {initials(user?.name)}
                {user?.avatar && (
                  <img
                    src={user.avatar}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </span>
            </button>
          </div>
        </header>
      </div>

      {/* ── Body: desktop nav + content + featured rail · mobile pills + content ── */}
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto px-4 relative z-10 mt-3 lg:flex lg:gap-6 lg:items-start">
        {/* MOBILE: sticky segmented tab bar (5 primary modules) */}
        <div className="lg:hidden sticky top-0 z-30 -mx-4 px-4 pt-1 pb-1.5 bg-[#eaeff5]/85 backdrop-blur-xl">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 border border-white/80 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.3)]">
            {NAV_MODULES.map((m) => {
              const Icon = m.icon;
              const active = module === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => go(m.id)}
                  className={cx(
                    'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black tracking-tight transition-all active:scale-95',
                    active ? 'bg-[#ba0036] text-white shadow-[0_8px_18px_-8px_rgba(186,0,54,0.55)]' : 'text-gray-500 hover:text-gray-900'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} strokeWidth={2.4} />
                  <span className="truncate max-w-full leading-none">{isBn ? m.bn : m.en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DESKTOP: vertical sidebar nav (all modules) */}
        <aside className="hidden lg:block w-60 shrink-0 lg:sticky lg:top-4">
          {/* Solid bg (no backdrop-blur): this rail is sticky, so blurring its
              backdrop every scroll frame was a desktop-jank source. */}
          <nav className="bg-white/95 border border-white/80 rounded-3xl p-2 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] space-y-1">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const active = module === m.id;
              const badge = m.id === 'reminders' ? reminders.length : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => go(m.id)}
                  className={cx(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-black tracking-tight transition-all active:scale-[0.98]',
                    active
                      ? 'bg-[#ba0036] text-white shadow-[0_10px_22px_-10px_rgba(186,0,54,0.6)]'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={2.3} />
                  <span className="flex-1 text-left">{isBn ? m.bn : m.en}</span>
                  {badge > 0 && (
                    <span className={cx('min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-black', active ? 'bg-white/25 text-white' : 'bg-[#ba0036] text-white')}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main id="living-scroll" className="flex-1 min-w-0 pt-3 lg:pt-0 pb-28 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={module}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <ActiveModule go={go} me={me} t={t} language={language} intent={intent} clearIntent={() => setIntent(null)} />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* DESKTOP (xl+): sticky "Featured" wallet snapshot — stays pinned while
            the module content scrolls. Gives the wide desktop a real 3-column
            dashboard instead of one narrow mobile column. */}
        <aside className="hidden xl:block w-72 shrink-0 xl:sticky xl:top-4 pb-12">
          <FeaturedRail go={go} me={me} language={language} />
        </aside>
      </div>
    </div>
  );
};

export default Living;
