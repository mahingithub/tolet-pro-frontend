/*
 * ShiftTenantModal.jsx — the landlord moves a tenant from 203 to 206.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS IS THE LANDLORD'S BUTTON
 * The tenant may not have the app. They may not have a smartphone. They do not
 * need to know this software exists — they knocked on a door and said "I'm
 * taking 206 from the first". The landlord is the one holding the register, so
 * the move has to be one action on the row already in front of them.
 *
 * WHAT IT REPLACES
 * Two separate actions that between them lost the thread: move the person out
 * of 203, then add them to 206 by retyping their name, their number, their
 * father's name, their NID and their emergency contact — the eleven fields the
 * landlord had already collected months earlier. Landlords did the first half
 * and skipped the second, or did the second and skipped the first, and the
 * register ended up saying someone lived in two rooms at once.
 *
 * WHAT IS ASKED FOR
 * The room, the date, and the rent if it differs. Nothing else, because
 * nothing else changed.
 *
 * WHAT IS NOT ASKED FOR, AND WHY IT MATTERS
 * The rent history. It stays on 203 — "what did they pay for 203" is a question
 * about 203, and the new room starts a clean ledger at the new rent. The old
 * member row is closed, never deleted, so a year from now the landlord can
 * still answer who was in that room and until when.
 */

import React, { useMemo, useState } from 'react';
import {
  X, DoorOpen, Loader2, Check, AlertTriangle, ArrowRight, Calendar, User,
} from 'lucide-react';
import { shiftTenantToUnit } from '../../services/buildingService';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ShiftTenantModal({
  fromUnit,       // the room they are in now
  person,         // { memberId, name, phone } — memberId null ⇒ legacy tenancy
  units,          // every room in this building (from listUnits)
  building,
  language,
  showToast,
  onClose,
  onSaved,
}) {
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);
  const noun = building?.rentedAs === 'seat' ? L('রুম', 'Room') : L('ইউনিট', 'Unit');

  const [toUnitId, setToUnitId]     = useState('');
  const [moveInDate, setMoveInDate] = useState(todayIso());
  const [monthlyRent, setMonthlyRent] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Every room except the one they are standing in. Full rooms stay in the list
  // and stay pickable: the landlord may be about to free a seat, and they know
  // their own building better than a seat count does. The server is the one
  // that refuses a genuinely full whole-unit let, with a message that says so.
  const options = useMemo(
    () => (units || []).filter((u) => String(u.id) !== String(fromUnit?.id)),
    [units, fromUnit],
  );
  const selected = options.find((u) => String(u.id) === toUnitId) || null;

  const submit = async () => {
    if (!toUnitId) {
      setError(L('কোন রুমে সরাবেন সেটি বেছে নিন।', 'Pick the room to move them to.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await shiftTenantToUnit(fromUnit.id, person.memberId || 'primary', {
        toUnitId,
        moveInDate,
        ...(monthlyRent !== '' ? { monthlyRent: Number(monthlyRent) } : {}),
      });
      showToast?.(L(
        `${person.name} এখন ${noun} ${selected?.roomNumber} এ`,
        `${person.name} moved to ${noun} ${selected?.roomNumber}`,
      ));
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || L('সরানো গেল না।', 'Could not move them.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-gray-900/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DoorOpen size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-gray-900 leading-tight">
              {L('রুম বদলান', 'Move to another room')}
            </h3>
            <p className="text-[11px] font-bold text-gray-400 leading-relaxed mt-0.5 flex items-center gap-1">
              <User size={10} className="text-gray-300 shrink-0" />
              <span className="truncate">{person?.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mr-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label={L('বন্ধ করুন', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-[#ba0036] shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-red-900 leading-relaxed flex-1">{error}</p>
            </div>
          )}

          {/* The whole change in one line, so what the button does is not in
              doubt before it is tapped. */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3.5 flex items-center gap-2 text-sm font-black text-gray-900">
            <span className="truncate">{noun} {fromUnit?.roomNumber}</span>
            <ArrowRight size={14} className="text-gray-300 shrink-0" />
            <span className={`truncate ${selected ? 'text-blue-600' : 'text-gray-300'}`}>
              {selected ? `${noun} ${selected.roomNumber}` : L('রুম বাছুন', 'pick a room')}
            </span>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {L('নতুন রুম', 'New room')}
            </p>
            <div className="space-y-2 max-h-[34vh] overflow-y-auto -mx-1 px-1">
              {options.length === 0 && (
                <p className="text-xs font-bold text-gray-400 py-6 text-center">
                  {L('এই বিল্ডিংয়ে অন্য কোনো রুম নেই।', 'This building has no other rooms.')}
                </p>
              )}
              {options.map((u) => {
                const on = toUnitId === String(u.id);
                const vacant = Number(u.vacantSeats) || 0;
                const full = vacant <= 0;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setToUnitId(String(u.id)); setError(''); }}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.99] flex items-center gap-3 ${
                      on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-100 bg-white hover:border-gray-300'
                    }`}
                  >
                    <DoorOpen size={16} className={on ? 'text-white/70' : 'text-gray-300'} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black leading-tight">{noun} {u.roomNumber}</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>
                        {(Number(u.seatCapacity) || 1) > 1
                          ? `${vacant}/${u.seatCapacity} ${L('সিট খালি', 'seats free')}`
                          : (full ? L('ভাড়া হয়ে আছে', 'occupied') : L('খালি', 'vacant'))}
                        {Number(u.monthlyRent) > 0 && ` · ৳${Number(u.monthlyRent).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    {full && (
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                        on ? 'bg-white/15 text-white/80' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {L('পূর্ণ', 'Full')}
                      </span>
                    )}
                    {on && <Check size={16} strokeWidth={3} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Calendar size={11} className="text-gray-300" /> {L('কবে থেকে', 'From')}
              </label>
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                {L('নতুন ভাড়া', 'New rent')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                placeholder={selected?.monthlyRent ? String(selected.monthlyRent) : L('রুমের ভাড়া', "room's rent")}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium focus:border-gray-900 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
            {L(`${person?.name || 'ভাড়াটিয়ার'} নাম, নম্বর, NID ও ছবি নতুন রুমে চলে যাবে — কিছু টাইপ করতে হবে না। ${noun} ${fromUnit?.roomNumber} এর পুরোনো ভাড়ার হিসাব ও রিসিট ওখানেই থেকে যাবে, মুছবে না।`,
                `Their name, number, NID and photo move with them — nothing to retype. The rent history for ${noun} ${fromUnit?.roomNumber} stays on that room and is not deleted.`)}
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-[11px] uppercase tracking-widest transition-colors"
          >
            {L('বাতিল', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !toUnitId}
            className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {L('সরিয়ে দিন', 'Move them')}
          </button>
        </div>
      </div>
    </div>
  );
}
