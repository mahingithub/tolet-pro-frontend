import React, { useMemo, useState, useEffect } from 'react';
import {
  Receipt, UtensilsCrossed, Zap, HandCoins, ArrowUpRight, ArrowDownLeft,
  Wallet, PieChart, Activity, BellRing, UserPlus, ChevronRight, Check, Info,
} from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { walletSummary, buildReminders, taka, takaSigned } from './livingUtils';
import { Card, IconBadge, Avatar, AvatarStack, PrimaryButton, Field, TextInput, Sheet, cx } from './livingUI';

const QUICK = [
  { id: 'add-expense', icon: Receipt, tint: 'bg-blue-50', text: 'text-blue-600', en: 'Add Expense', bn: 'খরচ যোগ', module: 'expenses', intent: 'add' },
  { id: 'log-meal', icon: UtensilsCrossed, tint: 'bg-emerald-50', text: 'text-emerald-600', en: 'Log Meal', bn: 'মিল লগ', module: 'meals', intent: 'add' },
  { id: 'pay-bill', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', en: 'Pay Bill', bn: 'বিল দিন', module: 'bills', intent: null },
  { id: 'settle', icon: HandCoins, tint: 'bg-violet-50', text: 'text-violet-600', en: 'Settle Up', bn: 'সেটেল', module: 'balances', intent: 'add' },
];

const SWATCHES = ['#ba0036', '#1B8553', '#2563eb', '#D99B28', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const AddRoommateSheet = ({ open, onClose, isBn, onAdd }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[1]);

  useEffect(() => {
    if (open) {
      setName('');
      setColor(SWATCHES[Math.floor(Math.random() * SWATCHES.length)]);
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'রুমমেট যোগ করুন' : 'Add Roommate'}
      subtitle={isBn ? 'ভাগাভাগির জন্য একজন যোগ করুন' : 'Add a person to split costs with'}
      footer={
        <PrimaryButton className="w-full" disabled={!name.trim()} onClick={() => { onAdd(name.trim(), color); onClose(); }}>
          <Check size={17} /> {isBn ? 'যোগ করুন' : 'Add roommate'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full font-black text-white shrink-0" style={{ width: 48, height: 48, background: color, fontSize: 18 }}>
            {(name.trim()[0] || '?').toUpperCase()}
          </span>
          <div className="flex-1">
            <Field label={isBn ? 'নাম' : 'Name'}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={isBn ? 'যেমন: রাকিব' : 'e.g. Rakib'} autoFocus />
            </Field>
          </div>
        </div>

        <Field label={isBn ? 'রঙ' : 'Colour'}>
          <div className="flex flex-wrap gap-2.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cx('w-8 h-8 rounded-full transition active:scale-90', color === c ? 'ring-2 ring-offset-2 ring-gray-900' : '')}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        <div className="flex items-start gap-2 rounded-2xl bg-blue-50 border border-blue-100 p-3">
          <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-semibold text-blue-700 leading-relaxed">
            {isBn
              ? 'এই রুমমেট এই ডিভাইসে যোগ হবে। তারা নিজের ফোন থেকে একই ওয়ালেট ব্যবহার করতে চাইলে কানেক্টেড (ইনভাইট) ভার্সন লাগবে।'
              : 'This roommate is added on this device. For them to share this wallet from their own phone, the connected (invite) version is needed.'}
          </p>
        </div>
      </div>
    </Sheet>
  );
};

const MoreRow = ({ icon: Icon, tint, text, label, badge, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 py-2.5 active:scale-[0.99] transition">
    <IconBadge icon={Icon} tint={tint} text={text} size={38} iconSize={17} />
    <span className="flex-1 text-left text-[13px] font-bold text-gray-800">{label}</span>
    {badge > 0 && (
      <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#ba0036] text-white text-[10px] font-black">{badge}</span>
    )}
    <ChevronRight size={17} className="text-gray-300" />
  </button>
);

const WalletSummary = ({ go, me, language }) => {
  const isBn = language === 'বাংলা';
  const state = useLivingStore();
  const roommates = useLivingStore((s) => s.roommates);
  const addRoommate = useLivingStore((s) => s.addRoommate);

  const ws = useMemo(() => walletSummary(state, me), [state, me]);
  const reminders = useMemo(() => buildReminders(state, me), [state, me]);
  const positive = ws.totalBalance >= 0;

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* ── Hero: Total Balance ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ba0036] via-[#d11147] to-[#ff4d6d] text-white p-5 shadow-[0_20px_45px_-18px_rgba(186,0,54,0.7)]">
        <div className="absolute -top-10 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet size={15} />
            <span className="text-[11px] font-black uppercase tracking-widest">{isBn ? 'মোট ব্যালেন্স' : 'Total Balance'}</span>
          </div>
          <p className="text-[34px] leading-none font-black tracking-tight mt-2">{takaSigned(ws.totalBalance, language)}</p>
          <p className="text-[12px] font-semibold text-white/80 mt-1.5">
            {ws.totalBalance === 0
              ? isBn ? 'সব হিসাব মিটে গেছে' : "You're all settled up"
              : positive
              ? isBn ? 'সব মিলিয়ে আপনি পাবেন' : "Overall, you're owed money"
              : isBn ? 'সব মিলিয়ে আপনার দিতে হবে' : 'Overall, you owe money'}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowUpRight size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি দিবেন' : 'You Owe'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(ws.youOwe, language)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/85">
                <ArrowDownLeft size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'আপনি পাবেন' : 'Others Owe You'}</span>
              </div>
              <p className="text-lg font-black tracking-tight mt-1">{taka(ws.othersOweYou, language)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK.map((q) => (
          <button
            key={q.id}
            onClick={() => go(q.module, q.intent)}
            className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-gray-100 p-3 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] active:scale-95 transition"
          >
            <IconBadge icon={q.icon} tint={q.tint} text={q.text} size={40} iconSize={18} />
            <span className="text-[10px] font-black text-gray-700 leading-tight text-center">{isBn ? q.bn : q.en}</span>
          </button>
        ))}
      </div>

      {/* ── This Month + Living Cost ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'এ মাসের খরচ' : 'This Month'}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(ws.thisMonthSpending, language)}</p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{isBn ? 'আপনার ভাগ' : 'Your share'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'মোট খরচ' : 'Living Cost'}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(ws.totalLivingCost, language)}</p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{isBn ? 'বাসার মোট' : 'Household'}</p>
        </Card>
      </div>

      {/* ── Roommates (with Add) ─────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <AvatarStack roommates={roommates} size={34} max={5} />
            <div className="min-w-0">
              <p className="text-[13px] font-black text-gray-900 leading-tight">
                {roommates.length} {isBn ? 'জন রুমমেট' : roommates.length === 1 ? 'roommate' : 'roommates'}
              </p>
              <p className="text-[11px] font-semibold text-gray-400 truncate max-w-[160px]">
                {roommates.map((r) => (r.isMe ? (isBn ? 'আপনি' : 'You') : r.name)).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition shrink-0"
          >
            <UserPlus size={15} /> {isBn ? 'যোগ' : 'Add'}
          </button>
        </div>
      </Card>

      {/* ── More (Report / Activity / Reminders) ─────────────────────── */}
      <Card className="px-4 py-1.5">
        <div className="divide-y divide-gray-50">
          <MoreRow icon={PieChart} tint="bg-violet-50" text="text-violet-600" label={isBn ? 'মাসিক রিপোর্ট' : 'Monthly Report'} onClick={() => go('report')} />
          <MoreRow icon={Activity} tint="bg-blue-50" text="text-blue-600" label={isBn ? 'একটিভিটি টাইমলাইন' : 'Activity Timeline'} onClick={() => go('activity')} />
          <MoreRow icon={BellRing} tint="bg-rose-50" text="text-red-600" label={isBn ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminders'} badge={reminders.length} onClick={() => go('reminders')} />
        </div>
      </Card>

      <AddRoommateSheet open={addOpen} onClose={() => setAddOpen(false)} isBn={isBn} onAdd={addRoommate} />
    </div>
  );
};

export default WalletSummary;
