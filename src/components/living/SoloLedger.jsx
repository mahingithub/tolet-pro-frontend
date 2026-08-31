/**
 * SoloLedger — the two-sided খাতা of the solo wallet. One component drives both
 * tabs: `flow="out"` is the money-out page (খরচ, ধার দেওয়া, ধার শোধ) and
 * `flow="in"` is the money-in page (আয়, ধার নেওয়া, পাওনা ফেরত).
 *
 * Rows are grouped by day with a per-day total, which is how a paper খাতা is
 * read — and the header keeps খরচ and ধার apart, so a month where a lot of
 * money moved never reads as a month where a lot of money was spent.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { dateLabel, monthLabel, taka } from './livingUtils';
import { getMethod } from './livingConfig';
import {
  INCOME_CATEGORIES, INCOME_ORDER, SPEND_CATEGORIES, SPEND_ORDER,
  getEntryType, IN_TYPES, OUT_TYPES,
} from './soloConfig';
import { entriesOfFlow, groupByDay, monthEntries, soloSummary, toDateInput } from './soloUtils';
import { Card, Chip, ConfirmDialog, EmptyState, IconBadge, PrimaryButton, SectionHeader, cx } from './livingUI';
import SoloEntrySheet from './SoloEntrySheet';

// Day headings are computed in LOCAL time (toDateInput), so "আজ" flips at
// midnight here rather than at midnight UTC.
const dayHeading = (day, language) => {
  const isBn = language === 'বাংলা';
  if (day.key === toDateInput()) return isBn ? 'আজ' : 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day.key === toDateInput(y)) return isBn ? 'গতকাল' : 'Yesterday';
  return dateLabel(day.date, language);
};

const SoloLedger = ({ flow = 'out', language, intent, clearIntent }) => {
  const isBn = language === 'বাংলা';
  const solo = useLivingStore((s) => s.solo);
  const addSoloEntry = useLivingStore((s) => s.addSoloEntry);
  const updateSoloEntry = useLivingStore((s) => s.updateSoloEntry);
  const deleteSoloEntry = useLivingStore((s) => s.deleteSoloEntry);

  const [off, setOff] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [lockType, setLockType] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);

  // Quick actions from the Overview arrive as an intent: 'add' opens the sheet
  // on this side's default type, a type key opens it locked to that type.
  useEffect(() => {
    if (!intent) return;
    setEditing(null);
    setLockType(getEntryType(intent).key === intent ? intent : null);
    setOpen(true);
    clearIntent?.();
  }, [intent, clearIntent]);

  const summary = useMemo(() => soloSummary(solo, off), [solo, off]);

  const rows = useMemo(
    () => entriesOfFlow(monthEntries(solo.entries, off), flow),
    [solo.entries, off, flow]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter.startsWith('type:')) return rows.filter((e) => e.type === filter.slice(5));
    return rows.filter((e) => e.category === filter);
  }, [rows, filter]);

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  // Only offer filters that would actually return something.
  const table = flow === 'in' ? INCOME_CATEGORIES : SPEND_CATEGORIES;
  const order = flow === 'in' ? INCOME_ORDER : SPEND_ORDER;
  const usedCategories = useMemo(() => {
    const set = new Set(rows.filter((e) => e.category).map((e) => e.category));
    return order.filter((c) => set.has(c));
  }, [rows, order]);
  const usedTransfers = useMemo(() => {
    const types = (flow === 'in' ? IN_TYPES : OUT_TYPES).filter((k) => getEntryType(k).needsPerson);
    const set = new Set(rows.map((e) => e.type));
    return types.filter((tk) => set.has(tk));
  }, [rows, flow]);

  const main = flow === 'in' ? summary.earned : summary.spent;
  const transfers = flow === 'in' ? summary.borrowed + summary.gotBack : summary.lent + summary.paidBack;

  const openAdd = (type = null) => {
    setEditing(null);
    setLockType(type);
    setOpen(true);
  };

  const save = (data) => {
    if (editing) updateSoloEntry(editing.id, data);
    else addSoloEntry(data);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={flow === 'in' ? (isBn ? 'আয়ের খাতা' : 'Money In') : isBn ? 'খরচের খাতা' : 'Money Out'}
        subtitle={
          flow === 'in'
            ? isBn ? 'কোথা থেকে কত এসেছে' : 'What came in, and from where'
            : isBn ? 'কোন খাতে কত গেছে' : 'Where the money went'
        }
        right={
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition"
          >
            <Plus size={15} /> {isBn ? 'যোগ' : 'Add'}
          </button>
        }
      />

      {/* month picker */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOff((o) => o - 1)} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 active:scale-90 transition" aria-label={isBn ? 'আগের মাস' : 'Previous month'}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-[12px] font-black text-gray-700">{monthLabel(summary.ref, language)}</span>
        <button onClick={() => setOff((o) => Math.min(0, o + 1))} disabled={off === 0} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 active:scale-90 transition disabled:opacity-40" aria-label={isBn ? 'পরের মাস' : 'Next month'}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* the month at a glance — real spending kept apart from transfers */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            {flow === 'in' ? (isBn ? 'এ মাসের আয়' : 'Earned') : isBn ? 'এ মাসের খরচ' : 'Spent'}
          </p>
          <p className={cx('text-xl font-black tracking-tight mt-1.5', flow === 'in' ? 'text-emerald-600' : 'text-[#ba0036]')}>
            {taka(main, language)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isBn ? 'ধার-দেনা' : 'Lending'}</p>
          <p className="text-xl font-black text-gray-900 tracking-tight mt-1.5">{taka(transfers, language)}</p>
          <p className="text-[10.5px] font-semibold text-gray-400 mt-0.5">
            {flow === 'in' ? (isBn ? 'খরচ/আয়ের বাইরে' : 'Not income') : isBn ? 'খরচ হিসেবে ধরা হয়নি' : 'Not counted as spending'}
          </p>
        </Card>
      </div>

      {/* filters */}
      {(usedCategories.length > 0 || usedTransfers.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={isBn ? 'সব' : 'All'} />
          {usedCategories.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={isBn ? table[c].bn : table[c].en} />
          ))}
          {usedTransfers.map((tk) => (
            <FilterChip
              key={tk}
              active={filter === `type:${tk}`}
              onClick={() => setFilter(`type:${tk}`)}
              label={isBn ? getEntryType(tk).bn : getEntryType(tk).en}
            />
          ))}
        </div>
      )}

      {/* the ledger itself */}
      {days.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={flow === 'in' ? (isBn ? 'এ মাসে কিছু আসেনি' : 'Nothing came in this month') : isBn ? 'এ মাসে কোনো খরচ নেই' : 'No spending this month'}
            subtitle={
              isBn
                ? 'যখনই টাকা হাতবদল হয়, সাথে সাথে এখানে লিখে রাখুন — মাস শেষে আর মেলাতে হবে না।'
                : 'Jot it down the moment money moves — then nothing needs reconciling at month end.'
            }
            action={
              <PrimaryButton onClick={() => openAdd()}>
                <Plus size={16} /> {flow === 'in' ? (isBn ? 'আয় যোগ' : 'Add income') : isBn ? 'খরচ যোগ' : 'Add expense'}
              </PrimaryButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.key}>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">{dayHeading(day, language)}</span>
                <span className="text-[11px] font-black text-gray-500 tabular-nums">
                  {taka(flow === 'in' ? day.in : day.out, language)}
                </span>
              </div>
              <div className="space-y-2">
                {day.entries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    people={solo.people}
                    language={language}
                    onEdit={() => { setEditing(e); setLockType(null); setOpen(true); }}
                    onDelete={() => setPendingDelete(e)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <SoloEntrySheet
        open={open}
        onClose={() => { setOpen(false); setEditing(null); setLockType(null); }}
        flow={flow}
        editing={editing}
        lockType={editing ? null : lockType}
        onSave={save}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => deleteSoloEntry(pendingDelete.id)}
        title={isBn ? 'হিসাবটি মুছবেন?' : 'Delete this entry?'}
        message={isBn ? 'খাতা থেকে সারিটি স্থায়ীভাবে মুছে যাবে।' : 'This row will be removed from your ledger for good.'}
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

// ── one row of the খাতা ──────────────────────────────────────────────────────
const EntryRow = ({ entry, people, language, onEdit, onDelete }) => {
  const isBn = language === 'বাংলা';
  const type = getEntryType(entry.type);
  // A transfer is identified by its type (ধার দিলাম), a real খরচ/আয় by its
  // category (খাওয়া-দাওয়া) — that is the fastest way to read the list.
  const cat = entry.type === 'income' ? INCOME_CATEGORIES[entry.category] : SPEND_CATEGORIES[entry.category];
  const visual = type.needsPerson || !cat ? type : cat;
  const person = people.find((p) => p.id === entry.personId);
  const method = getMethod(entry.method);
  const label = entry.note?.trim() || (isBn ? visual.bn : visual.en);

  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <IconBadge icon={visual.icon} tint={visual.tint} text={visual.text} size={42} iconSize={19} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-black text-gray-900 truncate">{label}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Chip tint={type.tint} text={type.text}>{isBn ? type.bn : type.en}</Chip>
            {person && <span className="text-[11px] font-bold text-gray-500 truncate max-w-[110px]">{person.name}</span>}
            <span className="text-[11px] font-semibold text-gray-400">· {isBn ? method.bn : method.en}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <p className={cx('text-[15px] font-black tabular-nums', type.flow === 'in' ? 'text-emerald-600' : 'text-gray-900')}>
            {type.flow === 'in' ? '+' : '−'}{taka(entry.amount, language)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 -mb-1">
        <button onClick={onEdit} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition active:scale-90" aria-label={isBn ? 'এডিট' : 'Edit'}>
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition active:scale-90" aria-label={isBn ? 'মুছুন' : 'Delete'}>
          <Trash2 size={15} />
        </button>
      </div>
    </Card>
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

export const SoloSpending = (props) => <SoloLedger {...props} flow="out" />;
export const SoloIncome = (props) => <SoloLedger {...props} flow="in" />;

export default SoloLedger;
