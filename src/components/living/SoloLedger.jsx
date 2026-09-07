/**
 * SoloLedger — the two-sided খাতা of the solo wallet. One component drives both
 * tabs: `flow="out"` is the money-out page (খরচ, ধার দেওয়া, ধার শোধ) and
 * `flow="in"` is the money-in page (আয়, ধার নেওয়া, পাওনা ফেরত).
 *
 * Rows can be read two ways, because two different questions get asked of the
 * same খাতা: `view="day"` groups them by day with a per-day total (what a paper
 * খাতা looks like), `view="category"` groups them by খাত with every line filed
 * inside it (how people actually track where the money goes). The header keeps
 * খরচ and ধার apart in both, so a month where a lot of money moved never reads
 * as a month where a lot of money was spent.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Layers, Pencil, Plus, Trash2, Wallet } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { dateLabel, taka } from './livingUtils';
import { getMethod } from './livingConfig';
import {
  INCOME_ORDER, SPEND_ORDER, categoryOfFlow, getEntryType, getIncomeCategory,
  getSpendCategory, isCustomCategory, IN_TYPES, OUT_TYPES,
} from './soloConfig';
import {
  entriesOfFlow, groupByDay, isEarning, isSpending, monthEntries, monthSpan,
  soloSummary, toDateInput,
} from './soloUtils';
import {
  Card, Chip, ConfirmDialog, EmptyState, IconBadge, MonthStrip, PrimaryButton,
  SectionHeader, SegmentedControl, cx, rememberView, rememberedView,
} from './livingUI';
import SoloCategoryView from './SoloCategoryView';
import SoloEntrySheet from './SoloEntrySheet';

// Which way the খাতা was last read — a habit, not a setting (see rememberedView).
const VIEW_KEY = 'tp:solo-ledger-view';
const readView = () => rememberedView(VIEW_KEY, ['day', 'category'], 'day');

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
  const [view, setView] = useState(readView);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [lockType, setLockType] = useState(null);
  const [presetCategory, setPresetCategory] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);

  // Quick actions from the Overview arrive as an intent: 'add' opens the sheet
  // on this side's default type, a type key opens it locked to that type.
  useEffect(() => {
    if (!intent) return;
    setEditing(null);
    setLockType(getEntryType(intent).key === intent ? intent : null);
    setPresetCategory(null);
    setOpen(true);
    clearIntent?.();
  }, [intent, clearIntent]);

  const pickView = (next) => {
    setView(next);
    // The খাত folders ARE the filter, so a chip left on from the day view would
    // silently hide most of them.
    if (next === 'category') setFilter('all');
    rememberView(VIEW_KEY, next);
  };

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

  // Only offer filters that would actually return something. The defaults keep
  // their canonical order; the খাত the user made themselves follow after them.
  const order = flow === 'in' ? INCOME_ORDER : SPEND_ORDER;
  const usedCategories = useMemo(() => {
    const set = new Set(rows.filter((e) => e.category).map((e) => e.category));
    return [...order.filter((c) => set.has(c)), ...[...set].filter(isCustomCategory)];
  }, [rows, order]);
  const usedTransfers = useMemo(() => {
    const types = (flow === 'in' ? IN_TYPES : OUT_TYPES).filter((k) => getEntryType(k).needsPerson);
    const set = new Set(rows.map((e) => e.type));
    return types.filter((tk) => set.has(tk));
  }, [rows, flow]);

  const main = flow === 'in' ? summary.earned : summary.spent;
  const transfers = flow === 'in' ? summary.borrowed + summary.gotBack : summary.lent + summary.paidBack;

  // Every month the খাতা reaches back to, each with its own headline figure, so
  // the strip doubles as a year at a glance.
  const months = useMemo(() => monthSpan(solo.entries, off), [solo.entries, off]);
  const monthTotals = useMemo(() => {
    const pick = flow === 'in' ? isEarning : isSpending;
    const totals = {};
    months.forEach((o) => {
      totals[o] = monthEntries(solo.entries, o).filter(pick).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    });
    return totals;
  }, [months, solo.entries, flow]);

  const openAdd = (type = null, category = null) => {
    setEditing(null);
    setLockType(type);
    setPresetCategory(category);
    setOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setLockType(null);
    setPresetCategory(null);
    setOpen(true);
  };

  // "Add another to this খাত" — the folder already answers "কোন খাতে", so the
  // sheet opens with that filled in and only the টাকা and the note to write. A
  // transfer folder (ধার) has no category, so it locks the type instead.
  const addToBucket = (bucket) => {
    if (bucket.kind === 'category') openAdd(flow === 'in' ? 'income' : 'expense', bucket.ref);
    else openAdd(bucket.ref);
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

      {/* every month in a row, the open one lit up */}
      <MonthStrip
        offsets={months}
        value={off}
        onChange={setOff}
        language={language}
        totalFor={(o) => monthTotals[o] ?? 0}
      />

      {/* how to read the month: day by day, or খাত by খাত */}
      <SegmentedControl
        value={view}
        onChange={pickView}
        options={[
          {
            value: 'day',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} /> {isBn ? 'দিন অনুযায়ী' : 'By day'}
              </span>
            ),
          },
          {
            value: 'category',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Layers size={13} /> {isBn ? 'খাত অনুযায়ী' : 'By category'}
              </span>
            ),
          },
        ]}
      />

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

      {/* filters — only in the day view; in the খাত view the folders are the filter */}
      {view === 'day' && (usedCategories.length > 0 || usedTransfers.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={isBn ? 'সব' : 'All'} />
          {usedCategories.map((c) => {
            const meta = categoryOfFlow(c, flow);
            return (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={isBn ? meta.bn : meta.en} />
            );
          })}
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
      ) : view === 'category' ? (
        <SoloCategoryView
          entries={filtered}
          flow={flow}
          people={solo.people}
          language={language}
          resetKey={`${off}|${flow}`}
          onAdd={addToBucket}
          onEdit={openEdit}
          onDelete={setPendingDelete}
        />
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
                    onEdit={() => openEdit(e)}
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
        onClose={() => { setOpen(false); setEditing(null); setLockType(null); setPresetCategory(null); }}
        flow={flow}
        editing={editing}
        lockType={editing ? null : lockType}
        presetCategory={editing ? null : presetCategory}
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
  const cat = entry.category
    ? entry.type === 'income'
      ? getIncomeCategory(entry.category)
      : getSpendCategory(entry.category)
    : null;
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
