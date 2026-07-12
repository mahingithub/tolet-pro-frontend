import React, { useEffect, useMemo, useState } from 'react';
import { Plus, UtensilsCrossed, ShoppingBasket, Trash2, ChevronLeft, ChevronRight, Coffee, Sun, Moon, Check, ChefHat } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { mealSummary, taka, num, dateLabel } from './livingUtils';
import {
  Card, SectionHeader, IconBadge, Avatar, Stepper, HBar, PrimaryButton, Field, MoneyInput, TextInput,
  EmptyState, Sheet, cx,
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

const GrocerySheet = ({ open, onClose, roommates, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('me');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaidBy('me');
      setNote('');
    }
  }, [open]);

  const amt = Number(amount) || 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'বাজার খরচ' : 'Add Groceries'}
      subtitle={isBn ? 'মিলের বাজার — মিল অনুযায়ী ভাগ হবে' : 'Meal groceries — split by meal count'}
      footer={
        <PrimaryButton className="w-full" disabled={amt <= 0} onClick={() => { onSave({ amount: amt, paidBy, note: note.trim() }); onClose(); }}>
          <Check size={17} /> {isBn ? 'যোগ করুন' : 'Add groceries'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
        <Field label={isBn ? 'কে দিয়েছে' : 'Paid By'}>
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
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'যেমন: চাল, তেল' : 'e.g. Rice, oil'} />
        </Field>
      </div>
    </Sheet>
  );
};

const MealManagement = ({ language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const roommates = useLivingStore((s) => s.roommates);
  const meals = useLivingStore((s) => s.meals);
  const groceries = useLivingStore((s) => s.groceries);
  const setMeal = useLivingStore((s) => s.setMeal);
  const addGrocery = useLivingStore((s) => s.addGrocery);
  const deleteGrocery = useLivingStore((s) => s.deleteGrocery);
  const state = useLivingStore();

  const [dayOffset, setDayOffset] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (intent === 'add') {
      setOpen(true);
      clearIntent?.();
    }
  }, [intent, clearIntent]);

  const iso = dayISO(dayOffset);
  const dayKey = iso.slice(0, 10);

  const getMeal = (rid) => {
    const m = meals.find((x) => x.date.slice(0, 10) === dayKey && x.roommateId === rid);
    return m || { breakfast: 0, lunch: 0, dinner: 0 };
  };

  const summary = useMemo(() => mealSummary(state, 0), [state]);
  const maxCount = Math.max(1, ...summary.perRoommate.map((p) => p.count));

  const recentGroceries = useMemo(() => [...groceries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [groceries]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'মিল ম্যানেজমেন্ট' : 'Meal Management'}
        subtitle={isBn ? 'মিল গুনুন ও বাজার ভাগ করুন' : 'Track meals & split grocery cost'}
        right={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <ShoppingBasket size={15} /> {isBn ? 'বাজার' : 'Grocery'}
          </button>
        }
      />

      {/* month meal totals */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3.5 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'মোট মিল' : 'Meals'}</p>
          <p className="text-xl font-black text-gray-900 mt-1">{num(summary.totalMeals, language)}</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'বাজার' : 'Grocery'}</p>
          <p className="text-xl font-black text-gray-900 mt-1">{taka(summary.totalGrocery, language)}</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'প্রতি মিল' : 'Per meal'}</p>
          <p className="text-xl font-black text-[#ba0036] mt-1">{taka(summary.rate, language)}</p>
        </Card>
      </div>

      {/* daily meal editor */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight">{isBn ? 'আজকের মিল' : "Today's meals"}</h3>
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

      {/* grocery cost distribution */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'বাজার খরচ বণ্টন' : 'Grocery Cost Distribution'} subtitle={isBn ? 'মিল অনুযায়ী ভাগ' : 'Split by meals eaten'} />
        {summary.totalMeals === 0 ? (
          <EmptyState icon={UtensilsCrossed} title={isBn ? 'কোনো মিল নেই' : 'No meals logged'} subtitle={isBn ? 'মিল যোগ করলে বণ্টন দেখা যাবে' : 'Log meals to see the cost split'} />
        ) : (
          <div className="space-y-1">
            {summary.perRoommate.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5">
                <Avatar roommate={p} size={30} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-bold text-gray-800">{p.isMe ? (isBn ? 'আপনি' : 'You') : p.name}</span>
                    <span className="text-[12.5px] font-black text-gray-900">{taka(p.cost, language)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${summary.totalMeals ? (p.count / summary.totalMeals) * 100 : 0}%`, background: p.color }} />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 shrink-0">{num(p.count, language)} {isBn ? 'মিল' : 'meals'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* monthly meal report */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'মাসিক মিল রিপোর্ট' : 'Monthly Meal Report'} subtitle={dateLabel(summary.ref, language) + (isBn ? ' থেকে' : ' →')} />
        <div className="space-y-1">
          {summary.perRoommate.map((p) => (
            <HBar
              key={p.id}
              label={p.isMe ? (isBn ? 'আপনি' : 'You') : p.name}
              value={p.count}
              max={maxCount}
              color={p.color}
              right={`${num(p.count, language)} · ${taka(p.cost, language)}`}
            />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] font-black text-gray-500"><ChefHat size={14} /> {isBn ? 'মোট মিল খরচ' : 'Total meal cost'}</span>
          <span className="text-[14px] font-black text-gray-900">{taka(summary.totalGrocery, language)}</span>
        </div>
      </Card>

      {/* recent grocery entries */}
      {recentGroceries.length > 0 && (
        <Card className="p-4">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1">{isBn ? 'সাম্প্রতিক বাজার' : 'Recent groceries'}</h3>
          <div className="divide-y divide-gray-50">
            {recentGroceries.map((g) => {
              const payer = roommates.find((r) => r.id === g.paidBy);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={ShoppingBasket} tint="bg-emerald-50" text="text-emerald-600" size={36} iconSize={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">{g.note || (isBn ? 'বাজার' : 'Groceries')}</p>
                    <p className="text-[11px] font-medium text-gray-400">
                      {payer?.isMe ? (isBn ? 'আপনি' : 'You') : payer?.name} · {dateLabel(g.date, language)}
                    </p>
                  </div>
                  <span className="text-[13px] font-black text-gray-900 shrink-0">{taka(g.amount, language)}</span>
                  <button onClick={() => deleteGrocery(g.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <GrocerySheet open={open} onClose={() => setOpen(false)} roommates={roommates} onSave={addGrocery} />
    </div>
  );
};

export default MealManagement;
