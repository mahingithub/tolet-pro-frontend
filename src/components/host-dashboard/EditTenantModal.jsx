/*
 * EditTenantModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Correcting a person who is already in the room.
 *
 * WHY THIS EXISTS
 * Everything a landlord knows about a tenant was writable exactly once — at the
 * moment they were seated. A name typed in a corridor, a missing NID, an
 * emergency number that turned out to be wrong: none of it could be put right
 * afterwards. The only thing the room offered was "বদলান", which does not mean
 * "fix this" — it ends one tenancy and starts another, on the same seat, and
 * takes the rent ledger's ownership with it. Landlords used it as an edit
 * button because it was the only button there.
 *
 * WHAT IT IS NOT
 * Not a replacement and not a move. The seat, the rent, the ledger and the
 * tenancy are untouched — this writes the PERSON: their name, their number,
 * their move-in date and the eleven intake fields behind them.
 *
 * SAME RULEBOOK AS EVERY OTHER WRITER
 * It renders TenantInfoForm and validates with validateTenantProfile(), so a
 * record that was accepted when the tenant moved in is still acceptable when it
 * is corrected — a landlord must never be blocked from FIXING a field by a rule
 * that let them save it blank in the first place.
 */

import React, { useState } from 'react';
import { X, Loader2, Check, Pencil, DoorOpen } from 'lucide-react';
import TenantInfoForm from './TenantInfoForm';
import { emptyTenantProfile, toTenantProfile, validateTenantProfile } from '../../utils/tenantFields';
import { unitNoun } from '../../utils/buildingTypes';
import useHostSyncStore from '../../store/useHostSyncStore';
import { submitOnEnter } from '../../utils/submitOnEnter';
import ModalPortal from '../shared/ModalPortal.jsx';

// A stored joinDate / leaseStart is an ISO timestamp; a <input type="date">
// wants YYYY-MM-DD and silently renders nothing for anything else.
const dateInput = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

export default function EditTenantModal({
  person,        // { memberId, bookingId, name, phone, joinDate, tenantProfile }
  unit,
  building,
  language,
  showToast,
  onClose,
  // (op, patch) => void — the queued operation, so the caller can paint its own
  // list with it without waiting for a server it has not been sent to yet.
  onSaved,
}) {
  const isBn = language === 'বাংলা';
  const noun = unitNoun(building, isBn);

  const [profile, setProfile] = useState(() => ({
    ...emptyTenantProfile(),
    ...toTenantProfile(person?.tenantProfile || {}),
    // Name, phone and move-in live on the MEMBER, not inside the profile blob —
    // members[] is the single source of truth for who is in a seat. They are
    // lifted into the form here and written back out to the member on save.
    name:  person?.name || '',
    phone: person?.phone || '',
    moveInDate: dateInput(person?.joinDate),
  }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const patchForm = (p) => setProfile((prev) => ({ ...prev, ...p }));

  const submit = () => {
    const missing = validateTenantProfile(profile);
    if (missing.length) {
      setErrors(missing);
      showToast?.(isBn ? 'লাল ঘরগুলো ঠিক করুন' : 'Please fix the highlighted fields');
      setTimeout(() => {
        const el = document.getElementById(`edit-tenant-${missing[0]}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch { /* optional */ } }
      }, 60);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const name = String(profile.name || '').trim();
      const phone = String(profile.phone || '').trim();
      // Queued, not awaited — the same rule as every other write on this screen.
      // A landlord standing on the third floor with no signal can still correct
      // a number, and the queue delivers it when there is a network.
      const op = person?.memberId
        ? useHostSyncStore.getState().enqueue('updateMemberFields', {
          bookingId: person.bookingId,
          memberId: person.memberId,
          patch: { name, phone, joinDate: profile.moveInDate, tenantProfile: profile },
        })
        // A whole-unit tenancy from before members[] existed: the person IS the
        // booking, so their details are the booking's own fields.
        : useHostSyncStore.getState().enqueue('updateBookingFields', {
          bookingId: person?.bookingId,
          patch: { tenant: name, tenantPhone: phone, leaseStart: profile.moveInDate, tenantProfile: profile },
        });
      onSaved?.(op, { name, phone, joinDate: profile.moveInDate, tenantProfile: profile });
      showToast?.(isBn ? 'ভাড়াটিয়ার তথ্য আপডেট হয়েছে' : "Tenant's details updated");
      onClose?.();
    } catch (err) {
      showToast?.(err.message || (isBn ? 'সেভ ব্যর্থ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
        onKeyDown={submitOnEnter(submit, { enabled: !saving })}
      >
        <div className="p-5 sm:p-6">

          <div className="flex items-start gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
              <Pencil size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-gray-900 leading-tight">
                {isBn ? 'ভাড়াটিয়ার তথ্য এডিট' : 'Edit tenant details'}
              </h2>
              <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate">
                {person?.name || (isBn ? 'নামহীন' : 'Unnamed')}
                {unit?.roomNumber && <> · {noun} {unit.roomNumber}</>}
                {person?.seatLabel && <> · {person.seatLabel}</>}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <X size={17} />
            </button>
          </div>

          {/* Say plainly what this is not. "বদলান" and "এডিট" sit next to each
              other in the same menu and mean opposite things. */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 mb-4 flex items-start gap-2.5">
            <DoorOpen size={15} className="text-[#ba0036] shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-gray-600 leading-relaxed">
              {isBn
                ? 'একই ভাড়াটিয়ার তথ্য ঠিক করা হচ্ছে — রুম, সিট, ভাড়া ও ভাড়ার হিসাব অপরিবর্তিত থাকবে।'
                : 'Correcting the same tenant — the room, seat, rent and rent history all stay as they are.'}
            </p>
          </div>

          <TenantInfoForm
            value={profile}
            onChange={patchForm}
            language={language}
            errors={errors}
            showToast={showToast}
            fieldId={(k) => `edit-tenant-${k}`}
            // Opened on purpose: this form is reached BY someone who came to
            // change one of the fields inside it, so collapsing them hides the
            // reason they are here.
            defaultExpanded
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
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 shadow-[0_8px_15px_rgba(79,70,229,0.25)]"
            >
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> {isBn ? 'সেভ হচ্ছে' : 'Saving'}</>
                : <><Check size={17} strokeWidth={3} /> {isBn ? 'সেভ করুন' : 'Save changes'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
