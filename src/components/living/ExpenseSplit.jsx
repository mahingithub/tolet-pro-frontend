import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Receipt, Trash2, Pencil, Camera, X, Check, Lock } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { expenseShares, taka, num, dateLabel, isSameMonth, roommateById } from './livingUtils';
import { CATEGORIES, CATEGORY_ORDER, EXPENSE_CATEGORY_ORDER, getCategory, SPLIT_TYPES } from './livingConfig';
import {
  Card, SectionHeader, IconBadge, Avatar, AvatarStack, Chip, PrimaryButton, GhostButton,
  Field, MoneyInput, TextArea, SegmentedControl, EmptyState, Sheet, ConfirmDialog, cx,
} from './livingUI';

const ROUND = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Re-seed split shares whenever mode / members / amount change.
function seedShares(type, members, amount, prev = {}) {
  if (!members.length) return {};
  if (type === 'percentage') {
    const each = ROUND(100 / members.length);
    const out = {};
    members.forEach((id, i) => (out[id] = prev[id] != null ? prev[id] : i === members.length - 1 ? ROUND(100 - each * (members.length - 1)) : each));
    return out;
  }
  if (type === 'custom') {
    const each = ROUND((Number(amount) || 0) / members.length);
    const out = {};
    members.forEach((id) => (out[id] = prev[id] != null ? prev[id] : each));
    return out;
  }
  return {};
}

const ExpenseSheet = ({ open, onClose, roommates, editing, onSave }) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('groceries');
  const [paidBy, setPaidBy] = useState('me');
  const [splitWith, setSplitWith] = useState(roommates.map((r) => r.id));
  const [splitType, setSplitType] = useState('equal');
  const [shares, setShares] = useState({});
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState(null);
  const fileRef = useRef(null);

  // (re)initialise the form when opened
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount ?? ''));
      setCategory(editing.category || 'other');
      setPaidBy(editing.paidBy || 'me');
      setSplitWith(editing.splitWith?.length ? editing.splitWith : roommates.map((r) => r.id));
      setSplitType(editing.splitType || 'equal');
      setShares(editing.shares || {});
      setNote(editing.note || '');
      setReceipt(editing.receipt || null);
    } else {
      setAmount('');
      setCategory('groceries');
      setPaidBy('me');
      setSplitWith(roommates.map((r) => r.id));
      setSplitType('equal');
      setShares({});
      setNote('');
      setReceipt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // keep shares consistent with mode/members/amount
  useEffect(() => {
    if (splitType === 'equal') return;
    setShares((prev) => seedShares(splitType, splitWith, amount, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, splitWith, amount]);

  const preview = useMemo(
    () => expenseShares({ amount, splitWith, splitType, shares }, roommates),
    [amount, splitWith, splitType, shares, roommates]
  );

  // Utilities live in the Bills tab, so they're not offered here. But if we're
  // editing an older expense saved under a utility category, keep it visible.
  const catOptions = EXPENSE_CATEGORY_ORDER.includes(category)
    ? EXPENSE_CATEGORY_ORDER
    : [category, ...EXPENSE_CATEGORY_ORDER];

  const toggleMember = (id) =>
    setSplitWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pctSum = splitWith.reduce((s, id) => s + (Number(shares[id]) || 0), 0);
  const customSum = splitWith.reduce((s, id) => s + (Number(shares[id]) || 0), 0);
  const amt = Number(amount) || 0;

  const invalid =
    !amt ||
    amt <= 0 ||
    !splitWith.length ||
    (splitType === 'percentage' && Math.abs(pctSum - 100) > 0.5) ||
    (splitType === 'custom' && Math.abs(customSum - amt) > 1);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setReceipt(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = () => {
    if (invalid) return;
    onSave({
      amount: amt,
      category,
      paidBy,
      splitWith,
      splitType,
      shares: splitType === 'equal' ? {} : shares,
      note: note.trim(),
      receipt,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? (isBn ? 'খরচ এডিট' : 'Edit Expense') : isBn ? 'নতুন খরচ' : 'New Expense'}
      subtitle={isBn ? 'শেয়ার্ড খরচ যোগ করুন' : 'Add a shared expense to split'}
      footer={
        <PrimaryButton className="w-full" onClick={submit} disabled={invalid}>
          <Check size={17} /> {editing ? (isBn ? 'আপডেট' : 'Update expense') : isBn ? 'খরচ যোগ করুন' : 'Add expense'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <Field label={isBn ? 'পরিমাণ' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>

        <Field label={isBn ? 'ক্যাটাগরি' : 'Category'}>
          <div className="grid grid-cols-4 gap-2">
            {catOptions.map((key) => {
              const c = CATEGORIES[key] || CATEGORIES.other;
              const Icon = c.icon;
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={cx(
                    'flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition active:scale-95',
                    active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-100 bg-gray-50'
                  )}
                >
                  <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', c.tint, c.text)}>
                    <Icon size={16} />
                  </span>
                  <span className="text-[10px] font-bold text-gray-600">{isBn ? c.bn : c.en}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] font-semibold text-gray-400 mt-2 leading-relaxed">
            {isBn
              ? 'বিদ্যুৎ, গ্যাস, পানি, ইন্টারনেট? সেগুলো "বিল" ট্যাবে যোগ করুন — তাহলে একই খরচ দুইবার হিসাব হবে না।'
              : 'Electricity, gas, water, internet? Add those in the Bills tab so the same cost isn’t counted twice.'}
          </p>
        </Field>

        <Field label={isBn ? 'কে দিয়েছে' : 'Paid By'}>
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {roommates.map((r) => {
              const active = paidBy === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPaidBy(r.id)}
                  className={cx(
                    'shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition active:scale-95',
                    active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-white'
                  )}
                >
                  <Avatar roommate={r} size={28} />
                  <span className="text-[12px] font-bold text-gray-700">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={`${isBn ? 'ভাগ হবে' : 'Split With'} (${splitWith.length})`}>
          <div className="flex flex-wrap gap-2">
            {roommates.map((r) => {
              const active = splitWith.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleMember(r.id)}
                  className={cx(
                    'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border transition active:scale-95',
                    active ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white opacity-60'
                  )}
                >
                  <Avatar roommate={r} size={24} />
                  <span className="text-[11px] font-bold text-gray-700">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                  {active && <Check size={12} className="text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={isBn ? 'ভাগের ধরন' : 'Split Type'}>
          <SegmentedControl
            value={splitType}
            onChange={setSplitType}
            options={[
              { value: 'equal', label: isBn ? SPLIT_TYPES.equal.bn : SPLIT_TYPES.equal.en },
              { value: 'percentage', label: isBn ? SPLIT_TYPES.percentage.bn : SPLIT_TYPES.percentage.en },
              { value: 'custom', label: isBn ? SPLIT_TYPES.custom.bn : SPLIT_TYPES.custom.en },
            ]}
          />
        </Field>

        {/* split editor / preview */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
          {splitWith.length === 0 && <p className="text-[12px] font-semibold text-gray-400 text-center py-2">{isBn ? 'অন্তত একজন নির্বাচন করুন' : 'Select at least one person'}</p>}
          {splitWith.map((id) => {
            const r = roommates.find((x) => x.id === id);
            if (!r) return null;
            return (
              <div key={id} className="flex items-center gap-2.5">
                <Avatar roommate={r} size={26} />
                <span className="text-[12px] font-bold text-gray-700 flex-1 truncate">{r.isMe ? (isBn ? 'আপনি' : 'You') : r.name}</span>
                {splitType === 'equal' && <span className="text-[13px] font-black text-gray-900">{taka(preview[id] || 0)}</span>}
                {splitType === 'percentage' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={shares[id] ?? ''}
                      onChange={(e) => setShares((p) => ({ ...p, [id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] font-bold text-right focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30"
                    />
                    <span className="text-[12px] font-black text-gray-400 w-4">%</span>
                    <span className="text-[12px] font-black text-gray-900 w-16 text-right">{taka(preview[id] || 0)}</span>
                  </div>
                )}
                {splitType === 'custom' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-black text-gray-400">৳</span>
                    <input
                      type="number"
                      value={shares[id] ?? ''}
                      onChange={(e) => setShares((p) => ({ ...p, [id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] font-bold text-right focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30"
                    />
                  </div>
                )}
              </div>
            );
          })}
          {splitType === 'percentage' && splitWith.length > 0 && (
            <p className={cx('text-[11px] font-black text-right', Math.abs(pctSum - 100) > 0.5 ? 'text-red-600' : 'text-emerald-600')}>
              {isBn ? 'মোট' : 'Total'}: {num(pctSum)}% {Math.abs(pctSum - 100) > 0.5 ? `(${isBn ? '১০০% হতে হবে' : 'must be 100%'})` : '✓'}
            </p>
          )}
          {splitType === 'custom' && splitWith.length > 0 && (
            <p className={cx('text-[11px] font-black text-right', Math.abs(customSum - amt) > 1 ? 'text-red-600' : 'text-emerald-600')}>
              {isBn ? 'মোট' : 'Total'}: {taka(customSum)} / {taka(amt)} {Math.abs(customSum - amt) > 1 ? '' : '✓'}
            </p>
          )}
        </div>

        <Field label={isBn ? 'নোট' : 'Notes'}>
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'যেমন: সাপ্তাহিক বাজার' : 'e.g. Weekly bazaar'} />
        </Field>

        <Field label={isBn ? 'রসিদ' : 'Receipt'}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {receipt ? (
            <div className="relative inline-block">
              <img src={receipt} alt="receipt" className="w-24 h-24 object-cover rounded-2xl border border-gray-200" />
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center shadow"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-[13px] font-bold hover:border-[#ba0036]/40 hover:text-[#ba0036] transition w-full justify-center"
            >
              <Camera size={16} /> {isBn ? 'রসিদ আপলোড' : 'Upload receipt'}
            </button>
          )}
        </Field>
      </div>
    </Sheet>
  );
};

const ExpenseSplit = ({ me, language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const roommates = useLivingStore((s) => s.roommates);
  const connected = useLivingStore((s) => s.connected);
  const isOwner = useLivingStore((s) => s.isOwner);
  const expenses = useLivingStore((s) => s.expenses);
  const addExpense = useLivingStore((s) => s.addExpense);
  const updateExpense = useLivingStore((s) => s.updateExpense);
  const deleteExpense = useLivingStore((s) => s.deleteExpense);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (intent === 'add') {
      setEditing(null);
      setOpen(true);
      clearIntent?.();
    }
  }, [intent, clearIntent]);

  const sorted = useMemo(() => [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)), [expenses]);
  const filtered = filter === 'all' ? sorted : sorted.filter((e) => e.category === filter);

  const monthTotal = useMemo(
    () => expenses.filter((e) => isSameMonth(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses]
  );
  const myMonthShare = useMemo(
    () =>
      expenses
        .filter((e) => isSameMonth(e.date))
        .reduce((s, e) => s + (expenseShares(e, roommates)[me] || 0), 0),
    [expenses, roommates, me]
  );

  const usedCategories = useMemo(() => {
    const set = new Set(expenses.map((e) => e.category));
    return CATEGORY_ORDER.filter((c) => set.has(c));
  }, [expenses]);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (exp) => {
    setEditing(exp);
    setOpen(true);
  };
  const handleSave = (data) => {
    if (editing) updateExpense(editing.id, data);
    else addExpense(data);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'খরচ ভাগাভাগি' : 'Expense Split'}
        subtitle={isBn ? 'শেয়ার্ড খরচ যোগ ও ভাগ করুন' : 'Add and split shared expenses'}
        right={
          <button onClick={openAdd} className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition">
            <Plus size={15} /> {isBn ? 'যোগ' : 'Add'}
          </button>
        }
      />

      {/* summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'এ মাসে মোট' : 'This month'}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1">{taka(monthTotal, language)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'আপনার ভাগ' : 'Your share'}</p>
          <p className="text-xl font-black text-[#ba0036] tracking-tight mt-1">{taka(myMonthShare, language)}</p>
        </Card>
      </div>

      {/* category filter */}
      {usedCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={isBn ? 'সব' : 'All'} />
          {usedCategories.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={isBn ? CATEGORIES[c].bn : CATEGORIES[c].en} />
          ))}
        </div>
      )}

      {/* list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={isBn ? 'কোনো খরচ নেই' : 'No expenses yet'}
            subtitle={isBn ? 'প্রথম শেয়ার্ড খরচ যোগ করুন' : 'Add your first shared expense to start splitting'}
            action={<PrimaryButton onClick={openAdd}><Plus size={16} /> {isBn ? 'খরচ যোগ' : 'Add expense'}</PrimaryButton>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => {
            const c = getCategory(e.category);
            const Icon = c.icon;
            const payer = roommates.find((r) => r.id === e.paidBy);
            const myShare = expenseShares(e, roommates)[me] || 0;
            // The person who added an expense may edit/delete it — and so can
            // the household manager (owner), who has full access to everything.
            const editable = !connected || !e.createdBy || e.createdBy === me || isOwner;
            const creator = roommateById(roommates, e.createdBy || me);
            return (
              <Card key={e.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <IconBadge icon={Icon} tint={c.tint} text={c.text} size={44} iconSize={20} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-black text-gray-900 truncate">{e.note || (isBn ? c.bn : c.en)}</p>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      {payer?.isMe ? (isBn ? 'আপনি' : 'You') : payer?.name} {isBn ? 'দিয়েছে' : 'paid'} · {dateLabel(e.date, language)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-black text-gray-900">{taka(e.amount, language)}</p>
                    <p className={cx('text-[10.5px] font-black', myShare > 0 ? 'text-[#ba0036]' : 'text-gray-400')}>
                      {isBn ? 'আপনার' : 'you'}: {taka(myShare, language)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pl-1">
                  <div className="flex items-center gap-2">
                    <AvatarStack roommates={roommates} ids={e.splitWith} size={24} />
                    <Chip tint="bg-gray-100" text="text-gray-500">{SPLIT_TYPES[e.splitType]?.[isBn ? 'bn' : 'en'] || e.splitType}</Chip>
                    {e.receipt && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400">
                        <Camera size={12} /> {isBn ? 'রসিদ' : 'Receipt'}
                      </span>
                    )}
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(e)} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition active:scale-90" aria-label="edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setPendingDelete(e)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label="delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-gray-400">
                      <Lock size={12} /> {isBn ? `শুধু ${creator.name}` : `Only ${creator.name}`}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ExpenseSheet open={open} onClose={() => setOpen(false)} roommates={roommates} editing={editing} onSave={handleSave} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteExpense(pendingDelete.id)}
        title={isBn ? 'খরচটি মুছবেন?' : 'Delete this expense?'}
        message={isBn ? 'এটি স্থায়ীভাবে মুছে যাবে, ফেরানো যাবে না।' : "This expense will be permanently removed. This can't be undone."}
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

const FilterChip = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={cx(
      'shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-black transition border active:scale-95',
      active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
    )}
  >
    {label}
  </button>
);

export default ExpenseSplit;
