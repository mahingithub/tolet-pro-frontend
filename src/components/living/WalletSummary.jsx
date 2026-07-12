import React, { useMemo } from 'react';
import {
  Receipt, UtensilsCrossed, Zap, HandCoins, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownLeft, ChevronRight, Wallet, PiggyBank, CalendarClock,
} from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { walletSummary, monthlyReport, taka, takaSigned, timeAgo, dateLabel, daysUntil, roommateById } from './livingUtils';
import { getBillType, BILL_STATUS, getActivityMeta } from './livingConfig';
import { deriveBillStatus } from './livingUtils';
import { Card, IconBadge, Avatar, Chip, cx } from './livingUI';

const QUICK = [
  { id: 'add-expense', icon: Receipt, tint: 'bg-blue-50', text: 'text-blue-600', en: 'Add Expense', bn: 'খরচ যোগ', module: 'expenses', intent: 'add' },
  { id: 'log-meal', icon: UtensilsCrossed, tint: 'bg-emerald-50', text: 'text-emerald-600', en: 'Log Meal', bn: 'মিল লগ', module: 'meals', intent: 'add' },
  { id: 'pay-bill', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', en: 'Pay Bill', bn: 'বিল দিন', module: 'bills', intent: null },
  { id: 'settle', icon: HandCoins, tint: 'bg-violet-50', text: 'text-violet-600', en: 'Settle Up', bn: 'সেটেল', module: 'balances', intent: 'add' },
];

const WalletSummary = ({ go, me, language }) => {
  const isBn = language === 'বাংলা';
  const state = useLivingStore();
  const { roommates, bills, activities } = state;

  const ws = useMemo(() => walletSummary(state, me), [state, me]);
  const report = useMemo(() => monthlyReport(state, 0), [state]);

  const myDebts = useMemo(() => {
    const owe = ws.debts.filter((d) => d.from === me).map((d) => ({ ...d, dir: 'owe' }));
    const owed = ws.debts.filter((d) => d.to === me).map((d) => ({ ...d, dir: 'owed' }));
    return [...owe, ...owed].slice(0, 3);
  }, [ws.debts, me]);

  const nextBill = useMemo(() => {
    const unpaid = bills.filter((b) => b.status !== 'paid');
    unpaid.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return unpaid[0] || null;
  }, [bills]);

  const recent = activities.slice(0, 3);
  const positive = ws.totalBalance >= 0;

  return (
    <div className="space-y-4">
      {/* ── Hero: Total Balance ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ba0036] via-[#d11147] to-[#ff4d6d] text-white p-5 shadow-[0_20px_45px_-18px_rgba(186,0,54,0.7)]">
        <div className="absolute -top-10 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet size={15} />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {isBn ? 'মোট ব্যালেন্স' : 'Total Balance'}
            </span>
          </div>
          <p className="text-[34px] leading-none font-black tracking-tight mt-2">{takaSigned(ws.totalBalance, language)}</p>
          <p className="text-[12px] font-semibold text-white/80 mt-1.5">
            {ws.totalBalance === 0
              ? isBn ? 'সব হিসাব মিটে গেছে' : "You're all settled up"
              : positive
              ? isBn ? 'সব মিলিয়ে আপনি পাবেন' : "Overall, you're owed money"
              : isBn ? 'সব মিলিয়ে আপনার দিতে হবে' : 'Overall, you owe money'}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowUpRight size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি দিবেন' : 'You Owe'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(ws.youOwe, language)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowDownLeft size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি পাবেন' : 'Others Owe You'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(ws.othersOweYou, language)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK.map((q) => (
          <button
            key={q.id}
            onClick={() => go(q.module, q.intent)}
            className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-gray-100 p-3 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition"
          >
            <IconBadge icon={q.icon} tint={q.tint} text={q.text} size={40} iconSize={18} />
            <span className="text-[10px] font-black text-gray-700 leading-tight text-center">{isBn ? q.bn : q.en}</span>
          </button>
        ))}
      </div>

      {/* ── This Month Spending + Total Living Cost ─────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-gray-400">
            <TrendingDown size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'এ মাসের খরচ' : 'This Month'}</span>
          </div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(ws.thisMonthSpending, language)}</p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{isBn ? 'আপনার ভাগের খরচ' : 'Your share of costs'}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Wallet size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'মোট খরচ' : 'Living Cost'}</span>
          </div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(ws.totalLivingCost, language)}</p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{isBn ? 'বাসার মোট (এ মাস)' : 'Household this month'}</p>
        </Card>
      </div>

      {/* ── Monthly snapshot strip → Report ─────────────────────────── */}
      <button onClick={() => go('report')} className="w-full text-left">
        <Card className="p-4 flex items-center gap-4 active:scale-[0.99] transition">
          <div className={cx('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', report.savings >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-red-600')}>
            <PiggyBank size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'এ মাসের সঞ্চয়' : 'Projected Savings'}</p>
            <p className={cx('text-lg font-black tracking-tight', report.savings >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {takaSigned(report.savings, language)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold text-gray-400">{isBn ? 'আয়' : 'Income'}</p>
            <p className="text-[13px] font-black text-gray-700">{taka(report.income, language)}</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </Card>
      </button>

      {/* ── Balances snapshot ───────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight">{isBn ? 'কে কাকে দিবে' : 'Who owes whom'}</h3>
          <button onClick={() => go('balances')} className="text-[11px] font-black text-[#ba0036] flex items-center gap-0.5">
            {isBn ? 'সব দেখুন' : 'View all'} <ChevronRight size={13} />
          </button>
        </div>
        {myDebts.length === 0 ? (
          <p className="text-[12px] font-semibold text-gray-400 py-3 text-center">{isBn ? 'কোনো বকেয়া নেই 🎉' : 'No pending balances 🎉'}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {myDebts.map((d) => {
              const other = roommateById(roommates, d.dir === 'owe' ? d.to : d.from);
              return (
                <div key={`${d.from}-${d.to}`} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={other} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">
                      {d.dir === 'owe'
                        ? isBn ? `${other.name}-কে দিতে হবে` : `You owe ${other.name}`
                        : isBn ? `${other.name} আপনাকে দিবে` : `${other.name} owes you`}
                    </p>
                  </div>
                  <span className={cx('text-[14px] font-black tabular-nums', d.dir === 'owe' ? 'text-red-600' : 'text-emerald-600')}>
                    {d.dir === 'owe' ? '−' : '+'}
                    {taka(d.amount, language)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Upcoming bill ───────────────────────────────────────────── */}
      {nextBill && (() => {
        const meta = getBillType(nextBill.type);
        const st = deriveBillStatus(nextBill);
        const stMeta = BILL_STATUS[st];
        const d = daysUntil(nextBill.dueDate);
        const Icon = meta.icon;
        return (
          <button onClick={() => go('bills')} className="w-full text-left">
            <Card className="p-4 flex items-center gap-3.5 active:scale-[0.99] transition">
              <IconBadge icon={Icon} tint={meta.tint} text={meta.text} size={44} iconSize={20} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-black text-gray-900">{isBn ? meta.bn : meta.en}</p>
                  <Chip tint={stMeta.tint} text={stMeta.text}>{isBn ? stMeta.bn : stMeta.en}</Chip>
                </div>
                <p className="text-[11px] font-semibold text-gray-400 mt-0.5 flex items-center gap-1">
                  <CalendarClock size={12} />
                  {d < 0
                    ? isBn ? `${Math.abs(d)} দিন পার` : `${Math.abs(d)}d overdue`
                    : d === 0
                    ? isBn ? 'আজ শেষ দিন' : 'Due today'
                    : isBn ? `${d} দিনে দিতে হবে` : `Due in ${d} days`}
                </p>
              </div>
              <span className="text-[15px] font-black text-gray-900 shrink-0">{taka(nextBill.amount, language)}</span>
            </Card>
          </button>
        );
      })()}

      {/* ── Recent activity ─────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight">{isBn ? 'সাম্প্রতিক কার্যক্রম' : 'Recent activity'}</h3>
          <button onClick={() => go('activity')} className="text-[11px] font-black text-[#ba0036] flex items-center gap-0.5">
            {isBn ? 'সব দেখুন' : 'View all'} <ChevronRight size={13} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {recent.map((a) => {
            const meta = getActivityMeta(a.type);
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <IconBadge icon={Icon} tint={meta.tint} text={meta.text} size={34} iconSize={15} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold text-gray-800 truncate">{a.title}</p>
                  <p className="text-[11px] font-medium text-gray-400 truncate">{a.detail}</p>
                </div>
                <span className="text-[10px] font-bold text-gray-400 shrink-0">{timeAgo(a.date, language)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default WalletSummary;
