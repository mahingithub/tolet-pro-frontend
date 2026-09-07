/**
 * ExpenseCategoryView — the shared খরচ list, read as a category ledger instead
 * of a running list.
 *
 * The list answers "কী কী খরচ হলো?". This one answers what roommates actually
 * argue about at month end: "কোন খাতে কত গেল, আর তার কতটা আমার?" One folder per
 * খাত, the month's total and your own share on its face, and every line filed
 * inside it — মাছ, চাল, ডিম — all under বাজার, never as three categories.
 *
 * A new kind of খরচ is a NOTE inside an existing খাত, not a new খাত, so each
 * folder carries its own "add another" button that opens the expense sheet with
 * the category already chosen.
 *
 * The drawer is `CategoryFolder` in livingUI, shared with the solo খাতা
 * (SoloCategoryView); what is written here is the joint line — who paid, who it
 * was split between, and what it left you owing.
 */
import React, { useMemo } from 'react';
import { Camera, Pencil, Trash2 } from 'lucide-react';

import { dateLabel, expenseShares, groupByCategory, num, roommateById, taka, toDateInput } from './livingUtils';
import { getCategory } from './livingConfig';
import {
  Avatar, AvatarStack, CategoryFolder, PendingDot, TodayTag, cx, todayRowTint, useOpenFolders,
} from './livingUI';

// ── one line inside a folder ────────────────────────────────────────────────
const ExpenseLine = ({ expense, roommates, me, language, pending, onEdit, onDelete }) => {
  const isBn = language === 'বাংলা';
  const payer = roommateById(roommates, expense.paidBy);
  const mine = expenseShares(expense, roommates)[me] || 0;
  const note = expense.note?.trim();
  const isToday = toDateInput(expense.date) === toDateInput();
  // Nearly every খরচ is split by the whole বাসা, so the faces only earn their
  // space on the line where it wasn't — that is the one worth a second look.
  const partial = expense.splitWith?.length > 0 && expense.splitWith.length < roommates.length;

  return (
    <div className={cx('flex items-center gap-2.5 px-3.5 py-2.5', isToday && todayRowTint)}>
      {/* the date column — this is the "কোন তারিখে" a category খাতা is read by */}
      <div className="w-[42px] shrink-0 text-center">
        <p className={cx('text-[11px] font-black tabular-nums leading-none', isToday ? 'text-[#ba0036]' : 'text-gray-500')}>
          {dateLabel(expense.date, language)}
        </p>
        {isToday && (
          <p className="text-[8.5px] font-black uppercase tracking-wider text-[#ba0036] mt-1">
            {isBn ? 'আজ' : 'Today'}
          </p>
        )}
      </div>

      {/* Tapping the line opens it for editing — that is how a note gets added
          to a row that was entered in a hurry with only an amount. */}
      <button onClick={onEdit} className="flex-1 min-w-0 text-left active:scale-[0.99] transition">
        <p className={cx('text-[12.5px] font-black truncate', note ? 'text-gray-900' : 'text-gray-400')}>
          {note || (isBn ? 'নোট লিখতে চাপুন' : 'Tap to add a note')}
        </p>
        {/* who paid, and who it was split between — the two things a shared
            line means that a solo one doesn't */}
        <div className="flex items-center gap-1.5 mt-1">
          {pending && <PendingDot isBn={isBn} />}
          <Avatar roommate={payer} size={16} ring={false} />
          <span className="text-[10.5px] font-semibold text-gray-400 truncate">
            {payer.isMe ? (isBn ? 'আপনি' : 'You') : payer.name} {isBn ? 'দিয়েছে' : 'paid'}
          </span>
          {partial && <AvatarStack roommates={roommates} ids={expense.splitWith} size={16} max={3} />}
          {expense.receipt && <Camera size={11} className="shrink-0 text-gray-300" />}
        </div>
      </button>

      <div className="text-right shrink-0">
        <p className="text-[13.5px] font-black text-gray-900 tabular-nums leading-none">{taka(expense.amount, language)}</p>
        <p className={cx('text-[10px] font-black tabular-nums mt-1', mine > 0 ? 'text-[#ba0036]' : 'text-gray-400')}>
          {isBn ? 'আপনার' : 'you'} {taka(mine, language)}
        </p>
      </div>

      <div className="flex items-center shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-900 hover:bg-gray-100 transition active:scale-90"
          aria-label={isBn ? 'এডিট' : 'Edit'}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-rose-50 transition active:scale-90"
          aria-label={isBn ? 'মুছুন' : 'Delete'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ── one folder ──────────────────────────────────────────────────────────────
const ExpenseFolder = ({ bucket, max, roommates, me, language, pending, open, onToggle, onAdd, onEdit, onDelete }) => {
  const isBn = language === 'বাংলা';
  const cat = getCategory(bucket.ref);
  const name = isBn ? cat.bn : cat.en;
  const hasToday = bucket.entries.some((e) => toDateInput(e.date) === toDateInput());
  // What this folder cost YOU — the group's total is the headline, but the
  // share is the number anyone opening this page came to find.
  const mine = useMemo(
    () => bucket.entries.reduce((s, e) => s + (expenseShares(e, roommates)[me] || 0), 0),
    [bucket.entries, roommates, me]
  );

  return (
    <CategoryFolder
      icon={cat.icon}
      tint={cat.tint}
      text={cat.text}
      hex={cat.hex}
      name={name}
      badge={hasToday && <TodayTag>{isBn ? 'আজ' : 'Today'}</TodayTag>}
      meta={
        isBn
          ? `${num(bucket.count, language)}টি খরচ · সর্বশেষ ${dateLabel(bucket.last, language)}`
          : `${bucket.count} ${bucket.count === 1 ? 'expense' : 'expenses'} · last ${dateLabel(bucket.last, language)}`
      }
      total={taka(bucket.total, language)}
      totalSub={
        <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">
          {num(Math.round(bucket.pct), language)}% ·{' '}
          <span className="text-[#ba0036]">{isBn ? 'আপনার' : 'you'} {taka(mine, language)}</span>
        </span>
      }
      value={bucket.total}
      max={max}
      open={open}
      onToggle={onToggle}
      onAdd={() => onAdd(cat.key)}
      addLabel={isBn ? `${name}-এ আরেকটি খরচ` : `Add to ${name.toLowerCase()}`}
    >
      {bucket.entries.map((e) => (
        <ExpenseLine
          key={e.id}
          expense={e}
          roommates={roommates}
          me={me}
          language={language}
          pending={pending?.has(e.id)}
          onEdit={() => onEdit(e)}
          onDelete={() => onDelete(e)}
        />
      ))}
    </CategoryFolder>
  );
};

/**
 * @param {object[]} expenses The month's shared expenses.
 * @param {Set} pending Rows written on this phone that haven't synced yet.
 * @param {(categoryKey) => void} onAdd Write another খরচ into that folder.
 */
const ExpenseCategoryView = ({
  expenses = [], roommates = [], me = 'me', language, pending, onAdd, onEdit, onDelete, resetKey,
}) => {
  const buckets = useMemo(() => groupByCategory(expenses), [expenses]);
  const max = buckets[0]?.total || 0;
  const [isOpen, toggle] = useOpenFolders(buckets, resetKey);

  return (
    <div className="space-y-2.5">
      {buckets.map((b) => (
        <ExpenseFolder
          key={b.key}
          bucket={b}
          max={max}
          roommates={roommates}
          me={me}
          language={language}
          pending={pending}
          open={isOpen(b.key)}
          onToggle={() => toggle(b.key)}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default ExpenseCategoryView;
