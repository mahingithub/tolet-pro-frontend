/*
 * VacantUnitsPanel.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The empty rooms, flats and seats, listed underneath the ones that are
 * earning.
 *
 * WHY IT IS HERE
 * Rent Collection only ever showed rows that had a tenant on them, so a room
 * that nobody was renting simply did not exist on the screen — the one view a
 * landlord opens to ask "where is my money" could not answer "and where is it
 * NOT coming from". Empty units were unrepresentable before Unit existed as a
 * record; now they are, so they are shown.
 *
 * Ordered like the rest of the building: ground floor up, 101 · 102 · 110
 * within a floor, seat by seat within a room.
 */

import React, { useEffect, useState } from 'react';
import { DoorOpen, ChevronDown, ChevronUp, Users, Home, BedDouble } from 'lucide-react';
import { listUnits } from '../../services/buildingService';
import { unitNoun } from '../../utils/buildingTypes';

const floorLabel = (n, isBn) => {
  const f = Number(n);
  if (f === 0) return isBn ? 'নিচতলা' : 'Ground Floor';
  if (f < 0) return isBn ? `বেসমেন্ট ${Math.abs(f)}` : `Basement ${Math.abs(f)}`;
  return isBn ? `${f}য় তলা` : `Floor ${f}`;
};

export default function VacantUnitsPanel({ building, language, formatBDT }) {
  const isBn = language === 'বাংলা';
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!building?.id) { setUnits([]); return undefined; }
    listUnits(building.id)
      .then(({ units: rows }) => { if (!cancelled) setUnits(rows || []); })
      .catch(() => { /* a missing vacancy list must never break Rent Collection */ });
    return () => { cancelled = true; };
  }, [building?.id]);

  if (!building?.id) return null;

  const isSeat = building.rentedAs === 'seat';
  const noun = unitNoun(building, isBn);

  // A room with 4 seats and 1 occupant contributes 3 vacancies, not 0 — the
  // unit of vacancy is the SEAT wherever seats exist.
  const vacancies = [];
  units.forEach((u) => {
    const capacity = Math.max(1, Number(u.seatCapacity) || 1);
    const taken = u.occupiedSeats || 0;
    for (let i = taken; i < capacity; i += 1) {
      vacancies.push({ unit: u, seatNumber: i + 1, seatOf: capacity });
    }
  });

  if (vacancies.length === 0) return null;

  const expectedLoss = vacancies.reduce((sum, v) => {
    const capacity = Math.max(1, Number(v.unit.seatCapacity) || 1);
    return sum + Math.round(((Number(v.unit.monthlyRent) || 0) + (Number(v.unit.serviceCharge) || 0)) / capacity);
  }, 0);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-3 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-gray-50/60 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <DoorOpen size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
            {isSeat ? (isBn ? 'খালি সিট' : 'Vacant Seats') : (isBn ? `খালি ${noun}` : `Vacant ${noun}s`)}
            <span className="ml-1.5 text-amber-600 tabular-nums">{vacancies.length}</span>
          </p>
          <p className="text-[10px] font-bold text-gray-500 leading-tight mt-0.5">
            {isBn ? 'ভাড়া হলে যোগ হবে ' : 'Worth '}
            <span className="tabular-nums text-gray-700">{formatBDT ? formatBDT(expectedLoss) : `৳${expectedLoss}`}</span>
            {isBn ? ' /মাস' : ' / month once let'}
          </p>
        </div>
        <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
          {vacancies.map((v, i) => {
            const capacity = Math.max(1, Number(v.unit.seatCapacity) || 1);
            const share = Math.round(((Number(v.unit.monthlyRent) || 0) + (Number(v.unit.serviceCharge) || 0)) / capacity);
            return (
              <div key={`${v.unit.id}-${v.seatNumber}-${i}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-dashed border-gray-200">
                <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                  {isSeat ? <Users size={14} /> : building.rentedAs === 'flat' ? <Home size={14} /> : <BedDouble size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-gray-700">
                    {noun} {v.unit.roomNumber}
                    {isSeat && <span className="text-gray-400 font-bold"> · {isBn ? `সিট ${v.seatNumber}` : `Seat ${v.seatNumber}`}</span>}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 leading-tight">{floorLabel(v.unit.floor, isBn)}</p>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-black text-gray-500 tabular-nums">
                  {formatBDT ? formatBDT(share) : `৳${share}`}
                </span>
                <span className="shrink-0 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[9px] font-black text-amber-700 uppercase tracking-wider">
                  {isBn ? 'খালি' : 'Vacant'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
