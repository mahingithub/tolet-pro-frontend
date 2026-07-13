import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Receipt, UtensilsCrossed, Zap, HandCoins, ArrowUpRight, ArrowDownLeft,
  Wallet, PieChart, Activity, BellRing, UserPlus, ChevronRight, Check, Info,
  Users, Copy, LogOut, RefreshCw, Wifi, LogIn, X, AlertTriangle, ShieldCheck,
} from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { walletSummary, buildReminders, taka, takaSigned } from './livingUtils';
import { Card, IconBadge, Avatar, AvatarStack, Chip, PrimaryButton, GhostButton, Field, TextInput, Sheet, ConfirmDialog, cx } from './livingUI';

const QUICK = [
  { id: 'add-expense', icon: Receipt, tint: 'bg-blue-50', text: 'text-blue-600', en: 'Add Expense', bn: 'খরচ যোগ', module: 'expenses', intent: 'add' },
  { id: 'log-meal', icon: UtensilsCrossed, tint: 'bg-emerald-50', text: 'text-emerald-600', en: 'Log Meal', bn: 'মিল লগ', module: 'meals', intent: 'add' },
  { id: 'pay-bill', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', en: 'Pay Bill', bn: 'বিল দিন', module: 'bills', intent: null },
  { id: 'settle', icon: HandCoins, tint: 'bg-violet-50', text: 'text-violet-600', en: 'Settle Up', bn: 'সেটেল', module: 'balances', intent: 'add' },
];

const SWATCHES = ['#ba0036', '#1B8553', '#2563eb', '#D99B28', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// ── Add a roommate (works in both local + connected mode) ──────────────────
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
              <button key={c} type="button" onClick={() => setColor(c)} className={cx('w-8 h-8 rounded-full transition active:scale-90', color === c ? 'ring-2 ring-offset-2 ring-gray-900' : '')} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
};

// ── Create / join a shared household ────────────────────────────────────────
const ConnectSheet = ({ open, onClose, isBn }) => {
  const createHousehold = useLivingStore((s) => s.createHousehold);
  const joinHousehold = useLivingStore((s) => s.joinHousehold);
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setMode('create'); setName(''); setCode(''); setBusy(false); }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'create') {
        await createHousehold(name.trim() || (isBn ? 'আমাদের বাসা' : 'Our Flat'));
        toast.success(isBn ? 'হাউসহোল্ড তৈরি হয়েছে' : 'Shared household created');
      } else {
        await joinHousehold(code.trim().toUpperCase());
        toast.success(isBn ? 'হাউসহোল্ডে যোগ হয়েছেন' : 'Joined the household');
      }
      onClose();
    } catch (e) {
      toast.error(e?.message || (isBn ? 'ব্যর্থ হয়েছে' : 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'রুমমেট কানেক্ট করুন' : 'Connect Roommates'}
      subtitle={isBn ? 'একটি শেয়ার্ড ওয়ালেট সবার ফোনে' : 'One shared wallet across everyone’s phones'}
      footer={
        <PrimaryButton className="w-full" disabled={busy || (mode === 'join' && !code.trim())} onClick={submit}>
          {mode === 'create' ? <Users size={17} /> : <LogIn size={17} />}
          {busy ? (isBn ? 'অপেক্ষা করুন…' : 'Please wait…') : mode === 'create' ? (isBn ? 'হাউসহোল্ড তৈরি করুন' : 'Create household') : (isBn ? 'কোড দিয়ে জয়েন' : 'Join with code')}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-2xl">
          {[{ id: 'create', en: 'Create', bn: 'তৈরি' }, { id: 'join', en: 'Join', bn: 'জয়েন' }].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              className={cx('flex-1 py-2 rounded-xl text-[12px] font-black transition-all', mode === o.id ? 'bg-white text-[#ba0036] shadow-sm' : 'text-gray-500')}
            >
              {isBn ? o.bn : o.en}
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <>
            <Field label={isBn ? 'হাউসহোল্ডের নাম' : 'Household name'}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={isBn ? 'যেমন: ধানমন্ডি ফ্ল্যাট' : 'e.g. Dhanmondi Flat'} autoFocus />
            </Field>
            <div className="flex items-start gap-2 rounded-2xl bg-blue-50 border border-blue-100 p-3">
              <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-semibold text-blue-700 leading-relaxed">
                {isBn
                  ? 'তৈরি করার পর একটি ইনভাইট কোড পাবেন। রুমমেটদের কোডটি দিন — তারা নিজের ফোন থেকে জয়েন করে একই ওয়ালেট ব্যবহার করবে।'
                  : 'After creating, you get an invite code. Share it with roommates so they can join from their own phones and share this one wallet.'}
              </p>
            </div>
          </>
        ) : (
          <Field label={isBn ? 'ইনভাইট কোড' : 'Invite code'}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="ABC123"
              autoFocus
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-[0.35em] text-gray-900 placeholder:text-gray-300 placeholder:tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30 uppercase"
            />
          </Field>
        )}
      </div>
    </Sheet>
  );
};

// ── Leave household — a destructive "dismiss the roommate wall" action gated
// behind re-entering the login password (verified server-side). ──────────────
const LeaveHouseholdSheet = ({ open, onClose, isBn, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setPassword(''); setBusy(false); }
  }, [open]);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    try {
      await onConfirm(password);
      toast.success(isBn ? 'হাউসহোল্ড ছেড়ে দিয়েছেন' : 'Left the household');
      onClose();
    } catch (e) {
      const wrong = e?.code === 'invalid_password' || e?.status === 401;
      toast.error(wrong ? (isBn ? 'পাসওয়ার্ড ভুল হয়েছে।' : 'Incorrect password.') : (e?.message || (isBn ? 'ব্যর্থ হয়েছে' : 'Something went wrong')));
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'রুমমেট ওয়ালেট ছাড়ুন' : 'Leave Roommate Wallet'}
      subtitle={isBn ? 'নিশ্চিত করতে লগইন পাসওয়ার্ড দিন' : 'Re-enter your login password to confirm'}
      footer={
        <button
          onClick={submit}
          disabled={busy || !password}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#ba0036] text-white px-5 py-3.5 font-black text-sm active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100"
        >
          <LogOut size={17} /> {busy ? (isBn ? 'অপেক্ষা করুন…' : 'Please wait…') : (isBn ? 'হাউসহোল্ড ছাড়ুন' : 'Leave household')}
        </button>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-100 p-3">
          <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11.5px] font-semibold text-red-700 leading-relaxed">
            {isBn
              ? 'আপনি এই শেয়ার্ড ওয়ালেট থেকে বেরিয়ে যাবেন। এই ডিভাইসে সিঙ্ক করা ডেটা আর দেখা যাবে না — তবে ইনভাইট কোড দিয়ে আবার জয়েন করতে পারবেন।'
              : "You'll disconnect from this shared wallet. Its synced data won't show on this device anymore — but you can re-join anytime with the invite code."}
          </p>
        </div>
        <Field label={isBn ? 'লগইন পাসওয়ার্ড' : 'Login password'}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30"
          />
        </Field>
        <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-gray-400" />
          {isBn ? 'নিরাপত্তার জন্য এই ধাপটি রাখা হয়েছে।' : 'This step protects your wallet from accidental removal.'}
        </p>
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
  const removeRoommate = useLivingStore((s) => s.removeRoommate);
  const leaveHousehold = useLivingStore((s) => s.leaveHousehold);
  const regenerateCode = useLivingStore((s) => s.regenerateCode);
  const connected = useLivingStore((s) => s.connected);
  const householdName = useLivingStore((s) => s.householdName);
  const inviteCode = useLivingStore((s) => s.inviteCode);
  const isOwner = useLivingStore((s) => s.isOwner);

  const ws = useMemo(() => walletSummary(state, me), [state, me]);
  const reminders = useMemo(() => buildReminders(state, me), [state, me]);
  const positive = ws.totalBalance >= 0;

  const [addOpen, setAddOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success(isBn ? 'কোড কপি হয়েছে' : 'Invite code copied');
    } catch {
      toast.error(isBn ? 'কপি করা যায়নি' : 'Could not copy');
    }
  };

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

      {/* Desktop: summary detail flows into two columns; mobile stays stacked. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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

      {/* ── Household / Roommates ────────────────────────────────────── */}
      {connected ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                <Wifi size={11} /> {isBn ? 'কানেক্টেড' : 'Connected'}
              </p>
              <p className="text-[15px] font-black text-gray-900 truncate">{householdName}</p>
            </div>
            {isOwner && (
              <button
                onClick={async () => { try { await regenerateCode(); toast.success(isBn ? 'নতুন কোড তৈরি' : 'New code generated'); } catch (e) { toast.error(e?.message || 'Failed'); } }}
                className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-500 active:scale-90 transition"
                aria-label={isBn ? 'নতুন কোড' : 'New code'}
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>

          <button onClick={copyCode} className="w-full flex items-center justify-between rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-3 active:scale-[0.99] transition">
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{isBn ? 'ইনভাইট কোড' : 'Invite code'}</p>
              <p className="text-xl font-black tracking-[0.28em] text-gray-900">{inviteCode}</p>
            </div>
            <span className="flex items-center gap-1 text-[#ba0036] font-black text-[12px]"><Copy size={14} /> {isBn ? 'কপি' : 'Copy'}</span>
          </button>
          <p className="text-[11px] font-semibold text-gray-400 -mt-1">
            {isBn ? 'রুমমেটদের কোডটি দিন — তারা কোড দিয়ে জয়েন করবে।' : 'Share this code so roommates can join from their phones.'}
          </p>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
              {roommates.length} {isBn ? 'জন সদস্য' : roommates.length === 1 ? 'member' : 'members'}
            </p>
            <div className="divide-y divide-gray-50">
              {roommates.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <Avatar roommate={r} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-gray-900 truncate flex items-center gap-1.5">
                      {r.isMe ? `${r.name} (${isBn ? 'আপনি' : 'You'})` : r.name}
                      {r.role === 'owner' && (
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider text-[#ba0036] bg-[#ba0036]/10 px-1.5 py-0.5 rounded-full">
                          {isBn ? 'ম্যানেজার' : 'Manager'}
                        </span>
                      )}
                    </p>
                    <p className={cx('text-[11px] font-bold mt-0.5 flex items-center gap-1', r.joined ? 'text-emerald-600' : 'text-gray-400')}>
                      {r.joined ? (
                        <>
                          <Check size={12} /> {isBn ? 'জয়েন করেছে' : 'Joined'}
                        </>
                      ) : (
                        isBn ? 'ইনভাইট পেন্ডিং' : 'Invite pending'
                      )}
                    </p>
                  </div>
                  {!r.joined && !r.isMe && isOwner && (
                    <button onClick={() => setPendingRemove(r)} className="p-2 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90 shrink-0" aria-label="remove">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Real roommates join with the invite code above — no manual "add person" needed. */}
          <div className="pt-1">
            <button
              onClick={() => setLeaveOpen(true)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-[12px] font-black active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} /> {isBn ? 'হাউসহোল্ড ছাড়ুন' : 'Leave household'}
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
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
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 bg-gray-100 text-gray-700 pl-2.5 pr-3 py-2 rounded-xl text-[12px] font-black active:scale-95 transition shrink-0">
              <UserPlus size={15} /> {isBn ? 'যোগ' : 'Add'}
            </button>
          </div>

          <button onClick={() => setConnectOpen(true)} className="w-full flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#ba0036]/[0.07] to-transparent border border-[#ba0036]/15 px-3.5 py-3 active:scale-[0.99] transition">
            <IconBadge icon={Users} tint="bg-[#ba0036]/10" text="text-[#ba0036]" size={40} iconSize={18} />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-black text-gray-900">{isBn ? 'রুমমেট কানেক্ট করুন' : 'Connect your roommates'}</p>
              <p className="text-[11px] font-semibold text-gray-500">{isBn ? 'এক ওয়ালেট, সবার ফোনে সিঙ্ক' : 'One shared wallet, synced across phones'}</p>
            </div>
            <ChevronRight size={18} className="text-[#ba0036] shrink-0" />
          </button>
        </Card>
      )}

      {/* ── More (Report / Activity / Reminders) ─────────────────────── */}
      <Card className="px-4 py-1.5">
        <div className="divide-y divide-gray-50">
          <MoreRow icon={PieChart} tint="bg-violet-50" text="text-violet-600" label={isBn ? 'মাসিক রিপোর্ট' : 'Monthly Report'} onClick={() => go('report')} />
          <MoreRow icon={Activity} tint="bg-blue-50" text="text-blue-600" label={isBn ? 'একটিভিটি টাইমলাইন' : 'Activity Timeline'} onClick={() => go('activity')} />
          <MoreRow icon={BellRing} tint="bg-rose-50" text="text-red-600" label={isBn ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminders'} badge={reminders.length} onClick={() => go('reminders')} />
        </div>
      </Card>
      </div>

      <AddRoommateSheet open={addOpen} onClose={() => setAddOpen(false)} isBn={isBn} onAdd={addRoommate} />
      <ConnectSheet open={connectOpen} onClose={() => setConnectOpen(false)} isBn={isBn} />
      <LeaveHouseholdSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} isBn={isBn} onConfirm={leaveHousehold} />
      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => removeRoommate(pendingRemove.id)}
        title={isBn ? 'রুমমেট সরাবেন?' : 'Remove this roommate?'}
        message={pendingRemove ? (isBn ? `${pendingRemove.name}-কে হাউসহোল্ড থেকে সরানো হবে।` : `${pendingRemove.name} will be removed from the household.`) : ''}
        confirmLabel={isBn ? 'সরান' : 'Remove'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

export default WalletSummary;
