/*
 * OnboardingApprovalsPanel.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The one new thing tenant self-onboarding puts on the landlord's dashboard —
 * and it is invisible until it has something to say.
 *
 * WHY IT RENDERS NOTHING WHEN EMPTY
 * The host dashboard already carries sixteen sidebar items, a quick-action row
 * and a second action grid. A permanent "Pending onboarding (0)" card would
 * have been another line of chrome competing for attention on the 360 days a
 * year it has nothing in it. So it occupies zero pixels until someone actually
 * submits a form, at which point it is the most important thing on the screen
 * and sits at the top.
 *
 * WHAT APPROVING ACTUALLY IS
 * The landlord is not filling anything in — every field below was typed by the
 * tenant, on their own phone, including the NID number and the photo. The only
 * thing being asked is the one question the landlord alone can answer: does
 * this person live in that room? One tap either way.
 *
 * WHY A DECLINE ASKS FOR NOTHING AND STILL TELLS THEM
 * Somebody filled in a form with their NID on it. Leaving them watching a
 * spinner forever is the worst outcome available, so a decline notifies them —
 * with a reason if the landlord types one, and a sensible default if not.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  UserCheck, Check, X, Loader2, ChevronDown, ChevronUp, Phone, IdCard,
  Briefcase, PhoneCall, MapPin, Calendar, User, DoorOpen, AlertTriangle,
} from 'lucide-react';
import { listOnboardings, approveOnboarding, rejectOnboarding } from '../../services/inviteService';
import { tenantTypeLabel, GOVT_ID_TYPES, HAS_STATUS } from '../../utils/tenantFields';

const fmtDate = (iso, isBn) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function OnboardingApprovalsPanel({ language, showToast, onApproved }) {
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId]   = useState(null);
  const [rejecting, setRejecting] = useState(null); // { id, reason }
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await listOnboardings('pending'));
      setError('');
    } catch (err) {
      // A failure here must not break the Tenants tab around it — the panel
      // just stays quiet, exactly as it does when there is nothing pending.
      setError(err.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (row) => {
    setBusyId(row.id);
    try {
      await approveOnboarding(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      showToast?.(L(`${row.name} যুক্ত হয়েছেন`, `${row.name} has been added`));
      // The approval wrote a member into a booking, so every tenant/rent
      // surface upstream is now stale.
      onApproved?.();
    } catch (err) {
      // The readable case is "the room filled up while this was in the queue",
      // which the server says in words. Show them.
      showToast?.(err.message || L('অনুমোদন করা যায়নি', 'Could not approve'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectOnboarding(rejecting.id, rejecting.reason);
      setRows((prev) => prev.filter((r) => r.id !== rejecting.id));
      setRejecting(null);
      showToast?.(L('আবেদনটি বাতিল করা হয়েছে', 'Request declined'));
    } catch (err) {
      showToast?.(err.message || L('বাতিল করা যায়নি', 'Could not decline'));
    } finally {
      setBusyId(null);
    }
  };

  // The whole point: no pixels until there is something to decide.
  if (loading || error || rows.length === 0) return null;

  const Row = ({ label, value, Icon }) => (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      {Icon && <Icon size={12} className="text-gray-300 shrink-0 mt-0.5" />}
      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest w-28 shrink-0 leading-relaxed">{label}</span>
      <span className="text-[11px] font-bold text-gray-900 flex-1 min-w-0 break-words leading-relaxed">
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-100 bg-amber-50">
        <UserCheck size={15} className="text-amber-700 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-amber-900 uppercase tracking-widest">
            {L('অনুমোদনের অপেক্ষায়', 'Waiting for your approval')}
          </p>
          <p className="text-[10px] font-bold text-amber-700/80 mt-0.5 leading-relaxed">
            {L('এঁরা QR/লিংক দিয়ে নিজেরাই তথ্য পূরণ করেছেন। আপনাকে কিছু টাইপ করতে হবে না।',
               'They filled in their own details via your QR / link. Nothing for you to type.')}
          </p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-600 text-white text-[10px] font-black tabular-nums">
          {rows.length}
        </span>
      </div>

      <div className="divide-y divide-amber-100/70">
        {rows.map((row) => {
          const p = row.tenantProfile || {};
          const open = expanded === row.id;
          const govtType = GOVT_ID_TYPES.find((g) => g.id === p.govtIdType);
          const busy = busyId === row.id;

          return (
            <div key={row.id} className="bg-white/70">
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-300">
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                      : <User size={18} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900 leading-tight truncate">{row.name}</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                      <DoorOpen size={10} className="text-gray-300" />
                      {row.building?.name}
                      {row.unit && <>· {row.unit.floorLabel} · {L('রুম', 'Room')} {row.unit.roomNumber}</>}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 tabular-nums">{row.phone}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : row.id)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                    title={L('সব তথ্য দেখুন', 'See all details')}
                  >
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {open && (
                  <div className="mt-3 rounded-xl bg-white border border-gray-100 p-3">
                    <Row label={L('মোবাইল', 'Mobile')} value={row.phone} Icon={Phone} />
                    <Row label={L('মুভ-ইন', 'Move-in')} value={fmtDate(row.moveInDate, isBn)} Icon={Calendar} />
                    <Row label={L('পিতার নাম', "Father's name")} value={p.fatherName} />
                    <Row label={L('জন্ম তারিখ', 'Date of birth')} value={fmtDate(p.dob, isBn)} />
                    <Row label={L('স্থায়ী ঠিকানা', 'Permanent address')} value={p.permanentAddress} Icon={MapPin} />
                    <Row label={L('পেশা', 'Profession')} value={tenantTypeLabel(p, isBn)} Icon={Briefcase} />
                    <Row label={L('প্রতিষ্ঠান', 'Organization')} value={p.organization} />
                    <Row
                      label={L('পরিচয়পত্র', 'Identity doc')}
                      value={p.govtIdStatus === HAS_STATUS.NONE
                        ? <span className="text-gray-400">{L('নেই', 'None')}</span>
                        : (govtType ? `${isBn ? govtType.bn : govtType.en} · ${p.govtIdNumber || ''}` : p.govtIdNumber)}
                      Icon={IdCard}
                    />
                    <Row label={L('জরুরি যোগাযোগ', 'Emergency')} value={
                      [p.emergencyName, p.emergencyRelation, p.emergencyPhone].filter(Boolean).join(' · ')
                    } Icon={PhoneCall} />
                    {row.note && <Row label={L('বার্তা', 'Note')} value={row.note} />}
                  </div>
                )}

                {/* Declining asks for an optional reason, because "wrong room"
                    is the common case and it is the one thing that lets the
                    tenant fix it and try again. */}
                {rejecting?.id === row.id ? (
                  <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 p-3 space-y-2">
                    <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">
                      {L('কারণ (ঐচ্ছিক)', 'Reason (optional)')}
                    </p>
                    <input
                      type="text"
                      value={rejecting.reason}
                      onChange={(e) => setRejecting((r) => ({ ...r, reason: e.target.value }))}
                      placeholder={L('যেমন: ভুল রুম নির্বাচন করেছেন', 'e.g. Wrong room selected')}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-rose-100 bg-white text-[11px] font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium focus:border-rose-400 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={reject}
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} strokeWidth={3} />}
                        {L('বাতিল করুন', 'Decline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(null)}
                        className="px-4 py-2.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all"
                      >
                        {L('ফিরে যান', 'Back')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => approve(row)}
                      disabled={busy}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                      {L('অনুমোদন দিন', 'Approve')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting({ id: row.id, reason: '' })}
                      disabled={busy}
                      className="px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {L('বাতিল', 'Decline')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* A universal link is forwardable — that is what it is for. This is the
          reminder that the tap below is the check on it. */}
      <div className="px-4 py-2.5 bg-amber-50/60 border-t border-amber-100 flex items-start gap-1.5">
        <AlertTriangle size={11} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-amber-800/90 leading-relaxed">
          {L('অনুমোদনের আগে দেখে নিন ব্যক্তিটি সত্যিই ওই রুমে থাকেন কিনা — সবাইকে দেওয়া লিংক যে কেউ ফরওয়ার্ড করতে পারেন।',
             'Check the person really lives in that room before approving — a link shared with everyone can be forwarded by anyone.')}
        </p>
      </div>
    </div>
  );
}
