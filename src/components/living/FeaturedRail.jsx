import React, { useMemo } from 'react';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, BellRing, Receipt, UtensilsCrossed, Zap,
  HandCoins, Users, ChevronRight, Wifi,
} from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { walletSummary, buildReminders, taka, takaSigned } from './livingUtils';
import { Card, IconBadge, cx } from './livingUI';

const QUICK = [
  { id: 'add-expense', icon: Receipt, tint: 'bg-blue-50', text: 'text-blue-600', en: 'Add Expense', bn: 'খরচ যোগ', module: 'expenses', intent: 'add' },
  { id: 'log-meal', icon: UtensilsCrossed, tint: 'bg-emerald-50', text: 'text-emerald-600', en: 'Log Meal', bn: 'মিল লগ', module: 'meals', intent: 'add' },
  { id: 'pay-bill', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', en: 'Pay Bill', bn: 'বিল দিন', module: 'bills', intent: null },
  { id: 'settle', icon: HandCoins, tint: 'bg-violet-50', text: 'text-violet-600', en: 'Settle Up', bn: 'সেটেল', module: 'balances', intent: 'add' },
];

/**
 * FeaturedRail — the desktop-only ("xl+") sticky wallet snapshot that stays
 * pinned beside the scrolling module content. It gives the Living tab a proper
 * three-column desktop layout (nav · content · featured rail) instead of a
 * lone mobile column stretched across a wide screen. Intentionally solid
 * backgrounds (no backdrop-blur) so it composites cheaply while the page
 * scrolls — smooth on desktop.
 */
const FeaturedRail = ({ go, me, language }) => {
  const isBn = language === 'বাংলা';
  const state = useLivingStore();
  const connected = useLivingStore((s) => s.connected);
  const householdName = useLivingStore((s) => s.householdName);
  const roommates = useLivingStore((s) => s.roommates);

  const ws = useMemo(() => walletSummary(state, me), [state, me]);
  const reminders = useMemo(() => buildReminders(state, me), [state, me]);
  const positive = ws.totalBalance >= 0;

  return (
    <div className="space-y-4">
      {/* balance hero (compact) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ba0036] via-[#d11147] to-[#ff4d6d] text-white p-4 shadow-[0_18px_40px_-20px_rgba(186,0,54,0.7)]">
        <div className="absolute -top-8 -right-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-white/80">
            <Wallet size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isBn ? 'মোট ব্যালেন্স' : 'Total Balance'}</span>
          </div>
          <p className="text-[28px] leading-none font-black tracking-tight mt-2">{takaSigned(ws.totalBalance, language)}</p>
          <p className="text-[11px] font-semibold text-white/80 mt-1.5">
            {ws.totalBalance === 0
              ? isBn ? 'সব হিসাব মিটে গেছে' : "You're all settled up"
              : positive
              ? isBn ? 'সব মিলিয়ে আপনি পাবেন' : "Overall, you're owed"
              : isBn ? 'সব মিলিয়ে আপনার দিতে হবে' : 'Overall, you owe'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-2.5 border border-white/10">
              <div className="flex items-center gap-1 text-white/85">
                <ArrowUpRight size={12} />
                <span className="text-[9px] font-black uppercase tracking-wider">{isBn ? 'দিবেন' : 'You Owe'}</span>
              </div>
              <p className="text-[15px] font-black tracking-tight mt-0.5">{taka(ws.youOwe, language)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-2.5 border border-white/10">
              <div className="flex items-center gap-1 text-white/85">
                <ArrowDownLeft size={12} />
                <span className="text-[9px] font-black uppercase tracking-wider">{isBn ? 'পাবেন' : 'Owed'}</span>
              </div>
              <p className="text-[15px] font-black tracking-tight mt-0.5">{taka(ws.othersOweYou, language)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* this month + living cost */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'এ মাস' : 'This Month'}</p>
          <p className="text-[17px] font-black text-gray-900 tracking-tight mt-1">{taka(ws.thisMonthSpending, language)}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'মোট খরচ' : 'Living Cost'}</p>
          <p className="text-[17px] font-black text-gray-900 tracking-tight mt-1">{taka(ws.totalLivingCost, language)}</p>
        </Card>
      </div>

      {/* quick actions */}
      <Card className="p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1 mb-2">{isBn ? 'কুইক অ্যাকশন' : 'Quick actions'}</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK.map((q) => (
            <button
              key={q.id}
              onClick={() => go(q.module, q.intent)}
              className="flex items-center gap-2 rounded-2xl border border-gray-100 p-2.5 hover:bg-gray-50 active:scale-95 transition text-left"
            >
              <IconBadge icon={q.icon} tint={q.tint} text={q.text} size={32} iconSize={15} />
              <span className="text-[11px] font-black text-gray-700 leading-tight">{isBn ? q.bn : q.en}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* reminders + household */}
      <Card className="px-3 py-0.5">
        <button onClick={() => go('reminders')} className="w-full flex items-center gap-3 py-2.5 active:scale-[0.99] transition">
          <IconBadge icon={BellRing} tint="bg-rose-50" text="text-red-600" size={34} iconSize={16} />
          <span className="flex-1 text-left text-[12px] font-bold text-gray-800">{isBn ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminders'}</span>
          {reminders.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#ba0036] text-white text-[10px] font-black">{reminders.length}</span>
          )}
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </Card>

      <button
        onClick={() => go('overview')}
        className={cx(
          'w-full flex items-center gap-2.5 rounded-2xl border px-3 py-3 active:scale-[0.99] transition text-left',
          connected ? 'border-emerald-100 bg-emerald-50/50' : 'border-[#ba0036]/15 bg-gradient-to-r from-[#ba0036]/[0.06] to-transparent'
        )}
      >
        <IconBadge icon={connected ? Wifi : Users} tint={connected ? 'bg-emerald-50' : 'bg-[#ba0036]/10'} text={connected ? 'text-emerald-600' : 'text-[#ba0036]'} size={36} iconSize={17} />
        <div className="flex-1 min-w-0">
          {connected ? (
            <>
              <p className="text-[12px] font-black text-gray-900 truncate">{householdName || (isBn ? 'হাউসহোল্ড' : 'Household')}</p>
              <p className="text-[10.5px] font-semibold text-gray-500">
                {roommates.length} {isBn ? 'জন সদস্য · কানেক্টেড' : roommates.length === 1 ? 'member · connected' : 'members · connected'}
              </p>
            </>
          ) : (
            <>
              <p className="text-[12px] font-black text-gray-900">{isBn ? 'রুমমেট কানেক্ট করুন' : 'Connect roommates'}</p>
              <p className="text-[10.5px] font-semibold text-gray-500">{isBn ? 'এক ওয়ালেট, সবার ফোনে' : 'One shared wallet, all phones'}</p>
            </>
          )}
        </div>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </button>
    </div>
  );
};

export default FeaturedRail;
