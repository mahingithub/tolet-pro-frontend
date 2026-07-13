import React, { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed, ShoppingBasket, Trash2, ChevronLeft, ChevronRight, Coffee, Sun, Moon, Check, ChefHat,
  Lock, Scale, PiggyBank, Gauge, HandCoins, Wallet, Info, Pencil,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { messSummary, taka, takaSigned, num, dateLabel, roommateById } from './livingUtils';
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
      <div className="space-y-4 py-1">
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
      <div className="space-y-4 py-1">
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
      <div className="space-y-4 py-1">
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
  const connected = useLivingStore((s) => s.connected);
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

  const [period, setPeriod] = useState('month');
  const [dayOffset, setDayOffset] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [bazarOpen, setBazarOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { kind, id }

  useEffect(() => {
    if (intent === 'add') {
      setDepositOpen(true);
      clearIntent?.();
    }
  }, [intent, clearIntent]);

  const iso = dayISO(dayOffset);
  const dayKey = iso.slice(0, 10);
  const getMeal = (rid) => {
    const m = (meals || []).find((x) => x.date.slice(0, 10) === dayKey && x.roommateId === rid);
    return m || { breakfast: 0, lunch: 0, dinner: 0 };
  };

  const summary = useMemo(() => messSummary(state, period), [state, period]);
  const mine = summary.perMember.find((p) => p.id === me) || summary.perMember.find((p) => p.isMe) || summary.perMember[0];

  const recentDeposits = useMemo(() => [...(deposits || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6), [deposits]);
  const recentBazar = useMemo(() => [...(groceries || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6), [groceries]);

  const canEdit = (item) => !connected || !item.createdBy || item.createdBy === me;
  const periodLabel = period === 'week' ? (isBn ? 'গত ৭ দিন' : 'Last 7 days') : (isBn ? 'এ মাস' : 'This month');

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

      {/* week / month toggle */}
      <SegmentedControl
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: isBn ? 'সাপ্তাহিক' : 'Weekly' },
          { value: 'month', label: isBn ? 'মাসিক' : 'Monthly' },
        ]}
      />

      {/* mess summary */}
      <Card className="p-5">
        <div className="text-center">
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <Scale size={13} /> {isBn ? 'মেস ব্যালেন্স' : 'Mess Balance'} · {periodLabel}
          </span>
          <p className={cx('text-[32px] leading-none font-black tracking-tight mt-2', summary.messBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {takaSigned(summary.messBalance, language)}
          </p>
          <p className="text-[11px] font-semibold text-gray-400 mt-1.5">
            {isBn ? 'মোট জমা − মোট মিল খরচ' : 'Total deposit − total meal cost'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <MiniStat icon={HandCoins} label={isBn ? 'মোট জমা' : 'Total deposit'} value={taka(summary.totalDeposit, language)} valueClass="text-emerald-600" />
          <MiniStat icon={ShoppingBasket} label={isBn ? 'মোট মিল খরচ' : 'Meal cost'} value={taka(summary.totalMealCost, language)} />
          <MiniStat icon={UtensilsCrossed} label={isBn ? 'মোট মিল' : 'Total meals'} value={num(summary.totalMeals, language)} />
          <button onClick={() => setRateOpen(true)} className="rounded-2xl bg-gray-50 border border-gray-100 p-3 text-left active:scale-95 transition">
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
      </Card>

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setDepositOpen(true)} className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-gray-100 py-3.5 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition">
          <IconBadge icon={PiggyBank} tint="bg-emerald-50" text="text-emerald-600" size={34} iconSize={16} />
          <span className="text-[13px] font-black text-gray-800">{isBn ? 'জমা দিন' : 'Add Deposit'}</span>
        </button>
        <button onClick={() => setBazarOpen(true)} className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-gray-100 py-3.5 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition">
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
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3">
              <p className="text-[16px] font-black text-gray-900">{num(mine.meals, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'আমার মিল' : 'Meals'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3">
              <p className="text-[16px] font-black text-emerald-600">{taka(mine.deposit, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'আমার জমা' : 'Deposit'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3">
              <p className="text-[16px] font-black text-gray-900">{taka(mine.mealCost, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'মিল খরচ' : 'Meal cost'}</p>
            </div>
            <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-3">
              <p className={cx('text-[16px] font-black', mine.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>{takaSigned(mine.balance, language)}</p>
              <p className="text-[9.5px] font-bold text-gray-400 mt-0.5">{isBn ? 'ব্যালেন্স' : 'Balance'}</p>
            </div>
          </div>
          <p className="text-[10.5px] font-semibold text-gray-400 mt-2.5 leading-relaxed flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            {isBn
              ? `ব্যালেন্স = জমা − (মিল × রেট)। + মানে আপনি ফেরত পাবেন, − মানে আরও জমা দিতে হবে।`
              : `Balance = deposit − (meals × rate). + means you get money back, − means you owe more.`}
          </p>
        </Card>
      )}

      {/* everyone's account (manager table) */}
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
            <div key={p.id} className="grid grid-cols-[1.5fr_0.7fr_1fr_1.05fr] gap-2 items-center py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar roommate={p} size={28} />
                <span className="text-[12.5px] font-bold text-gray-800 truncate">{p.isMe ? (isBn ? 'আপনি' : 'You') : p.name}</span>
              </div>
              <span className="text-right text-[12.5px] font-black text-gray-900 tabular-nums">{num(p.meals, language)}</span>
              <span className="text-right text-[12.5px] font-bold text-gray-600 tabular-nums">{taka(p.deposit, language)}</span>
              <span className={cx('text-right text-[12.5px] font-black tabular-nums', p.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>{takaSigned(p.balance, language)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* daily meal editor */}
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
                <div className="flex items-center gap-2 mb-2.5">
                  <Avatar roommate={r} size={28} />
                  <span className="text-[13px] font-black text-gray-800 flex-1">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                  <span className="text-[11px] font-black text-gray-400">{num(total, language)} {isBn ? 'মিল' : 'meals'}</span>
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

      {/* deposits list */}
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <PiggyBank size={15} className="text-emerald-600" /> {isBn ? 'জমার হিস্ট্রি' : 'Deposits'}
        </h3>
        {recentDeposits.length === 0 ? (
          <EmptyState icon={HandCoins} title={isBn ? 'কোনো জমা নেই' : 'No deposits yet'} subtitle={isBn ? 'মেস ফান্ডে টাকা জমা দিন' : 'Add money to the meal fund'} />
        ) : (
          <div className="divide-y divide-gray-50">
            {recentDeposits.map((d) => {
              const who = roommateById(roommates, d.roommateId);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={who} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{who.isMe ? (isBn ? 'আপনি' : 'You') : who.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{d.note || (isBn ? 'জমা' : 'Deposit')} · {dateLabel(d.date, language)}</p>
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">+{taka(d.amount, language)}</span>
                  {canEdit(d) ? (
                    <button onClick={() => setPendingDelete({ kind: 'deposit', id: d.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="p-1.5 text-gray-300" title={isBn ? 'শুধু যিনি যোগ করেছেন' : 'Only the recorder'}><Lock size={13} /></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* bazar list */}
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <ShoppingBasket size={15} className="text-amber-600" /> {isBn ? 'বাজারের হিস্ট্রি' : 'Bazar'}
        </h3>
        {recentBazar.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={isBn ? 'কোনো বাজার নেই' : 'No bazar yet'} subtitle={isBn ? 'মিলের বাজার যোগ করুন' : 'Add the meal groceries'} />
        ) : (
          <div className="divide-y divide-gray-50">
            {recentBazar.map((g) => {
              const payer = roommateById(roommates, g.paidBy);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={ShoppingBasket} tint="bg-amber-50" text="text-amber-600" size={32} iconSize={15} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{g.note || (isBn ? 'বাজার' : 'Bazar')}</p>
                    <p className="text-[11px] font-medium text-gray-400 truncate">{payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name} · {dateLabel(g.date, language)}</p>
                  </div>
                  <span className="text-[13px] font-black text-gray-900 shrink-0">{taka(g.amount, language)}</span>
                  {canEdit(g) ? (
                    <button onClick={() => setPendingDelete({ kind: 'grocery', id: g.id })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="p-1.5 text-gray-300" title={isBn ? 'শুধু যিনি যোগ করেছেন' : 'Only the recorder'}><Lock size={13} /></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} roommates={roommates} onSave={addDeposit} />
      <GrocerySheet open={bazarOpen} onClose={() => setBazarOpen(false)} roommates={roommates} onSave={addGrocery} />
      <RateSheet open={rateOpen} onClose={() => setRateOpen(false)} autoRate={summary.autoRate} current={mealRateSetting} onSave={setMealRate} language={language} />
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

export default MealManagement;
