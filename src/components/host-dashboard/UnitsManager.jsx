/*
 * UnitsManager.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The inside of a building: its flats or rooms, in the order you would walk
 * them, each showing who is actually in it.
 *
 * THE POINT OF THIS SCREEN
 * A room is created ONCE and outlives every tenant who passes through it. Until
 * now a "room" had no independent existence — it was whatever floor and room
 * number happened to be typed on a lease — so a room could not exist without a
 * tenant, vacancy was unrepresentable, and every new tenant meant retyping the
 * room and its rent. Here the room is the durable thing and people come and go
 * from its seats.
 *
 * THE FORM ADAPTS TO THE BUILDING, NOT THE OTHER WAY ROUND
 *   flat   → Flat No. · Floor · Suitable For (Family / Bachelor / Both) · money
 *   room   → Room No. · Floor · money                      (one tenant per room)
 *   seat   → Room No. · Floor · Seats · money              (rent splits N ways)
 * `rentedAs` was locked when the building was created, so a seat building can
 * only ever produce seat rooms — a whole-room tenancy can't be created over a
 * room that already holds four seats.
 *
 * ORDERING
 * Ground floor up, then 101 · 102 · 110 within each floor (natural-numeric, so
 * 110 sorts after 102). The server sorts; this renders the floor groups.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, X, Loader2, Users, Home, BedDouble, Trash2, Pencil,
  UserPlus, ChevronDown, ChevronUp, DoorOpen, Check, RefreshCw,
} from 'lucide-react';
import { listUnits, createUnit, archiveUnit, updateUnit } from '../../services/buildingService';
import SeatTenantModal from './SeatTenantModal';
import TenantDetailModal from './TenantDetailModal';
import {
  SUITABLE_FOR, suitableForCardLabel, suitableForColor, unitNoun,
} from '../../utils/buildingTypes';

// 0 is the ground floor and must read as such — "Floor 0" is not a thing a
// landlord says. Negative floors are basements.
const floorLabel = (n, isBn) => {
  const f = Number(n);
  if (f === 0) return isBn ? 'নিচতলা' : 'Ground Floor';
  if (f < 0) return isBn ? `বেসমেন্ট ${Math.abs(f)}` : `Basement ${Math.abs(f)}`;
  return isBn ? `${f}য় তলা` : `Floor ${f}`;
};

export default function UnitsManager({
  building,
  language,
  showToast,
  onAddTenant,      // (unit, seatIndex) => void — opens the lease form for a seat
  formatBDT,
}) {
  const isBn = language === 'বাংলা';
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Which seat is being filled or swapped. The tenant form is seat-scoped: it
  // never creates a room and never creates a second booking for this one.
  const [seatTarget, setSeatTarget] = useState(null);
  // Reading back the eleven fields and the photo. Until this existed the intake
  // form wrote details nobody could ever look at again — which is exactly when
  // they matter: the moment something goes wrong and you need to reach someone.
  const [viewing, setViewing] = useState(null);
  // Which flat's "Suitable For" is being changed. It is a label, so it can be
  // corrected freely — a landlord who let 102 to a family this year and to
  // bachelors the next changes one word, not the flat.
  const [editingSuitable, setEditingSuitable] = useState(null);

  const isSeat = building?.rentedAs === 'seat';
  const isFlat = building?.rentedAs === 'flat';
  const noun = unitNoun(building, isBn);

  const blank = {
    roomNumber: '', floor: 0, seatCapacity: 2,
    suitableFor: '', monthlyRent: '', serviceCharge: '', rentDueDay: '',
  };
  const [form, setForm] = useState(blank);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    if (!building?.id) return;
    setLoading(true);
    try {
      const { units: rows } = await listUnits(building.id);
      setUnits(rows);
    } catch (err) {
      showToast?.(err.message || (isBn ? 'রুম লোড ব্যর্থ' : 'Could not load rooms'));
    } finally {
      setLoading(false);
    }
  }, [building?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!String(form.roomNumber).trim()) {
      showToast?.(isBn ? `${noun} নম্বর দিন` : `Enter the ${noun.toLowerCase()} number`);
      return;
    }
    setSaving(true);
    try {
      await createUnit(building.id, {
        roomNumber: String(form.roomNumber).trim(),
        floor: Number(form.floor) || 0,
        // Seats only exist in a seat building; the server pins this too.
        seatCapacity: isSeat ? Number(form.seatCapacity) || 1 : 1,
        // Family / Bachelor / Both — flats only, and optional.
        suitableFor: isFlat ? form.suitableFor : '',
        // Blank falls back to the building's defaults, so 30 rooms don't need
        // the rent typed 30 times.
        ...(form.monthlyRent !== '' ? { monthlyRent: Number(form.monthlyRent) } : {}),
        ...(form.serviceCharge !== '' ? { serviceCharge: Number(form.serviceCharge) } : {}),
        ...(form.rentDueDay !== '' ? { rentDueDay: Number(form.rentDueDay) } : {}),
      });
      // Keep floor + money for the next one: a landlord adding a whole floor
      // changes only the number.
      setForm((f) => ({ ...blank, floor: f.floor, monthlyRent: f.monthlyRent, serviceCharge: f.serviceCharge, rentDueDay: f.rentDueDay, seatCapacity: f.seatCapacity, suitableFor: f.suitableFor }));
      await load();
      showToast?.(isBn ? `${noun} যোগ হয়েছে` : `${noun} added`);
    } catch (err) {
      showToast?.(err.message || (isBn ? 'যোগ করা যায়নি' : 'Could not add it'));
    } finally {
      setSaving(false);
    }
  };

  const setSuitableFor = async (unit, value) => {
    try {
      await updateUnit(unit.id, { suitableFor: value });
      setEditingSuitable(null);
      await load();
    } catch (err) {
      showToast?.(err.message || (isBn ? 'বদলানো যায়নি' : 'Could not change it'));
    }
  };

  const remove = async (unit) => {
    try {
      await archiveUnit(unit.id);
      setConfirmDelete(null);
      await load();
      showToast?.(isBn ? 'মুছে ফেলা হয়েছে' : 'Removed');
    } catch (err) {
      showToast?.(err.message || (isBn ? 'মুছে ফেলা যায়নি' : 'Could not remove it'));
    }
  };

  const labelCls = 'text-[10px] font-black text-gray-400 uppercase tracking-widest';
  const inputCls = 'w-full mt-1.5 p-3 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none border border-gray-200 focus:border-[#ba0036]/30 transition-all';

  // Group into floors so the list reads like the building itself.
  const floors = [];
  units.forEach((u) => {
    const last = floors[floors.length - 1];
    if (last && last.floor === u.floor) last.units.push(u);
    else floors.push({ floor: u.floor, units: [u] });
  });

  const totalSeats = units.reduce((n, u) => n + (Number(u.seatCapacity) || 1), 0);
  const totalTaken = units.reduce((n, u) => n + (u.occupiedSeats || 0), 0);

  return (
    <div className="w-full">

      {/* ── Header — what this building holds right now ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <DoorOpen size={12} className="text-[#ba0036]" />
          {isBn ? `${noun}` : `${noun}s`}
          <span className="text-gray-400 tabular-nums">{units.length}</span>
        </span>
        {isSeat && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
            <Users size={12} className="text-[#ba0036]" />
            {isBn ? 'সিট' : 'Seats'}
            <span className="tabular-nums text-emerald-600">{totalTaken}</span>
            <span className="text-gray-300">/</span>
            <span className="tabular-nums text-gray-400">{totalSeats}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 bg-[#ba0036] hover:bg-[#a0002f] text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(186,0,54,0.25)] active:scale-95"
        >
          {adding ? <X size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
          {adding ? (isBn ? 'বাতিল' : 'Cancel') : (isBn ? `${noun} যোগ` : `Add ${noun}`)}
        </button>
      </div>

      {/* ── Add form — shaped by how this building is let ── */}
      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isBn ? `${noun} নম্বর` : `${noun} No.`}</label>
              <input
                autoFocus
                type="text"
                value={form.roomNumber}
                onChange={(e) => set({ roomNumber: e.target.value })}
                placeholder={isBn ? 'যেমন ১০১' : 'e.g. 101'}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{isBn ? 'ফ্লোর' : 'Floor'}</label>
              <input
                type="number"
                value={form.floor}
                onChange={(e) => set({ floor: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
              <p className="text-[9px] font-bold text-gray-400 mt-1">{isBn ? '০ = নিচতলা' : '0 = ground floor'}</p>
            </div>
          </div>

          {/* Suitable For — FLATS ONLY. One building holds any mix. */}
          {isFlat && (
            <div className="mt-3">
              <label className={labelCls}>{isBn ? 'কাদের জন্য উপযুক্ত' : 'Suitable For'}</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {SUITABLE_FOR.map((s) => {
                  const on = form.suitableFor === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set({ suitableFor: on ? '' : s.id })}
                      className={`px-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 inline-flex items-center justify-center gap-1 ${
                        on ? 'bg-[#ba0036] text-white border-[#ba0036]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {on && <Check size={11} strokeWidth={3.5} />}
                      {isBn ? s.bn : s.en}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seats — SEAT BUILDINGS ONLY. */}
          {isSeat && (
            <div className="mt-3">
              <label className={labelCls}>{isBn ? 'এই রুমে কয়টি সিট?' : 'How many seats in this room?'}</label>
              <input
                type="number" min="1" max="60"
                value={form.seatCapacity}
                onChange={(e) => set({ seatCapacity: e.target.value })}
                className={inputCls}
              />
              <p className="text-[9px] font-bold text-gray-400 mt-1">
                {isBn ? 'রুমের ভাড়া সিটগুলোতে সমানভাবে ভাগ হবে' : 'The room rent splits equally across the seats'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className={labelCls}>{isBn ? 'ভাড়া (৳)' : 'Rent (৳)'}</label>
              <input type="number" min="0" value={form.monthlyRent} onChange={(e) => set({ monthlyRent: e.target.value })} placeholder={String(building?.defaultMonthlyRent || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{isBn ? 'সার্ভিস (৳)' : 'Service (৳)'}</label>
              <input type="number" min="0" value={form.serviceCharge} onChange={(e) => set({ serviceCharge: e.target.value })} placeholder={String(building?.defaultServiceCharge || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{isBn ? 'ডিউ ডে' : 'Due Day'}</label>
              <input type="number" min="1" max="28" value={form.rentDueDay} onChange={(e) => set({ rentDueDay: e.target.value })} placeholder={String(building?.defaultRentDueDay || 5)} className={inputCls} />
            </div>
          </div>
          <p className="text-[9px] font-bold text-gray-400 mt-1.5">
            {isBn ? 'খালি রাখলে বিল্ডিংয়ের ডিফল্ট ব্যবহার হবে' : 'Leave blank to use the building defaults'}
          </p>

          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="mt-3 w-full bg-gray-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> {isBn ? 'সেভ হচ্ছে' : 'Saving'}</>
              : <><Plus size={14} strokeWidth={3} /> {isBn ? `${noun} যোগ করুন` : `Add ${noun}`}</>}
          </button>
        </div>
      )}

      {/* ── The list ── */}
      {loading ? (
        <div className="py-12 flex items-center justify-center text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : units.length === 0 ? (
        <div className="text-center py-12 px-5 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <DoorOpen className="text-gray-300 mx-auto mb-3" size={30} />
          <h3 className="text-sm font-black text-gray-900">
            {isBn ? `এখনো কোনো ${noun} নেই` : `No ${noun.toLowerCase()}s yet`}
          </h3>
          <p className="text-[11px] font-bold text-gray-500 mt-1.5 max-w-[300px] mx-auto leading-relaxed">
            {isBn
              ? `${noun} একবার তৈরি করলেই হবে — ভাড়াটিয়া বদলালেও ${noun} থেকে যাবে।`
              : `Create each ${noun.toLowerCase()} once — it stays put as tenants come and go.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {floors.map(({ floor, units: rows }) => (
            <div key={floor}>
              {/* Floor heading — the building read from the ground up. */}
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {floorLabel(floor, isBn)}
                </span>
                <span className="text-[10px] font-black text-gray-300 tabular-nums">{rows.length}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-2">
                {rows.map((u) => {
                  const open = expanded === u.id;
                  const capacity = Number(u.seatCapacity) || 1;
                  const taken = u.occupiedSeats || 0;
                  const full = taken >= capacity;
                  return (
                    <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : u.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-gray-50/60 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${full ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          {isSeat ? <Users size={16} /> : isFlat ? <Home size={16} /> : <BedDouble size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-[13px] font-black text-gray-900">{noun} {u.roomNumber}</h4>
                            {/* Family / Bachelor / Family + Bachelor — flats only. */}
                            {u.suitableFor && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${suitableForColor(u.suitableFor)}`}>
                                {suitableForCardLabel(u.suitableFor, isBn)}
                              </span>
                            )}
                            {isSeat && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border tabular-nums ${full ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {taken}/{capacity} {isBn ? 'সিট' : 'seats'}
                              </span>
                            )}
                            {!isSeat && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${full ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {full ? (isBn ? 'ভাড়া হয়েছে' : 'Occupied') : (isBn ? 'খালি' : 'Vacant')}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">
                            <span className="tabular-nums">{formatBDT ? formatBDT(u.monthlyRent) : `৳${u.monthlyRent}`}</span>
                            {u.occupants?.length > 0 && (
                              <>
                                <span className="mx-1 text-gray-300">·</span>
                                {u.occupants.map((o) => o.name || (isBn ? 'নামহীন' : 'Unnamed')).join(', ')}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
                          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {open && (
                        <div className="border-t border-gray-100 bg-gray-50/40 px-3 py-3 animate-in slide-in-from-top-1 duration-200">
                          {/* Seat grid — every seat, filled or empty. An empty
                              seat is a one-tap "add tenant HERE", which is the
                              whole reason the room exists on its own. */}
                          <div className="space-y-1.5">
                            {Array.from({ length: capacity }).map((_, i) => {
                              const person = u.occupants?.[i] || null;
                              return (
                                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border border-gray-100">
                                  <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${person ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {i + 1}
                                  </span>
                                  {person ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setViewing({ person, unit: u })}
                                        className="text-xs font-bold text-gray-900 truncate flex-1 text-left hover:text-[#ba0036] hover:underline underline-offset-2 transition-colors"
                                        title={isBn ? 'বিস্তারিত দেখুন' : 'View details'}
                                      >
                                        {person.name || (isBn ? 'নামহীন' : 'Unnamed')}
                                      </button>
                                      {person.phone && <span className="hidden sm:inline text-[10px] font-bold text-gray-400 shrink-0 tabular-nums">{person.phone}</span>}
                                      {/* Same seat, new person — the room, its
                                          rent and this seat all stay put. */}
                                      <button
                                        type="button"
                                        onClick={() => setSeatTarget({ unit: u, seatNumber: i + 1, member: { id: person.memberId, name: person.name } })}
                                        disabled={!person.memberId}
                                        className="shrink-0 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-600 hover:text-amber-700 hover:border-amber-200 active:scale-95 transition-all inline-flex items-center gap-1 disabled:opacity-40"
                                        title={isBn ? 'ভাড়াটিয়া বদলান' : 'Replace tenant'}
                                      >
                                        <RefreshCw size={10} /> {isBn ? 'বদলান' : 'Replace'}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs font-bold text-gray-400 flex-1">
                                        {isSeat ? (isBn ? 'সিট খালি' : 'Seat vacant') : (isBn ? 'খালি' : 'Vacant')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSeatTarget({ unit: u, seatNumber: i + 1, member: null })}
                                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all inline-flex items-center gap-1"
                                      >
                                        <UserPlus size={11} /> {isBn ? 'ভাড়াটিয়া' : 'Add tenant'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Suitable For — flats only, and editable, because
                              it is classification rather than structure. */}
                          {isFlat && (
                            <div className="mt-3">
                              {editingSuitable === u.id ? (
                                <div className="grid grid-cols-3 gap-2">
                                  {SUITABLE_FOR.map((so) => (
                                    <button
                                      key={so.id}
                                      type="button"
                                      onClick={() => setSuitableFor(u, u.suitableFor === so.id ? '' : so.id)}
                                      className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${u.suitableFor === so.id ? 'bg-[#ba0036] text-white border-[#ba0036]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                    >
                                      {isBn ? so.bn : so.en}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingSuitable(u.id)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] font-black text-gray-600 hover:text-[#ba0036] hover:border-[#ba0036]/30 transition-all active:scale-95"
                                >
                                  <Pencil size={11} />
                                  {isBn ? 'কাদের জন্য: ' : 'Suitable for: '}
                                  {u.suitableFor
                                    ? suitableForCardLabel(u.suitableFor, isBn)
                                    : (isBn ? 'বলা হয়নি' : 'not set')}
                                </button>
                              )}
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500">
                              {isBn ? 'সার্ভিস' : 'Service'} <span className="tabular-nums">{formatBDT ? formatBDT(u.serviceCharge) : u.serviceCharge}</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              {isBn ? 'ডিউ' : 'Due'} <span className="tabular-nums">{u.rentDueDay}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              className="ml-auto shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                              title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <TenantDetailModal
          tenant={{ ...viewing.person, moveInDate: viewing.person.joinDate }}
          unit={viewing.unit}
          building={building}
          language={language}
          onClose={() => setViewing(null)}
          onReplace={viewing.person.memberId ? () => {
            const seatNumber = (viewing.unit.occupants || []).findIndex(o => o.memberId === viewing.person.memberId) + 1;
            setSeatTarget({ unit: viewing.unit, seatNumber: seatNumber || 1, member: { id: viewing.person.memberId, name: viewing.person.name } });
            setViewing(null);
          } : undefined}
        />
      )}

      {/* Seat-scoped tenant form — add into an empty seat, or swap the person
          in an occupied one. Never creates a room or a second booking. */}
      {seatTarget && (
        <SeatTenantModal
          unit={seatTarget.unit}
          building={building}
          seatNumber={seatTarget.seatNumber}
          replacingMember={seatTarget.member}
          language={language}
          showToast={showToast}
          formatBDT={formatBDT}
          onClose={() => setSeatTarget(null)}
          onSaved={load}
        />
      )}

      {/* Delete confirmation — refused server-side while anyone lives here. */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-rose-600 mx-auto">
              <Trash2 size={22} strokeWidth={2.5} />
            </div>
            <h3 className="text-base font-black text-gray-900 text-center mb-2">
              {isBn ? `${noun} ${confirmDelete.roomNumber} মুছবেন?` : `Remove ${noun} ${confirmDelete.roomNumber}?`}
            </h3>
            <p className="text-xs font-bold text-gray-500 text-center mb-5 leading-relaxed">
              {isBn
                ? 'পুরোনো লিজ ও ভাড়ার হিসাব মুছে যাবে না — শুধু তালিকা থেকে সরে যাবে।'
                : 'Past leases and rent history are kept — this only takes it off the list.'}
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button onClick={() => remove(confirmDelete)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                {isBn ? 'মুছুন' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
