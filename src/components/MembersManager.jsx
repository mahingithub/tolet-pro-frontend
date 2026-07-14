import React, { useMemo, useState } from 'react';
import {
  Users, UserPlus, Copy, Check, X, LogOut, Undo2, CheckCircle2, Plus,
} from 'lucide-react';
import {
  addMember as addMemberApi,
  updateMemberLedger as updateMemberLedgerApi,
  undoMemberLedger as undoMemberLedgerApi,
  removeMember as removeMemberApi,
} from '../services/bookingService';

/**
 * MembersManager — multi-member rent management for a single booking.
 * ──────────────────────────────────────────────────────────────────────────
 * Renders inside a Bookings-tab lease card. Lets a landlord:
 *   • see every occupant (flat / room / seat) + their per-month rent status
 *   • mark a member's month paid / due / undo (per-member ledger + receipt)
 *   • add a member, share the invite code, move a member out
 *
 * Self-contained: talks to bookingService directly and reports the updated
 * booking back via onChange so the parent replaces it in its bookings state.
 * Legacy single-tenant bookings (no members[]) simply show the add-member CTA.
 */

const pad = (n) => String(n).padStart(2, '0');
const mKey = (y, m) => `${y}-${pad(m)}`;
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_BN = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];

function enumerateLeaseMonths(leaseStart, leaseEnd) {
  if (!leaseStart || !leaseEnd) return [];
  const start = new Date(leaseStart);
  const end = new Date(leaseEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  let safety = 0;
  while (cur <= last && safety < 600) {
    out.push(mKey(cur.getFullYear(), cur.getMonth() + 1));
    cur.setMonth(cur.getMonth() + 1);
    safety += 1;
  }
  return out;
}

function monthShort(key, isBn) {
  const [y, m] = String(key).split('-').map(Number);
  if (!m) return '';
  return `${(isBn ? MONTHS_BN : MONTHS_EN)[m - 1]} ${String(y).slice(-2)}`;
}

function dueDateOf(key, dueDay) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return null;
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, dueDay || 5), lastDay);
  return new Date(y, m - 1, day);
}

// Mirrors HostDashboard.getRentStatus so the member grid reads the same as the
// legacy rent matrix. ledger is a plain object keyed by 'YYYY-MM'.
function memberRentStatus(booking, ledger, key, today) {
  const entry = ledger && ledger[key];
  if (entry && entry.paid) {
    if (entry.status === 'partial' || (Number(entry.balance) || 0) > 0) return 'partial';
    return 'paid';
  }
  if (entry && entry.status === 'due') return 'due-marked';
  const due = dueDateOf(key, booking.rentDueDay);
  if (!due) return 'upcoming';
  const lead = new Date(due);
  lead.setDate(lead.getDate() - (booking.reminderLeadDays || 3));
  if (today > due) return 'overdue';
  if (today >= lead) return 'due-soon';
  return 'upcoming';
}

const CELL_STYLE = {
  paid:         'bg-green-500 text-white border-green-500',
  partial:      'bg-amber-400 text-white border-amber-400',
  'due-marked': 'bg-rose-500 text-white border-rose-500',
  overdue:      'bg-rose-500 text-white border-rose-500',
  'due-soon':   'bg-orange-100 text-orange-700 border-orange-200',
  upcoming:     'bg-gray-50 text-gray-400 border-gray-200',
};

const taka = (n) => `৳${(Number(n) || 0).toLocaleString('en-IN')}`;
const isMongoId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));

function spaceLabel(m, isBn) {
  const parts = [m.floor, m.roomLabel, m.seatLabel].filter(Boolean);
  if (parts.length) return parts.join(' • ');
  if (m.rentType === 'flat') return isBn ? 'পুরো ফ্ল্যাট' : 'Whole flat';
  if (m.rentType === 'room') return isBn ? 'রুম' : 'Room';
  return isBn ? 'সিট' : 'Seat';
}

export default function MembersManager({ booking, language = 'English', onChange, today = new Date(), showLedger = true, showManage = true }) {
  const isBn = language === 'বাংলা';
  const bookingId = booking._id || booking.id;
  const persistable = isMongoId(bookingId);

  const members = Array.isArray(booking.members) ? booking.members : [];
  const activeMembers = members.filter((m) => m.status !== 'moved-out');
  const capacity = Number(booking.capacity || booking.propertyCapacity || 0);

  const months = useMemo(
    () => enumerateLeaseMonths(booking.leaseStart, booking.leaseEnd),
    [booking.leaseStart, booking.leaseEnd],
  );

  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cell, setCell] = useState(null); // { memberId, key }
  const defaultRentType = 'seat'; // hostel occupants are seats
  const [form, setForm] = useState({
    name: '', phone: '', rentType: defaultRentType,
    // New seats inherit the booking's floor + room, so adding occupants to the
    // same room only needs the seat label + tenant name.
    floor: booking.floorNumber || '', roomLabel: booking.roomNumber || '', seatLabel: '',
    monthlyRent: '',
  });

  const emit = (updated) => { if (updated && typeof onChange === 'function') onChange(updated); };

  const copyInvite = () => {
    if (!booking.inviteCode) return;
    try {
      navigator.clipboard.writeText(booking.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — no-op */ }
  };

  const submitAdd = async () => {
    if (!persistable) return;
    if (!form.name.trim() && !form.phone.trim()) return;
    setBusy(true);
    try {
      const updated = await addMemberApi(bookingId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        rentType: form.rentType,
        floor: form.floor.trim(),
        roomLabel: form.roomLabel.trim(),
        seatLabel: form.seatLabel.trim(),
        monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : undefined,
      });
      emit(updated);
      setForm({ name: '', phone: '', rentType: defaultRentType, floor: booking.floorNumber || '', roomLabel: booking.roomNumber || '', seatLabel: '', monthlyRent: '' });
      setShowAdd(false);
    } catch (err) {
      console.warn('[members] add failed:', err.message || err);
    } finally {
      setBusy(false);
    }
  };

  const markCell = async (member, key, action) => {
    if (!persistable) return;
    setBusy(true);
    setCell(null);
    try {
      const monthLabel = monthShort(key, isBn);
      let updated;
      if (action === 'undo') {
        updated = await undoMemberLedgerApi(bookingId, member.id, key);
      } else if (action === 'due') {
        updated = await updateMemberLedgerApi(bookingId, member.id, key, {
          status: 'due', dueNote: '—', monthLabel, totalDue: Number(member.monthlyRent) || 0,
        });
      } else {
        const rent = Number(member.monthlyRent) || Number(booking.monthlyRent) || 0;
        updated = await updateMemberLedgerApi(bookingId, member.id, key, {
          status: 'full', amount: rent, balance: 0,
          paidOn: new Date().toISOString().slice(0, 10), method: 'Cash',
          monthLabel, totalDue: rent,
        });
      }
      emit(updated);
    } catch (err) {
      console.warn('[members] mark failed:', err.message || err);
    } finally {
      setBusy(false);
    }
  };

  const moveOut = async (member) => {
    if (!persistable) return;
    setBusy(true);
    try {
      const updated = await removeMemberApi(bookingId, member.id);
      emit(updated);
    } catch (err) {
      console.warn('[members] move-out failed:', err.message || err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 bg-white rounded-xl border border-gray-100 p-3">
      {/* Management chrome (occupancy, invite, add member) — Bookings tab only.
          The Rent Collection tab passes showManage={false} for a clean card. */}
      {showManage && (<>
      {/* Header — occupancy + invite */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <div className="flex items-center gap-1.5 text-gray-700">
          <Users size={13} className="text-[#ba0036]" />
          <span className="text-[11px] font-black uppercase tracking-widest">
            {isBn ? 'সদস্য / ভাড়াটিয়া' : 'Members'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] font-black text-gray-600 tabular-nums">
            {activeMembers.length}{capacity > 0 ? ` / ${capacity}` : ''}
          </span>
          {capacity > 0 && capacity - activeMembers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[9px] font-black text-emerald-700">
              {capacity - activeMembers.length} {isBn ? 'খালি' : 'vacant'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {booking.inviteCode && (
            <button
              type="button"
              onClick={copyInvite}
              className="px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[10px] font-black text-gray-700 inline-flex items-center gap-1"
              title={isBn ? 'ইনভাইট কোড কপি করুন' : 'Copy invite code'}
            >
              {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
              <span className="tabular-nums tracking-widest">{booking.inviteCode}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            disabled={!persistable}
            className="px-2.5 py-1 rounded-lg bg-[#ba0036] hover:bg-[#a1002f] disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
          >
            {showAdd ? <X size={11} /> : <UserPlus size={11} />}
            {showAdd ? (isBn ? 'বন্ধ' : 'Close') : (isBn ? 'সদস্য যোগ' : 'Add')}
          </button>
        </div>
      </div>

      {!persistable && (
        <p className="text-[10px] font-bold text-amber-600 mb-2">
          {isBn ? 'সদস্য যোগ করতে বুকিংটি সেভ হওয়া দরকার।' : 'Save the booking first to manage members.'}
        </p>
      )}

      {/* Add member form */}
      {showAdd && persistable && (
        <div className="mb-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isBn ? 'নাম' : 'Name'}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={isBn ? 'ফোন' : 'Phone'}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              placeholder={isBn ? 'ফ্লোর' : 'Floor'}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
            <input
              value={form.roomLabel}
              onChange={(e) => setForm({ ...form, roomLabel: e.target.value })}
              placeholder={isBn ? 'রুম (৩০১)' : 'Room (301)'}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
            <input
              value={form.seatLabel}
              onChange={(e) => setForm({ ...form, seatLabel: e.target.value })}
              placeholder={isBn ? 'সিট (১)' : 'Seat (1)'}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: e.target.value.replace(/[^0-9]/g, '') })}
              placeholder={isBn ? `মাসিক ভাড়া (ডিফল্ট ${taka(booking.monthlyRent)})` : `Monthly rent (default ${taka(booking.monthlyRent)})`}
              inputMode="numeric"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold outline-none focus:border-[#ba0036]"
            />
            <button
              type="button"
              onClick={submitAdd}
              disabled={busy || (!form.name.trim() && !form.phone.trim())}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
            >
              <Plus size={12} /> {isBn ? 'যোগ করুন' : 'Add'}
            </button>
          </div>
        </div>
      )}
      </>)}

      {/* Member list */}
      {activeMembers.length === 0 ? (
        <p className="text-[11px] font-semibold text-gray-400 py-2 text-center">
          {isBn ? 'এখনো কোনো সদস্য নেই। উপরে "সদস্য যোগ" চাপুন।' : 'No members yet. Tap "Add" above.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {activeMembers.map((m) => {
            const ledger = m.ledger || {};
            const initials = (m.name || '?').trim().slice(0, 1).toUpperCase();
            return (
              <div key={m.id} className="rounded-xl border border-gray-100 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-[11px] font-black shrink-0 overflow-hidden">
                      {m.avatar ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" /> : initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-gray-900 truncate">{m.name || (isBn ? 'নামহীন' : 'Unnamed')}</p>
                        {m.userId && <CheckCircle2 size={11} className="text-blue-500 shrink-0" title={isBn ? 'অ্যাকাউন্ট যুক্ত' : 'Account linked'} />}
                      </div>
                      <p className="text-[9px] font-bold text-gray-500 truncate">
                        {spaceLabel(m, isBn)} <span className="text-gray-300">·</span> <span className="tabular-nums">{taka(m.monthlyRent || booking.monthlyRent)}</span>
                      </p>
                    </div>
                  </div>
                  {showManage && (
                  <button
                    type="button"
                    onClick={() => moveOut(m)}
                    disabled={busy}
                    className="px-2 py-1 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-600 text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shrink-0"
                    title={isBn ? 'মুভ-আউট' : 'Move out'}
                  >
                    <LogOut size={11} /> {isBn ? 'মুভ-আউট' : 'Move out'}
                  </button>
                  )}
                </div>

                {/* Rent collection strip — only in the Rent Collection tab.
                    The Bookings tab hides it (member management only). */}
                {showLedger && (<>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {months.map((key) => {
                    const status = memberRentStatus(booking, ledger, key, today);
                    const isSel = cell && cell.memberId === m.id && cell.key === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCell(isSel ? null : { memberId: m.id, key })}
                        className={`shrink-0 px-1.5 py-1 rounded-md border text-[8px] font-black tabular-nums leading-tight transition-all ${CELL_STYLE[status]} ${isSel ? 'ring-2 ring-offset-1 ring-[#ba0036]' : ''}`}
                        title={monthShort(key, isBn)}
                      >
                        {monthShort(key, isBn)}
                      </button>
                    );
                  })}
                </div>

                {/* Action popover for the selected month */}
                {cell && cell.memberId === m.id && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap bg-gray-50 rounded-lg p-1.5">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider px-1">
                      {monthShort(cell.key, isBn)}
                    </span>
                    <button
                      type="button"
                      onClick={() => markCell(m, cell.key, 'full')}
                      disabled={busy}
                      className="px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      <CheckCircle2 size={10} /> {isBn ? 'পেইড' : 'Paid'}
                    </button>
                    <button
                      type="button"
                      onClick={() => markCell(m, cell.key, 'due')}
                      disabled={busy}
                      className="px-2 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider"
                    >
                      {isBn ? 'বকেয়া' : 'Due'}
                    </button>
                    <button
                      type="button"
                      onClick={() => markCell(m, cell.key, 'undo')}
                      disabled={busy}
                      className="px-2 py-1 rounded-md bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      <Undo2 size={10} /> {isBn ? 'আনডু' : 'Undo'}
                    </button>
                  </div>
                )}
                </>)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
