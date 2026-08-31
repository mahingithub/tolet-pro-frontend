/*
 * SeatTenantModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Putting a person into a space that already exists.
 *
 * This is deliberately NOT the lease wizard. There is no property picker, no
 * room number, no floor, no rent and no due day — the unit was set up once and
 * already carries all of that. What is left is the person, which is the only
 * thing that changes when a tenant arrives or is replaced.
 *
 * Two modes, one form:
 *   add     — an empty seat / a vacant flat
 *   replace — the occupant left; the SAME seat gets a new person, and the
 *             outgoing one is kept (moved-out) so their rent history survives
 *
 * The rent is shown, not asked for: a seat's share is the room rent divided by
 * its seats, and typing it again per tenant is how the numbers drift apart.
 *
 * The ADVANCE is the exception, and is asked for. It is not a property of the
 * unit — it is what THIS person handed over on the day they moved in, it
 * differs from tenant to tenant in the same room, and the booking card has
 * always had a "ডিপোজিট (অগ্রিম)" tile to show it. Without a box here that
 * tile read ৳0 for every tenant seated this way, which is what the landlord
 * noticed.
 */

import React, { useRef, useState } from 'react';
import { X, Loader2, Check, RefreshCw, UserPlus, DoorOpen, ScanLine, Sparkles, AlertCircle, Banknote } from 'lucide-react';
import { ADVANCE_PAYMENT_METHODS } from '../../utils/tenantRent';
import TenantInfoForm from './TenantInfoForm';
import { emptyTenantProfile, validateTenantProfile, tenantFieldReport } from '../../utils/tenantFields';
import { replaceTenantInUnit } from '../../services/buildingService';
import useHostSyncStore from '../../store/useHostSyncStore';
import { newObjectId } from '../../store/hostOps';
import { unitNoun } from '../../utils/buildingTypes';
import { submitOnEnter } from '../../utils/submitOnEnter';
import { scanTenantForm } from '../../services/aiScanService';
import ModalPortal from '../shared/ModalPortal.jsx';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SeatTenantModal({
  unit,
  building,
  seatNumber,           // 1-based, for the heading
  replacingMember,      // { id, name } when replacing; null when adding
  language,
  showToast,
  onClose,
  onSaved,              // () => void — parent reloads the units
  formatBDT,
}) {
  const isBn = language === 'বাংলা';
  const isSeat = building?.rentedAs === 'seat';
  const noun = unitNoun(building, isBn);
  const replacing = !!replacingMember;

  const [profile, setProfile] = useState(() => ({
    ...emptyTenantProfile(),
    moveInDate: todayIso(),
  }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  // The up-front money this person handed over, and the rail it came through.
  // Optional — plenty of tenancies start with nothing paid in advance, so an
  // empty box saves as ৳0 rather than blocking the form.
  const [advance, setAdvance] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('');
  // Scanning the admission form the landlord is already holding, straight into
  // THIS form. Manual and scanned are not two flows — the scan just fills the
  // boxes, and the landlord corrects whatever the page did not say clearly.
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(null);   // which fields the page filled
  const scanInputRef = useRef(null);

  const handleScan = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast?.(isBn ? 'ছবি ফাইল দিন' : 'Please choose an image file');
      return;
    }
    setScanning(true);
    try {
      const result = await scanTenantForm(file);
      if (!result || !Object.keys(result.patch).length) {
        showToast?.(isBn ? 'ফরম থেকে কিছু পড়া গেল না — হাতে লিখুন' : 'Nothing readable on that page — fill it in by hand');
        return;
      }
      // Blanks on the page never overwrite what is already typed: scanTenantForm
      // only returns keys the form actually had a value for.
      setProfile((prev) => ({ ...prev, ...result.patch }));
      setScanned(Object.keys(result.patch));
      showToast?.(isBn
        ? `${Object.keys(result.patch).length}টি ঘর ভরা হয়েছে — যাচাই করে নিন`
        : `Filled ${Object.keys(result.patch).length} field(s) — please check them`);
    } catch (err) {
      showToast?.(err.message || (isBn ? 'স্ক্যান ব্যর্থ' : 'Scan failed'));
    } finally {
      setScanning(false);
    }
  };

  // What this person will be charged. A seat takes an equal share of the room
  // rent; a whole unit takes the lot. Shown so the host can see it — never
  // retyped, because the room already holds the number.
  const capacity = isSeat ? Math.max(1, Number(unit?.seatCapacity) || 1) : 1;
  const share = Math.round(((Number(unit?.monthlyRent) || 0) + (Number(unit?.serviceCharge) || 0)) / capacity);

  const patch = (p) => setProfile((prev) => ({ ...prev, ...p }));

  const submit = async () => {
    const missing = validateTenantProfile(profile);
    if (missing.length) {
      setErrors(missing);
      showToast?.(isBn ? 'লাল ঘরগুলো পূরণ করুন' : 'Please fill the highlighted fields');
      setTimeout(() => {
        const el = document.getElementById(`seat-${missing[0]}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch { /* optional */ } }
      }, 60);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const advancePayment = Math.max(0, Number(advance) || 0);
      const body = {
        name: profile.name,
        phone: profile.phone,
        moveInDate: profile.moveInDate,
        tenantProfile: profile,
        advancePayment,
        // Only name a rail when money actually changed hands — "৳0 via bKash"
        // is a payment that never happened.
        paymentMethod: advancePayment > 0 ? advanceMethod : '',
      };
      if (replacing) {
        // Swapping the occupant of an OCCUPIED seat still waits for the server:
        // it closes one tenancy and opens another on the same seat, and getting
        // that pair half-applied is worse than asking for a connection.
        await replaceTenantInUnit(unit.id, replacingMember.id, body);
      } else {
        // ── Moving someone in, with or without a network ──────────────────
        // The ids are minted HERE, so this tenant is real the moment they are
        // written down: rent can be collected against them, under their own
        // name, before the record has ever reached the server. The queue
        // delivers it when there is signal (store/useHostSyncStore.js).
        //
        // The one thing the server still decides is whether the seat is free.
        // If someone else took the last seat while this phone was away, the
        // placement comes back refused with the reason, and the Rent tab says
        // so — rather than two people quietly holding one bed.
        const memberId = newObjectId();
        const existingBookingId = unit?.booking?.id || unit?.bookingId || null;
        useHostSyncStore.getState().applyLive('addTenant', {
          unitId: unit.id,
          bookingId: existingBookingId || newObjectId(),
          payload: body,
          member: {
            id: memberId,
            name: profile.name,
            phone: profile.phone,
            rentType: capacity > 1 ? 'seat' : 'flat',
            floor: String(unit.floor ?? ''),
            roomLabel: unit.roomNumber || '',
            seatsBooked: 1,
            monthlyRent: capacity > 1 ? 0 : Number(unit.monthlyRent) || 0,
            // Written on the MEMBER, not the booking: a seat room is one
            // booking with several occupants, each with their own advance.
            advancePayment: body.advancePayment,
            paymentMethod: body.paymentMethod,
            status: 'active',
            joinDate: profile.moveInDate,
            ledger: {},
            tenantProfile: profile,
          },
          booking: {
            property: unit.buildingName || '',
            floorNumber: String(unit.floor ?? ''),
            roomNumber: unit.roomNumber || '',
            unitId: unit.id,
            tenant: capacity > 1 ? '' : profile.name,
            tenantPhone: profile.phone,
            leaseStart: profile.moveInDate,
            leaseEnd: null,
            monthlyRent: Number(unit.monthlyRent) || 0,
            serviceCharge: Number(unit.serviceCharge) || 0,
            rentDueDay: Number(unit.rentDueDay) || 5,
            status: 'active',
            ledger: {},
          },
        });
      }

      showToast?.(replacing
        ? (isBn ? 'নতুন ভাড়াটিয়া বসানো হয়েছে — রেন্ট লেজার চালু' : 'New tenant moved in — rent ledger is live')
        : (isBn ? 'ভাড়াটিয়া যোগ হয়েছে' : 'Tenant added'));
      onSaved?.();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || (isBn ? 'সেভ ব্যর্থ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
        onKeyDown={submitOnEnter(submit, { enabled: !saving && !scanning })}
      >
        <div className="p-5 sm:p-6">

          <div className="flex items-start gap-2 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${replacing ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {replacing ? <RefreshCw size={19} /> : <UserPlus size={19} />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-gray-900 leading-tight">
                {replacing
                  ? (isBn ? 'নতুন ভাড়াটিয়া বসান' : 'Replace the tenant')
                  : (isBn ? 'ভাড়াটিয়া যোগ করুন' : 'Add a tenant')}
              </h2>
              <p className="text-[11px] font-bold text-gray-500 mt-0.5">
                {noun} {unit?.roomNumber}
                {isSeat && <> · {isBn ? `সিট ${seatNumber}` : `Seat ${seatNumber}`}</>}
                {' · '}
                <span className="tabular-nums">{formatBDT ? formatBDT(share) : `৳${share}`}</span>
                {isSeat && <span className="text-gray-400">{isBn ? '/সিট' : ' each'}</span>}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <X size={17} />
            </button>
          </div>

          {/* The space is already set up — say so, so nobody looks for the
              rent or room fields that used to be on this form. */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 mb-4 flex items-start gap-2.5">
            <DoorOpen size={15} className="text-[#ba0036] shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-gray-600 leading-relaxed">
              {replacing
                ? (isBn
                    ? `${replacingMember?.name || 'পুরোনো ভাড়াটিয়া'} মুভ-আউট হিসেবে থাকবেন — তাঁর ভাড়ার হিসাব মুছবে না। রুম, সিট ও ভাড়া অপরিবর্তিত।`
                    : `${replacingMember?.name || 'The previous tenant'} is kept as moved-out, so their rent history survives. The room, seat and rent are unchanged.`)
                : (isBn
                    ? 'রুম ও ভাড়া আগেই সেট করা আছে — শুধু ব্যক্তির তথ্য দিন।'
                    : 'The room and its rent are already set — just add the person.')}
            </p>
          </div>

          {/* Scan the admission form instead of typing it. Same record either
              way — this only prefills the boxes below. */}
          <div className="mb-3">
            <button
              type="button"
              disabled={scanning}
              onClick={() => scanInputRef.current?.click()}
              className="w-full px-3 py-3 rounded-2xl border-2 border-dashed border-[#ba0036]/30 bg-[#ba0036]/[0.03] text-[#ba0036] hover:bg-[#ba0036]/[0.06] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {scanning
                ? <><Loader2 size={15} className="animate-spin" /> <span className="text-[11px] font-black uppercase tracking-wider">{isBn ? 'পড়া হচ্ছে…' : 'Reading…'}</span></>
                : <>
                    <ScanLine size={15} strokeWidth={2.5} />
                    <span className="text-[11px] font-black uppercase tracking-wider">
                      {isBn ? 'ভর্তি ফরম স্ক্যান করুন' : 'Scan the admission form'}
                    </span>
                  </>}
            </button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { handleScan(e.target.files?.[0]); e.target.value = ''; }}
            />
            {/* What the scan actually got, and what it did not. A bare count
                left the landlord to work out which fields were still empty by
                opening the section and reading every box. */}
            {scanned && (() => {
              const { filled, missing } = tenantFieldReport(profile, isBn);
              return (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-2.5 py-2 bg-emerald-50 border-b border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-800 inline-flex items-center gap-1">
                      <Sparkles size={10} className="shrink-0" />
                      {isBn ? `ফরম থেকে পাওয়া গেছে — ${filled.length}টি` : `Read from the form — ${filled.length}`}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700/80 leading-relaxed mt-0.5">
                      {filled.map((f) => f.label).join(' · ')}
                    </p>
                  </div>

                  {missing.length > 0 ? (
                    <div className="px-2.5 py-2 bg-amber-50">
                      <p className="text-[10px] font-black text-amber-800 inline-flex items-center gap-1">
                        <AlertCircle size={10} className="shrink-0" />
                        {isBn ? `পাওয়া যায়নি — ${missing.length}টি` : `Not found — ${missing.length}`}
                      </p>
                      <p className="text-[10px] font-bold text-amber-700/90 leading-relaxed mt-0.5">
                        {missing.map((f) => f.label).join(' · ')}
                      </p>
                      <p className="text-[9px] font-bold text-amber-700/70 leading-relaxed mt-1">
                        {isBn
                          ? 'ফরমে ছিল না বা পড়া যায়নি। দরকার হলে নিচে হাতে লিখুন — না লিখলেও সেভ হবে।'
                          : 'Either not on the page or not readable. Fill them in below if you need them — saving works without them.'}
                      </p>
                    </div>
                  ) : (
                    <div className="px-2.5 py-2 bg-emerald-50/60">
                      <p className="text-[10px] font-black text-emerald-800">
                        {isBn ? 'সব ঘর ভরা হয়েছে — দেখে নিয়ে সেভ করুন।' : 'Every field was read — check them and save.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Advance / deposit — the one money box on this form. The rent is
              the unit's and never retyped; this is the person's, and the
              booking card has a tile waiting for it. */}
          <div className="bg-gradient-to-br from-emerald-50/70 to-white p-3.5 rounded-2xl border border-emerald-100 mb-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Banknote size={14} className="text-emerald-600" />
              <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                {isBn ? 'অ্যাডভান্স / জামানত' : 'Advance / Deposit'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 ml-auto">{isBn ? 'ঐচ্ছিক' : 'Optional'}</span>
            </div>

            <label htmlFor="seat-advance" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {isBn ? 'অ্যাডভান্স (৳)' : 'Advance Amount (৳)'}
            </label>
            <input
              id="seat-advance"
              type="number"
              min="0"
              inputMode="numeric"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="0"
              className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(16,185,129,0.12)] border border-gray-100 focus:border-emerald-300 transition-all"
            />

            {/* The rail only matters once there is money to attribute to it. */}
            {Number(advance) > 0 && (
              <>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">
                  {isBn ? 'কীভাবে পেয়েছেন' : 'Received via'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ADVANCE_PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAdvanceMethod((cur) => (cur === m ? '' : m))}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                        advanceMethod === m
                          ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(5,150,105,0.25)]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* The same tenant form as everywhere else: name, mobile, move-in,
              then everything optional under অতিরিক্ত তথ্য. */}
          <TenantInfoForm
            value={profile}
            onChange={patch}
            language={language}
            errors={errors}
            showToast={showToast}
            fieldId={(k) => `seat-${k}`}
            defaultExpanded={!!scanned}
          />

          <div className="pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className={`flex-1 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 ${
                replacing
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-[0_8px_15px_rgba(217,119,6,0.25)]'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_8px_15px_rgba(5,150,105,0.25)]'
              }`}
            >
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> {isBn ? 'সেভ হচ্ছে' : 'Saving'}</>
                : <><Check size={17} strokeWidth={3} /> {replacing ? (isBn ? 'নতুন ভাড়াটিয়া বসান' : 'Move them in') : (isBn ? 'যোগ করুন' : 'Add tenant')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
