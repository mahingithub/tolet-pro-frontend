/**
 * SoloOverview — the first screen of the solo wallet. One question answered at
 * the top ("how much do I actually have?"), four buttons to write the next row,
 * and then the month in three glances: where it went, who owes whom, what just
 * happened.
 */
import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, ChevronRight, HandCoins, PiggyBank, Settings2,
  Sparkles, Target, Wallet,
} from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { dateLabel, monthLabel, taka } from './livingUtils';
import { getEntryType, getSpendCategory } from './soloConfig';
import { byNewest, personRows, soloSummary, takaBalance } from './soloUtils';
import {
  Avatar, Card, ConfirmDialog, Field, HBar, IconBadge, MoneyInput, PrimaryButton,
  ProgressBar, SectionHeader, Sheet, cx,
} from './livingUI';

const QUICK = [
  { type: 'expense', module: 'spending' },
  { type: 'income', module: 'income' },
  { type: 'lend', module: 'spending' },
  { type: 'borrow', module: 'income' },
];

// ── opening balance / budget / wipe ─────────────────────────────────────────
const SettingsSheet = ({ open, onClose, isBn }) => {
  const solo = useLivingStore((s) => s.solo);
  const setSoloOpening = useLivingStore((s) => s.setSoloOpening);
  const setSoloBudget = useLivingStore((s) => s.setSoloBudget);
  const resetSolo = useLivingStore((s) => s.resetSolo);

  const [opening, setOpening] = useState('');
  const [budget, setBudget] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setOpening(String(solo.opening || ''));
    setBudget(String(solo.budget || ''));
    setConfirmReset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isBn ? 'হিসাবের সেটিং' : 'Ledger settings'}
        subtitle={isBn ? 'শুরুর টাকা আর মাসিক বাজেট' : 'Starting cash and your monthly cap'}
        footer={
          <PrimaryButton
            className="w-full"
            onClick={() => { setSoloOpening(opening); setSoloBudget(budget); onClose(); }}
          >
            {isBn ? 'সেভ করুন' : 'Save'}
          </PrimaryButton>
        }
      >
        <div className="space-y-4 py-1">
          <Field
            label={isBn ? 'শুরুতে হাতে ছিল' : 'Cash in hand at the start'}
            hint={isBn ? 'খাতা শুরু করার দিন পকেটে/বিকাশে যত ছিল। না জানলে ফাঁকা রাখুন।' : "Whatever you had the day you started. Leave it blank if you're not sure."}
          >
            <MoneyInput value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
          </Field>

          <Field
            label={isBn ? 'মাসিক বাজেট' : 'Monthly budget'}
            hint={isBn ? 'এ মাসে সর্বোচ্চ কত খরচ করতে চান। ০ দিলে বাজেট বন্ধ।' : 'The most you want to spend in a month. 0 turns it off.'}
          >
            <MoneyInput value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" />
          </Field>

          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3.5">
            <p className="text-[11.5px] font-bold text-gray-600 leading-relaxed">
              {isBn
                ? 'এই হিসাব শুধু আপনার ফোনেই থাকে — ইন্টারনেট ছাড়াই কাজ করে, আর কেউ দেখতে পায় না।'
                : 'This ledger lives on your phone only — it works with no internet, and nobody else can see it.'}
            </p>
          </div>

          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-3 rounded-2xl bg-rose-50 text-red-600 text-[12px] font-black active:scale-95 transition"
          >
            {isBn ? 'পুরো হিসাব মুছে ফেলুন' : 'Erase the whole ledger'}
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetSolo(); onClose(); }}
        title={isBn ? 'সব মুছে ফেলবেন?' : 'Erase everything?'}
        message={
          isBn
            ? `${solo.entries.length}টি হিসাব আর ${solo.people.length}টি প্রোফাইল স্থায়ীভাবে মুছে যাবে। ফেরানো যাবে না।`
            : `${solo.entries.length} entries and ${solo.people.length} profiles will be permanently deleted. This can't be undone.`
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Erase'}
        cancelLabel={isBn ? 'থাক' : 'Keep it'}
      />
    </>
  );
};

const SoloOverview = ({ go, language }) => {
  const isBn = language === 'বাংলা';
  const solo = useLivingStore((s) => s.solo);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const s = useMemo(() => soloSummary(solo, 0), [solo]);
  const dues = useMemo(() => personRows(solo), [solo]);
  const recent = useMemo(() => [...solo.entries].sort(byNewest).slice(0, 5), [solo.entries]);

  const topCategories = s.byCategory.slice(0, 5);
  const overBudget = s.budget > 0 && s.spent > s.budget;

  return (
    <div className="space-y-4">
      {/* ── Hero: what is actually in hand ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ba0036] via-[#d11147] to-[#ff4d6d] text-white p-5 shadow-[0_20px_45px_-18px_rgba(186,0,54,0.7)]">
        <div className="absolute -top-10 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white/80">
              <Wallet size={15} />
              <span className="text-[11px] font-black uppercase tracking-widest">{isBn ? 'হাতে আছে' : 'Cash in hand'}</span>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl bg-white/15 border border-white/10 text-white/90 active:scale-90 transition"
              aria-label={isBn ? 'সেটিং' : 'Settings'}
            >
              <Settings2 size={15} />
            </button>
          </div>
          <p className="text-[34px] leading-none font-black tracking-tight mt-2">{takaBalance(s.cash, language)}</p>
          <p className="text-[12px] font-semibold text-white/80 mt-1.5">
            {isBn ? `${monthLabel(s.ref, language)} · সব হিসাব মিলিয়ে` : `${monthLabel(s.ref, language)} · after every entry`}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowUpRight size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'এ মাসে খরচ' : 'Spent'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(s.spent, language)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowDownLeft size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'এ মাসে আয়' : 'Earned'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(s.earned, language)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Write the next row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK.map(({ type, module }) => {
          const t = getEntryType(type);
          const Icon = t.icon;
          return (
            <button
              key={type}
              onClick={() => go(module, type)}
              className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-100 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)] py-3 active:scale-95 transition"
            >
              <span className={cx('w-10 h-10 rounded-2xl flex items-center justify-center', t.tint, t.text)}>
                <Icon size={18} strokeWidth={2.3} />
              </span>
              <span className="text-[10px] font-black text-gray-600 leading-tight text-center px-1">{isBn ? t.bn : t.en}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          {/* ── Budget ──────────────────────────────────────────────── */}
          {s.budget > 0 ? (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <IconBadge icon={Target} tint={overBudget ? 'bg-rose-50' : 'bg-emerald-50'} text={overBudget ? 'text-red-600' : 'text-emerald-600'} size={34} iconSize={16} />
                  <div>
                    <p className="text-[13px] font-black text-gray-900 leading-tight">{isBn ? 'মাসিক বাজেট' : 'Monthly budget'}</p>
                    <p className="text-[11px] font-semibold text-gray-400">
                      {taka(s.spent, language)} / {taka(s.budget, language)}
                    </p>
                  </div>
                </div>
                <span className={cx('text-[15px] font-black', overBudget ? 'text-red-600' : 'text-emerald-600')}>
                  {overBudget
                    ? isBn ? `${taka(s.spent - s.budget, language)} বেশি` : `${taka(s.spent - s.budget, language)} over`
                    : isBn ? `${taka(s.budgetLeft, language)} বাকি` : `${taka(s.budgetLeft, language)} left`}
                </span>
              </div>
              <ProgressBar value={s.spent} max={s.budget} color={overBudget ? '#ef4444' : s.budgetUsed > 80 ? '#f59e0b' : '#22c55e'} />
            </Card>
          ) : (
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-3 rounded-3xl bg-white border border-gray-100 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)] p-4 active:scale-[0.99] transition"
            >
              <IconBadge icon={Target} tint="bg-amber-50" text="text-amber-600" size={40} iconSize={18} />
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black text-gray-900">{isBn ? 'মাসিক বাজেট ঠিক করুন' : 'Set a monthly budget'}</p>
                <p className="text-[11px] font-semibold text-gray-500">{isBn ? 'সীমা ছাড়ালে আগেই জানিয়ে দেব' : "We'll warn you before you cross it"}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 shrink-0" />
            </button>
          )}

          {/* ── Where it went ───────────────────────────────────────── */}
          <Card className="p-4">
            <SectionHeader
              title={isBn ? 'কোন খাতে গেল' : 'Where it went'}
              subtitle={isBn ? 'এ মাসের খরচ' : "This month's spending"}
              right={
                <button onClick={() => go('report')} className="text-[11px] font-black text-[#ba0036] flex items-center gap-0.5 active:scale-95 transition">
                  {isBn ? 'বিস্তারিত' : 'Details'} <ChevronRight size={13} />
                </button>
              }
            />
            {topCategories.length === 0 ? (
              <p className="text-[12px] font-semibold text-gray-400 py-4 text-center">
                {isBn ? 'এ মাসে এখনো কোনো খরচ লেখা হয়নি।' : 'No spending logged this month yet.'}
              </p>
            ) : (
              <div className="space-y-0.5">
                {topCategories.map((c) => {
                  const meta = getSpendCategory(c.key);
                  return (
                    <HBar
                      key={c.key}
                      icon={meta.icon}
                      label={isBn ? meta.bn : meta.en}
                      value={c.amount}
                      max={s.spent}
                      color={meta.hex}
                      right={taka(c.amount, language)}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* ── দেনা-পাওনা ───────────────────────────────────────────── */}
          <Card as="button" onClick={() => go('people')} className="w-full p-4 text-left active:scale-[0.99] transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBadge icon={HandCoins} tint="bg-blue-50" text="text-blue-600" size={34} iconSize={16} />
                <p className="text-[13px] font-black text-gray-900">{isBn ? 'দেনা-পাওনা' : 'Dues & loans'}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{isBn ? 'পাবেন' : 'You get'}</p>
                <p className="text-[17px] font-black text-emerald-600 mt-1">{taka(dues.theyOweMe, language)}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-red-600">{isBn ? 'দেবেন' : 'You owe'}</p>
                <p className="text-[17px] font-black text-red-600 mt-1">{taka(dues.iOwe, language)}</p>
              </div>
            </div>
            {dues.rows.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {dues.rows.slice(0, 4).map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
                    <Avatar roommate={p} size={20} ring={false} />
                    <span className="text-[10.5px] font-bold text-gray-600">{p.name}</span>
                  </span>
                ))}
                {dues.rows.length > 4 && (
                  <span className="text-[10.5px] font-black text-gray-400">+{dues.rows.length - 4}</span>
                )}
              </div>
            )}
          </Card>

          {/* ── Saved this month ────────────────────────────────────── */}
          <Card className="p-4 flex items-center gap-3.5">
            <div className={cx('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', s.saved >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-red-600')}>
              <PiggyBank size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-gray-900">
                {s.saved >= 0
                  ? isBn ? `এ মাসে ${taka(s.saved, language)} বেঁচেছে` : `${taka(s.saved, language)} left over this month`
                  : isBn ? `এ মাসে ${taka(-s.saved, language)} বেশি খরচ` : `${taka(-s.saved, language)} overspent this month`}
              </p>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                {isBn ? `আয় ${taka(s.earned, language)} · খরচ ${taka(s.spent, language)}` : `In ${taka(s.earned, language)} · out ${taka(s.spent, language)}`}
              </p>
            </div>
          </Card>

          {/* ── Recent rows ─────────────────────────────────────────── */}
          <Card className="p-4">
            <SectionHeader
              title={isBn ? 'সর্বশেষ' : 'Latest entries'}
              right={
                <button onClick={() => go('spending')} className="text-[11px] font-black text-[#ba0036] flex items-center gap-0.5 active:scale-95 transition">
                  {isBn ? 'সব' : 'All'} <ChevronRight size={13} />
                </button>
              }
            />
            {recent.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-2xl bg-blue-50 border border-blue-100 p-3">
                <Sparkles size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11.5px] font-semibold text-blue-700 leading-relaxed">
                  {isBn
                    ? 'উপরের বোতামগুলো দিয়ে শুরু করুন। যত ছোট খরচই হোক, হাতে হাতে লিখে রাখলে মাস শেষে হিসাব আর মেলাতে হবে না।'
                    : 'Start with the buttons above. Log it the moment it happens — however small — and the month adds up on its own.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((e) => {
                  const t = getEntryType(e.type);
                  const cat = e.category && e.type !== 'income' ? getSpendCategory(e.category) : null;
                  const visual = t.needsPerson || !cat ? t : cat;
                  const person = solo.people.find((p) => p.id === e.personId);
                  return (
                    <div key={e.id} className="flex items-center gap-3 py-2.5">
                      <IconBadge icon={visual.icon} tint={visual.tint} text={visual.text} size={34} iconSize={15} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-black text-gray-900 truncate">
                          {e.note?.trim() || (isBn ? visual.bn : visual.en)}
                        </p>
                        <p className="text-[10.5px] font-semibold text-gray-400">
                          {person ? `${person.name} · ` : ''}{dateLabel(e.date, language)}
                        </p>
                      </div>
                      <span className={cx('text-[13px] font-black tabular-nums shrink-0', t.flow === 'in' ? 'text-emerald-600' : 'text-gray-900')}>
                        {t.flow === 'in' ? '+' : '−'}{taka(e.amount, language)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} isBn={isBn} />
    </div>
  );
};

export default SoloOverview;
