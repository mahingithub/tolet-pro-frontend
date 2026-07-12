import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Home, Zap, ShoppingBasket, UtensilsCrossed, Layers, PiggyBank, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { monthlyReport, monthStart, monthLabel, taka, num } from './livingUtils';
import { Card, SectionHeader, DonutChart, HBar, BarChart, cx } from './livingUI';

const BUCKET_META = {
  rent: { icon: Home, color: '#ba0036', en: 'Rent', bn: 'ভাড়া' },
  bills: { icon: Zap, color: '#f59e0b', en: 'Bills', bn: 'বিল' },
  grocery: { icon: ShoppingBasket, color: '#22c55e', en: 'Grocery', bn: 'বাজার' },
  meals: { icon: UtensilsCrossed, color: '#3b82f6', en: 'Meals', bn: 'মিল' },
  other: { icon: Layers, color: '#64748b', en: 'Other', bn: 'অন্যান্য' },
};

const shortMonth = (date, language) =>
  new Date(date).toLocaleDateString(language === 'বাংলা' ? 'bn-BD' : 'en-US', { month: 'short' });

const MonthlyReport = ({ language }) => {
  const isBn = language === 'বাংলা';
  const state = useLivingStore();
  const [off, setOff] = useState(0);

  const report = useMemo(() => monthlyReport(state, off), [state, off]);

  const donutData = report.buckets
    .filter((b) => b.amount > 0)
    .map((b) => ({ label: BUCKET_META[b.key][isBn ? 'bn' : 'en'], value: b.amount, color: BUCKET_META[b.key].color }));

  const trend = useMemo(() => {
    const arr = [];
    for (let o = -5; o <= 0; o++) {
      const r = monthlyReport(state, o);
      arr.push({ label: shortMonth(monthStart(o), language), value: Math.round(r.total) });
    }
    return arr;
  }, [state, language]);

  const savingsRate = report.income > 0 ? Math.round((report.savings / report.income) * 100) : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
        subtitle={isBn ? 'খরচ ও সঞ্চয়ের বিশ্লেষণ' : 'Cost breakdown & analytics'}
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setOff((o) => o - 1)} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 active:scale-90 transition" aria-label="previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-700 min-w-[92px] text-center">{monthLabel(report.ref, language)}</span>
            <button onClick={() => setOff((o) => Math.min(0, o + 1))} disabled={off === 0} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label="next month">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {/* donut + total */}
      <Card className="p-5">
        <div className="flex flex-col items-center">
          <DonutChart
            data={donutData}
            size={190}
            thickness={26}
            centerTop={isBn ? 'মোট খরচ' : 'Total Cost'}
            centerMain={taka(report.total, language)}
            centerSub={monthLabel(report.ref, language)}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4">
          {report.buckets.map((b) => {
            const meta = BUCKET_META[b.key];
            const pct = report.total > 0 ? Math.round((b.amount / report.total) * 100) : 0;
            return (
              <div key={b.key} className="flex items-center gap-2 py-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="text-[12px] font-bold text-gray-600 flex-1 truncate">{isBn ? meta.bn : meta.en}</span>
                <span className="text-[12px] font-black text-gray-900">{taka(b.amount, language)}</span>
                <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{num(pct, language)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* total living cost + savings */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-gray-400"><BarChart3 size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'মোট লিভিং কস্ট' : 'Total Living Cost'}</span></div>
          <p className="text-[22px] font-black text-gray-900 tracking-tight mt-1.5">{taka(report.total, language)}</p>
        </Card>
        <Card className={cx('p-4', report.savings >= 0 ? '' : 'ring-1 ring-rose-200/60')}>
          <div className={cx('flex items-center gap-1.5', report.savings >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {report.savings >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'সঞ্চয়' : 'Savings'}</span>
          </div>
          <p className={cx('text-[22px] font-black tracking-tight mt-1.5', report.savings >= 0 ? 'text-emerald-600' : 'text-red-600')}>{taka(report.savings, language)}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">{isBn ? `আয়ের ${num(savingsRate, language)}%` : `${savingsRate}% of income`}</p>
        </Card>
      </div>

      {/* detailed breakdown */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'খরচের বিস্তারিত' : 'Cost breakdown'} />
        <div className="space-y-0.5">
          {report.buckets.map((b) => {
            const meta = BUCKET_META[b.key];
            return (
              <HBar
                key={b.key}
                icon={meta.icon}
                label={isBn ? meta.bn : meta.en}
                value={b.amount}
                max={report.total}
                color={meta.color}
                right={taka(b.amount, language)}
              />
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[13px] font-black text-gray-800">{isBn ? 'মোট' : 'Total'}</span>
          <span className="text-[15px] font-black text-[#ba0036]">{taka(report.total, language)}</span>
        </div>
      </Card>

      {/* 6-month trend */}
      <Card className="p-4">
        <SectionHeader title={isBn ? '৬ মাসের ট্রেন্ড' : '6-month trend'} subtitle={isBn ? 'মোট লিভিং কস্ট' : 'Total living cost'} />
        <BarChart data={trend} height={130} formatter={(v) => taka(v, language)} />
      </Card>

      {/* savings analytics */}
      <Card className="p-4 flex items-center gap-4">
        <div className={cx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', report.savings >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-red-600')}>
          <PiggyBank size={22} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-black text-gray-900">
            {report.savings >= 0
              ? isBn ? `এ মাসে ${taka(report.savings, language)} সঞ্চয়` : `You saved ${taka(report.savings, language)} this month`
              : isBn ? `এ মাসে ${taka(Math.abs(report.savings), language)} বেশি খরচ` : `You overspent ${taka(Math.abs(report.savings), language)} this month`}
          </p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
            {isBn ? `আয় ${taka(report.income, language)} · খরচ ${taka(report.total, language)}` : `Income ${taka(report.income, language)} · Spent ${taka(report.total, language)}`}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default MonthlyReport;
