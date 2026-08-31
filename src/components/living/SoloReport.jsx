/**
 * SoloReport — the month in one page: what the money was spent on, where it
 * came from, what was left over, and how that compares with the last six
 * months. Read-only by design; every number traces back to a row in the খাতা.
 */
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { monthLabel, num, taka } from './livingUtils';
import { getIncomeCategory, getSpendCategory } from './soloConfig';
import { soloSummary, soloTrend, takaBalance } from './soloUtils';
import { BarChart, Card, DonutChart, HBar, IconBadge, SectionHeader, cx } from './livingUI';

const shortMonth = (date, language) =>
  new Date(date).toLocaleDateString(language === 'বাংলা' ? 'bn-BD' : 'en-US', { month: 'short' });

const SoloReport = ({ language }) => {
  const isBn = language === 'বাংলা';
  const solo = useLivingStore((s) => s.solo);
  const [off, setOff] = useState(0);

  const s = useMemo(() => soloSummary(solo, off), [solo, off]);
  const trend = useMemo(() => soloTrend(solo, 6), [solo]);

  const donutData = s.byCategory.map((c) => {
    const meta = getSpendCategory(c.key);
    return { label: isBn ? meta.bn : meta.en, value: c.amount, color: meta.hex };
  });

  const trendData = trend.map((t) => ({ label: shortMonth(t.ref, language), value: Math.round(t.spent) }));
  const savingsRate = s.earned > 0 ? Math.round((s.saved / s.earned) * 100) : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
        subtitle={isBn ? 'কোথায় গেল, কোথা থেকে এলো' : 'Where it went, where it came from'}
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setOff((o) => o - 1)} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 active:scale-90 transition" aria-label={isBn ? 'আগের মাস' : 'Previous month'}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-gray-700 min-w-[92px] text-center">{monthLabel(s.ref, language)}</span>
            <button onClick={() => setOff((o) => Math.min(0, o + 1))} disabled={off === 0} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label={isBn ? 'পরের মাস' : 'Next month'}>
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {/* spending donut + legend */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-8">
          <div className="flex flex-col items-center shrink-0">
            <DonutChart
              data={donutData}
              size={190}
              thickness={26}
              centerTop={isBn ? 'মোট খরচ' : 'Total spent'}
              centerMain={taka(s.spent, language)}
              centerSub={monthLabel(s.ref, language)}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 lg:mt-0 lg:flex-1">
            {s.byCategory.length === 0 && (
              <p className="col-span-2 text-[12px] font-semibold text-gray-400 text-center py-4">
                {isBn ? 'এ মাসে কোনো খরচ লেখা হয়নি।' : 'Nothing was logged this month.'}
              </p>
            )}
            {s.byCategory.map((c) => {
              const meta = getSpendCategory(c.key);
              return (
                <div key={c.key} className="flex items-center gap-2 py-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.hex }} />
                  <span className="text-[12px] font-bold text-gray-600 flex-1 truncate">{isBn ? meta.bn : meta.en}</span>
                  <span className="text-[12px] font-black text-gray-900">{taka(c.amount, language)}</span>
                  <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{num(Math.round(c.pct), language)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* in / out / left over */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-gray-400">
            <TrendingDown size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'মোট খরচ' : 'Total spent'}</span>
          </div>
          <p className="text-[22px] font-black text-gray-900 tracking-tight mt-1.5">{taka(s.spent, language)}</p>
        </Card>
        <Card className={cx('p-4', s.saved >= 0 ? '' : 'ring-1 ring-rose-200/60')}>
          <div className={cx('flex items-center gap-1.5', s.saved >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {s.saved >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'বেঁচেছে' : 'Left over'}</span>
          </div>
          <p className={cx('text-[22px] font-black tracking-tight mt-1.5', s.saved >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {takaBalance(s.saved, language)}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">
            {isBn ? `আয়ের ${num(savingsRate, language)}%` : `${savingsRate}% of income`}
          </p>
        </Card>
      </div>

      {/* category breakdown */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'খরচের বিস্তারিত' : 'Spending breakdown'} />
        {s.byCategory.length === 0 ? (
          <p className="text-[12px] font-semibold text-gray-400 py-4 text-center">
            {isBn ? 'কিছু নেই।' : 'Nothing here yet.'}
          </p>
        ) : (
          <>
            <div className="space-y-0.5">
              {s.byCategory.map((c) => {
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
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[13px] font-black text-gray-800">{isBn ? 'মোট' : 'Total'}</span>
              <span className="text-[15px] font-black text-[#ba0036]">{taka(s.spent, language)}</span>
            </div>
          </>
        )}
      </Card>

      {/* income sources */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'টাকা এসেছে যেখান থেকে' : 'Where the money came from'} subtitle={taka(s.earned, language)} />
        {s.bySource.length === 0 ? (
          <p className="text-[12px] font-semibold text-gray-400 py-4 text-center">
            {isBn ? 'এ মাসে কোনো আয় লেখা হয়নি।' : 'No income logged this month.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {s.bySource.map((c) => {
              const meta = getIncomeCategory(c.key);
              return (
                <HBar
                  key={c.key}
                  icon={meta.icon}
                  label={isBn ? meta.bn : meta.en}
                  value={c.amount}
                  max={s.earned}
                  color={meta.hex}
                  right={taka(c.amount, language)}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* money that only moved — never spending */}
      <Card className="p-4">
        <SectionHeader
          title={isBn ? 'ধার-দেনা (খরচ নয়)' : 'Lending (not spending)'}
          subtitle={isBn ? 'এই টাকা হাতবদল হয়েছে, খরচ হয়নি' : 'This money moved, it was not spent'}
        />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: isBn ? 'ধার দিয়েছেন' : 'Lent out', value: s.lent },
            { label: isBn ? 'ধার নিয়েছেন' : 'Borrowed', value: s.borrowed },
            { label: isBn ? 'ফেরত পেয়েছেন' : 'Got back', value: s.gotBack },
            { label: isBn ? 'ফেরত দিয়েছেন' : 'Paid back', value: s.paidBack },
          ].map((row) => (
            <div key={row.label} className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{row.label}</p>
              <p className="text-[16px] font-black text-gray-900 mt-1">{taka(row.value, language)}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-3 rounded-2xl bg-blue-50 border border-blue-100 p-3">
          <IconBadge icon={HandCoins} tint="bg-blue-100" text="text-blue-600" size={30} iconSize={14} />
          <p className="text-[11px] font-semibold text-blue-700 leading-relaxed">
            {isBn
              ? 'ধার দেওয়া টাকা উপরের খরচের হিসাবে ধরা হয়নি — ওটা আপনি ফেরত পাবেন। তাই মাসের খরচ যা দেখাচ্ছে, ঠিক ততটাই খরচ হয়েছে।'
              : "Money you lent is not in the spending totals above — you are getting it back. So the month's spending figure is exactly what you actually spent."}
          </p>
        </div>
      </Card>

      {/* 6-month trend */}
      <Card className="p-4">
        <SectionHeader title={isBn ? '৬ মাসের ট্রেন্ড' : '6-month trend'} subtitle={isBn ? 'মাসিক খরচ' : 'Monthly spending'} />
        <BarChart data={trendData} height={130} formatter={(v) => taka(v, language)} />
      </Card>

      {/* savings line */}
      <Card className="p-4 flex items-center gap-4">
        <div className={cx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', s.saved >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-red-600')}>
          <PiggyBank size={22} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-black text-gray-900">
            {s.saved >= 0
              ? isBn ? `${monthLabel(s.ref, language)}-এ ${taka(s.saved, language)} বেঁচেছে` : `You kept ${taka(s.saved, language)} in ${monthLabel(s.ref, language)}`
              : isBn ? `${monthLabel(s.ref, language)}-এ ${taka(-s.saved, language)} বেশি খরচ` : `You overspent ${taka(-s.saved, language)} in ${monthLabel(s.ref, language)}`}
          </p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
            {isBn ? `হাতে আছে ${taka(s.cash, language)}` : `${taka(s.cash, language)} in hand right now`}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SoloReport;
