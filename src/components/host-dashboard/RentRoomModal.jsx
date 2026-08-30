/*
 * RentRoomModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * ONE ROOM, on its own, with everything else out of the way.
 *
 * WHY A MODAL AND NOT A DROPDOWN
 * Rent Collection opened tenants as accordions. With seventy rooms on the
 * screen, opening one pushed the rest out of view and the landlord lost their
 * place; opening two made the page unreadable. A room opens here instead:
 * nothing but that room's seats, its month, and what it still owes.
 *
 * WHAT IT HOLDS
 *   · the room's month at a glance — expected, collected, outstanding
 *   · FULL ROOM PAYMENT — settles every seat that still owes, in one action,
 *     with the exact amount shown before it is confirmed
 *   · one line per seat, with the occupant's name and where they stand
 *   · tap a seat → their existing 12-month ledger card, unchanged
 *
 * The per-seat card is `renderRow` from the Rent tab — the SAME card the list
 * used to render inline. Mark-paid, the month matrix, reminders and receipts
 * keep working here because none of that was reimplemented.
 */

import React, { useEffect, useState } from 'react';
import {
  X, DoorOpen, Users, CheckCircle2, AlertCircle, Hourglass, Clock,
  Banknote, ChevronDown, ChevronUp, MinusCircle,
} from 'lucide-react';
import { remainingFor, paidSoFar } from '../../utils/rentLedger';

const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Cash'];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// rentUnitsOf() folds the service charge into each unit's monthlyRent, so this
// is the seat's whole obligation for a month.
const expectedOf = (u) => Number(u?.monthlyRent || 0);

export default function RentRoomModal({
  units,            // rent units for ONE room (one per occupant)
  buckets,          // per-unit bucket, index-aligned with `units`
  language,
  formatBDT,
  activeMonthKey,   // 'YYYY-MM' being collected
  monthFullLabel,
  renderRow,        // (unit, forceOpen) => the existing rent card
  markRoomPaid,     // (units, monthKey, { paidOn, method }) => void
  focusUnitId,      // seat to open on mount (deep links, overdue drawer)
  onClose,
}) {
  const isBn = language === 'বাংলা';
  const seatCount = units.length;
  // One occupant ⇒ there is nothing to choose between; open their ledger
  // straight away instead of making them tap their own name first.
  const [selectedId, setSelectedId] = useState(
    focusUnitId || (seatCount === 1 ? units[0]?.id : null),
  );
  const [confirming, setConfirming] = useState(false);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState('bKash');

  // Escape closes, and the page behind doesn't scroll while a room is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const first = units[0] || {};
  const roomNumber = first.roomNumber || '';
  const floorNumber = first.floorNumber;
  const title = roomNumber
    ? `${isBn ? 'রুম' : 'Room'} ${roomNumber}`
    : (first.property || (isBn ? 'ইউনিট' : 'Unit'));

  // A seat whose lease doesn't reach this month owes nothing for it — bucket
  // 'none'. markRoomPaid skips those seats too, so the total on the button is
  // exactly what confirming it will record.
  const covered = (i) => (buckets[i] || 'none') !== 'none';

  const expected = units.reduce((n, u, i) => n + (covered(i) ? expectedOf(u) : 0), 0);
  const collected = units.reduce((n, u, i) => n + (covered(i) ? paidSoFar(u.ledger?.[activeMonthKey]) : 0), 0);
  const outstanding = units.reduce(
    (n, u, i) => n + (covered(i) ? remainingFor(u.ledger?.[activeMonthKey], expectedOf(u)) : 0),
    0,
  );
  const paidCount = buckets.filter(b => b === 'cleared').length;
  // Who the full-room button will actually charge: seats inside the month that
  // still owe something.
  const unpaidCount = units.filter((u, i) => covered(i) && remainingFor(u.ledger?.[activeMonthKey], expectedOf(u)) > 0).length;

  const seatTheme = {
    cleared:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={10} strokeWidth={3}/>, label: isBn ? 'পরিশোধিত' : 'PAID' },
    partial:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',       icon: <Hourglass size={10} strokeWidth={3}/>,    label: isBn ? 'আংশিক' : 'PARTIAL' },
    overdue:  { cls: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', icon: <AlertCircle size={10} strokeWidth={3}/>,  label: isBn ? 'বকেয়া' : 'OVERDUE' },
    upcoming: { cls: 'bg-orange-50 text-orange-700 border-orange-200',    icon: <Clock size={10} strokeWidth={3}/>,        label: isBn ? 'আসন্ন' : 'UPCOMING' },
    none:     { cls: 'bg-gray-100 text-gray-600 border-gray-200',         icon: <MinusCircle size={10} strokeWidth={3}/>,  label: isBn ? 'লিজের বাইরে' : 'OUTSIDE' },
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-gray-50 w-full sm:max-w-2xl rounded-t-[1.75rem] sm:rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.28)] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* ── Header — which room, and nothing else ── */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${outstanding > 0 ? 'bg-fuchsia-50 text-fuchsia-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {outstanding > 0 ? <DoorOpen size={19}/> : <CheckCircle2 size={19}/>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-black text-gray-900 truncate">{title}</h3>
              {floorNumber !== '' && floorNumber != null && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                  {isBn ? 'ফ্লোর' : 'Floor'} {floorNumber}
                </span>
              )}
              {seatCount > 1 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-gray-50 text-gray-600 border-gray-200 inline-flex items-center gap-0.5 tabular-nums shrink-0">
                  <Users size={10}/> {seatCount} {isBn ? 'সিট' : 'seats'}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">
              <span className="text-emerald-600 font-black">{first.property}</span>
              <span className="mx-1 text-gray-300">·</span>
              {monthFullLabel(activeMonthKey, language)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
            className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X size={18}/>
          </button>
        </div>

        {/* ── Scrolling body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-3 space-y-3">

          {/* The room's month in three numbers. */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{isBn ? 'রুমের ভাড়া' : 'Room Rent'}</p>
                <p className="text-sm font-black text-gray-900 tabular-nums mt-0.5">{formatBDT(expected)}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{isBn ? 'আদায়' : 'Collected'}</p>
                <p className="text-sm font-black text-emerald-600 tabular-nums mt-0.5">{formatBDT(collected)}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{isBn ? 'বাকি' : 'Outstanding'}</p>
                <p className={`text-sm font-black tabular-nums mt-0.5 ${outstanding > 0 ? 'text-fuchsia-600' : 'text-gray-400'}`}>{formatBDT(outstanding)}</p>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                style={{ width: expected > 0 ? `${Math.min(100, (collected / expected) * 100)}%` : '0%' }}
              />
            </div>
            {seatCount > 1 && (
              <p className="mt-2 text-[10px] font-bold text-gray-500">
                <span className="text-emerald-600 font-black tabular-nums">{paidCount}</span> {isBn ? 'জন পরিশোধ করেছেন' : 'paid'}
                <span className="mx-1 text-gray-300">·</span>
                <span className={`font-black tabular-nums ${unpaidCount > 0 ? 'text-fuchsia-600' : 'text-gray-400'}`}>{unpaidCount}</span> {isBn ? 'জনের বাকি আছে' : 'still due'}
              </p>
            )}
          </div>

          {/* ── FULL ROOM PAYMENT ────────────────────────────────────────────
              The whole point of grouping by room: collect what the room owes
              without opening a seat. The amount is shown before it is
              confirmed, and confirming records it seat by seat. */}
          {outstanding > 0 && (
            confirming ? (
              <div className="bg-white rounded-2xl border border-[#ba0036]/20 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  {isBn ? 'ফুল রুম পেমেন্ট নিশ্চিত করুন' : 'Confirm full room payment'}
                </p>
                <p className="text-[11px] font-bold text-gray-600 leading-relaxed mb-3">
                  {isBn
                    ? `${monthFullLabel(activeMonthKey, language)} এর বাকি ${formatBDT(outstanding)} — ${unpaidCount} জনের ভাড়া একসাথে পরিশোধ হিসেবে রেকর্ড হবে।`
                    : `${formatBDT(outstanding)} outstanding for ${monthFullLabel(activeMonthKey, language)} will be recorded as paid across ${unpaidCount} tenant${unpaidCount > 1 ? 's' : ''}.`}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <label className="block">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{isBn ? 'তারিখ' : 'Paid on'}</span>
                    <input
                      type="date"
                      value={paidOn}
                      onChange={(e) => setPaidOn(e.target.value)}
                      className="mt-1 w-full px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900 focus:outline-none focus:border-[#ba0036]/30"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{isBn ? 'মাধ্যম' : 'Method'}</span>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="mt-1 w-full px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-900 focus:outline-none focus:border-[#ba0036]/30"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest transition-colors active:scale-[0.98]"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { markRoomPaid?.(units, activeMonthKey, { paidOn, method }); setConfirming(false); }}
                    className="flex-[2] py-2.5 rounded-xl bg-[#ba0036] hover:bg-[#90002a] text-white text-[10px] font-black uppercase tracking-widest transition-colors active:scale-[0.98] shadow-[0_6px_18px_rgba(186,0,54,0.25)] inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={13} strokeWidth={3}/>
                    {isBn ? `${formatBDT(outstanding)} রেকর্ড করুন` : `Record ${formatBDT(outstanding)}`}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="w-full bg-gradient-to-br from-[#ba0036] via-[#d1003d] to-[#ff004c] text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-[0_8px_24px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_32px_rgba(186,0,54,0.35)] active:scale-[0.985] transition-all"
              >
                <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Banknote size={18}/>
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-black uppercase tracking-widest">
                    {isBn ? 'ফুল রুম পেমেন্ট' : 'Full Room Payment'}
                  </span>
                  <span className="block text-[10px] font-bold text-white/80 mt-0.5">
                    {isBn
                      ? `${unpaidCount} জনের বাকি একসাথে ক্লিয়ার করুন`
                      : `Clear all ${unpaidCount} outstanding seat${unpaidCount > 1 ? 's' : ''} at once`}
                  </span>
                </span>
                <span className="shrink-0 text-base font-black tabular-nums">{formatBDT(outstanding)}</span>
              </button>
            )
          )}

          {outstanding <= 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0"/>
              <p className="text-[11px] font-black text-emerald-800">
                {isBn
                  ? `${monthFullLabel(activeMonthKey, language)} — পুরো রুমের ভাড়া পরিশোধিত`
                  : `${monthFullLabel(activeMonthKey, language)} — the whole room is settled`}
              </p>
            </div>
          )}

          {/* ── Seats. Tap one to open that tenant's ledger. ── */}
          <div className="space-y-1.5">
            <p className="px-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">
              {seatCount > 1 ? (isBn ? 'সিট ও ভাড়াটিয়া' : 'Seats & tenants') : (isBn ? 'ভাড়াটিয়া' : 'Tenant')}
            </p>
            {units.map((u, i) => {
              const bucket = buckets[i] || 'none';
              const th = seatTheme[bucket] || seatTheme.none;
              const seatExpected = covered(i) ? expectedOf(u) : 0;
              const seatDue = covered(i) ? remainingFor(u.ledger?.[activeMonthKey], seatExpected) : 0;
              const isSelected = selectedId === u.id;
              return (
                <div key={u.id} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : u.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-white border-gray-300 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {seatCount > 1 && (
                      <span className="w-6 h-6 rounded-lg bg-[#ba0036] text-white text-[9px] font-black flex items-center justify-center shrink-0 tabular-nums">
                        {u.__seatIndex || i + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-black text-gray-900 truncate">{u.tenant}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border inline-flex items-center gap-0.5 shrink-0 ${th.cls}`}>
                          {th.icon} {th.label}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">
                        {u.__seatLabel && <>{u.__seatLabel}<span className="mx-1 text-gray-300">·</span></>}
                        <span className="tabular-nums">{formatBDT(seatExpected)}</span>
                        {seatDue > 0 && (
                          <>
                            <span className="mx-1 text-gray-300">·</span>
                            <span className="text-fuchsia-600 tabular-nums">{formatBDT(seatDue)} {isBn ? 'বাকি' : 'due'}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 p-1 rounded-lg bg-gray-50 text-gray-400">
                      {isSelected ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </span>
                  </button>

                  {/* The tenant's own 12-month ledger — the existing rent card,
                      rendered here instead of in the list behind us. */}
                  {isSelected && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      {renderRow(u, true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
