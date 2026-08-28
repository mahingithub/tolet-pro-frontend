/*
 * RoomRentGroup.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Rent Collection, read the way a landlord walks the building: ROOM first,
 * seats inside it.
 *
 * WHY
 * A booking is made once; rent is collected every month. So Rent Collection is
 * the screen that has to be organised, and a flat list of every occupant is not
 * organised — a twelve-seat hostel became twelve loose cards with nothing
 * saying which room any of them was in, or whether a room was fully paid.
 *
 * THE RULE
 *   no seats  → the room IS one tenancy, so render the ordinary card unchanged
 *   seats     → a ROOM card that opens to reveal its seats
 *
 * A one-seat room is deliberately treated as "no seats": wrapping a single
 * person in a room header they have to open is friction with nothing behind it.
 *
 * The per-seat cards are the EXISTING rent rows, passed in by the parent. This
 * component only groups and summarises — mark-paid, ledgers and receipts keep
 * working because none of that was reimplemented here.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, DoorOpen, CheckCircle2 } from 'lucide-react';

export default function RoomRentGroup({
  units,            // rent units for ONE room (one per occupant)
  renderRow,        // (unit, forceOpen) => node — the existing rent row
  forceOpen,
  language,
  formatBDT,
  monthKey,         // 'YYYY-MM' the list is showing
  getRentStatus,    // shared rent-status helper, so nothing is re-derived here
  today,
}) {
  const isBn = language === 'বাংলা';
  const [open, setOpen] = useState(false);

  // One occupant ⇒ this is a whole-unit tenancy. Render it exactly as before.
  if (!units || units.length <= 1) {
    return <>{(units || []).map((u) => renderRow(u, forceOpen))}</>;
  }

  const first = units[0];
  const roomNumber = first.roomNumber || '';
  const floorNumber = first.floorNumber;

  // Paid/unpaid per seat, using the same helper the rows themselves use — a
  // second opinion on "did they pay" is how a summary starts disagreeing with
  // the rows underneath it.
  //
  // getRentStatus returns a STRING ('paid' | 'partial' | 'due-marked' | …), not
  // an object. A partial payment is not paid: the point of this count is what
  // the landlord still has to chase.
  const statuses = units.map((u) => {
    try { return getRentStatus?.(u, monthKey, today); } catch { return null; }
  });
  const paidCount = statuses.filter((s) => s === 'paid').length;
  const allPaid = paidCount === units.length;

  const expected = units.reduce((n, u) => n + (Number(u.monthlyRent) || 0) + (Number(u.serviceCharge) || 0), 0);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${open ? 'border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)]' : 'border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]'} bg-white`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${allPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {allPaid ? <CheckCircle2 size={17} /> : <DoorOpen size={17} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-[13px] font-black text-gray-900">
              {isBn ? 'রুম' : 'Room'} {roomNumber}
            </h4>
            {floorNumber !== '' && floorNumber != null && (
              <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                {isBn ? 'ফ্লোর' : 'Floor'} {floorNumber}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-gray-50 text-gray-600 border-gray-200 inline-flex items-center gap-0.5 tabular-nums">
              <Users size={9} /> {units.length} {isBn ? 'সিট' : 'seats'}
            </span>
            {/* The number the landlord is actually chasing: how many of this
                room's seats have paid this month. */}
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border tabular-nums ${allPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {paidCount}/{units.length} {isBn ? 'পরিশোধ' : 'paid'}
            </span>
          </div>
          <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">
            <span className="tabular-nums">{formatBDT ? formatBDT(expected) : expected}</span>
            <span className="text-gray-400">{isBn ? ' /মাস মোট' : ' /mo total'}</span>
            <span className="mx-1 text-gray-300">·</span>
            {units.map((u) => u.tenant).filter(Boolean).join(', ')}
          </p>
        </div>

        <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Inside the room: one card per seat, each labelled with its seat. */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-2 py-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
          {units.map((u, i) => (
            <div key={u.id}>
              <div className="flex items-center gap-1.5 px-1.5 pb-1">
                <span className="w-5 h-5 rounded-md bg-[#ba0036] text-white text-[9px] font-black flex items-center justify-center shrink-0">
                  {u.__seatIndex || i + 1}
                </span>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  {u.__seatLabel || (isBn ? `সিট ${u.__seatIndex || i + 1}` : `Seat ${u.__seatIndex || i + 1}`)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {renderRow(u, forceOpen)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
