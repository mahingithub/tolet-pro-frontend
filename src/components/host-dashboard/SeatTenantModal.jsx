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
 */

import React, { useRef, useState } from 'react';
import { X, Loader2, Check, RefreshCw, UserPlus, DoorOpen, ScanLine, Sparkles, AlertCircle } from 'lucide-react';
import TenantInfoForm from './TenantInfoForm';
import { emptyTenantProfile, validateTenantProfile, tenantFieldReport } from '../../utils/tenantFields';
import { addTenantToUnit, replaceTenantInUnit } from '../../services/buildingService';
import { unitNoun } from '../../utils/buildingTypes';
import { submitOnEnter } from '../../utils/submitOnEnter';
import { scanTenantForm } from '../../services/aiScanService';

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
      const body = {
        name: profile.name,
        phone: profile.phone,
        moveInDate: profile.moveInDate,
        tenantProfile: profile,
      };
      if (replacing) await replaceTenantInUnit(unit.id, replacingMember.id, body);
      else await addTenantToUnit(unit.id, body);

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
  );
}
