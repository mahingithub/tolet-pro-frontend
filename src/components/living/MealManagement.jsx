import React, { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed, ShoppingBasket, Trash2, ChevronLeft, ChevronRight, Coffee, Sun, Moon, Check, ChefHat,
  Scale, PiggyBank, Gauge, HandCoins, Wallet, Info, Pencil, CalendarRange,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { messSummary, messWeeklyBreakdown, inDateRange, monthLabel, taka, takaSigned, num, dateLabel, roommateById } from './livingUtils';
import {
  Card, SectionHeader, IconBadge, Avatar, Stepper, PrimaryButton, Field, MoneyInput, TextInput,
  SegmentedControl, EmptyState, Sheet, ConfirmDialog, cx,
} from './livingUI';

const MEALS = [
  { key: 'breakfast', icon: Coffee, en: 'Breakfast', bn: 'সকাল' },
  { key: 'lunch', icon: Sun, en: 'Lunch', bn: 'দুপুর' },
  { key: 'dinner', icon: Moon, en: 'Dinner', bn: 'রাত' },
];

const dayISO = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const MonthlyHistorySheet = ({ open, onClose, roommate, meals, range, monthName, language }) => {
  const isBn = language === 'বাংলা';
  const myMeals = useMemo(() => {
    if (!roommate) return [];
    return [...meals]
      .filter((m) => m.roommateId === roommate.id && (m.breakfast > 0 || m.lunch > 0 || m.dinner > 0))
      .filter((m) => !range || inDateRange(m.date, range))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [meals, roommate, range]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'মিলের হিস্ট্রি' : 'Meal History'}
      subtitle={roommate ? `${roommate.name}${monthName ? ` · ${monthName}` : ''}` : ''}
    >
      <div className="py-2 space-y-2">
        {myMeals.length === 0 ? (
          <EmptyState title={isBn ? 'কোনো মিল নেই' : 'No meals'} />
        ) : (
          myMeals.map((m) => {
            const d = new Date(m.date);
            const day = d.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', weekday: 'short' });
            const total = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0);
            return (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-[13px] font-black text-gray-800">{day}</p>
                  <p className="text-[10.5px] font-bold text-gray-500 mt-1 flex gap-2">
                    <span>{isBn ? 'সকাল' : 'B'}: {num(m.breakfast || 0, language)}</span>
                    <span>{isBn ? 'দুপুর' : 'L'}: {num(m.lunch || 0, language)}</span>
                    <span>{isBn ? 'রাত' : 'D'}: {num(m.dinner || 0, language)}</span>
                  </p>
                </div>
                <div className="text-[14px] font-black text-[#ba0036] bg-[#ba0036]/10 px-3 py-1 rounded-xl">
                  {num(total, language)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
};

// ── Deposit (জমা) sheet ─────────────────────────────────────────────────────
const DepositSheet = ({ open, onClose, roommates, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [roommateId, setRoommateId] = useState('me');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setRoommateId(roommates.find((r) => r.isMe)?.id || roommates[0]?.id || 'me');
      setAmount('');
      setNote('');
    }
  }, [open, roommates]);

  const amt = Number(amount) || 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'জমা দিন' : 'Add Deposit'}
      subtitle={isBn ? 'মেস ফান্ডে টাকা জমা' : 'Money into the shared meal fund'}
      footer={
        <PrimaryButton className="w-full" disabled={amt <= 0} onClick={() => { onSave({ roommateId, amount: amt, note: note.trim() }); onClose(); }}>
          <Check size={17} /> {isBn ? 'জমা যোগ করুন' : 'Add deposit'}
        </PrimaryButton>
      }
    >
      <div data-tour="deposit-sheet" className="space-y-4 py-1">
        <Field label={isBn ? 'কে জমা দিচ্ছে' : 'Who deposited'}>
          <div className="flex gap-2 flex-wrap">
            {roommates.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoommateId(r.id)}
                className={cx('flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition active:scale-95', roommateId === r.id ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-white')}
              >
                <Avatar roommate={r} size={26} />
                <span className="text-[12px] font-bold text-gray-700">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
        <Field label={isBn ? 'নোট' : 'Note'}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'} />
        </Field>
      </div>
    </Sheet>
  );
};

// ── Bazar (grocery) sheet ────────────────────────────────────────────────────
const GrocerySheet = ({ open, onClose, roommates, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('me');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaidBy(roommates.find((r) => r.isMe)?.id || roommates[0]?.id || 'me');
      setNote('');
    }
  }, [open, roommates]);

  const amt = Number(amount) || 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'বাজার খরচ' : 'Add Bazar'}
      subtitle={isBn ? 'মিলের বাজার — মিল অনুযায়ী ভাগ হবে' : 'Meal bazar — split by meals eaten'}
      footer={
        <PrimaryButton className="w-full" disabled={amt <= 0} onClick={() => { onSave({ amount: amt, paidBy, note: note.trim() }); onClose(); }}>
          <Check size={17} /> {isBn ? 'বাজার যোগ করুন' : 'Add bazar'}
        </PrimaryButton>
      }
    >
      <div data-tour="grocery-sheet" className="space-y-4 py-1">
        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
        <Field label={isBn ? 'কে বাজার করেছে' : 'Who shopped'}>
          <div className="flex gap-2 flex-wrap">
            {roommates.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPaidBy(r.id)}
                className={cx('flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition active:scale-95', paidBy === r.id ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-white')}
              >
                <Avatar roommate={r} size={26} />
                <span className="text-[12px] font-bold text-gray-700">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label={isBn ? 'নোট' : 'Note'}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'যেমন: চাল, তেল, মাছ' : 'e.g. Rice, oil, fish'} />
        </Field>
      </div>
    </Sheet>
  );
};

// ── Meal rate (মিল রেট) sheet — auto or a fixed rate the manager sets ─────────
const RateSheet = ({ open, onClose, autoRate, current, onSave, language }) => {
  const isBn = language === 'বাংলা';
  const [mode, setMode] = useState(current > 0 ? 'manual' : 'auto');
  const [value, setValue] = useState(current > 0 ? String(current) : '');

  useEffect(() => {
    if (open) {
      setMode(current > 0 ? 'manual' : 'auto');
      setValue(current > 0 ? String(current) : '');
    }
  }, [open, current]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'মিল রেট সেট করুন' : 'Set Meal Rate'}
      subtitle={isBn ? 'অটো নাকি নির্দিষ্ট রেট' : 'Auto or a fixed rate'}
      footer={
        <PrimaryButton className="w-full" onClick={() => { onSave(mode === 'manual' ? (Number(value) || 0) : 0); onClose(); }}>
          <Check size={17} /> {isBn ? 'সেভ করুন' : 'Save rate'}
        </PrimaryButton>
      }
    >
      <div data-tour="rate-sheet" className="space-y-4 py-1">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'auto', label: isBn ? 'অটো' : 'Auto' },
            { value: 'manual', label: isBn ? 'নির্দিষ্ট রেট' : 'Fixed rate' },
          ]}
        />
        {mode === 'auto' ? (
          <div className="flex items-start gap-2 rounded-2xl bg-blue-50 border border-blue-100 p-3">
            <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] font-semibold text-blue-700 leading-relaxed">
              {isBn
                ? `রেট স্বয়ংক্রিয়ভাবে হিসাব হবে = মোট বাজার ÷ মোট মিল। এখন ≈ ${taka(autoRate, language)} প্রতি মিল।`
                : `Rate is calculated automatically = total bazar ÷ total meals. Currently ≈ ${taka(autoRate, language)} per meal.`}
            </p>
          </div>
        ) : (
          <Field
            label={isBn ? 'নির্দিষ্ট রেট (৳/মিল)' : 'Fixed rate (৳ per meal)'}
            hint={isBn ? `অটো রেট এখন ≈ ${taka(autoRate, language)}` : `Auto rate is currently ≈ ${taka(autoRate, language)}`}
          >
            <MoneyInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" autoFocus />
          </Field>
        )}
      </div>
    </Sheet>
  );
};

// A small labelled stat used in the mess summary + my-accounts.
const MiniStat = ({ icon: Icon, label, value, valueClass = 'text-gray-900', sub }) => (
  <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
      {Icon && <Icon size={12} />} {label}
    </span>
    <p className={cx('text-[17px] font-black tracking-tight mt-1', valueClass)}>{value}</p>
    {sub && <p className="text-[10px] font-bold text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const MealManagement = ({ me, language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const roommates = useLivingStore((s) => s.roommates);
  const meals = useLivingStore((s) => s.meals);
  const groceries = useLivingStore((s) => s.groceries);
  const deposits = useLivingStore((s) => s.deposits);
  const mealRateSetting = useLivingStore((s) => s.mealRate);
  const setMealRate = useLivingStore((s) => s.setMealRate);
  const setMeal = useLivingStore((s) => s.setMeal);
  const addGrocery = useLivingStore((s) => s.addGrocery);
  const deleteGrocery = useLivingStore((s) => s.deleteGrocery);
  const addDeposit = useLivingStore((s) => s.addDeposit);
  const deleteDeposit = useLivingStore((s) => s.deleteDeposit);
  const state = useLivingStore();

  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, −1 = last month…
  const [selectedWeek, setSelectedWeek] = useState(null); // null = whole month, or week index
  const [weeklyOpen, setWeeklyOpen] = useState(false); // weekly-breakdown side popup
  const [dayOffset, setDayOffset] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [bazarOpen, setBazarOpen] = useState(false);
  const [showAllDeposits, setShowAllDeposits] = useState(false);
  const [showAllBazar, setShowAllBazar] = useState(false);
  const [bazarWeekFilter, setBazarWeekFilter] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [historyOpenFor, setHistoryOpenFor] = useState(null); // roommate ID
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobileLayout(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

 // { kind, id }

  useEffect(() => {
    if (intent === 'add') {
      setDepositOpen(true);
      clearIntent?.();
    }
  }, [intent, clearIntent]);

  useEffect(() => {
    const handleTourAction = (e) => {
      switch(e.detail) {
        case 'open-deposit': setDepositOpen(true); break;
        case 'close-deposit': setDepositOpen(false); break;
        case 'open-bazar': setBazarOpen(true); break;
        case 'close-bazar': setBazarOpen(false); break;
        case 'open-rate': setRateOpen(true); break;
        case 'close-rate': setRateOpen(false); break;
        // The tour can end on a sheet step (Done, Esc, overlay click) — don't
        // leave the sheet stranded over the page once the overlay is gone.
        case 'close-all':
          setDepositOpen(false);
          setBazarOpen(false);
          setRateOpen(false);
          break;
      }
    };
    window.addEventListener('tour:action', handleTourAction);
    return () => window.removeEventListener('tour:action', handleTourAction);
  }, []);

  const iso = dayISO(dayOffset);
  const dayKey = iso.slice(0, 10);
  const getMeal = (rid) => {
    const m = (meals || []).find((x) => x.date.slice(0, 10) === dayKey && x.roommateId === rid);
    return m || { breakfast: 0, lunch: 0, dinner: 0 };
  };

  const summary = useMemo(() => messSummary(state, monthOffset), [state, monthOffset]);
  const weeks = useMemo(() => messWeeklyBreakdown(state, monthOffset, summary.mealRate), [state, monthOffset, summary.mealRate]);
  const mine = summary.perMember.find((p) => p.id === me) || summary.perMember.find((p) => p.isMe) || summary.perMember[0];

  // Deposit/bazar history scoped to the selected month (newest first).
  const monthDeposits = useMemo(
    () => [...(deposits || [])].filter((d) => inDateRange(d.date, summary.range)).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [deposits, summary.range]
  );
  const monthBazar = useMemo(
    () => [...(groceries || [])].filter((g) => inDateRange(g.date, summary.range)).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [groceries, summary.range]
  );

  const periodLabel = monthLabel(summary.range.start, language);
  
  const displayedDeposits = showAllDeposits ? monthDeposits : monthDeposits.slice(0, 4);
  const filteredBazar = useMemo(() => {
    if (!bazarWeekFilter) return monthBazar;
    const w = weeks.find((x) => x.index === bazarWeekFilter);
    if (!w) return monthBazar;
    return monthBazar.filter((g) => inDateRange(g.date, { start: w.start, end: w.end }));
  }, [monthBazar, bazarWeekFilter, weeks]);
  
  const displayedBazar = showAllBazar ? filteredBazar : filteredBazar.slice(0, 4);
  const weekRangeLabel = (w) =>
    `${num(w.start.getDate(), language)}–${num(w.end.getDate(), language)} ${w.start.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { month: 'short' })}`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'মিল ম্যানেজার' : 'Meal Manager'}
        subtitle={isBn ? 'মেস জমা, মিল, রেট ও ব্যালেন্স' : 'Mess deposits, meals, rate & balance'}
        right={
          <button onClick={() => setDepositOpen(true)} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <PiggyBank size={15} /> {isBn ? 'জমা' : 'Deposit'}
          </button>
        }
      />

      {/* month filter — every total below is scoped to this calendar month */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-2 py-2 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)]">
        <button
          onClick={() => { setMonthOffset((o) => o - 1); setSelectedWeek(null); }}
          className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition"
          aria-label={isBn ? 'আগের মাস' : 'Previous month'}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-[13.5px] font-black text-gray-900 tracking-tight">{periodLabel}</p>
          <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
            {monthOffset === 0 ? (isBn ? 'চলতি মাস' : 'Current month') : (isBn ? 'মাসিক হিসাব' : 'Monthly view')}
          </p>
        </div>
        <button
          onClick={() => { setMonthOffset((o) => Math.min(0, o + 1)); setSelectedWeek(null); }}
          disabled={monthOffset === 0}
          className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition disabled:opacity-40"
          aria-label={isBn ? 'পরের মাস' : 'Next month'}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* quick section nav — jump to any section in one tap instead of long scrolling */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'mm-summary', label: isBn ? 'সারাংশ' : 'Summary' },
          { id: 'weekly', label: isBn ? 'সাপ্তাহিক' : 'Weekly' },
          { id: 'mm-accounts', label: isBn ? 'সবার হিসাব' : 'Accounts' },
          { id: 'mm-log', label: isBn ? 'মিল লগ' : 'Log meals' },
          { id: 'mm-deposits', label: isBn ? 'জমা' : 'Deposits' },
          { id: 'mm-bazar', label: isBn ? 'বাজার' : 'Bazar' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() =>
              s.id === 'weekly'
                ? setWeeklyOpen(true)
                : document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="shrink-0 px-3.5 py-1.5 rounded-full bg-white border border-gray-100 text-[11px] font-black text-gray-600 shadow-sm hover:border-[#ba0036]/30 hover:text-[#ba0036] active:scale-95 transition"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* two/three columns on tablet/desktop → less scroll; phones keep single column */}
      <div className="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:items-start space-y-4 md:space-y-0">
      <div className="space-y-4 min-w-0">
      {/* mess summary */}
      <div id="mm-summary" className="scroll-mt-24">
      <Card className="p-5">
        <div className="text-center">
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <Scale size={13} /> {isBn ? 'মেস ব্যালেন্স' : 'Mess Balance'} · {periodLabel}
          </span>
          <p className={cx('text-[32px] leading-none font-black tracking-tight mt-2', summary.messBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {takaSigned(summary.messBalance, language)}
          </p>
          <p className="text-[11px] font-semibold text-gray-400 mt-1.5">
            {isBn ? 'আগের ব্যালেন্স + জমা − মিল খরচ' : 'Previous balance + deposits − meal cost'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {summary.totalOpening !== 0 && (
            <MiniStat
              icon={Wallet}
              label={isBn ? 'আগের মাস থেকে' : 'Carried over'}
              value={takaSigned(summary.totalOpening, language)}
              valueClass={summary.totalOpening >= 0 ? 'text-emerald-600' : 'text-red-600'}
              sub={isBn ? 'আগের মাসগুলোর অবশিষ্ট' : 'Leftover from past months'}
            />
          )}
          <MiniStat icon={HandCoins} label={isBn ? 'মোট জমা' : 'Total deposit'} value={taka(summary.totalDeposit, language)} valueClass="text-emerald-600" sub={isBn ? 'এ মাসে' : 'This month'} />
          <MiniStat icon={ShoppingBasket} label={isBn ? 'মোট মিল খরচ' : 'Meal cost'} value={taka(summary.totalMealCost, language)} />
          <MiniStat icon={UtensilsCrossed} label={isBn ? 'মোট মিল' : 'Total meals'} value={num(summary.totalMeals, language)} />
          <button data-tour="set-rate-btn" onClick={() => setRateOpen(true)} className="rounded-2xl bg-gray-50 border border-gray-100 p-3 text-left active:scale-95 transition">
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                <Gauge size={12} /> {isBn ? 'মিল রেট' : 'Meal rate'}
              </span>
              <Pencil size={12} className="text-gray-400" />
            </span>
            <p className="text-[17px] font-black tracking-tight mt-1 text-[#ba0036]">{taka(summary.mealRate, language)}</p>
            <span className={cx('inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-1', summary.rateMode === 'manual' ? 'bg-[#ba0036]/10 text-[#ba0036]' : 'bg-gray-200 text-gray-500')}>
              {summary.rateMode === 'manual' ? (isBn ? 'নির্দিষ্ট রেট' : 'Fixed') : (isBn ? 'অটো' : 'Auto')}
            </span>
          </button>
        </div>
        {summary.rateMode === 'manual' && summary.totalMeals > 0 && summary.totalMealCost === 0 && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-100 p-3 mt-2.5">
            <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10.5px] font-semibold text-amber-700 leading-relaxed">
              {isBn
                ? `নির্দিষ্ট রেট (${taka(summary.mealRate, language)}) চালু — তাই এ মাসে বাজার না হলেও প্রতি মিলে চার্জ হচ্ছে। বাজার ÷ মিল হিসাব চাইলে রেট "অটো" করুন।`
                : `Fixed rate (${taka(summary.mealRate, language)}) is on — so meals are charged even though no bazar has happened this month. Switch the rate to "Auto" if cost should follow bazar ÷ meals.`}
            </p>
          </div>
        )}
      </Card>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button data-tour="add-deposit-btn" onClick={() => setDepositOpen(true)} className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-gray-100 py-3.5 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition">
          <IconBadge icon={PiggyBank} tint="bg-emerald-50" text="text-emerald-600" size={34} iconSize={16} />
          <span className="text-[13px] font-black text-gray-800">{isBn ? 'জমা দিন' : 'Add Deposit'}</span>
        </button>
        <button data-tour="add-bazar-btn" onClick={() => setBazarOpen(true)} className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-gray-100 py-3.5 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition">
          <IconBadge icon={ShoppingBasket} tint="bg-amber-50" text="text-amber-600" size={34} iconSize={16} />
          <span className="text-[13px] font-black text-gray-800">{isBn ? 'বাজার যোগ' : 'Add Bazar'}</span>
        </button>
      </div>

      {/* my accounts */}
      {mine && (
        <Card className="p-4">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-3 flex items-center gap-1.5">
            <Wallet size={15} className="text-[#ba0036]" /> {isBn ? 'আমার হিসাব' : 'My Accounts'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3 px-2">
              <p className="text-[16px] font-black text-gray-900 truncate">{num(mine.meals, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'আমার মিল' : 'Meals'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3 px-2">
              <p className="text-[16px] font-black text-emerald-600 truncate">{taka(mine.deposit, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'আমার জমা' : 'Deposit'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3 px-2">
              <p className="text-[16px] font-black text-gray-900 truncate">{taka(mine.mealCost, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'মিল খরচ' : 'Meal cost'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3 px-2">
              <p className={cx('text-[16px] font-black truncate', mine.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>{takaSigned(mine.balance, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'ব্যালেন্স' : 'Balance'}</p>
            </div>
          </div>
          <p className="text-[10.5px] font-semibold text-gray-400 mt-2.5 leading-relaxed flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            {isBn
              ? `ব্যালেন্স = আগের ব্যালেন্স + জমা − (মিল × রেট)। + মানে আপনি ফেরত পাবেন, − মানে আরও জমা দিতে হবে।`
              : `Balance = previous balance + deposit − (meals × rate). + means you get money back, − means you owe more.`}
          </p>
          {mine.opening !== 0 && (
            <p className={cx('text-[10.5px] font-black mt-1.5 flex items-center gap-1.5', mine.opening >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              <Wallet size={12} className="shrink-0" />
              {isBn
                ? `আগের মাস থেকে এসেছে: ${takaSigned(mine.opening, language)}`
                : `Carried over from previous months: ${takaSigned(mine.opening, language)}`}
            </p>
          )}
        </Card>
      )}
      </div>

      <div className="space-y-4 min-w-0">
      {/* everyone's account (manager table) */}
      <div id="mm-accounts" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center gap-1.5">
          <UtensilsCrossed size={15} className="text-gray-400" /> {isBn ? 'সবার হিসাব' : "Everyone's account"}
        </h3>
        <div className="grid grid-cols-[1.5fr_0.7fr_1fr_1.05fr] gap-2 px-1 pb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
          <span>{isBn ? 'নাম' : 'Name'}</span>
          <span className="text-right">{isBn ? 'মিল' : 'Meals'}</span>
          <span className="text-right">{isBn ? 'জমা' : 'Deposit'}</span>
          <span className="text-right">{isBn ? 'ব্যালেন্স' : 'Balance'}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {summary.perMember.map((p) => (
            <button key={p.id} onClick={() => setHistoryOpenFor(p.id)} className="w-full grid grid-cols-[1.5fr_0.7fr_1fr_1.05fr] gap-2 items-center py-2.5 active:bg-gray-50 transition text-left">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar roommate={p} size={28} />
                <div className="min-w-0">
                  <span className="text-[12.5px] font-bold text-gray-800 truncate block">{p.isMe ? (isBn ? 'আপনি' : 'You') : p.name}</span>
                  {/* the "why" behind the balance: carry-over and this month's charge */}
                  <span className="text-[9px] font-bold text-gray-400 truncate block">
                    {isBn ? 'আগের' : 'Prev'} {takaSigned(p.opening, language)} · {isBn ? 'খরচ' : 'Cost'} −{taka(p.mealCost, language)}
                  </span>
                </div>
              </div>
              <span className="text-right text-[12.5px] font-black text-gray-900 tabular-nums">{num(p.meals, language)}</span>
              <span className="text-right text-[12.5px] font-bold text-gray-600 tabular-nums">{taka(p.deposit, language)}</span>
              <span className={cx('text-right text-[12.5px] font-black tabular-nums', p.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>{takaSigned(p.balance, language)}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] font-semibold text-gray-400 mt-2 leading-relaxed flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          {isBn
            ? 'ব্যালেন্সে আগের মাসের পাওনা/দেনা যোগ করা আছে — মাস বদলালেও টাকা হারায় না।'
            : "Balance includes each member's carry-over from previous months — money never disappears when the month changes."}
        </p>
      </Card>
      </div>
      {isDesktopLayout ? (
        <React.Fragment>


      {/* deposits list */}
      <div id="mm-deposits" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <PiggyBank size={15} className="text-emerald-600" /> {isBn ? 'জমার হিস্ট্রি' : 'Deposits'}
          <span className="text-[9.5px] font-bold text-gray-400 ml-auto">{periodLabel}</span>
        </h3>
        {monthDeposits.length === 0 ? (
          <EmptyState icon={HandCoins} title={isBn ? 'কোনো জমা নেই' : 'No deposits yet'} subtitle={isBn ? 'মেস ফান্ডে টাকা জমা দিন' : 'Add money to the meal fund'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedDeposits.map((d) => {
              const who = roommateById(roommates, d.roommateId);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={who} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{who.isMe ? (isBn ? 'আপনি' : 'You') : who.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{d.note || (isBn ? 'জমা' : 'Deposit')} · {dateLabel(d.date, language)}</p>
                    {d.createdBy && d.createdBy !== d.roommateId && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {isBn ? 'যুক্ত করেছেন ' : 'Added by '}{roommateById(roommates, d.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">+{taka(d.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'deposit', id: d.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {monthDeposits.length > 4 && (
            <button
              onClick={() => setShowAllDeposits(!showAllDeposits)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllDeposits ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>
</React.Fragment>
      ) : (
        <React.Fragment>
      {/* daily meal editor */}
      <div id="mm-log" className="scroll-mt-24">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            <ChefHat size={15} className="text-gray-400" /> {isBn ? 'মিল লগ' : 'Log meals'}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setDayOffset((o) => o + 1)} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition" aria-label="previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-600 min-w-[64px] text-center">
              {dayOffset === 0 ? (isBn ? 'আজ' : 'Today') : dateLabel(iso, language)}
            </span>
            <button onClick={() => setDayOffset((o) => Math.max(0, o - 1))} disabled={dayOffset === 0} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label="next day">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {roommates.map((r) => {
            const m = getMeal(r.id);
            const total = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0);
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start gap-2 mb-2.5">
                  <Avatar roommate={r} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-gray-800 flex-1">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                    {(m.editedBy || m.createdBy) && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {m.editedBy ? (isBn ? 'এডিট করেছেন ' : 'Edited by ') : (isBn ? 'যুক্ত করেছেন ' : 'Added by ')}
                        {roommateById(roommates, m.editedBy || m.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-gray-400 mt-1">{num(total, language)} {isBn ? 'মিল' : 'meals'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MEALS.map((meal) => {
                    const MIcon = meal.icon;
                    return (
                      <div key={meal.key} className="flex flex-col items-center gap-1.5 bg-white rounded-xl py-2 border border-gray-100">
                        <span className="flex items-center gap-1 text-[10px] font-black text-gray-500">
                          <MIcon size={12} /> {isBn ? meal.bn : meal.en}
                        </span>
                        <Stepper value={m[meal.key] || 0} onChange={(v) => setMeal(iso, r.id, meal.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      </div>
</React.Fragment>
      )}
      </div>
      
      {/* right column */}
      <div className="space-y-4 min-w-0">
      {isDesktopLayout ? (
        <React.Fragment>
      {/* daily meal editor */}
      <div id="mm-log" className="scroll-mt-24">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            <ChefHat size={15} className="text-gray-400" /> {isBn ? 'মিল লগ' : 'Log meals'}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setDayOffset((o) => o + 1)} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition" aria-label="previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-600 min-w-[64px] text-center">
              {dayOffset === 0 ? (isBn ? 'আজ' : 'Today') : dateLabel(iso, language)}
            </span>
            <button onClick={() => setDayOffset((o) => Math.max(0, o - 1))} disabled={dayOffset === 0} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label="next day">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {roommates.map((r) => {
            const m = getMeal(r.id);
            const total = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0);
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start gap-2 mb-2.5">
                  <Avatar roommate={r} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-gray-800 flex-1">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                    {(m.editedBy || m.createdBy) && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {m.editedBy ? (isBn ? 'এডিট করেছেন ' : 'Edited by ') : (isBn ? 'যুক্ত করেছেন ' : 'Added by ')}
                        {roommateById(roommates, m.editedBy || m.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-gray-400 mt-1">{num(total, language)} {isBn ? 'মিল' : 'meals'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MEALS.map((meal) => {
                    const MIcon = meal.icon;
                    return (
                      <div key={meal.key} className="flex flex-col items-center gap-1.5 bg-white rounded-xl py-2 border border-gray-100">
                        <span className="flex items-center gap-1 text-[10px] font-black text-gray-500">
                          <MIcon size={12} /> {isBn ? meal.bn : meal.en}
                        </span>
                        <Stepper value={m[meal.key] || 0} onChange={(v) => setMeal(iso, r.id, meal.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      </div>
</React.Fragment>
      ) : (
        <React.Fragment>


      {/* deposits list */}
      <div id="mm-deposits" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <PiggyBank size={15} className="text-emerald-600" /> {isBn ? 'জমার হিস্ট্রি' : 'Deposits'}
          <span className="text-[9.5px] font-bold text-gray-400 ml-auto">{periodLabel}</span>
        </h3>
        {monthDeposits.length === 0 ? (
          <EmptyState icon={HandCoins} title={isBn ? 'কোনো জমা নেই' : 'No deposits yet'} subtitle={isBn ? 'মেস ফান্ডে টাকা জমা দিন' : 'Add money to the meal fund'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedDeposits.map((d) => {
              const who = roommateById(roommates, d.roommateId);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={who} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{who.isMe ? (isBn ? 'আপনি' : 'You') : who.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{d.note || (isBn ? 'জমা' : 'Deposit')} · {dateLabel(d.date, language)}</p>
                    {d.createdBy && d.createdBy !== d.roommateId && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {isBn ? 'যুক্ত করেছেন ' : 'Added by '}{roommateById(roommates, d.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">+{taka(d.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'deposit', id: d.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {monthDeposits.length > 4 && (
            <button
              onClick={() => setShowAllDeposits(!showAllDeposits)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllDeposits ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>
</React.Fragment>
      )}
      {/* bazar list */}
      <div id="mm-bazar" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5"><ShoppingBasket size={15} className="text-amber-600" /> {isBn ? 'বাজারের হিস্ট্রি' : 'Bazar'}</span>
          <span className="text-[9.5px] font-bold text-gray-400">{periodLabel}</span>
        </h3>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3 border-b border-gray-50">
          <button
            onClick={() => setBazarWeekFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === null ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {isBn ? 'সব' : 'All'}
          </button>
          {weeks.map((w) => (
            <button
              key={w.index}
              onClick={() => setBazarWeekFilter(w.index)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === w.index ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {isBn ? `সপ্তাহ ${num(w.index, language)}` : `W${w.index}`}
            </button>
          ))}
        </div>
        {filteredBazar.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={isBn ? 'কোনো বাজার নেই' : 'No bazar yet'} subtitle={isBn ? 'মিলের বাজার যোগ করুন' : 'Add the meal groceries'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedBazar.map((g) => {
              const payer = roommateById(roommates, g.paidBy);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={ShoppingBasket} tint="bg-amber-50" text="text-amber-600" size={32} iconSize={15} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{g.note || (isBn ? 'বাজার' : 'Bazar')}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name} · {dateLabel(g.date, language)}</p>
                  </div>
                  <span className="text-[13px] font-black text-gray-900 shrink-0">{taka(g.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'grocery', id: g.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {filteredBazar.length > 4 && (
            <button
              onClick={() => setShowAllBazar(!showAllBazar)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllBazar ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>
      </div>
      </div>


      {/* floating side tab (chat-bot style launcher) → weekly breakdown popup */}
      {!weeklyOpen && (
        <button
          onClick={() => setWeeklyOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] rounded-l-2xl overflow-hidden bg-white border border-r-0 border-gray-100 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.4)] active:scale-95 transition"
          aria-label={isBn ? 'সাপ্তাহিক খরচ দেখুন' : 'Open weekly breakdown'}
        >
          <span className="flex flex-col items-center gap-1 bg-gradient-to-b from-[#ba0036] to-[#d4004a] text-white px-2.5 py-3">
            <CalendarRange size={17} />
            <span className="text-[9px] font-black uppercase tracking-wide leading-none">
              {isBn ? `${num(weeks.length, language)} সপ্তাহ` : `${weeks.length} Weeks`}
            </span>
          </span>
          <span className="block px-2 py-2 text-center text-[10.5px] font-black text-[#ba0036]">
            {taka(summary.totalMealCost, language)}
          </span>
        </button>
      )}

      {/* weekly breakdown popup — the month split into fixed weeks (1–7, 8–14…) */}
      <Sheet
        open={weeklyOpen}
        onClose={() => setWeeklyOpen(false)}
        title={isBn ? 'সাপ্তাহিক খরচ' : 'Weekly breakdown'}
        subtitle={`${periodLabel} · ${isBn ? `${num(weeks.length, language)} সপ্তাহ` : `${weeks.length} weeks`}`}
      >
        <div className="py-2">
          <div className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr] gap-2 px-1 pb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            <span>{isBn ? 'সপ্তাহ' : 'Week'}</span>
            <span className="text-right">{isBn ? 'মিল' : 'Meals'}</span>
            <span className="text-right">{isBn ? 'বাজার' : 'Bazar'}</span>
            <span className="text-right">{isBn ? 'জমা' : 'Deposit'}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {weeks.map((w) => (
              <button
                key={w.index}
                onClick={() => setSelectedWeek((s) => (s === w.index ? null : w.index))}
                className={cx(
                  'w-full grid grid-cols-[1.2fr_0.7fr_1fr_1fr] gap-2 items-center py-2.5 px-1 rounded-xl transition text-left',
                  selectedWeek === w.index ? 'bg-[#ba0036]/5' : 'active:bg-gray-50'
                )}
              >
                <div>
                  <p className={cx('text-[12.5px] font-black', selectedWeek === w.index ? 'text-[#ba0036]' : 'text-gray-800')}>
                    {isBn ? `সপ্তাহ ${num(w.index, language)}` : `Week ${w.index}`}
                  </p>
                  <p className="text-[9.5px] font-bold text-gray-400">{weekRangeLabel(w)}</p>
                </div>
                <span className="text-right text-[12.5px] font-black text-gray-900 tabular-nums">{num(w.meals, language)}</span>
                <span className="text-right text-[12.5px] font-bold text-gray-600 tabular-nums">{taka(w.bazar, language)}</span>
                <span className="text-right text-[12.5px] font-bold text-emerald-600 tabular-nums">{taka(w.deposit, language)}</span>
              </button>
            ))}
          </div>
          {selectedWeek && (() => {
            const w = weeks.find((x) => x.index === selectedWeek);
            if (!w) return null;
            return (
              <div className="mt-2 rounded-2xl bg-[#ba0036]/5 border border-[#ba0036]/10 p-3">
                <p className="text-[11px] font-black text-[#ba0036] uppercase tracking-wider mb-2">
                  {isBn ? `সপ্তাহ ${num(w.index, language)} · ${weekRangeLabel(w)}` : `Week ${w.index} · ${weekRangeLabel(w)}`}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat icon={ShoppingBasket} label={isBn ? 'বাজার খরচ' : 'Bazar spent'} value={taka(w.bazar, language)} />
                  <MiniStat icon={UtensilsCrossed} label={isBn ? 'মিল খরচ' : 'Meal cost'} value={taka(w.mealCost, language)} sub={isBn ? 'মাসের রেটে' : 'at month rate'} />
                  <MiniStat icon={HandCoins} label={isBn ? 'জমা' : 'Deposit'} value={taka(w.deposit, language)} valueClass="text-emerald-600" />
                </div>
              </div>
            );
          })()}
          <p className="text-[10px] font-semibold text-gray-400 mt-2.5 leading-relaxed flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5" />
            {isBn
              ? 'সপ্তাহগুলো মাসের ভেতরে ভাগ করা (১–৭, ৮–১৪…) — তাই সব সপ্তাহ যোগ করলে মাসের মোট হিসাব মিলে যায়।'
              : 'Weeks are fixed inside the month (1–7, 8–14…) — so the weeks always add up exactly to the monthly total.'}
          </p>
        </div>
      </Sheet>

      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} roommates={roommates} onSave={addDeposit} />
      <GrocerySheet open={bazarOpen} onClose={() => setBazarOpen(false)} roommates={roommates} onSave={addGrocery} />
      <RateSheet open={rateOpen} onClose={() => setRateOpen(false)} autoRate={summary.autoRate} current={mealRateSetting} onSave={setMealRate} language={language} />
      <MonthlyHistorySheet open={!!historyOpenFor} onClose={() => setHistoryOpenFor(null)} roommate={historyOpenFor ? roommateById(roommates, historyOpenFor) : null} meals={meals} range={summary.range} monthName={periodLabel} language={language} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === 'deposit') deleteDeposit(pendingDelete.id);
          else deleteGrocery(pendingDelete.id);
        }}
        title={pendingDelete?.kind === 'deposit' ? (isBn ? 'জমা মুছবেন?' : 'Delete this deposit?') : (isBn ? 'বাজার মুছবেন?' : 'Delete this bazar?')}
        message={isBn ? 'এটি মুছলে হিসাব আবার আপডেট হবে।' : 'Removing this will recalculate the accounts.'}
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

export default MealManagement;      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:gap-6 items-start">
      
      {/* left column */}
      <div className="space-y-4 min-w-0">
      {/* everyone's account (manager table) */}
      <div id="mm-accounts" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center gap-1.5">
          <UtensilsCrossed size={15} className="text-gray-400" /> {isBn ? 'সবার হিসাব' : "Everyone's account"}
        </h3>
        <div className="grid grid-cols-[1.5fr_0.7fr_1fr_1.05fr] gap-2 px-1 pb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
          <span>{isBn ? 'নাম' : 'Name'}</span>
          <span className="text-right">{isBn ? 'মিল' : 'Meals'}</span>
          <span className="text-right">{isBn ? 'জমা' : 'Deposit'}</span>
          <span className="text-right">{isBn ? 'ব্যালেন্স' : 'Balance'}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {summary.perMember.map((p) => (
            <button key={p.id} onClick={() => setHistoryOpenFor(p.id)} className="w-full grid grid-cols-[1.5fr_0.7fr_1fr_1.05fr] gap-2 items-center py-2.5 active:bg-gray-50 transition text-left">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar roommate={p} size={28} />
                <div className="min-w-0">
                  <span className="text-[12.5px] font-bold text-gray-800 truncate block">{p.isMe ? (isBn ? 'আপনি' : 'You') : p.name}</span>
                  {/* the "why" behind the balance: carry-over and this month's charge */}
                  <span className="text-[9px] font-bold text-gray-400 truncate block">
                    {isBn ? 'আগের' : 'Prev'} {takaSigned(p.opening, language)} · {isBn ? 'খরচ' : 'Cost'} −{taka(p.mealCost, language)}
                  </span>
                </div>
              </div>
              <span className="text-right text-[12.5px] font-black text-gray-900 tabular-nums">{num(p.meals, language)}</span>
              <span className="text-right text-[12.5px] font-bold text-gray-600 tabular-nums">{taka(p.deposit, language)}</span>
              <span className={cx('text-right text-[12.5px] font-black tabular-nums', p.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>{takaSigned(p.balance, language)}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] font-semibold text-gray-400 mt-2 leading-relaxed flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          {isBn
            ? 'ব্যালেন্সে আগের মাসের পাওনা/দেনা যোগ করা আছে — মাস বদলালেও টাকা হারায় না।'
            : "Balance includes each member's carry-over from previous months — money never disappears when the month changes."}
        </p>
      </Card>
      </div>

      {isMobileLayout ? (
        <React.Fragment>
      {/* daily meal editor */}
      <div id="mm-log" className="scroll-mt-24">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            <ChefHat size={15} className="text-gray-400" /> {isBn ? 'মিল লগ' : 'Log meals'}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setDayOffset((o) => o + 1)} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition" aria-label="previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-600 min-w-[64px] text-center">
              {dayOffset === 0 ? (isBn ? 'আজ' : 'Today') : dateLabel(iso, language)}
            </span>
            <button onClick={() => setDayOffset((o) => Math.max(0, o - 1))} disabled={dayOffset === 0} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label="next day">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {roommates.map((r) => {
            const m = getMeal(r.id);
            const total = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0);
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start gap-2 mb-2.5">
                  <Avatar roommate={r} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-gray-800 flex-1">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                    {(m.editedBy || m.createdBy) && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {m.editedBy ? (isBn ? 'এডিট করেছেন ' : 'Edited by ') : (isBn ? 'যুক্ত করেছেন ' : 'Added by ')}
                        {roommateById(roommates, m.editedBy || m.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-gray-400 mt-1">{num(total, language)} {isBn ? 'মিল' : 'meals'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MEALS.map((meal) => {
                    const MIcon = meal.icon;
                    return (
                      <div key={meal.key} className="flex flex-col items-center gap-1.5 bg-white rounded-xl py-2 border border-gray-100">
                        <span className="flex items-center gap-1 text-[10px] font-black text-gray-500">
                          <MIcon size={12} /> {isBn ? meal.bn : meal.en}
                        </span>
                        <Stepper value={m[meal.key] || 0} onChange={(v) => setMeal(iso, r.id, meal.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      </div>

        </React.Fragment>
      ) : (
        <React.Fragment>
      {/* deposits list */}
      <div id="mm-deposits" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <PiggyBank size={15} className="text-emerald-600" /> {isBn ? 'জমার হিস্ট্রি' : 'Deposits'}
          <span className="text-[9.5px] font-bold text-gray-400 ml-auto">{periodLabel}</span>
        </h3>
        {monthDeposits.length === 0 ? (
          <EmptyState icon={HandCoins} title={isBn ? 'কোনো জমা নেই' : 'No deposits yet'} subtitle={isBn ? 'মেস ফান্ডে টাকা জমা দিন' : 'Add money to the meal fund'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedDeposits.map((d) => {
              const who = roommateById(roommates, d.roommateId);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={who} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{who.isMe ? (isBn ? 'আপনি' : 'You') : who.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{d.note || (isBn ? 'জমা' : 'Deposit')} · {dateLabel(d.date, language)}</p>
                    {d.createdBy && d.createdBy !== d.roommateId && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {isBn ? 'যুক্ত করেছেন ' : 'Added by '}{roommateById(roommates, d.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">+{taka(d.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'deposit', id: d.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {monthDeposits.length > 4 && (
            <button
              onClick={() => setShowAllDeposits(!showAllDeposits)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllDeposits ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>

      {/* bazar list */}
      <div id="mm-bazar" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5"><ShoppingBasket size={15} className="text-amber-600" /> {isBn ? 'বাজারের হিস্ট্রি' : 'Bazar'}</span>
          <span className="text-[9.5px] font-bold text-gray-400">{periodLabel}</span>
        </h3>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3 border-b border-gray-50">
          <button
            onClick={() => setBazarWeekFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === null ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {isBn ? 'সব' : 'All'}
          </button>
          {weeks.map((w) => (
            <button
              key={w.index}
              onClick={() => setBazarWeekFilter(w.index)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === w.index ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {isBn ? `সপ্তাহ ${num(w.index, language)}` : `W${w.index}`}
            </button>
          ))}
        </div>
        {filteredBazar.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={isBn ? 'কোনো বাজার নেই' : 'No bazar yet'} subtitle={isBn ? 'মিলের বাজার যোগ করুন' : 'Add the meal groceries'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedBazar.map((g) => {
              const payer = roommateById(roommates, g.paidBy);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={ShoppingBasket} tint="bg-amber-50" text="text-amber-600" size={32} iconSize={15} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{g.note || (isBn ? 'বাজার' : 'Bazar')}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name} · {dateLabel(g.date, language)}</p>
                  </div>
                  <span className="text-[13px] font-black text-gray-900 shrink-0">{taka(g.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'grocery', id: g.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {filteredBazar.length > 4 && (
            <button
              onClick={() => setShowAllBazar(!showAllBazar)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllBazar ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>

        </React.Fragment>
      )}
      </div>
      
      {/* right column */}
      <div className="space-y-4 min-w-0">
      {isMobileLayout ? (
        <React.Fragment>
      {/* deposits list */}
      <div id="mm-deposits" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <PiggyBank size={15} className="text-emerald-600" /> {isBn ? 'জমার হিস্ট্রি' : 'Deposits'}
          <span className="text-[9.5px] font-bold text-gray-400 ml-auto">{periodLabel}</span>
        </h3>
        {monthDeposits.length === 0 ? (
          <EmptyState icon={HandCoins} title={isBn ? 'কোনো জমা নেই' : 'No deposits yet'} subtitle={isBn ? 'মেস ফান্ডে টাকা জমা দিন' : 'Add money to the meal fund'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedDeposits.map((d) => {
              const who = roommateById(roommates, d.roommateId);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={who} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{who.isMe ? (isBn ? 'আপনি' : 'You') : who.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{d.note || (isBn ? 'জমা' : 'Deposit')} · {dateLabel(d.date, language)}</p>
                    {d.createdBy && d.createdBy !== d.roommateId && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {isBn ? 'যুক্ত করেছেন ' : 'Added by '}{roommateById(roommates, d.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">+{taka(d.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'deposit', id: d.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {monthDeposits.length > 4 && (
            <button
              onClick={() => setShowAllDeposits(!showAllDeposits)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllDeposits ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>

      {/* bazar list */}
      <div id="mm-bazar" className="scroll-mt-24">
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5"><ShoppingBasket size={15} className="text-amber-600" /> {isBn ? 'বাজারের হিস্ট্রি' : 'Bazar'}</span>
          <span className="text-[9.5px] font-bold text-gray-400">{periodLabel}</span>
        </h3>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3 border-b border-gray-50">
          <button
            onClick={() => setBazarWeekFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === null ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {isBn ? 'সব' : 'All'}
          </button>
          {weeks.map((w) => (
            <button
              key={w.index}
              onClick={() => setBazarWeekFilter(w.index)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-colors ${bazarWeekFilter === w.index ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {isBn ? `সপ্তাহ ${num(w.index, language)}` : `W${w.index}`}
            </button>
          ))}
        </div>
        {filteredBazar.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={isBn ? 'কোনো বাজার নেই' : 'No bazar yet'} subtitle={isBn ? 'মিলের বাজার যোগ করুন' : 'Add the meal groceries'} />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
            {displayedBazar.map((g) => {
              const payer = roommateById(roommates, g.paidBy);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={ShoppingBasket} tint="bg-amber-50" text="text-amber-600" size={32} iconSize={15} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{g.note || (isBn ? 'বাজার' : 'Bazar')}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name} · {dateLabel(g.date, language)}</p>
                  </div>
                  <span className="text-[13px] font-black text-gray-900 shrink-0">{taka(g.amount, language)}</span>
                  <button onClick={() => setPendingDelete({ kind: 'grocery', id: g.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {filteredBazar.length > 4 && (
            <button
              onClick={() => setShowAllBazar(!showAllBazar)}
              className="w-full mt-2 py-2 text-[12px] font-bold text-[#ba0036] hover:bg-[#ba0036]/5 rounded-xl transition"
            >
              {showAllBazar ? (isBn ? 'কম দেখুন' : 'Show less') : (isBn ? 'আরও দেখুন' : 'See more')}
            </button>
          )}
          </>
        )}
      </Card>
      </div>

        </React.Fragment>
      ) : (
        <React.Fragment>
      {/* daily meal editor */}
      <div id="mm-log" className="scroll-mt-24">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            <ChefHat size={15} className="text-gray-400" /> {isBn ? 'মিল লগ' : 'Log meals'}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setDayOffset((o) => o + 1)} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition" aria-label="previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-600 min-w-[64px] text-center">
              {dayOffset === 0 ? (isBn ? 'আজ' : 'Today') : dateLabel(iso, language)}
            </span>
            <button onClick={() => setDayOffset((o) => Math.max(0, o - 1))} disabled={dayOffset === 0} className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label="next day">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {roommates.map((r) => {
            const m = getMeal(r.id);
            const total = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0);
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start gap-2 mb-2.5">
                  <Avatar roommate={r} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-gray-800 flex-1">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                    {(m.editedBy || m.createdBy) && (
                      <p className="text-[9px] font-bold text-gray-400 truncate mt-0.5">
                        {m.editedBy ? (isBn ? 'এডিট করেছেন ' : 'Edited by ') : (isBn ? 'যুক্ত করেছেন ' : 'Added by ')}
                        {roommateById(roommates, m.editedBy || m.createdBy).name}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-gray-400 mt-1">{num(total, language)} {isBn ? 'মিল' : 'meals'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MEALS.map((meal) => {
                    const MIcon = meal.icon;
                    return (
                      <div key={meal.key} className="flex flex-col items-center gap-1.5 bg-white rounded-xl py-2 border border-gray-100">
                        <span className="flex items-center gap-1 text-[10px] font-black text-gray-500">
                          <MIcon size={12} /> {isBn ? meal.bn : meal.en}
                        </span>
                        <Stepper value={m[meal.key] || 0} onChange={(v) => setMeal(iso, r.id, meal.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      </div>

        </React.Fragment>
      )}
      </div>

      </div>


