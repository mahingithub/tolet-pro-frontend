/**
 * SoloCategoryView — the same খাতা, read as a category ledger instead of a
 * diary.
 *
 * The day view answers "what did I spend today?". This one answers the question
 * people actually keep a খাতা to answer: "কোন খাতে কত যাচ্ছে, আর কী কী কিনলাম?"
 * One folder per খাত, the month's total on its face, and every line written
 * inside it — রিকশা ভাড়া, বাসের টিকিট, সিএনজি — all under যাতায়াত, never as
 * three categories of their own.
 *
 * That last part is the whole point: a new kind of খরচ is a NOTE inside an
 * existing খাত, not a new খাত. So each folder carries its own "add another"
 * button, which opens the entry sheet with the category already chosen and only
 * the amount and the note left to fill in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';

import { dateLabel, num, taka } from './livingUtils';
import { getMethod } from './livingConfig';
import { getEntryType, getIncomeCategory, getSpendCategory } from './soloConfig';
import { groupByCategory, toDateInput } from './soloUtils';
import { Card, IconBadge, ProgressBar, cx } from './livingUI';

/** The icon/colour/name a folder is drawn with: its category, or its own type. */
const bucketMeta = (bucket, flow) => {
  if (bucket.kind !== 'category') return getEntryType(bucket.ref);
  return flow === 'in' ? getIncomeCategory(bucket.ref) : getSpendCategory(bucket.ref);
};

// ── one line inside a folder ────────────────────────────────────────────────
const CategoryLine = ({ entry, people, language, onEdit, onDelete }) => {
  const isBn = language === 'বাংলা';
  const type = getEntryType(entry.type);
  const person = people.find((p) => p.id === entry.personId);
  const method = getMethod(entry.method);
  const note = entry.note?.trim();
  const isToday = toDateInput(entry.date) === toDateInput();

  return (
    <div className={cx('flex items-center gap-2.5 px-3.5 py-2.5', isToday && 'bg-[#ba0036]/[0.045]')}>
      {/* the date column — this is the "কোন তারিখে" a category খাতা is read by */}
      <div className="w-[42px] shrink-0 text-center">
        <p className={cx('text-[11px] font-black tabular-nums leading-none', isToday ? 'text-[#ba0036]' : 'text-gray-500')}>
          {dateLabel(entry.date, language)}
        </p>
        {isToday && (
          <p className="text-[8.5px] font-black uppercase tracking-wider text-[#ba0036] mt-1">
            {isBn ? 'আজ' : 'Today'}
          </p>
        )}
      </div>

      {/* Tapping the line opens it for editing — that is how a note gets added
          to a row that was written in a hurry with only an amount. */}
      <button onClick={onEdit} className="flex-1 min-w-0 text-left active:scale-[0.99] transition">
        <p className={cx('text-[12.5px] font-black truncate', note ? 'text-gray-900' : 'text-gray-400')}>
          {note || (isBn ? 'নোট লিখতে চাপুন' : 'Tap to add a note')}
        </p>
        <p className="text-[10.5px] font-semibold text-gray-400 truncate">
          {person ? `${person.name} · ` : ''}
          {isBn ? method.bn : method.en}
        </p>
      </button>

      <p className={cx('text-[13.5px] font-black tabular-nums shrink-0', type.flow === 'in' ? 'text-emerald-600' : 'text-gray-900')}>
        {type.flow === 'in' ? '+' : '−'}{taka(entry.amount, language)}
      </p>

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
const CategoryCard = ({ bucket, flow, max, people, language, open, onToggle, onAdd, onEdit, onDelete }) => {
  const isBn = language === 'বাংলা';
  const meta = bucketMeta(bucket, flow);
  const name = isBn ? meta.bn : meta.en;
  const hasToday = bucket.entries.some((e) => toDateInput(e.date) === toDateInput());

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:scale-[0.995] transition">
        <IconBadge icon={meta.icon} tint={meta.tint} text={meta.text} size={42} iconSize={19} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13.5px] font-black text-gray-900 truncate">{name}</p>
            {hasToday && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[#ba0036] bg-[#ba0036]/10 px-1.5 py-0.5 rounded-full">
                {isBn ? 'আজ' : 'Today'}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5 truncate">
            {isBn
              ? `${num(bucket.count, language)}টি লেখা · সর্বশেষ ${dateLabel(bucket.last, language)}`
              : `${bucket.count} ${bucket.count === 1 ? 'entry' : 'entries'} · last ${dateLabel(bucket.last, language)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[15px] font-black text-gray-900 tabular-nums leading-none">{taka(bucket.total, language)}</p>
          <p className="text-[10px] font-black text-gray-400 mt-1">{num(Math.round(bucket.pct), language)}%</p>
        </div>
        <ChevronDown size={17} className={cx('shrink-0 text-gray-300 transition-transform', open && 'rotate-180')} />
      </button>

      <div className="px-3.5 pb-3">
        <ProgressBar value={bucket.total} max={max} color={meta.hex} />
      </div>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {bucket.entries.map((e) => (
            <CategoryLine
              key={e.id}
              entry={e}
              people={people}
              language={language}
              onEdit={() => onEdit(e)}
              onDelete={() => onDelete(e)}
            />
          ))}
          <button
            onClick={() => onAdd(bucket)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] font-black text-[#ba0036] bg-[#ba0036]/[0.03] active:scale-[0.99] transition"
          >
            <Plus size={14} />
            {isBn ? `${name}-এ আরেকটি লিখুন` : `Add to ${name.toLowerCase()}`}
          </button>
        </div>
      )}
    </Card>
  );
};

/**
 * @param {object[]} entries The month's rows for this side of the খাতা.
 * @param {(bucket) => void} onAdd Write another line into that folder.
 */
const SoloCategoryView = ({ entries = [], flow = 'out', people = [], language, onAdd, onEdit, onDelete, resetKey }) => {
  const buckets = useMemo(() => groupByCategory(entries), [entries]);
  const max = buckets[0]?.total || 0;

  // The biggest folder opens by itself — on a month with nine খাত, a wall of
  // shut drawers is not a ledger. Everything else is one tap away, and changing
  // month starts the same way rather than remembering last month's drawers.
  const [openKeys, setOpenKeys] = useState([]);
  useEffect(() => {
    setOpenKeys(buckets[0] ? [buckets[0].key] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const toggle = (key) =>
    setOpenKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  return (
    <div className="space-y-2.5">
      {buckets.map((b) => (
        <CategoryCard
          key={b.key}
          bucket={b}
          flow={flow}
          max={max}
          people={people}
          language={language}
          open={openKeys.includes(b.key)}
          onToggle={() => toggle(b.key)}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default SoloCategoryView;
