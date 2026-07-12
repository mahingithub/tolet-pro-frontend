import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, BellRing } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext.jsx';
import useLivingStore from '../../store/useLivingStore';
import { buildReminders } from './livingUtils';
import { MODULES } from './livingConfig';
import { cx } from './livingUI';

import WalletSummary from './WalletSummary';
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
  // Whole-state snapshot for reminder badge (recomputes on any store change).
  const state = useLivingStore();

  // Adopt the authenticated user's name for the "You" roommate the first time
  // (only while it's still the default), so balances read naturally.
  useEffect(() => {
    const me = roommates.find((r) => r.isMe);
    if (user?.name && me && me.name === 'You') setMyName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

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
      {/* decorative orbs — same language as the dashboards */}
      <div className="fixed top-[-18%] left-[-12%] w-[52vw] h-[52vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-22%] right-[-12%] w-[52vw] h-[52vw] bg-gradient-to-tl from-emerald-500/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="w-full max-w-3xl mx-auto z-40 relative px-4">
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

          <button
            onClick={() => go('reminders')}
            className="relative p-2.5 bg-white/70 rounded-xl border border-white/80 shadow-sm text-gray-500 hover:text-[#ba0036] hover:bg-white active:scale-90 transition shrink-0"
            aria-label={isBn ? 'রিমাইন্ডার' : 'Reminders'}
          >
            <BellRing size={18} />
            {reminders.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ba0036] text-white text-[10px] font-black border-2 border-white">
                {reminders.length}
              </span>
            )}
          </button>
        </header>
      </div>

      {/* ── Module sub-navigation (horizontal scroll pills, sticky) ────── */}
      <div className="w-full max-w-3xl mx-auto z-30 sticky top-0 px-4 mt-3 pt-1 pb-1.5 bg-[#eaeff5]/85 backdrop-blur-xl">
        <div
          className="flex items-center gap-2 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {MODULES.map((m) => {
            const Icon = m.icon;
            const active = module === m.id;
            const isReminder = m.id === 'reminders';
            return (
              <button
                key={m.id}
                onClick={() => go(m.id)}
                className={cx(
                  'shrink-0 inline-flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-2xl text-[12px] font-black tracking-tight transition-all border active:scale-95',
                  active
                    ? 'bg-[#ba0036] text-white border-[#ba0036] shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)]'
                    : 'bg-white/70 backdrop-blur-xl text-gray-600 border-white/80 hover:text-gray-900'
                )}
              >
                <Icon size={15} strokeWidth={2.4} />
                {isBn ? m.bn : m.en}
                {isReminder && reminders.length > 0 && (
                  <span
                    className={cx(
                      'ml-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black',
                      active ? 'bg-white/25 text-white' : 'bg-[#ba0036] text-white'
                    )}
                  >
                    {reminders.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main id="living-scroll" className="w-full max-w-3xl mx-auto z-10 relative px-4 pt-3 pb-28 md:pb-14 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={module}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ActiveModule go={go} me={ME} t={t} language={language} intent={intent} clearIntent={() => setIntent(null)} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Living;
