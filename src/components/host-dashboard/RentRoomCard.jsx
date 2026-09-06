/*
 * RentRoomCard.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * ONE ROOM, one line, in the Rent Collection list.
 *
 * WHAT THIS REPLACES
 * Rent Collection listed one card per OCCUPANT. Room 201 with two tenants, one
 * paid and one not, therefore came apart: the payer went to the cleared list,
 * the other stayed in arrears, and the room — the thing the landlord actually
 * owns and walks into — existed on the screen nowhere. Rooms are the rows now.
 *
 * THE RULE FOR A ROOM'S STATUS
 * A room is only cleared when EVERY seat in it is cleared. One seat overdue and
 * the whole room sits in the overdue list, with the name of whoever owes on the
 * card, because "201 is short one rent" is the fact the landlord acts on.
 *
 * The card opens a modal (RentRoomModal) rather than an accordion. With 70-80
 * rooms an accordion pushes everything else off the screen; a modal shows one
 * room and nothing else.
 */

import React from 'react';
import { DoorOpen, CheckCircle2, Users, AlertCircle, Hourglass, Clock, ChevronRight } from 'lucide-react';
import { remainingFor } from '../../utils/rentLedger';

// Per-seat obligation. rentUnitsOf() has already folded the service charge into
// each unit's monthlyRent, so this is the whole of what the seat owes.
const expectedOf = (u) => Number(u?.monthlyRent || 0);

export default function RentRoomCard({
  units,            // the rent units of ONE room (one per occupant)
  bucket,           // room-level bucket: overdue | partial | upcoming | cleared | none
  buckets,          // per-unit buckets, index-aligned with `units`
  language,
  formatBDT,
  activeMonthKey,   // 'YYYY-MM' the list is showing
  onOpen,
  isOpen,
}) {
  const isBn = language === 'বাংলা';
  const first = units[0] || {};
  const roomNumber = first.roomNumber || '';
  const floorNumber = first.floorNumber;

  const paidCount = buckets.filter(b => b === 'cleared').length;
  const seatCount = units.length;
  const dueCount = buckets.filter(b => b !== 'cleared' && b !== 'none').length;

  // A seat whose lease doesn't reach this month owes nothing for it — bucket
  // 'none'. Counting its rent would bill a room for someone who hasn't moved
  // in yet (or has already left).
  const covered = (i) => (buckets[i] || 'none') !== 'none';

  // What the room is worth this month, and what is still to be collected.
  const expected = units.reduce((n, u, i) => n + (covered(i) ? expectedOf(u) : 0), 0);
  const outstanding = units.reduce(
    (n, u, i) => n + (covered(i) ? remainingFor(u.ledger?.[activeMonthKey], expectedOf(u)) : 0),
    0,
  );

  // Who is still short. Named on the card so the landlord doesn't have to open
  // the room to find out which of the two people in it owes money.
  const unpaidNames = units
    .filter((_, i) => buckets[i] !== 'cleared' && buckets[i] !== 'none')
    .map(u => u.tenant)
    .filter(Boolean);

  const theme = {
    cleared:  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={15}/>, iconBg: 'bg-emerald-50 text-emerald-600', label: isBn ? 'ক্লিয়ার্ড' : 'CLEARED', money: 'text-emerald-600' },
    partial:  { chip: 'bg-amber-50 text-amber-700 border-amber-200',      icon: <Hourglass size={15}/>,    iconBg: 'bg-amber-50 text-amber-600',     label: isBn ? 'আংশিক' : 'PARTIAL',    money: 'text-amber-600' },
    overdue:  { chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', icon: <AlertCircle size={15}/>, iconBg: 'bg-fuchsia-50 text-fuchsia-600', label: isBn ? 'বকেয়া' : 'OVERDUE',    money: 'text-fuchsia-600' },
    upcoming: { chip: 'bg-orange-50 text-orange-700 border-orange-200',   icon: <Clock size={15}/>,        iconBg: 'bg-orange-50 text-orange-600',   label: isBn ? 'আসন্ন' : 'UPCOMING',   money: 'text-orange-600' },
    none:     { chip: 'bg-gray-100 text-gray-600 border-gray-200',        icon: <DoorOpen size={15}/>,     iconBg: 'bg-gray-100 text-gray-500',      label: isBn ? 'লিজের বাইরে' : 'OUTSIDE', money: 'text-gray-400' },
  }[bucket] || {};

  // A room number is the honest title. Without one (a whole flat, a legacy row)
  // the property name is what the landlord recognises it by.
  const title = roomNumber
    ? `${isBn ? 'রুম' : 'Room'} ${roomNumber}`
    : (first.property || (isBn ? 'ইউনিট' : 'Unit'));

  return (
    <button
      type="button"
      id={`rent-${first.__realId || first.id}`}
      onClick={onOpen}
      className={`w-full text-left bg-white rounded-xl border overflow-hidden transition-all flex items-center gap-2.5 px-3 py-2.5 ${
        isOpen
          ? 'border-[#ba0036]/30 shadow-[0_6px_24px_rgba(186,0,54,0.10)]'
          : 'border-gray-100/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-gray-200'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${theme.iconBg}`}>
        {theme.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <h4 className="text-xs sm:text-[13px] font-black text-gray-900 truncate">{title}</h4>
          {floorNumber !== '' && floorNumber != null && (
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
              {isBn ? 'ফ্লোর' : 'Floor'} {floorNumber}
            </span>
          )}
          {seatCount > 1 && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-gray-50 text-gray-600 border-gray-200 inline-flex items-center gap-0.5 tabular-nums shrink-0">
              <Users size={9}/> {seatCount} {isBn ? 'সিট' : 'seats'}
            </span>
          )}
          {/* The mixed-status summary: "১ পরিশোধ · ১ বাকি" on one room, so a
              half-paid room reads as a half-paid room instead of two rows in
              two different lists. */}
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border tabular-nums shrink-0 ${theme.chip}`}>
            {seatCount > 1
              ? `${paidCount} ${isBn ? 'পরিশোধ' : 'paid'} · ${dueCount} ${isBn ? 'বাকি' : 'due'}`
              : theme.label}
          </span>
        </div>
        <p className="text-[10px] font-bold text-gray-500 truncate">
          <span className="text-emerald-600 font-black tabular-nums">{formatBDT(expected)}</span>
          <span className="text-gray-400">{isBn ? ' /মাস' : ' /mo'}</span>
          <span className="mx-1 text-gray-300">·</span>
          {unpaidNames.length > 0 ? (
            <span className={theme.money}>
              {unpaidNames.join(', ')} — {isBn ? 'বকেয়া' : 'due'} <span className="tabular-nums">{formatBDT(outstanding)}</span>
            </span>
          ) : (
            <span className="text-gray-500 truncate">{units.map(u => u.tenant).filter(Boolean).join(', ')}</span>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right hidden sm:block mr-0.5">
        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-tight">
          {outstanding > 0 ? (isBn ? 'বাকি' : 'Outstanding') : (isBn ? 'পরিশোধিত' : 'Settled')}
        </p>
        <p className={`text-xs font-black tabular-nums leading-tight ${outstanding > 0 ? theme.money : 'text-emerald-600'}`}>
          {formatBDT(outstanding)}
        </p>
      </div>

      <div className="shrink-0 p-1 rounded-lg bg-gray-50 text-gray-400">
        <ChevronRight size={14}/>
      </div>
    </button>
  );
}
