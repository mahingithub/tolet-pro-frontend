/*
 * ShiftRoomModal.jsx — "I moved from 301 to 204."
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT IT REPLACES
 * Re-scanning the building QR and filling the eleven-field join form a second
 * time. That produced a second live tenancy for one person: two rent cards on
 * this dashboard, two sets of dues, two rows on the landlord's register — and
 * nothing ever closed the first one, because the tenant has no button for it
 * and the landlord has no reason to go looking for a room that quietly emptied.
 *
 * WHAT IS ASKED FOR, AND WHAT IS NOT
 * Only the three things that actually changed: which room, from when, and (if
 * the room's rent differs) how much. Their name, phone, NID, photograph,
 * profession and emergency contact are already on the member row they are
 * leaving — the landlord has had them for months. Asking for them again to move
 * down one floor is the paper-form busywork this whole feature exists to
 * delete, so the server carries them across (see requestShift).
 *
 * WHY IT STILL WAITS FOR THE LANDLORD
 * Same reason a building-link join does. The tenant knows they have moved; only
 * the landlord knows whether 204 was theirs to move into. Approving is one tap
 * on a row that is already filled in — and that one tap is what closes 301 and
 * opens 204, so the two never overlap.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  X, DoorOpen, Loader2, Check, AlertTriangle, ArrowRight, Calendar, Building2,
} from 'lucide-react';
import { getShiftOptions, requestShift } from '../../services/inviteService';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ShiftRoomModal({ booking, language, onClose, onSubmitted }) {
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);

  const bookingId = booking?.id || booking?._id || '';

  const [loading, setLoading] = useState(true);
  const [shift, setShift]     = useState(null);
  const [error, setError]     = useState('');

  const [toUnitId, setToUnitId]       = useState('');
  const [moveInDate, setMoveInDate]   = useState(todayIso());
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setShift(await getShiftOptions(bookingId));
    } catch (err) {
      setError(err?.message || L('রুমের তালিকা আনা গেল না।', 'Could not load the room list.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => { if (bookingId) load(); }, [bookingId, load]);

  const rooms = shift?.rooms || [];
  // The room they are in now is not somewhere they can move to. Shown, greyed,
  // labelled — hiding it would just make them wonder where 301 went.
  const currentUnitId = String(shift?.fromUnitId || '');
  const selected = rooms.find((r) => r.id === toUnitId) || null;

  const submit = async () => {
    if (!toUnitId) {
      setError(L('আপনি কোন রুমে গেছেন সেটি বেছে নিন।', 'Pick the room you moved to.'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await requestShift({ bookingId, toUnitId, moveInDate, note });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(err?.message || L('আবেদন জমা দেওয়া গেল না।', 'Could not submit the request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-gray-900/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
            <DoorOpen size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-gray-900 leading-tight">
              {L('রুম বদলেছেন?', 'Moved to another room?')}
            </h3>
            <p className="text-[11px] font-bold text-gray-400 leading-relaxed mt-0.5">
              {L('একই বিল্ডিংয়ে নতুন রুম বেছে নিন। আপনার তথ্য আবার লিখতে হবে না।',
                 "Pick your new room in the same building. You won't retype your details.")}
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
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Check size={30} strokeWidth={3} />
              </div>
              <h4 className="text-lg font-black text-gray-900 leading-tight">
                {L('বাড়িওয়ালার অনুমোদনের অপেক্ষায়', 'Waiting for your landlord')}
              </h4>
              <p className="text-xs font-bold text-gray-500 leading-relaxed max-w-sm mx-auto">
                {L('অনুমোদন দিলে আগের রুমের হিসাব বন্ধ হয়ে নতুন রুমে চালু হবে — আপনার পুরোনো ভাড়ার রেকর্ড মুছবে না। জানানো হবে।',
                    "Once they approve, your old room closes and the new one opens — your past rent records are kept. We'll notify you.")}
              </p>
            </div>
          ) : loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-[11px] font-black uppercase tracking-widest">{L('লোড হচ্ছে', 'Loading')}</p>
            </div>
          ) : !shift ? (
            <div className="py-12 text-center">
              <AlertTriangle size={22} className="text-[#ba0036] mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500 leading-relaxed">
                {error || L('রুমের তালিকা আনা গেল না।', 'Could not load the room list.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-3 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-[#ba0036] shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-red-900 leading-relaxed flex-1">{error}</p>
                </div>
              )}

              {/* Where they are, and where they are going — the whole change in
                  one line, so the confirmation below is unambiguous. */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3.5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                  <Building2 size={11} /> {shift.buildingName}
                </p>
                <div className="flex items-center gap-2 text-sm font-black text-gray-900">
                  <span className="truncate">{shift.fromLabel || L('আপনার রুম', 'Your room')}</span>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                  <span className={`truncate ${selected ? 'text-[#ba0036]' : 'text-gray-300'}`}>
                    {selected
                      ? `${selected.floorLabel} · ${L('রুম', 'Room')} ${selected.roomNumber}`
                      : L('রুম বাছুন', 'pick a room')}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  {L('নতুন রুম', 'New room')}
                </p>
                <div className="space-y-2 max-h-[38vh] overflow-y-auto -mx-1 px-1">
                  {rooms.length === 0 && (
                    <p className="text-xs font-bold text-gray-400 py-6 text-center">
                      {L('এই বিল্ডিংয়ে অন্য কোনো রুম নেই।', 'This building has no other rooms.')}
                    </p>
                  )}
                  {rooms.map((r) => {
                    const isCurrent = r.id === currentUnitId;
                    const on = toUnitId === r.id;
                    const full = r.free <= 0;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => { setToUnitId(r.id); setError(''); }}
                        className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                          isCurrent
                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                            : on
                              ? 'border-gray-900 bg-gray-900 text-white active:scale-[0.99]'
                              : 'border-gray-100 bg-white hover:border-gray-300 active:scale-[0.99]'
                        }`}
                      >
                        <DoorOpen size={16} className={on ? 'text-white/70' : 'text-gray-300'} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black leading-tight">
                            {L('রুম', 'Room')} {r.roomNumber}
                          </p>
                          <p className={`text-[10px] font-bold mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>
                            {r.floorLabel}
                            {r.capacity > 1 && ` · ${r.free}/${r.capacity} ${L('সিট খালি', 'seats free')}`}
                          </p>
                        </div>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded-md bg-gray-200 text-gray-500 text-[9px] font-black uppercase tracking-wider shrink-0">
                            {L('এখন এখানে', 'You’re here')}
                          </span>
                        ) : full ? (
                          // A full room stays pickable: the landlord may be
                          // about to free a seat, and the person standing in it
                          // knows better than the seat count does. Same rule the
                          // QR picker uses — they are told, so a wrong pick is
                          // an informed one.
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            on ? 'bg-white/15 text-white/80' : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {L('পূর্ণ', 'Full')}
                          </span>
                        ) : null}
                        {on && <Check size={16} strokeWidth={3} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Calendar size={11} className="text-gray-300" /> {L('কবে থেকে নতুন রুমে', 'Moved in on')}
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  {L('বাড়িওয়ালাকে কিছু বলবেন? (ঐচ্ছিক)', 'Anything to tell your landlord? (optional)')}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  placeholder={L('যেমন: ১ তারিখ থেকে ২০৪ এ উঠেছি', 'e.g. moved into 204 on the 1st')}
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium focus:border-gray-900 focus:outline-none transition-colors resize-none"
                />
              </div>

              <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                {L('আপনার নাম, নম্বর, NID ও ছবি আগের রুম থেকেই চলে যাবে — আবার লিখতে হবে না। আগের ভাড়ার হিসাব ও রিসিট মুছবে না।',
                    "Your name, number, NID and photo carry over from your current room — nothing to retype. Your past rent records and receipts are kept.")}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          {done ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all"
            >
              {L('ঠিক আছে', 'Done')}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || loading || !toUnitId}
              className="w-full py-3.5 rounded-xl bg-[#ba0036] text-white font-black text-[11px] uppercase tracking-widest hover:bg-[#9a002d] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {L('অনুমোদনের জন্য পাঠান', 'Send for approval')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
