import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, ShoppingBasket, UtensilsCrossed, HandCoins, ArrowDownLeft, Sparkles, Settings, Check, Send, ChevronRight } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { buildReminders, monthlyReport, taka } from './livingUtils';
import { getBillType } from './livingConfig';
import { Card, SectionHeader, IconBadge, ProgressBar, PrimaryButton, Field, MoneyInput, EmptyState, Sheet, cx } from './ui';

const SEVERITY = {
  high: { tint: 'bg-rose-50', text: 'text-red-600', bar: '#f43f5e' },
  medium: { tint: 'bg-amber-50', text: 'text-amber-600', bar: '#f59e0b' },
  low: { tint: 'bg-blue-50', text: 'text-blue-600', bar: '#3b82f6' },
};

const BudgetSheet = ({ open, onClose, current, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [rent, setRent] = useState('');
  const [income, setIncome] = useState('');
  const [grocery, setGrocery] = useState('');
  const [meal, setMeal] = useState('');

  useEffect(() => {
    if (open) {
      setRent(String(current.rent || ''));
      setIncome(String(current.income || ''));
      setGrocery(String(current.grocery || ''));
      setMeal(String(current.meal || ''));
    }
  }, [open, current]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'বাজেট ও সেটিংস' : 'Budgets & Settings'}
      subtitle={isBn ? 'রিমাইন্ডারের জন্য সীমা ঠিক করুন' : 'Set caps that drive reminders'}
      footer={
        <PrimaryButton className="w-full" onClick={() => { onSave({ rent: Number(rent) || 0, income: Number(income) || 0, grocery: Number(grocery) || 0, meal: Number(meal) || 0 }); onClose(); }}>
          <Check size={17} /> {isBn ? 'সেভ করুন' : 'Save'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label={isBn ? 'মাসিক ভাড়া' : 'Monthly rent'}>
            <MoneyInput value={rent} onChange={(e) => setRent(e.target.value)} placeholder="0" />
          </Field>
          <Field label={isBn ? 'মাসিক আয়' : 'Monthly income'}>
            <MoneyInput value={income} onChange={(e) => setIncome(e.target.value)} placeholder="0" />
          </Field>
          <Field label={isBn ? 'বাজার বাজেট' : 'Grocery budget'}>
            <MoneyInput value={grocery} onChange={(e) => setGrocery(e.target.value)} placeholder="0" />
          </Field>
          <Field label={isBn ? 'মিল বাজেট' : 'Meal budget'}>
            <MoneyInput value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
    </Sheet>
  );
};

const SmartReminder = ({ go, me, language }) => {
  const isBn = language === 'বাংলা';
  const state = useLivingStore();
  const budgets = useLivingStore((s) => s.budgets);
  const rent = useLivingStore((s) => s.rent);
  const income = useLivingStore((s) => s.monthlyIncome);
  const setBudgets = useLivingStore((s) => s.setBudgets);
  const setRent = useLivingStore((s) => s.setRent);
  const setMonthlyIncome = useLivingStore((s) => s.setMonthlyIncome);
  const pushActivity = useLivingStore((s) => s.pushActivity);

  const [open, setOpen] = useState(false);

  const reminders = useMemo(() => buildReminders(state, me), [state, me]);
  const report = useMemo(() => monthlyReport(state, 0), [state]);

  const describe = (r) => {
    switch (r.kind) {
      case 'bill': {
        const meta = getBillType(r.billType);
        const over = r.statusKey === 'overdue';
        return {
          icon: meta.icon,
          title: isBn
            ? `${meta.bn} বিল ${over ? 'বকেয়া' : r.daysLeft <= 0 ? 'আজ শেষ' : `${r.daysLeft} দিনে`}`
            : `${meta.en} bill ${over ? 'is overdue' : r.daysLeft <= 0 ? 'due today' : `due in ${r.daysLeft} days`}`,
          detail: `${taka(r.amount, language)}${over ? (isBn ? ` · ${Math.abs(r.daysLeft)} দিন পার` : ` · ${Math.abs(r.daysLeft)}d late`) : ''}`,
          cta: isBn ? 'পরিশোধ করুন' : 'Pay now',
          onCta: () => go('bills'),
        };
      }
      case 'payment':
        return {
          icon: HandCoins,
          title: isBn ? 'বকেয়া পেমেন্ট' : 'Pending payment',
          detail: isBn ? `আপনার ${taka(r.amount, language)} দিতে হবে` : `You owe ${taka(r.amount, language)} to roommates`,
          cta: isBn ? 'সেটেল আপ' : 'Settle up',
          onCta: () => go('balances', 'add'),
        };
      case 'collect':
        return {
          icon: ArrowDownLeft,
          title: isBn ? 'টাকা তুলুন' : 'Money to collect',
          detail: isBn ? `${taka(r.amount, language)} আপনি পাবেন` : `${taka(r.amount, language)} is owed to you`,
          cta: isBn ? 'রিমাইন্ডার পাঠান' : 'Send reminder',
          onCta: () => {
            pushActivity('reminder', isBn ? 'রিমাইন্ডার পাঠানো হয়েছে' : 'Reminder sent', isBn ? 'বকেয়া টাকার জন্য' : 'For pending balance');
            toast.success(isBn ? 'রিমাইন্ডার পাঠানো হয়েছে' : 'Reminder sent to roommates');
          },
        };
      case 'grocery-budget': {
        const over = r.amount > r.budget;
        return {
          icon: ShoppingBasket,
          title: isBn ? (over ? 'বাজার বাজেট শেষ' : 'বাজার বাজেট প্রায় শেষ') : over ? 'Grocery budget exceeded' : 'Grocery budget almost used',
          detail: `${taka(r.amount, language)} / ${taka(r.budget, language)}`,
          cta: isBn ? 'রিপোর্ট দেখুন' : 'View report',
          onCta: () => go('report'),
        };
      }
      case 'meal-budget': {
        const over = r.amount > r.budget;
        return {
          icon: UtensilsCrossed,
          title: isBn ? (over ? 'মিল বাজেট শেষ' : 'মিল বাজেট প্রায় শেষ') : over ? 'Meal budget exceeded' : 'Meal budget almost used',
          detail: `${taka(r.amount, language)} / ${taka(r.budget, language)}`,
          cta: isBn ? 'রিপোর্ট দেখুন' : 'View report',
          onCta: () => go('report'),
        };
      }
      default:
        return { icon: BellRing, title: '', detail: '', cta: '', onCta: () => {} };
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminder'}
        subtitle={isBn ? 'স্বয়ংক্রিয় সতর্কতা' : 'Automatic alerts that keep you on track'}
        right={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 bg-gray-900 text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black active:scale-95 transition">
            <Settings size={14} /> {isBn ? 'বাজেট' : 'Budgets'}
          </button>
        }
      />

      {reminders.length === 0 ? (
        <Card>
          <EmptyState icon={Sparkles} title={isBn ? 'সব ঠিক আছে!' : "You're all caught up!"} subtitle={isBn ? 'কোনো বকেয়া বিল বা পেমেন্ট নেই' : 'No due bills, pending payments or budget alerts'} />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {reminders.map((r) => {
            const sev = SEVERITY[r.severity] || SEVERITY.low;
            const d = describe(r);
            return (
              <Card key={r.id} className={cx('p-4 border-l-4')} style={{ borderLeftColor: sev.bar }}>
                <div className="flex items-center gap-3.5">
                  <IconBadge icon={d.icon} tint={sev.tint} text={sev.text} size={44} iconSize={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-black text-gray-900 leading-tight">{d.title}</p>
                    <p className="text-[11.5px] font-semibold text-gray-500 mt-0.5">{d.detail}</p>
                  </div>
                </div>
                <button
                  onClick={d.onCta}
                  className={cx('mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black text-white active:scale-[0.98] transition', r.kind === 'collect' ? 'bg-gray-900' : 'bg-[#ba0036]')}
                >
                  {r.kind === 'collect' ? <Send size={14} /> : null}
                  {d.cta}
                  {r.kind !== 'collect' && <ChevronRight size={14} />}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* budget usage */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'বাজেট ব্যবহার' : 'Budget usage'} subtitle={isBn ? 'এ মাসের সীমা' : "This month's caps"} />
        <div className="space-y-3.5">
          <BudgetRow
            label={isBn ? 'বাজার বাজেট' : 'Grocery budget'}
            used={report.grocery}
            cap={budgets.grocery}
            color="#22c55e"
            language={language}
          />
          <BudgetRow
            label={isBn ? 'মিল বাজেট' : 'Meal budget'}
            used={report.meals}
            cap={budgets.meal}
            color="#3b82f6"
            language={language}
          />
        </div>
      </Card>

      <BudgetSheet
        open={open}
        onClose={() => setOpen(false)}
        current={{ rent, income, grocery: budgets.grocery, meal: budgets.meal }}
        onSave={({ rent: rn, income: inc, grocery, meal }) => {
          setRent(rn);
          setMonthlyIncome(inc);
          setBudgets({ grocery, meal });
        }}
      />
    </div>
  );
};

const BudgetRow = ({ label, used, cap, color, language }) => {
  const isBn = language === 'বাংলা';
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const over = cap > 0 && used > cap;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-gray-700">{label}</span>
        <span className={cx('text-[12px] font-black', over ? 'text-red-600' : 'text-gray-900')}>
          {taka(used, language)} <span className="text-gray-400 font-bold">/ {taka(cap, language)}</span>
        </span>
      </div>
      <ProgressBar value={used} max={cap} color={over ? '#f43f5e' : color} />
      <p className={cx('text-[10px] font-bold mt-1', over ? 'text-red-600' : 'text-gray-400')}>
        {over ? (isBn ? 'সীমা ছাড়িয়েছে' : 'Over budget') : `${pct}%${isBn ? ' ব্যবহৃত' : ' used'}`}
      </p>
    </div>
  );
};

export default SmartReminder;
