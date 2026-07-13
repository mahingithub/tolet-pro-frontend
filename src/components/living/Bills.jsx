import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Bell, Check, CircleDollarSign, RotateCcw, CalendarClock, Pencil, Trash2, Lock, Info, Users, HandCoins } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { taka, num, dateLabel, daysUntil, deriveBillStatus, billPaid, isSameMonth, roommateById } from './livingUtils';
import { BILL_TYPES, BILL_ORDER, getBillType, BILL_STATUS } from './livingConfig';
import { Card, SectionHeader, IconBadge, Avatar, Chip, Toggle, ProgressBar, PrimaryButton, Field, MoneyInput, Sheet, ConfirmDialog, cx } from './livingUI';

const todayInput = () => new Date().toISOString().slice(0, 10);

// ── Add / Edit bill sheet ──────────────────────────────────────────────────
const BillSheet = ({ open, onClose, editing, onSave, roommates = [], myId = 'me', language }) => {
  const isBn = language === 'বাংলা';
  const [type, setType] = useState('electricity');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(todayInput());
  const [reminder, setReminder] = useState(true);
  const [paidBy, setPaidBy] = useState(myId);
  const [recurring, setRecurring] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type || 'electricity');
      setAmount(String(editing.amount ?? ''));
      setDue(new Date(editing.dueDate).toISOString().slice(0, 10));
      setReminder(editing.reminder !== false);
      setPaidBy(editing.paidBy || editing.createdBy || myId);
      setRecurring(!!editing.recurring);
      setAlreadyPaid(editing.status === 'paid');
    } else {
      setType('electricity');
      setAmount('');
      setDue(todayInput());
      setReminder(true);
      setPaidBy(myId);
      setRecurring(false);
      setAlreadyPaid(false);
    }
  }, [open, editing, myId]);

  const amt = Number(amount) || 0;
  const memberCount = Math.max(1, roommates.length);
  const share = amt / memberCount;
  const dueDay = new Date(due + 'T12:00:00').getDate();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? (isBn ? 'বিল এডিট' : 'Edit Bill') : isBn ? 'নতুন বিল' : 'Add Bill'}
      subtitle={isBn ? 'মাসিক ইউটিলিটি বিল ট্র্যাক করুন' : 'Track a monthly utility bill'}
      footer={
        <PrimaryButton
          className="w-full"
          disabled={amt <= 0}
          onClick={() => {
            onSave({
              type,
              amount: amt,
              dueDate: new Date(due + 'T12:00:00').toISOString(),
              reminder,
              paidBy,
              recurring,
              status: alreadyPaid ? 'paid' : 'unpaid',
            });
            onClose();
          }}
        >
          <Check size={17} /> {editing ? (isBn ? 'আপডেট করুন' : 'Update bill') : isBn ? 'বিল যোগ করুন' : 'Add bill'}
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

        <Field label={isBn ? 'পরিমাণ (মোট বিল)' : 'Amount (total bill)'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>

        {/* Live equal-split hint — "your share is X". */}
        {amt > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 -mt-1">
            <Users size={15} className="text-emerald-600 shrink-0" />
            <p className="text-[12px] font-bold text-emerald-700">
              {isBn
                ? `${num(memberCount, language)} জনে সমান ভাগ · আপনার ভাগ ${taka(share, language)}`
                : `Split ${num(memberCount, language)} ways · your share ${taka(share, language)}`}
            </p>
          </div>
        )}

        {/* Paid by — who fronts the money (feeds balances once paid). */}
        <Field label={isBn ? 'কে পরিশোধ করছেন' : 'Paid by'} hint={isBn ? 'পরিশোধ হলে বাকিরা এই জনকে তাদের ভাগ ফেরত দেবে।' : 'Once paid, everyone reimburses this person their share.'}>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {roommates.map((r) => {
              const active = paidBy === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPaidBy(r.id)}
                  className={cx('flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border shrink-0 transition active:scale-95', active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-gray-50')}
                >
                  <Avatar roommate={r} size={24} />
                  <span className={cx('text-[12px] font-bold whitespace-nowrap', active ? 'text-[#ba0036]' : 'text-gray-600')}>
                    {r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={isBn ? 'শেষ তারিখ' : 'Due date'}>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30"
          />
        </Field>

        {/* Recurring monthly bill (WiFi / electricity / water). */}
        <div>
          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-bold text-gray-700">
              <RotateCcw size={16} className="text-gray-400" /> {isBn ? 'প্রতি মাসে অটো-রিপিট' : 'Repeat every month'}
            </span>
            <Toggle checked={recurring} onChange={setRecurring} label="recurring" />
          </div>
          {recurring && (
            <p className="text-[11px] font-semibold text-violet-600 mt-1.5 px-1 flex items-center gap-1.5">
              <CalendarClock size={12} />
              {isBn
                ? `প্রতি মাসের ${num(dueDay, language)} তারিখে নতুন বিল অটো তৈরি হবে।`
                : `A new bill is auto-created on day ${dueDay} of every month.`}
            </p>
          )}
        </div>

        {/* Already paid — one-step "I added it and I've paid it". */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-bold text-gray-700">
            <CircleDollarSign size={16} className="text-gray-400" /> {isBn ? 'এটি ইতিমধ্যে পরিশোধ করা হয়েছে' : 'Already paid'}
          </span>
          <Toggle checked={alreadyPaid} onChange={setAlreadyPaid} label="already paid" />
        </div>

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

// ── Pay sheet — Full / Half(partial) payment ────────────────────────────────
const PayBillSheet = ({ open, onClose, bill, memberCount, language, onPay }) => {
  const isBn = language === 'বাংলা';
  const total = Number(bill?.amount) || 0;
  const already = billPaid(bill);
  const share = total / Math.max(1, memberCount);
  const remaining = Math.max(0, total - already);
  const [mode, setMode] = useState('full'); // 'full' | 'half'
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('full');
    // Default the partial amount to the user's share (or the remaining balance
    // if that's smaller) — "the specific amount paid (i.e. the user's share)".
    setAmount(String(Math.round(Math.min(share, remaining || share))));
  }, [open, bill]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = bill ? getBillType(bill.type) : null;
  const amt = mode === 'full' ? total : Number(amount) || 0;
  const invalid = amt <= 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBn ? 'বিল পরিশোধ' : 'Pay Bill'}
      subtitle={bill ? `${isBn ? meta.bn : meta.en} · ${taka(total, language)}` : ''}
      footer={
        <PrimaryButton className="w-full" disabled={invalid} onClick={() => { onPay(amt); onClose(); }}>
          <Check size={17} /> {isBn ? `পরিশোধ নিশ্চিত ${taka(amt, language)}` : `Confirm payment · ${taka(amt, language)}`}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center justify-between rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'মোট বিল' : 'Total bill'}</p>
            <p className="text-[15px] font-black text-gray-900">{taka(total, language)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'আপনার ভাগ' : 'Your share'}</p>
            <p className="text-[15px] font-black text-gray-900">{taka(share, language)}</p>
          </div>
        </div>

        {already > 0 && (
          <p className="text-[11px] font-bold text-blue-600 -mt-1 px-1">
            {isBn ? `ইতিমধ্যে পরিশোধ ${taka(already, language)} · বাকি ${taka(remaining, language)}` : `Already paid ${taka(already, language)} · ${taka(remaining, language)} left`}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setMode('full')}
            className={cx('flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left transition active:scale-[0.98]', mode === 'full' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50')}
          >
            <CircleDollarSign size={18} className={mode === 'full' ? 'text-emerald-600' : 'text-gray-400'} />
            <span className={cx('text-[13px] font-black', mode === 'full' ? 'text-emerald-700' : 'text-gray-700')}>{isBn ? 'সম্পূর্ণ' : 'Full Payment'}</span>
            <span className="text-[11px] font-bold text-gray-400">{taka(total, language)}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('half')}
            className={cx('flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left transition active:scale-[0.98]', mode === 'half' ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-gray-50')}
          >
            <HandCoins size={18} className={mode === 'half' ? 'text-[#ba0036]' : 'text-gray-400'} />
            <span className={cx('text-[13px] font-black', mode === 'half' ? 'text-[#ba0036]' : 'text-gray-700')}>{isBn ? 'আংশিক / অর্ধেক' : 'Half / Partial'}</span>
            <span className="text-[11px] font-bold text-gray-400">{isBn ? 'নিজের পরিমাণ' : 'enter amount'}</span>
          </button>
        </div>

        {mode === 'half' && (
          <Field label={isBn ? 'যত টাকা পরিশোধ করলেন (আপনার ভাগ)' : 'Amount paid (your share)'} hint={isBn ? 'এখন কত টাকা দিলেন লিখুন — বাকিটা পরে পরিশোধ করা যাবে।' : 'Enter how much is paid now — the rest can be paid later.'}>
            <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={() => setAmount(String(Math.round(share)))} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-black active:scale-95 transition">
                {isBn ? 'আমার ভাগ' : 'My share'} {taka(share, language)}
              </button>
              <button type="button" onClick={() => setAmount(String(Math.round(total / 2)))} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-black active:scale-95 transition">
                {isBn ? 'অর্ধেক' : 'Half'} {taka(total / 2, language)}
              </button>
              {remaining > 0 && remaining !== total && (
                <button type="button" onClick={() => setAmount(String(Math.round(remaining)))} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-black active:scale-95 transition">
                  {isBn ? 'বাকিটা' : 'Remaining'} {taka(remaining, language)}
                </button>
              )}
            </div>
          </Field>
        )}
      </div>
    </Sheet>
  );
};

const Bills = ({ language }) => {
  const isBn = language === 'বাংলা';
  const bills = useLivingStore((s) => s.bills);
  const roommates = useLivingStore((s) => s.roommates);
  const connected = useLivingStore((s) => s.connected);
  const myId = useLivingStore((s) => s.myId);
  const isOwner = useLivingStore((s) => s.isOwner);
  const addBill = useLivingStore((s) => s.addBill);
  const updateBill = useLivingStore((s) => s.updateBill);
  const deleteBill = useLivingStore((s) => s.deleteBill);
  const payBill = useLivingStore((s) => s.payBill);
  const markBillUnpaid = useLivingStore((s) => s.markBillUnpaid);
  const toggleBillReminder = useLivingStore((s) => s.toggleBillReminder);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const memberCount = Math.max(1, roommates.length);

  const sorted = useMemo(() => {
    const rank = { overdue: 0, 'due-soon': 1, partial: 2, unpaid: 3, paid: 4 };
    return [...bills].sort((a, b) => {
      const ra = rank[deriveBillStatus(a)] ?? 3;
      const rb = rank[deriveBillStatus(b)] ?? 3;
      if (ra !== rb) return ra - rb;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [bills]);

  // Paid = sum of what's actually been paid this month (incl. partial);
  // Due = the remaining balance on each bill.
  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    bills.filter((b) => isSameMonth(b.dueDate)).forEach((b) => {
      const p = billPaid(b);
      paid += p;
      due += Math.max(0, (Number(b.amount) || 0) - p);
    });
    return { due, paid };
  }, [bills]);

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (bill) => { setEditing(bill); setOpen(true); };
  const openPay = (bill) => setPaying(bill);
  const handleSave = (data) => {
    if (editing) { updateBill(editing.id, data); return; }
    addBill({ ...data, paidDate: data.status === 'paid' ? new Date().toISOString() : null });
  };

  // Ownership: in the connected (shared) wallet only the person who added a
  // bill may change it — EXCEPT the household manager (owner), who has full
  // access to every entry. The local planner (single device) has no restriction.
  const canEdit = (b) => !connected || !b.createdBy || b.createdBy === myId || isOwner;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'বিল' : 'Bills'}
        subtitle={isBn ? 'মাসিক বিল ও পেমেন্ট রিমাইন্ডার' : 'Monthly bills & payment reminders'}
        right={
          <button onClick={openAdd} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <Plus size={15} /> {isBn ? 'যোগ' : 'Add'}
          </button>
        }
      />

      {/* how it works */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-blue-50 border border-blue-100 p-3">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11.5px] font-semibold text-blue-700 leading-relaxed">
          {isBn ? (
            <>মোট বিল <b>{num(memberCount, language)} জন</b>-এর মধ্যে সমান ভাগ হয়। বিল <b>পরিশোধ</b> করলে যিনি দিয়েছেন তিনি সবার কাছ থেকে তার ভাগ ফেরত পাবেন — এটি <b>ব্যালেন্স</b>-এ যোগ হয়। WiFi/কারেন্টের মতো বিলে <b>অটো-রিপিট</b> চালু করলে প্রতি মাসে নিজে থেকেই তৈরি হবে।</>
          ) : (
            <>Each bill splits <b>equally among {num(memberCount, language)} roommates</b>. Mark a bill <b>paid</b> and the payer is reimbursed their share by everyone — it shows up in <b>Balances</b>. Turn on <b>Repeat monthly</b> for bills like WiFi so they’re created automatically each month.</>
          )}
        </p>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-amber-600"><CalendarClock size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'বাকি (এ মাস)' : 'Due this month'}</span></div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(totals.due, language)}</p>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">≈ {taka(totals.due / memberCount, language)} {isBn ? 'জনপ্রতি' : 'each'}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-emerald-600"><Check size={14} /><span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'পরিশোধিত' : 'Paid'}</span></div>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(totals.paid, language)}</p>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">{isBn ? 'এ মাসে' : 'this month'}</p>
        </Card>
      </div>

      {/* list */}
      <div className="space-y-2.5">
        {sorted.map((b) => {
          const meta = getBillType(b.type);
          const Icon = meta.icon;
          const st = deriveBillStatus(b);
          const stMeta = BILL_STATUS[st];
          const d = daysUntil(b.dueDate);
          const fullyPaid = st === 'paid';
          const partly = st === 'partial';
          const paid = billPaid(b);
          const remaining = Math.max(0, (Number(b.amount) || 0) - paid);
          const editable = canEdit(b);
          const creator = roommateById(roommates, b.createdBy || myId);
          const payerId = b.paidBy || b.createdBy || myId;
          const payer = roommateById(roommates, payerId);
          const iPaid = payerId === myId;
          const share = (Number(b.amount) || 0) / memberCount;
          return (
            <Card key={b.id} className="p-4">
              <div className="flex items-center gap-3.5">
                <IconBadge icon={Icon} tint={meta.tint} text={meta.text} size={46} iconSize={21} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-black text-gray-900">{isBn ? meta.bn : meta.en}</p>
                    <Chip tint={stMeta.tint} text={stMeta.text}>{isBn ? stMeta.bn : stMeta.en}</Chip>
                    {b.recurring && (
                      <Chip tint="bg-violet-50" text="text-violet-600"><RotateCcw size={10} /> {isBn ? 'মাসিক' : 'Monthly'}</Chip>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                    {fullyPaid
                      ? isBn ? `${dateLabel(b.paidDate || b.dueDate, language)} এ পরিশোধ` : `Paid on ${dateLabel(b.paidDate || b.dueDate, language)}`
                      : partly
                      ? isBn ? `আংশিক · শেষ তারিখ ${dateLabel(b.dueDate, language)}` : `Partly paid · due ${dateLabel(b.dueDate, language)}`
                      : d < 0
                      ? isBn ? `শেষ তারিখ ${dateLabel(b.dueDate, language)} · ${num(Math.abs(d), language)} দিন পার` : `Due ${dateLabel(b.dueDate, language)} · ${Math.abs(d)}d overdue`
                      : isBn ? `শেষ তারিখ ${dateLabel(b.dueDate, language)}` : `Due ${dateLabel(b.dueDate, language)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[16px] font-black text-gray-900 leading-tight">{taka(b.amount, language)}</p>
                  <p className="text-[10.5px] font-bold text-gray-400">{taka(share, language)} {isBn ? 'জনপ্রতি' : 'each'}</p>
                </div>
              </div>

              {/* who paid + what it means for me (transparent per-bill breakdown) */}
              {fullyPaid || partly ? (
                <div className="mt-2.5 pl-0.5 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar roommate={payer} size={22} />
                      <span className="text-[11px] font-semibold text-gray-500">
                        {isBn ? 'পরিশোধ করেছে' : 'Paid by'}{' '}
                        <span className="font-black text-gray-700">{payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name}</span>
                      </span>
                    </span>
                    <span className="text-gray-300">·</span>
                    {iPaid ? (
                      <span className="text-[11px] font-black text-emerald-600">
                        {isBn ? `ফেরত পাবেন ${taka(Math.max(0, paid - share), language)}` : `You get back ${taka(Math.max(0, paid - share), language)}`}
                      </span>
                    ) : fullyPaid ? (
                      <span className="text-[11px] font-black text-[#ba0036]">
                        {isBn ? `আপনি দিবেন ${taka(share, language)}` : `You owe ${taka(share, language)}`}
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-gray-600">
                        {isBn ? `আপনার ভাগ ${taka(share, language)}` : `Your share ${taka(share, language)}`}
                      </span>
                    )}
                  </div>
                  {partly && (
                    <div>
                      <div className="flex items-center justify-between text-[10.5px] font-bold mb-1">
                        <span className="text-blue-600">{isBn ? 'আংশিক পরিশোধ' : 'Partly paid'}</span>
                        <span className="text-gray-500">
                          {taka(paid, language)} / {taka(b.amount, language)} · {isBn ? 'বাকি' : 'left'} {taka(remaining, language)}
                        </span>
                      </div>
                      <ProgressBar value={paid} max={Number(b.amount) || 0} color="#3b82f6" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap mt-2.5 pl-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar roommate={creator} size={22} />
                    <span className="text-[11px] font-semibold text-gray-500">
                      {isBn ? 'যোগ করেছে' : 'Added by'}{' '}
                      <span className="font-black text-gray-700">{creator.isMe ? (isBn ? 'আপনি' : 'You') : creator.name}</span>
                    </span>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400">
                    <Users size={12} /> {num(memberCount, language)} {isBn ? 'জন' : 'people'}
                  </span>
                </div>
              )}

              {/* actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                {editable ? (
                  <>
                    <button
                      onClick={() => toggleBillReminder(b.id)}
                      className={cx('flex items-center gap-1.5 text-[11px] font-black transition', b.reminder ? 'text-[#ba0036]' : 'text-gray-400')}
                    >
                      <Bell size={14} className={b.reminder ? 'fill-[#ba0036]/20' : ''} />
                      {b.reminder ? (isBn ? 'রিমাইন্ডার চালু' : 'Reminder on') : (isBn ? 'রিমাইন্ডার বন্ধ' : 'Reminder off')}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition active:scale-90" aria-label="edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setPendingDelete(b)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                        <Trash2 size={15} />
                      </button>
                      {paid > 0 && (
                        <button onClick={() => markBillUnpaid(b.id)} className="flex items-center gap-1.5 text-[12px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:scale-95 transition ml-1">
                          <RotateCcw size={13} /> {isBn ? 'বাকি' : 'Unpay'}
                        </button>
                      )}
                      {!fullyPaid && (
                        <button onClick={() => openPay(b)} className="flex items-center gap-1.5 text-[12px] font-black text-white bg-emerald-600 px-3.5 py-1.5 rounded-lg shadow-[0_6px_16px_-6px_rgba(16,133,83,0.6)] active:scale-95 transition ml-1">
                          <CircleDollarSign size={14} /> {isBn ? (partly ? 'বাকি পরিশোধ' : 'পরিশোধ') : 'Pay'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                    <Lock size={13} />
                    {isBn ? `শুধু ${creator.name} এডিট করতে পারবে` : `Only ${creator.name} can edit this`}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <BillSheet open={open} onClose={() => setOpen(false)} editing={editing} onSave={handleSave} roommates={roommates} myId={myId} language={language} />
      <PayBillSheet open={!!paying} onClose={() => setPaying(null)} bill={paying} memberCount={memberCount} language={language} onPay={(amt) => { if (paying) payBill(paying.id, amt); }} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteBill(pendingDelete.id)}
        title={isBn ? 'বিলটি মুছবেন?' : 'Delete this bill?'}
        message={isBn ? 'এই বিলটি স্থায়ীভাবে মুছে যাবে, ফেরানো যাবে না।' : "This bill will be permanently removed. This can't be undone."}
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

export default Bills;
