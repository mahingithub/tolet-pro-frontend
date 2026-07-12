import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Zap, Bell, Check, CircleDollarSign, RotateCcw, CalendarClock } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { taka, dateLabel, daysUntil, deriveBillStatus, isSameMonth } from './livingUtils';
import { BILL_TYPES, BILL_ORDER, getBillType, BILL_STATUS } from './livingConfig';
import { Card, SectionHeader, IconBadge, Chip, Toggle, PrimaryButton, Field, MoneyInput, Sheet, cx } from './livingUI';

const todayInput = () => new Date().toISOString().slice(0, 10);

const BillSheet = ({ open, onClose, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [type, setType] = useState('electricity');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(todayInput());
  const [reminder, setReminder] = useState(true);

  useEffect(() => {
    if (open) {
      setType('electricity');
      setAmount('');
      setDue(todayInput());
      setReminder(true);
    }
  }, [open]);

  const amt = Number(amount) || 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'নতুন বিল' : 'Add Bill'}
      subtitle={isBn ? 'মাসিক ইউটিলিটি বিল ট্র্যাক করুন' : 'Track a monthly utility bill'}
      footer={
        <PrimaryButton
          className="w-full"
          disabled={amt <= 0}
          onClick={() => {
            onSave({ type, amount: amt, dueDate: new Date(due + 'T12:00:00').toISOString(), reminder, status: 'unpaid', paidDate: null });
            onClose();
          }}
        >
          <Check size={17} /> {isBn ? 'বিল যোগ করুন' : 'Add bill'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <Field label={isBn ? 'ধরন' : 'Type'}>
          <div className="grid grid-cols-4 gap-2">
            {BILL_ORDER.map((key) => {
              const b = BILL_TYPES[key];
              const Icon = b.icon;
              const active = type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cx('flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition active:scale-95', active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-100 bg-gray-50')}
                >
                  <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', b.tint, b.text)}>
                    <Icon size={16} />
                  </span>
                  <span className="text-[10px] font-bold text-gray-600">{isBn ? b.bn : b.en}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
        <Field label={isBn ? 'শেষ তারিখ' : 'Due date'}>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30"
          />
        </Field>
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-bold text-gray-700">
            <Bell size={16} className="text-gray-400" /> {isBn ? 'পেমেন্ট রিমাইন্ডার' : 'Payment reminder'}
          </span>
          <Toggle checked={reminder} onChange={setReminder} label="reminder" />
        </div>
      </div>
    </Sheet>
  );
};

const Bills = ({ language }) => {
  const isBn = language === 'বাংলা';
  const bills = useLivingStore((s) => s.bills);
  const addBill = useLivingStore((s) => s.addBill);
  const markBillPaid = useLivingStore((s) => s.markBillPaid);
  const markBillUnpaid = useLivingStore((s) => s.markBillUnpaid);
  const toggleBillReminder = useLivingStore((s) => s.toggleBillReminder);

  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    const rank = { overdue: 0, 'due-soon': 1, unpaid: 2, paid: 3 };
    return [...bills].sort((a, b) => {
      const ra = rank[deriveBillStatus(a)];
      const rb = rank[deriveBillStatus(b)];
      if (ra !== rb) return ra - rb;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [bills]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    bills.filter((b) => isSameMonth(b.dueDate)).forEach((b) => {
      if (b.status === 'paid') paid += Number(b.amount) || 0;
      else due += Number(b.amount) || 0;
    });
    return { due, paid };
  }, [bills]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'বিল' : 'Bills'}
        subtitle={isBn ? 'মাসিক বিল ও পেমেন্ট রিমাইন্ডার' : 'Monthly bills & payment reminders'}
        right={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <Plus size={15} /> {isBn ? 'যোগ' : 'Add'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-amber-600"><CalendarClock size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'বাকি (এ মাস)' : 'Due this month'}</span></div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(totals.due, language)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-emerald-600"><Check size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'পরিশোধিত' : 'Paid'}</span></div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(totals.paid, language)}</p>
        </Card>
      </div>

      <div className="space-y-2.5">
        {sorted.map((b) => {
          const meta = getBillType(b.type);
          const Icon = meta.icon;
          const st = deriveBillStatus(b);
          const stMeta = BILL_STATUS[st];
          const d = daysUntil(b.dueDate);
          const isPaid = b.status === 'paid';
          return (
            <Card key={b.id} className="p-4">
              <div className="flex items-center gap-3.5">
                <IconBadge icon={Icon} tint={meta.tint} text={meta.text} size={46} iconSize={21} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-black text-gray-900">{isBn ? meta.bn : meta.en}</p>
                    <Chip tint={stMeta.tint} text={stMeta.text}>{isBn ? stMeta.bn : stMeta.en}</Chip>
                  </div>
                  <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                    {isPaid
                      ? isBn ? `${dateLabel(b.paidDate || b.dueDate, language)} এ পরিশোধ` : `Paid on ${dateLabel(b.paidDate || b.dueDate, language)}`
                      : d < 0
                      ? isBn ? `শেষ তারিখ ${dateLabel(b.dueDate, language)} · ${Math.abs(d)} দিন পার` : `Due ${dateLabel(b.dueDate, language)} · ${Math.abs(d)}d overdue`
                      : isBn ? `শেষ তারিখ ${dateLabel(b.dueDate, language)}` : `Due ${dateLabel(b.dueDate, language)}`}
                  </p>
                </div>
                <span className="text-[16px] font-black text-gray-900 shrink-0">{taka(b.amount, language)}</span>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleBillReminder(b.id)}
                  className={cx('flex items-center gap-1.5 text-[11px] font-black transition', b.reminder ? 'text-[#ba0036]' : 'text-gray-400')}
                >
                  <Bell size={14} className={b.reminder ? 'fill-[#ba0036]/20' : ''} />
                  {b.reminder ? (isBn ? 'রিমাইন্ডার চালু' : 'Reminder on') : (isBn ? 'রিমাইন্ডার বন্ধ' : 'Reminder off')}
                </button>
                {isPaid ? (
                  <button onClick={() => markBillUnpaid(b.id)} className="flex items-center gap-1.5 text-[12px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:scale-95 transition">
                    <RotateCcw size={13} /> {isBn ? 'বাকি' : 'Unpay'}
                  </button>
                ) : (
                  <button onClick={() => markBillPaid(b.id)} className="flex items-center gap-1.5 text-[12px] font-black text-white bg-emerald-600 px-3.5 py-1.5 rounded-lg shadow-[0_6px_16px_-6px_rgba(16,133,83,0.6)] active:scale-95 transition">
                    <CircleDollarSign size={14} /> {isBn ? 'পরিশোধ' : 'Mark paid'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <BillSheet open={open} onClose={() => setOpen(false)} onSave={addBill} />
    </div>
  );
};

export default Bills;
