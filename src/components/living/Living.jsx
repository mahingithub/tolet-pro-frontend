import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGoBack from '../../hooks/useGoBack';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Wallet, BellRing, CloudOff } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import useLivingStore from '../../store/useLivingStore';
import callProvider from '../../services/callProvider';
import { isSoloOp } from '../../store/livingOps';
import { buildReminders, initials, num } from './livingUtils';
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

import { SOLO_MODULES } from './soloConfig';
import { ModeChooser, ModeSwitcher } from './LivingMode';
import SoloOverview from './SoloOverview';
import { SoloIncome, SoloSpending } from './SoloLedger';
import SoloPeople from './SoloPeople';
import SoloReport from './SoloReport';

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

// The solo wallet is its own set of modules over its own store slice — same
// shell, same navigation, entirely separate data.
const SOLO_MODULE_COMPONENTS = {
  overview: SoloOverview,
  spending: SoloSpending,
  income: SoloIncome,
  people: SoloPeople,
  report: SoloReport,
};

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
  const { settings, update: updateSettings } = useSettings();
  // Is Living this user's home screen? If so it must not offer a "back" that
  // points at a page they never came from.
  const isHome = (settings?.app?.defaultHome || 'auto') === 'living';

  const setMyName = useLivingStore((s) => s.setMyName);
  const roommates = useLivingStore((s) => s.roommates);
  const connected = useLivingStore((s) => s.connected);
  const myId = useLivingStore((s) => s.myId);
  const hydrateHousehold = useLivingStore((s) => s.hydrateHousehold);
  const hydrateSolo = useLivingStore((s) => s.hydrateSolo);
  // 'solo' = my own খাতা, 'joint' = the shared roommate wallet, null = not asked yet.
  const mode = useLivingStore((s) => s.mode);
  const setLivingMode = useLivingStore((s) => s.setLivingMode);
  // Writes made on this phone that the server hasn't confirmed yet.
  const outbox = useLivingStore((s) => s.outbox);
  const flushOutbox = useLivingStore((s) => s.flushOutbox);
  // Whole-state snapshot for reminder badge (recomputes on any store change).
  const state = useLivingStore();

  const isSolo = mode === 'solo';
  // One queue holds both wallets' unsent work, so the header only counts the
  // writes belonging to the wallet currently on screen — telling someone in
  // their private খাতা that "৩টি অপেক্ষায়" when all three are mess entries is
  // just confusing.
  const pendingHere = useMemo(
    () => outbox.filter((op) => isSoloOp(op) === isSolo).length,
    [outbox, isSolo],
  );
  const modules = isSolo ? SOLO_MODULES : MODULES;
  const navModules = isSolo ? SOLO_MODULES : NAV_MODULES;
  const components = isSolo ? SOLO_MODULE_COMPONENTS : MODULE_COMPONENTS;
  const validIds = useMemo(() => modules.map((m) => m.id), [modules]);

  // Identity used across every module: my member id when connected to a shared
  // household, else the local planner's 'me'.
  const me = connected ? myId : ME;

  // On mount: sync BOTH wallets with the server. If the user belongs to a
  // household we flip into connected mode; otherwise we stay on the local
  // planner. The solo খাতা reconciles alongside it — uploading itself the first
  // time, downloading after that. No-op for guests.
  useEffect(() => {
    const ctrl = new AbortController();
    hydrateHousehold(ctrl.signal);
    hydrateSolo(ctrl.signal);
    return () => ctrl.abort();
  }, [hydrateHousehold, hydrateSolo]);

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

  // A deep link written for the other wallet (…/living?m=meals while solo is on)
  // simply lands on that wallet's Overview rather than a blank screen.
  const initialModule = useMemo(() => {
    const fromState = location.state?.module;
    const fromQuery = new URLSearchParams(location.search).get('m');
    const candidate = fromState || fromQuery;
    return validIds.includes(candidate) ? candidate : 'overview';
  }, [location.state, location.search, validIds]);

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
      if (!validIds.includes(id)) return;
      setModule(id);
      setIntent(nextIntent);
      // keep the URL shareable without adding history spam
      const params = new URLSearchParams(location.search);
      params.set('m', id);
      navigate({ pathname: '/living', search: `?${params.toString()}` }, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [location.search, navigate, validIds]
  );

  useEffect(() => {
    const handleTourTab = (e) => {
      if (validIds.includes(e.detail)) {
        go(e.detail);
      }
    };
    window.addEventListener('tour:tab', handleTourTab);
    return () => window.removeEventListener('tour:tab', handleTourTab);
  }, [go, validIds]);

  // The wallet choice belongs to the PERSON, not the phone. It used to live
  // only in the local store, so reinstalling the app — or signing in on another
  // device — asked "একা না যৌথ?" all over again on a ledger that was already
  // restored. Adopt the account's answer whenever this device hasn't got one.
  const savedMode = settings?.app?.livingMode || '';
  useEffect(() => {
    if (mode) return; // this device already has an answer; never override it
    if (savedMode === 'solo' || savedMode === 'joint') setLivingMode(savedMode);
  }, [mode, savedMode, setLivingMode]);

  // Picking (or switching) a wallet always lands on that wallet's Overview —
  // the module ids differ between the two, so staying put isn't an option.
  const switchMode = useCallback(
    (next) => {
      setLivingMode(next);
      // Remember it on the account too. Fire-and-forget: the local store is
      // what renders, so a failed write costs the user nothing today and is
      // retried the next time they switch.
      if (next !== savedMode) updateSettings({ app: { livingMode: next } }).catch(() => {});
      setModule('overview');
      setIntent(null);
      const params = new URLSearchParams(location.search);
      params.set('m', 'overview');
      navigate({ pathname: '/living', search: `?${params.toString()}` }, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [location.search, navigate, setLivingMode, savedMode, updateSettings]
  );

  // Manual "send it now". The queue retries on its own (on reconnect, on every
  // poll, after each write), but when someone is standing still watching the
  // signal bars come back, waiting for a timer feels broken.
  const retrySync = useCallback(async () => {
    const before = useLivingStore.getState().outbox.length;
    await flushOutbox();
    const after = useLivingStore.getState().outbox.length;
    if (after === 0) toast.success(isBn ? 'সব সিঙ্ক হয়ে গেছে' : 'Everything is synced');
    else if (after >= before) toast.error(isBn ? 'এখনো নেট পাওয়া যাচ্ছে না' : 'Still no connection');
  }, [flushOutbox, isBn]);

  // Reminders are derived from the shared household (bills, dues, budgets), so
  // they only mean something on the joint side.
  const reminders = useMemo(() => (isSolo || !mode ? [] : buildReminders(state, ME)), [state, isSolo, mode]);
  const back = useGoBack('/tenant-dashboard');

  const [isNavVisible, setIsNavVisible] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (window.innerWidth >= 1024) {
      if (!isNavVisible) setIsNavVisible(true);
      return;
    }
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 60) {
      setIsNavVisible(false); // scrolling down -> hide
    } else if (latest < previous) {
      setIsNavVisible(true); // scrolling up -> show
    }
  });

  const ActiveModule = components[module] || components.overview;

  return (
    <div className="flex flex-col min-h-screen bg-[#eaeff5] font-sans relative text-gray-900 selection:bg-[#ba0036] selection:text-white">
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
      <header data-tour="living-header" className={cx(
        "w-full bg-white/95 backdrop-blur-2xl sticky top-0 z-[60] border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-transform duration-300 ease-in-out",
        !isNavVisible && "-translate-y-full"
      )}>
        <div className="w-full max-w-[1400px] xl:max-w-[1600px] mx-auto px-4 h-[56px] md:h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* No back arrow when this IS the home screen — there is nothing
                behind it, and an arrow that jumps to a page the user never
                opened reads as a bug. */}
            {!isHome && (
              <button
                onClick={back}
                className="p-2.5 bg-white/70 rounded-xl border border-white/80 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-white active:scale-90 transition"
                aria-label={isBn ? 'পেছনে' : 'Back'}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-gradient-to-br from-[#ba0036] to-[#ff4d6d] p-2 rounded-xl shadow-[0_4px_15px_rgba(186,0,54,0.3)] shrink-0">
                <Wallet className="text-white w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-base md:text-lg tracking-tight leading-none truncate">
                  {!mode
                    ? isBn ? 'লিভিং' : 'Living'
                    : isSolo
                    ? isBn ? 'আমার হিসাব' : 'My Wallet'
                    : isBn ? 'রুমমেট ওয়ালেট' : 'Roommate Wallet'}
                </h1>
                <p className="text-[10px] font-bold text-[#ba0036] uppercase tracking-widest mt-1">
                  {!mode ? (isBn ? 'হিসাবের খাতা' : 'Your ledger') : isBn ? 'লিভিং' : 'Living'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Written here, not yet at the server. Tapping tries again now
                rather than waiting for the next poll — the thing a user reaches
                for the moment they see a bar of signal come back. */}
            {pendingHere > 0 && (
              <button
                onClick={retrySync}
                className="flex items-center gap-1.5 pl-2 pr-2.5 py-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 active:scale-95 transition"
                aria-label={isBn ? 'এখনো সিঙ্ক হয়নি — আবার চেষ্টা করুন' : 'Not synced yet — try again'}
              >
                <CloudOff size={15} />
                <span className="text-[11px] font-black whitespace-nowrap">
                  {isBn ? `${num(pendingHere, language)}টি অপেক্ষায়` : `${pendingHere} pending`}
                </span>
              </button>
            )}

            {mode && <ModeSwitcher mode={mode} isBn={isBn} onSwitch={switchMode} />}

            {!isSolo && mode && (
              <button
                data-tour="living-reminders"
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
            )}

            <button
              data-tour="living-profile"
              onClick={() => navigate('/tenant-dashboard')}
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
        </div>
      </header>

      {/* ── The fork: which wallet is this? Asked once, then remembered. ── */}
      {!mode && (
        <div className="w-full max-w-[1400px] xl:max-w-[1600px] mx-auto px-4 relative z-10 mt-3 pb-24 lg:pb-12">
          <ModeChooser isBn={isBn} onPick={switchMode} />
        </div>
      )}

      {/* ── Body: desktop nav + content + featured rail · mobile pills + content ── */}
      {mode && (
      <div className="w-full max-w-[1400px] xl:max-w-[1600px] mx-auto px-4 relative z-10 mt-3 lg:flex lg:gap-6 lg:items-start">
        {/* MOBILE: sticky segmented tab bar (5 primary modules) */}
        <div className={cx(
          "lg:hidden sticky z-50 -mx-4 px-4 pt-1 pb-1.5 bg-[#eaeff5]/95 backdrop-blur-xl border-b border-gray-200/50 transition-[top] duration-300 ease-in-out",
          isNavVisible ? "top-[56px] md:top-[64px]" : "top-0"
        )}>
          <div data-tour="living-mobile-nav" className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 border border-white/80 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.3)]">
            {navModules.map((m) => {
              const Icon = m.icon;
              const active = module === m.id;
              return (
                <button
                  key={m.id}
                  data-tour={`living-tab-${m.id}`}
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
        <aside className="hidden lg:flex flex-col w-60 shrink-0 lg:sticky lg:top-[80px] lg:h-[calc(100vh-96px)]">
          {/* Solid bg (no backdrop-blur): this rail is sticky, so blurring its
              backdrop every scroll frame was a desktop-jank source. */}
          <nav data-tour="living-desktop-nav" className="bg-[#1a1f2e] border border-[#2d3748] rounded-3xl p-2 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.5)] space-y-1 flex-1 overflow-y-auto scrollbar-hide">
            {modules.map((m) => {
              const Icon = m.icon;
              const active = module === m.id;
              const badge = m.id === 'reminders' ? reminders.length : 0;
              return (
                <button
                  key={m.id}
                  data-tour={`living-tab-${m.id}`}
                  onClick={() => go(m.id)}
                  className={cx(
                    'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[13px] font-black tracking-tight transition-all active:scale-[0.98]',
                    active
                      ? 'bg-[#ba0036] text-white shadow-[0_10px_22px_-10px_rgba(186,0,54,0.6)]'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
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

        {/* Main Content Area */}
        <main id="living-scroll" data-tour="living-content" className="flex-1 min-w-0 pb-24 lg:pb-12 mt-3 lg:mt-0 relative z-20">
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
            the module content scrolls. Hidden on Overview (which IS the summary,
            so a rail there just duplicates it); shown on the focused modules
            where a persistent wallet snapshot genuinely helps. Joint only — it
            summarises roommate balances, which the solo wallet has none of. */}
        {!isSolo && module !== 'overview' && module !== 'meals' && (
          <aside className="hidden xl:block w-72 shrink-0 xl:sticky xl:top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-hide pb-12">
            <FeaturedRail go={go} me={me} language={language} />
          </aside>
        )}
      </div>
      )}
    </div>
  );
};

export default Living;
