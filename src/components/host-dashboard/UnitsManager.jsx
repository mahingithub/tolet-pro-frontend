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
  UserPlus, ChevronDown, ChevronUp, DoorOpen, Check, RefreshCw, QrCode,
} from 'lucide-react';
import InviteShareSheet from '../invite/InviteShareSheet';
import { listUnits, createUnit, createUnitsBulk, archiveUnit, updateUnit } from '../../services/buildingService';
import SeatTenantModal from './SeatTenantModal';
import { submitOnEnter } from '../../utils/submitOnEnter';
import TenantDetailModal from './TenantDetailModal';
import {
  SUITABLE_FOR, suitableForCardLabel, suitableForColor, unitNoun,
} from '../../utils/buildingTypes';

// Expand "101" → "109" into the nine room numbers it means.
//
// MIRRORS expandRoomRange() in the backend's building.controller.js. The server
// is authoritative — this copy exists only so the landlord can SEE what is
// about to be created before pressing the button. Kept deliberately simple so
// the two cannot drift: same prefix and suffix, only the number moves, and zero
// padding is preserved because "007" and "7" are different doors.
const MAX_RANGE = 200;
export const expandRoomRange = (from, to) => {
  const a = String(from || '').trim();
  const b = String(to || '').trim();
  if (!a || !b) return { rooms: [], error: 'both' };
  const shape = /^(\D*)(\d+)(\D*)$/;
  const ma = shape.exec(a);
  const mb = shape.exec(b);
  if (!ma || !mb) return { rooms: [], error: 'shape' };
  if (ma[1] !== mb[1] || ma[3] !== mb[3]) return { rooms: [], error: 'mismatch' };
  const start = parseInt(ma[2], 10);
  const end = parseInt(mb[2], 10);
  if (end < start) return { rooms: [], error: 'backwards' };
  if (end - start + 1 > MAX_RANGE) return { rooms: [], error: 'toomany' };
  const width = ma[2].length;
  const pad = (n) => (ma[2].startsWith('0') ? String(n).padStart(width, '0') : String(n));
  const rooms = [];
  for (let n = start; n <= end; n += 1) rooms.push(`${ma[1]}${pad(n)}${ma[3]}`);
  return { rooms, error: null };
};

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
  formatBDT,
  // Adding or replacing a tenant writes a BOOKING, not just a unit. Reloading
  // only the room list left the Tenants tab and Rent Collection showing stale
  // data until the page was refreshed by hand.
  onBookingsChanged,
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
  // Which invite the QR/link sheet is showing: { scope:'building' } for the
  // universal one, or { scope:'unit', unit } for a single room. One piece of
  // state for both, because only ever one sheet is open.
  const [shareTarget, setShareTarget] = useState(null);

  const isSeat = building?.rentedAs === 'seat';
  const isFlat = building?.rentedAs === 'flat';
  const noun = unitNoun(building, isBn);

  const blank = {
    roomNumber: '', floor: 0, seatCapacity: 2,
    suitableFor: '', monthlyRent: '', serviceCharge: '', rentDueDay: '',
  };
  const [form, setForm] = useState(blank);
  // A floor is built in one go in the real world. Adding thirty rooms through
  // thirty forms is why a landlord with 70–80 rooms never finishes setting up.
  const [bulk, setBulk] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  const preview = expandRoomRange(range.from, range.to);
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

  const submitRange = async () => {
    if (preview.error || !preview.rooms.length) {
      showToast?.(isBn ? 'রুম নম্বরের পরিসরটি ঠিক করুন' : 'Check the room number range');
      return;
    }
    setSaving(true);
    try {
      const r = await createUnitsBulk(building.id, {
        from: range.from.trim(),
        to: range.to.trim(),
        floor: Number(form.floor) || 0,
        seatCapacity: isSeat ? Number(form.seatCapacity) || 1 : 1,
        suitableFor: isFlat ? form.suitableFor : '',
        ...(form.monthlyRent !== '' ? { monthlyRent: Number(form.monthlyRent) } : {}),
        ...(form.serviceCharge !== '' ? { serviceCharge: Number(form.serviceCharge) } : {}),
        ...(form.rentDueDay !== '' ? { rentDueDay: Number(form.rentDueDay) } : {}),
      });
      setRange({ from: '', to: '' });
      await load();
      // Skipped rooms are said out loud: silently creating 6 of 15 and
      // reporting "done" leaves the landlord counting doors to find out.
      showToast?.(r.skipped
        ? (isBn
            ? `${r.created}টি ${noun} যোগ হয়েছে · ${r.skipped}টি আগে থেকেই ছিল`
            : `${r.created} added · ${r.skipped} already existed`)
        : (isBn ? `${r.created}টি ${noun} যোগ হয়েছে` : `${r.created} ${noun.toLowerCase()}s added`));
    } catch (err) {
      showToast?.(err.message || (isBn ? 'যোগ করা যায়নি' : 'Could not add them'));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (bulk) return submitRange();
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
        {/* The building's UNIVERSAL invite — the one that goes in the house
            WhatsApp group, or gets printed and taped up by the gate. It sits
            here, inside the building the landlord already opened, rather than
            on the dashboard home: there is one of these per building, and the
            landlord is holding the building when they want it.

            Shown only once there are rooms to pick from, because the tenant's
            first step through this link is choosing one. */}
        {units.length > 0 && (
          <button
            type="button"
            onClick={() => setShareTarget({ scope: 'building' })}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-900 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
            title={isBn ? 'সবাইকে ইনভাইট করুন' : 'Invite everyone'}
          >
            <QrCode size={13} />
            {isBn ? 'সবাইকে ইনভাইট' : 'Invite all'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className={`${units.length > 0 ? '' : 'ml-auto '}shrink-0 inline-flex items-center gap-1.5 bg-[#ba0036] hover:bg-[#a0002f] text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(186,0,54,0.25)] active:scale-95`}
        >
          {adding ? <X size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
          {adding ? (isBn ? 'বাতিল' : 'Cancel') : (isBn ? `${noun} যোগ` : `Add ${noun}`)}
        </button>
      </div>

      {/* ── Add form — shaped by how this building is let ── */}
      {adding && (
        <div
          className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-in slide-in-from-top-2 duration-200"
          onKeyDown={submitOnEnter(submit, { enabled: !saving })}
        >
          {/* One room, or a whole floor. Thirty rooms through thirty forms is
              why a 70–80 room building never got set up. */}
          <div className="flex items-center gap-1.5 mb-3">
            {[
              { id: false, en: 'One at a time', bn: 'একটি করে' },
              { id: true,  en: 'A whole range', bn: 'একসাথে অনেকগুলো' },
            ].map((m) => (
              <button
                key={String(m.id)}
                type="button"
                onClick={() => setBulk(m.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
                  bulk === m.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {isBn ? m.bn : m.en}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {bulk ? (
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isBn ? 'শুরু' : 'From'}</label>
                  <input
                    autoFocus
                    type="text"
                    value={range.from}
                    onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                    placeholder={isBn ? 'যেমন ১০১' : 'e.g. 101'}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isBn ? 'শেষ' : 'To'}</label>
                  <input
                    type="text"
                    value={range.to}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    placeholder={isBn ? 'যেমন ১০৯' : 'e.g. 109'}
                    className={inputCls}
                  />
                </div>
                {/* What is about to be created, before the button is pressed. */}
                {(range.from || range.to) && (
                  <div className="col-span-2">
                    {preview.error ? (
                      <p className="text-[10px] font-bold text-rose-600 leading-relaxed">
                        {preview.error === 'mismatch'
                          ? (isBn ? 'শুরু ও শেষের গঠন এক হতে হবে — যেমন A101 থেকে A109।' : 'Both ends must share a shape — e.g. A101 to A109.')
                          : preview.error === 'backwards'
                            ? (isBn ? 'শেষ নম্বরটি শুরুর চেয়ে বড় হতে হবে।' : 'The last number must be higher than the first.')
                            : preview.error === 'toomany'
                              ? (isBn ? 'একবারে সর্বোচ্চ ২০০টি রুম।' : 'At most 200 rooms at a time.')
                              : preview.error === 'shape'
                                ? (isBn ? 'রুম নম্বরে অন্তত একটি সংখ্যা থাকতে হবে।' : 'A room number needs at least one digit.')
                                : (isBn ? 'শুরু ও শেষ দুটোই দিন।' : 'Enter both ends of the range.')}
                      </p>
                    ) : (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                        <p className="text-[11px] font-black text-emerald-800">
                          {isBn
                            ? `${preview.rooms.length}টি ${noun} তৈরি হবে`
                            : `${preview.rooms.length} ${noun.toLowerCase()}${preview.rooms.length === 1 ? '' : 's'} will be created`}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-700/80 truncate mt-0.5 tabular-nums">
                          {preview.rooms.slice(0, 8).join(' · ')}
                          {preview.rooms.length > 8 ? ` … ${preview.rooms[preview.rooms.length - 1]}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
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
            )}
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
              : <><Plus size={14} strokeWidth={3} /> {bulk && preview.rooms.length
                  ? (isBn ? `${preview.rooms.length}টি ${noun} যোগ করুন` : `Add ${preview.rooms.length} ${noun.toLowerCase()}s`)
                  : (isBn ? `${noun} যোগ করুন` : `Add ${noun}`)}</>}
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
                            {/* This room's own invite link. The one that matters
                                most is on an EMPTY room — that is the room a
                                landlord is trying to fill, and the link is what
                                they send to the person moving in. */}
                            <button
                              type="button"
                              onClick={() => setShareTarget({ scope: 'unit', unit: u })}
                              className="ml-auto shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                              title={isBn ? 'এই রুমের ইনভাইট লিংক' : "This room's invite link"}
                            >
                              <QrCode size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
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

      {shareTarget && (
        <InviteShareSheet
          scope={shareTarget.scope}
          buildingId={building?.id}
          unitId={shareTarget.unit?.id}
          buildingName={building?.name || ''}
          roomLabel={shareTarget.unit ? `${noun} ${shareTarget.unit.roomNumber}` : ''}
          language={language}
          onClose={() => setShareTarget(null)}
        />
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
          onSaved={() => { load(); onBookingsChanged?.(); }}
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
