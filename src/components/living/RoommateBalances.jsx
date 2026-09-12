import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { HandCoins, ArrowRight, ArrowLeftRight, BellRing, Check, Clock, Loader2, MessageCircle, Smartphone, Users, ArrowDownLeft, ArrowUpRight, Trash2, Sparkles, Receipt } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import livingService from '../../services/livingService';
import { computeLedger, simplifyDebts, paymentBreakdown, taka, dateLabel, timeAgo, roommateById } from './livingUtils';
import { pendingKeys } from '../../store/livingOps';
import { PAYMENT_METHODS, METHOD_ORDER, getMethod, getCategory } from './livingConfig';
import { Card, SectionHeader, IconBadge, Avatar, Chip, PendingChip, PrimaryButton, Field, MoneyInput, TextInput, EmptyState, Sheet, ConfirmDialog, cx } from './livingUI';

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

/**
 * The settle-up nudge — "I paid, here's your share."
 *
 * Nothing is composed on this side. The sheet asks the server what it WOULD
 * send and shows that text verbatim, because the message goes out over the
 * user's name to a real roommate: approving one wording and delivering another
 * is the one thing a feature like this must never do. The figure in it is the
 * server's own recomputation of the debt, not a number this phone passed in.
 */
const RemindSheet = ({ open, onClose, person, isBn, language, onSent }) => {
  const [state, setState] = useState({ loading: true });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !person) return;
    let cancelled = false;
    setState({ loading: true });
    livingService
      .remindPreview(person.id)
      .then((r) => { if (!cancelled) setState({ loading: false, ...r }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, ok: false, reason: e.offline ? 'offline' : 'failed' }); });
    return () => { cancelled = true; };
  }, [open, person]);

  const send = async () => {
    setSending(true);
    try {
      const r = await livingService.remindMember(person.id);
      toast.success(
        isBn
          ? `${r.debtorName}-কে মনে করিয়ে দেওয়া হয়েছে।`
          : `${r.debtorName} has been reminded.`,
      );
      onSent?.(r);
      onClose();
    } catch (e) {
      // 409 = a real answer (cooldown / nothing owed), not a crash.
      toast.error(e.message || (isBn ? 'পাঠানো যায়নি।' : 'Could not send.'));
    } finally {
      setSending(false);
    }
  };

  const blocked = state.ok === false;
  const reasonText = {
    nothing_owed: isBn ? 'এখন আর কিছু বাকি নেই — হিসাব মিটে গেছে।' : 'Nothing is owed right now — you are settled.',
    no_channel: isBn ? 'এই রুমমেট এখনো অ্যাপে যোগ দেননি, তাই পাঠানোর কোনো উপায় নেই।' : 'This roommate has not joined the app, so there is nowhere to send it.',
    offline: isBn ? 'ইন্টারনেট নেই। রিমাইন্ডার পরে পাঠাতে হবে।' : 'No connection — a reminder has to be sent online.',
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'মনে করিয়ে দিন' : 'Send a reminder'}
      subtitle={person ? (isBn ? `${person.name}-কে পাঠানো হবে` : `Goes to ${person.name}`) : ''}
      footer={
        state.ok && !state.onCooldown ? (
          <PrimaryButton className="w-full" onClick={send} disabled={sending}>
            {sending ? <Loader2 size={17} className="animate-spin" /> : <BellRing size={17} />}
            {isBn ? 'এই বার্তাটি পাঠান' : 'Send this message'}
          </PrimaryButton>
        ) : null
      }
    >
      <div className="space-y-4 py-1">
        {state.loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[12.5px] font-bold">{isBn ? 'হিসাব মিলিয়ে দেখছি…' : 'Checking the balance…'}</span>
          </div>
        ) : blocked ? (
          <p className="text-[12.5px] font-semibold text-gray-500 leading-relaxed bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            {reasonText[state.reason] || (isBn ? 'এখন পাঠানো যাচ্ছে না।' : 'This cannot be sent right now.')}
          </p>
        ) : (
          <>
            <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">
                {isBn ? 'যা চাওয়া হবে' : 'The ask'}
              </p>
              <p className="text-[26px] leading-none font-black tracking-tight text-emerald-600 mt-1.5">
                {taka(state.amount, language)}
              </p>
              {state.paidTotal > 0 && (
                <p className="text-[11.5px] font-semibold text-emerald-800/70 mt-2 leading-relaxed">
                  {isBn
                    ? `আপনি মোট ${taka(state.paidTotal, language)} পরিশোধ করেছেন — সেটাই ভাগ হয়ে এই অঙ্কটা এসেছে।`
                    : `You have paid ${taka(state.paidTotal, language)} in total — this is their share of it.`}
                </p>
              )}
            </div>

            {/* The exact text, verbatim. */}
            <Field label={isBn ? 'যে বার্তাটি যাবে' : 'The message that goes out'}>
              <pre className="whitespace-pre-wrap break-words text-[12px] font-semibold text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-2xl p-3.5 font-sans max-h-[240px] overflow-y-auto">
                {state.message}
              </pre>
            </Field>

            <div className="flex flex-wrap gap-2">
              {state.channels?.whatsapp && (
                <Chip tint="bg-emerald-50" text="text-emerald-700"><MessageCircle size={11} className="inline mr-1" />{isBn ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</Chip>
              )}
              {state.channels?.inApp && (
                <Chip tint="bg-blue-50" text="text-blue-700"><Smartphone size={11} className="inline mr-1" />{isBn ? 'অ্যাপ নোটিফিকেশন' : 'In-app'}</Chip>
              )}
            </div>

            <p className="text-[11.5px] font-semibold text-gray-400 leading-relaxed">
              {state.onCooldown
                ? isBn
                  ? `আজ একবার মনে করিয়ে দেওয়া হয়েছে (${timeAgo(state.lastSentAt, language)})। দিনে একবারের বেশি পাঠানো যায় না।`
                  : `Already reminded today (${timeAgo(state.lastSentAt, language)}). One reminder a day is the limit.`
                : isBn
                  ? 'দিনে একজনকে একবারই মনে করিয়ে দেওয়া যাবে।'
                  : 'One reminder per roommate per day.'}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
};

// A single "who owes whom" row with a settle action.
const DebtRow = ({ person, amount, kind, isBn, language, onSettle, onRemind }) => {
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
      {/* Only a creditor gets this: you can ask for what is owed to you, and
          the server enforces the same rule regardless of what the UI shows. */}
      {receive && onRemind && (
        <button
          onClick={onRemind}
          className="shrink-0 flex items-center gap-1.5 text-[12px] font-black px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 active:scale-95 transition hover:border-[#ba0036]/40 hover:text-[#ba0036]"
          aria-label={isBn ? 'মনে করিয়ে দিন' : 'Remind'}
        >
          <BellRing size={14} />
          {/* Icon-only on a phone — the row already carries an avatar, a name,
              an amount and the settle button. `sm` is a real breakpoint; `xs`
              is not defined in this project. */}
          <span className="hidden sm:inline">{isBn ? 'মনে করান' : 'Remind'}</span>
        </button>
      )}
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
  const bills = useLivingStore((s) => s.bills);
  const settlements = useLivingStore((s) => s.settlements);
  const connected = useLivingStore((s) => s.connected);
  const addSettlement = useLivingStore((s) => s.addSettlement);
  const deleteSettlement = useLivingStore((s) => s.deleteSettlement);
  const outbox = useLivingStore((s) => s.outbox);
  const pending = useMemo(() => pendingKeys(outbox), [outbox]);

  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [remindWho, setRemindWho] = useState(null);

  // Paid bills feed the ledger too (payer credited, split equally) — same as the Overview wallet.
  const net = useMemo(() => computeLedger({ expenses, groceries, meals, bills, settlements, roommates }), [expenses, groceries, meals, bills, settlements, roommates]);
  const debts = useMemo(() => simplifyDebts(net, roommates), [net, roommates]);
  const breakdown = useMemo(() => paymentBreakdown({ expenses, groceries, bills, roommates }), [expenses, groceries, bills, roommates]);
  const myContribution = useMemo(() => breakdown.rows.find((r) => r.id === me) || null, [breakdown, me]);

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
            {/* WHY they owe you, right where you are about to ask for it. The
                balance on its own is a number somebody can dispute; "you paid
                the ৳2,000 electricity bill" is the answer to the dispute, and
                it was previously buried in a card further down the page. */}
            {myContribution && myContribution.total > 0 && owedToMe.length > 0 && (
              <p className="text-[11.5px] font-semibold text-gray-500 leading-relaxed mb-2.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl px-3 py-2">
                {isBn ? 'আপনি দিয়েছেন ' : 'You paid '}
                <span className="font-black text-emerald-700">{taka(myContribution.total, language)}</span>
                {myContribution.cats.length > 0 && (
                  <>
                    {' — '}
                    {myContribution.cats.slice(0, 3).map((c, i) => {
                      const cat = getCategory(c.key);
                      return (
                        <span key={c.key}>
                          {i > 0 && ' · '}
                          {isBn ? cat.bn : cat.en} <span className="font-black text-gray-700">{taka(c.amount, language)}</span>
                        </span>
                      );
                    })}
                  </>
                )}
              </p>
            )}
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
                    // Only offered on a connected household: a reminder needs a
                    // server, a real member id and a phone number, none of which
                    // the on-device local planner has.
                    onRemind={connected ? () => setRemindWho(roommateById(roommates, d.from)) : null}
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

      {/* who paid what — transparent per-person / per-category breakdown */}
      {breakdown.grandTotal > 0 && (
        <Card className="p-4">
          <h3 className="text-[14px] font-black text-gray-900 tracking-tight mb-0.5 flex items-center gap-1.5">
            <Receipt size={15} className="text-[#ba0036]" /> {isBn ? 'কে কত পরিশোধ করেছে' : 'Who paid what'}
          </h3>
          <p className="text-[11px] font-semibold text-gray-400 mb-3">
            {isBn ? 'মোট পরিশোধ ' : 'Total paid out '}
            <span className="font-black text-gray-700">{taka(breakdown.grandTotal, language)}</span>
            {isBn ? ' · কোন খাতে কে দিয়েছে' : ' · by person & category'}
          </p>
          <div className="space-y-2.5">
            {breakdown.rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar roommate={row} size={34} />
                  <span className="flex-1 text-[13px] font-black text-gray-900 truncate">{row.isMe ? (isBn ? 'আপনি' : 'You') : row.name}</span>
                  <span className="text-[14px] font-black text-gray-900">{taka(row.total, language)}</span>
                </div>
                {row.cats.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {row.cats.map((c) => {
                      const cat = getCategory(c.key);
                      const CIcon = cat.icon;
                      return (
                        <span key={c.key} className={cx('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold', cat.tint, cat.text)}>
                          <CIcon size={11} /> {isBn ? cat.bn : cat.en} <span className="font-black">{taka(c.amount, language)}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] font-semibold text-gray-400 mt-1.5">{isBn ? 'এখনো কিছু পরিশোধ করেনি' : 'Nothing paid yet'}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
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
                  {pending.has(s.id) && <PendingChip isBn={isBn} className="shrink-0" />}
                  <span className="text-[13px] font-black text-emerald-600 shrink-0">{taka(s.amount, language)}</span>
                  <button onClick={() => setPendingDelete(s)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90 shrink-0" aria-label="delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SettleSheet open={open} onClose={() => setOpen(false)} roommates={roommates} preset={preset} onSave={addSettlement} />
      <RemindSheet
        open={!!remindWho}
        onClose={() => setRemindWho(null)}
        person={remindWho}
        isBn={isBn}
        language={language}
      />
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
