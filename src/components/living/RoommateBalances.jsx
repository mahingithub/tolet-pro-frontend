import React, { useEffect, useMemo, useState } from 'react';
import { HandCoins, ArrowRight, ArrowLeftRight, Check, Plus, Clock, Users } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { computeLedger, simplifyDebts, taka, takaSigned, dateLabel, roommateById } from './livingUtils';
import { PAYMENT_METHODS, METHOD_ORDER, getMethod } from './livingConfig';
import { Card, SectionHeader, IconBadge, Avatar, Chip, PrimaryButton, Field, MoneyInput, TextInput, EmptyState, Sheet, cx } from './livingUI';

const SettleSheet = ({ open, onClose, roommates, preset, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [from, setFrom] = useState('me');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bkash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setFrom(preset?.from || 'me');
    setTo(preset?.to || roommates.find((r) => !r.isMe)?.id || '');
    setAmount(preset?.amount ? String(preset.amount) : '');
    setMethod('bkash');
    setNote('');
  }, [open, preset, roommates]);

  const amt = Number(amount) || 0;
  const invalid = amt <= 0 || !from || !to || from === to;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'সেটেল আপ' : 'Settle Up'}
      subtitle={isBn ? 'পেমেন্ট রেকর্ড করুন' : 'Record a payment between roommates'}
      footer={
        <PrimaryButton className="w-full" disabled={invalid} onClick={() => { onSave({ from, to, amount: amt, method, note: note.trim() }); onClose(); }}>
          <Check size={17} /> {isBn ? 'সেটেলমেন্ট রেকর্ড' : 'Record settlement'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Field label={isBn ? 'কে দিবে' : 'From'}>
              <PeoplePicker roommates={roommates} value={from} onChange={setFrom} isBn={isBn} />
            </Field>
          </div>
          <ArrowRight size={18} className="text-gray-300 mt-5 shrink-0" />
          <div className="flex-1">
            <Field label={isBn ? 'কে পাবে' : 'To'}>
              <PeoplePicker roommates={roommates.filter((r) => r.id !== from)} value={to} onChange={setTo} isBn={isBn} />
            </Field>
          </div>
        </div>

        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>

        <Field label={isBn ? 'পেমেন্ট মাধ্যম' : 'Payment method'}>
          <div className="grid grid-cols-4 gap-2">
            {METHOD_ORDER.map((key) => {
              const m = PAYMENT_METHODS[key];
              const Icon = m.icon;
              const active = method === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  className={cx('flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition active:scale-95', active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-100 bg-gray-50')}
                >
                  <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', m.tint, m.text)}>
                    <Icon size={16} />
                  </span>
                  <span className="text-[9.5px] font-bold text-gray-600 text-center leading-tight">{isBn ? m.bn : m.en}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={isBn ? 'নোট' : 'Note'}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'} />
        </Field>
      </div>
    </Sheet>
  );
};

const PeoplePicker = ({ roommates, value, onChange, isBn }) => (
  <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
    {roommates.map((r) => {
      const active = value === r.id;
      return (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={cx('shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-2xl border transition active:scale-95', active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-white')}
        >
          <Avatar roommate={r} size={30} />
          <span className="text-[10px] font-bold text-gray-600 max-w-[52px] truncate">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
        </button>
      );
    })}
  </div>
);

const RoommateBalances = ({ me, language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const roommates = useLivingStore((s) => s.roommates);
  const expenses = useLivingStore((s) => s.expenses);
  const groceries = useLivingStore((s) => s.groceries);
  const meals = useLivingStore((s) => s.meals);
  const settlements = useLivingStore((s) => s.settlements);
  const addSettlement = useLivingStore((s) => s.addSettlement);

  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(null);

  const net = useMemo(() => computeLedger({ expenses, groceries, meals, settlements, roommates }), [expenses, groceries, meals, settlements, roommates]);
  const debts = useMemo(() => simplifyDebts(net, roommates), [net, roommates]);

  const youOwe = debts.filter((d) => d.from === me).reduce((s, d) => s + d.amount, 0);
  const youAreOwed = debts.filter((d) => d.to === me).reduce((s, d) => s + d.amount, 0);

  useEffect(() => {
    if (intent === 'add') {
      const mine = debts.find((d) => d.from === me) || debts[0];
      setPreset(mine ? { from: mine.from, to: mine.to, amount: mine.amount } : null);
      setOpen(true);
      clearIntent?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const openSettle = (d) => {
    setPreset(d ? { from: d.from, to: d.to, amount: d.amount } : null);
    setOpen(true);
  };

  const history = useMemo(() => [...settlements].sort((a, b) => new Date(b.date) - new Date(a.date)), [settlements]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'রুমমেট ব্যালেন্স' : 'Roommate Balances'}
        subtitle={isBn ? 'কে কাকে কত দিবে' : 'Who owes whom & settle up'}
        right={
          <button onClick={() => openSettle(null)} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <HandCoins size={15} /> {isBn ? 'সেটেল' : 'Settle'}
          </button>
        }
      />

      {/* your position */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'আপনি দিবেন' : 'You owe'}</p>
          <p className="text-xl font-black text-red-600 tracking-tight mt-1">{taka(youOwe, language)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'আপনি পাবেন' : "You're owed"}</p>
          <p className="text-xl font-black text-emerald-600 tracking-tight mt-1">{taka(youAreOwed, language)}</p>
        </Card>
      </div>

      {/* who owes whom */}
      <Card className="p-4">
        <SectionHeader title={isBn ? 'পেন্ডিং ব্যালেন্স' : 'Pending balances'} subtitle={isBn ? 'সবচেয়ে কম লেনদেনে হিসাব' : 'Simplified to fewest payments'} />
        {debts.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title={isBn ? 'সব হিসাব মিটে গেছে' : 'Everyone is settled up'} subtitle={isBn ? 'কোনো বকেয়া নেই' : 'No pending balances right now'} />
        ) : (
          <div className="space-y-2.5">
            {debts.map((d) => {
              const from = roommateById(roommates, d.from);
              const to = roommateById(roommates, d.to);
              const involvesMe = d.from === me || d.to === me;
              return (
                <div key={`${d.from}-${d.to}`} className={cx('flex items-center gap-3 rounded-2xl p-3 border', involvesMe ? 'bg-[#ba0036]/5 border-[#ba0036]/15' : 'bg-gray-50 border-gray-100')}>
                  <div className="flex items-center gap-1.5">
                    <Avatar roommate={from} size={32} />
                    <ArrowRight size={15} className="text-gray-400" />
                    <Avatar roommate={to} size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">
                      <span className="font-black">{from.isMe ? (isBn ? 'আপনি' : 'You') : from.name}</span>
                      {isBn ? ' → ' : ' → '}
                      <span className="font-black">{to.isMe ? (isBn ? 'আপনি' : 'You') : to.name}</span>
                    </p>
                    <p className="text-[15px] font-black text-gray-900">{taka(d.amount, language)}</p>
                  </div>
                  <button onClick={() => openSettle(d)} className="text-[11px] font-black text-white bg-gray-900 px-3 py-2 rounded-xl active:scale-95 transition shrink-0">
                    {isBn ? 'সেটেল' : 'Settle'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* net per roommate */}
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center gap-1.5">
          <Users size={15} className="text-gray-400" /> {isBn ? 'সবার ব্যালেন্স' : 'Everyone’s balance'}
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {roommates.map((r) => {
            const v = Math.round(net[r.id] || 0);
            const settled = Math.abs(v) < 1;
            return (
              <div key={r.id} className="flex items-center gap-2.5 rounded-2xl bg-gray-50 border border-gray-100 p-2.5">
                <Avatar roommate={r} size={30} />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-gray-700 truncate">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</p>
                  <p className={cx('text-[13px] font-black', settled ? 'text-gray-400' : v > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {settled ? (isBn ? 'সেটেল্ড' : 'Settled') : takaSigned(v, language)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* settlement history */}
      <Card className="p-4">
        <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-1 flex items-center gap-1.5">
          <Clock size={15} className="text-gray-400" /> {isBn ? 'সেটেলমেন্ট হিস্ট্রি' : 'Settlement history'}
        </h3>
        {history.length === 0 ? (
          <p className="text-[12px] font-semibold text-gray-400 py-3 text-center">{isBn ? 'কোনো সেটেলমেন্ট নেই' : 'No settlements yet'}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((s) => {
              const from = roommateById(roommates, s.from);
              const to = roommateById(roommates, s.to);
              const m = getMethod(s.method);
              const MIcon = m.icon;
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={MIcon} tint={m.tint} text={m.text} size={36} iconSize={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">
                      {from.isMe ? (isBn ? 'আপনি' : 'You') : from.name} → {to.isMe ? (isBn ? 'আপনি' : 'You') : to.name}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                      <Chip tint={m.tint} text={m.text}>{isBn ? m.bn : m.en}</Chip>
                      {dateLabel(s.date, language)}
                    </p>
                  </div>
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">{taka(s.amount, language)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SettleSheet open={open} onClose={() => setOpen(false)} roommates={roommates} preset={preset} onSave={addSettlement} />
    </div>
  );
};

export default RoommateBalances;
