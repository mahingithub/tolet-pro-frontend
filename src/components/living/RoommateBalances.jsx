import React, { useEffect, useMemo, useState } from 'react';
import { HandCoins, ArrowRight, ArrowLeftRight, Check, Clock, Users, ArrowDownLeft, ArrowUpRight, Trash2, Lock, Sparkles } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { computeLedger, simplifyDebts, taka, dateLabel, roommateById } from './livingUtils';
import { PAYMENT_METHODS, METHOD_ORDER, getMethod } from './livingConfig';
import { Card, SectionHeader, IconBadge, Avatar, Chip, PrimaryButton, Field, MoneyInput, TextInput, EmptyState, Sheet, ConfirmDialog, cx } from './livingUI';

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
  const fromR = roommateById(roommates, from);
  const toR = roommateById(roommates, to);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'সেটেল আপ' : 'Settle Up'}
      subtitle={isBn ? 'একটি পেমেন্ট রেকর্ড করুন' : 'Record a payment between roommates'}
      footer={
        <PrimaryButton className="w-full" disabled={invalid} onClick={() => { onSave({ from, to, amount: amt, method, note: note.trim() }); onClose(); }}>
          <Check size={17} /> {isBn ? 'রেকর্ড করুন' : 'Record payment'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        {/* who → whom, made obvious */}
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-3">
          <div className="flex flex-col items-center gap-1 min-w-0">
            <Avatar roommate={fromR} size={40} />
            <span className="text-[11px] font-bold text-gray-600 max-w-[70px] truncate">{fromR.isMe ? (isBn ? 'আপনি' : 'You') : fromR.name}</span>
          </div>
          <div className="flex flex-col items-center text-gray-400">
            <ArrowRight size={18} />
            <span className="text-[9px] font-black uppercase tracking-wider">{isBn ? 'দিবে' : 'pays'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <Avatar roommate={toR} size={40} />
            <span className="text-[11px] font-bold text-gray-600 max-w-[70px] truncate">{toR.isMe ? (isBn ? 'আপনি' : 'You') : toR.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isBn ? 'কে দিবে' : 'From'}>
            <PeoplePicker roommates={roommates} value={from} onChange={setFrom} isBn={isBn} />
          </Field>
          <Field label={isBn ? 'কে পাবে' : 'To'}>
            <PeoplePicker roommates={roommates.filter((r) => r.id !== from)} value={to} onChange={setTo} isBn={isBn} />
          </Field>
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

// A single "who owes whom" row with a settle action.
const DebtRow = ({ person, amount, kind, isBn, language, onSettle }) => {
  const receive = kind === 'receive';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <Avatar roommate={person} size={38} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-black text-gray-900 truncate">{person.name}</p>
        <p className={cx('text-[15px] font-black tracking-tight', receive ? 'text-emerald-600' : 'text-red-600')}>
          {receive ? '+' : '−'}{taka(amount, language)}
        </p>
      </div>
      <button
        onClick={onSettle}
        className={cx(
          'shrink-0 flex items-center gap-1.5 text-[12px] font-black px-3.5 py-2 rounded-xl text-white active:scale-95 transition',
          receive ? 'bg-emerald-600 shadow-[0_6px_16px_-6px_rgba(16,133,83,0.6)]' : 'bg-[#ba0036] shadow-[0_6px_16px_-8px_rgba(186,0,54,0.6)]'
        )}
      >
        {receive ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        {receive ? (isBn ? 'পেয়েছি' : 'Received') : (isBn ? 'দিলাম' : 'Pay')}
      </button>
    </div>
  );
};

const RoommateBalances = ({ me, language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const roommates = useLivingStore((s) => s.roommates);
  const expenses = useLivingStore((s) => s.expenses);
  const groceries = useLivingStore((s) => s.groceries);
  const meals = useLivingStore((s) => s.meals);
  const settlements = useLivingStore((s) => s.settlements);
  const connected = useLivingStore((s) => s.connected);
  const addSettlement = useLivingStore((s) => s.addSettlement);
  const deleteSettlement = useLivingStore((s) => s.deleteSettlement);

  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const net = useMemo(() => computeLedger({ expenses, groceries, meals, settlements, roommates }), [expenses, groceries, meals, settlements, roommates]);
  const debts = useMemo(() => simplifyDebts(net, roommates), [net, roommates]);

  const owedToMe = debts.filter((d) => d.to === me); // people who owe me
  const iOwe = debts.filter((d) => d.from === me); // I owe them
  const otherDebts = debts.filter((d) => d.from !== me && d.to !== me);

  const youOwe = iOwe.reduce((s, d) => s + d.amount, 0);
  const youAreOwed = owedToMe.reduce((s, d) => s + d.amount, 0);

  useEffect(() => {
    if (intent === 'add') {
      const mine = iOwe[0] || owedToMe[0];
      setPreset(mine ? { from: mine.from, to: mine.to, amount: mine.amount } : null);
      setOpen(true);
      clearIntent?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const openSettle = (p) => { setPreset(p || null); setOpen(true); };
  const history = useMemo(() => [...settlements].sort((a, b) => new Date(b.date) - new Date(a.date)), [settlements]);
  const allSettled = owedToMe.length === 0 && iOwe.length === 0 && otherDebts.length === 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'রুমমেট ব্যালেন্স' : 'Roommate Balances'}
        subtitle={isBn ? 'কে কাকে কত দিবে ও সেটেল' : 'Who owes whom & settle up'}
        right={
          <button onClick={() => openSettle(null)} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <HandCoins size={15} /> {isBn ? 'সেটেল' : 'Settle'}
          </button>
        }
      />

      {/* your position */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-emerald-600"><ArrowDownLeft size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি পাবেন' : "You'll receive"}</span></div>
          <p className="text-xl font-black text-emerald-600 tracking-tight mt-1">{taka(youAreOwed, language)}</p>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">{owedToMe.length} {isBn ? 'জনের কাছ থেকে' : owedToMe.length === 1 ? 'person' : 'people'}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-red-600"><ArrowUpRight size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি দিবেন' : 'You owe'}</span></div>
          <p className="text-xl font-black text-red-600 tracking-tight mt-1">{taka(youOwe, language)}</p>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">{iOwe.length} {isBn ? 'জনকে' : iOwe.length === 1 ? 'person' : 'people'}</p>
        </Card>
      </div>

      {allSettled ? (
        <Card>
          <EmptyState icon={Sparkles} title={isBn ? 'সব হিসাব মিটে গেছে' : 'Everyone is settled up'} subtitle={isBn ? 'কোনো বকেয়া নেই 🎉' : 'No pending balances right now 🎉'} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* people who owe you */}
          <Card className="p-4">
            <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center gap-1.5">
              <ArrowDownLeft size={15} className="text-emerald-600" /> {isBn ? 'যারা আপনাকে দিবে' : 'Owe you'}
            </h3>
            {owedToMe.length === 0 ? (
              <p className="text-[12px] font-semibold text-gray-400 py-3 text-center">{isBn ? 'কেউ আপনাকে দিবে না' : 'Nobody owes you'}</p>
            ) : (
              <div className="space-y-2">
                {owedToMe.map((d) => (
                  <DebtRow
                    key={d.from}
                    person={roommateById(roommates, d.from)}
                    amount={d.amount}
                    kind="receive"
                    isBn={isBn}
                    language={language}
                    onSettle={() => openSettle({ from: d.from, to: me, amount: d.amount })}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* people you owe */}
          <Card className="p-4">
            <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-2 flex items-center gap-1.5">
              <ArrowUpRight size={15} className="text-red-600" /> {isBn ? 'যাদের আপনি দিবেন' : 'You owe'}
            </h3>
            {iOwe.length === 0 ? (
              <p className="text-[12px] font-semibold text-gray-400 py-3 text-center">{isBn ? 'আপনার কোনো বকেয়া নেই' : 'You owe nobody'}</p>
            ) : (
              <div className="space-y-2">
                {iOwe.map((d) => (
                  <DebtRow
                    key={d.to}
                    person={roommateById(roommates, d.to)}
                    amount={d.amount}
                    kind="pay"
                    isBn={isBn}
                    language={language}
                    onSettle={() => openSettle({ from: me, to: d.to, amount: d.amount })}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* balances between other roommates (only if any) */}
      {otherDebts.length > 0 && (
        <Card className="p-4">
          <h3 className="text-[13px] font-black text-gray-500 tracking-tight mb-2 flex items-center gap-1.5">
            <Users size={14} /> {isBn ? 'অন্যদের মধ্যে' : 'Between other roommates'}
          </h3>
          <div className="space-y-1.5">
            {otherDebts.map((d) => {
              const from = roommateById(roommates, d.from);
              const to = roommateById(roommates, d.to);
              return (
                <div key={`${d.from}-${d.to}`} className="flex items-center gap-2 text-[12.5px] py-1">
                  <Avatar roommate={from} size={24} />
                  <span className="font-bold text-gray-700">{from.name}</span>
                  <ArrowRight size={13} className="text-gray-400" />
                  <Avatar roommate={to} size={24} />
                  <span className="font-bold text-gray-700 flex-1 truncate">{to.name}</span>
                  <span className="font-black text-gray-900">{taka(d.amount, language)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

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
              const canDelete = !connected || !s.createdBy || s.createdBy === me;
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
                  {canDelete ? (
                    <button onClick={() => setPendingDelete(s)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90 shrink-0" aria-label="delete">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="p-1.5 text-gray-300 shrink-0" title={isBn ? 'শুধু যিনি রেকর্ড করেছেন' : 'Only the recorder can delete'}>
                      <Lock size={13} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SettleSheet open={open} onClose={() => setOpen(false)} roommates={roommates} preset={preset} onSave={addSettlement} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteSettlement(pendingDelete.id)}
        title={isBn ? 'সেটেলমেন্ট মুছবেন?' : 'Delete this settlement?'}
        message={isBn ? 'এই পেমেন্ট রেকর্ডটি মুছে গেলে ব্যালেন্স আবার আপডেট হবে।' : 'Removing this payment record will update the balances again.'}
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

export default RoommateBalances;
