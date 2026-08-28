/*
 * TenantInfoForm.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The tenant half of a lease, in two parts:
 *
 *   ALWAYS VISIBLE   name · mobile · move-in date
 *                    (+ room/flat no., which the parent owns — it belongs to
 *                    the unit, not the person, so it outlives this tenant)
 *
 *   অতিরিক্ত তথ্য     everything else, collapsed by default
 *
 * A landlord standing in a corridor with a new tenant can fill the top three
 * boxes and save. That is the whole intake. The optional section is there for
 * the landlord who wants a proper record — never in the way of the one who
 * doesn't.
 *
 * CONDITIONAL FIELDS
 * No document is ever demanded up front. Each one is gated behind a plain
 * আছে / নেই question, and only "আছে" makes the number required — the user just
 * told us it exists. "নেই" removes the field entirely: no ghost input, no
 * validation, no red box. See utils/tenantFields.js for the rulebook; this
 * component only renders it.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  User, Phone, Calendar, ChevronDown, ChevronUp, Camera, X, Loader2,
  Briefcase, IdCard, MapPin, PhoneCall, Check, Lock,
} from 'lucide-react';
import { privateUpload } from '../../services/cloudinaryUpload';
import {
  TENANT_TYPES, tenantTypeById, GOVT_ID_TYPES, MARITAL_STATUSES, HAS_STATUS,
} from '../../utils/tenantFields';

export default function TenantInfoForm({
  value,                       // tenant profile object (see emptyTenantProfile)
  onChange,                    // (patch) => void — shallow-merged by the parent
  language,
  errors = [],                 // field keys that failed validation
  fieldId = (k) => `lease-${k}`,
  showToast,
  defaultExpanded = false,
}) {
  const isBn = language === 'বাংলা';
  const [open, setOpen] = useState(defaultExpanded);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);
  // A just-picked file, shown from local memory. The stored photoUrl points at
  // an AUTHENTICATED Cloudinary asset, which an <img> cannot load until the
  // server signs it — so right after an upload we preview the local blob and
  // let the signed URL take over on the next load from the server.
  const [localPreview, setLocalPreview] = useState('');
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const v = value || {};
  const set = (patch) => onChange?.(patch);
  const err = (k) => (errors.includes(k) ? '!border-rose-400 ring-2 ring-rose-200' : '');

  const labelCls = 'text-[10px] font-black text-gray-400 uppercase tracking-widest';
  const inputCls = 'w-full mt-1.5 p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all';
  const subInputCls = 'w-full mt-1.5 p-3 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none border border-gray-200 focus:border-[#ba0036]/30 focus:shadow-[0_4px_15px_rgba(186,0,54,0.06)] transition-all';

  const type = tenantTypeById(v.tenantType);

  // ── আছে / নেই ─────────────────────────────────────────────────────────────
  // The only question asked about any document. Deliberately two buttons and
  // nothing else — no "skip", no "add later", no optional checkbox. "নেই" is a
  // real answer, so choosing it clears whatever was typed before: a number
  // can't linger on a record that says the document doesn't exist.
  const HasToggle = ({ label, statusKey, clearKeys = [] }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        {[
          { id: HAS_STATUS.HAS,  en: 'Yes',  bn: 'আছে' },
          { id: HAS_STATUS.NONE, en: 'No',   bn: 'নেই' },
        ].map((opt) => {
          const on = v[statusKey] === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => set({
                [statusKey]: on ? '' : opt.id,
                // Switching to "নেই" (or unselecting) wipes the dependent boxes.
                ...(opt.id === HAS_STATUS.NONE || on
                  ? Object.fromEntries(clearKeys.map((k) => [k, '']))
                  : {}),
              })}
              className={`px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                on
                  ? (opt.id === HAS_STATUS.HAS
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_4px_12px_rgba(5,150,105,0.25)]'
                      : 'bg-gray-900 text-white border-gray-900')
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {on && <Check size={12} strokeWidth={3.5} className="shrink-0" />}
              {isBn ? opt.bn : opt.en}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Photo ─────────────────────────────────────────────────────────────────
  // The landlord's own snapshot, kept only until the tenant joins with the
  // invite code — at that point the server deletes this and their real profile
  // picture takes over.
  //
  // Uploaded PRIVATELY (Cloudinary type:'authenticated'), the same handling NID
  // scans get. A photograph of someone's face taken by their landlord should not
  // sit on a guessable public URL; even if the link leaks it is useless without
  // a signature, and only the landlord who owns this booking gets a signed one.
  const handlePhoto = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast?.(isBn ? 'ছবি ফাইল দিন' : 'Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.(isBn ? 'ছবি ৫ MB এর কম হতে হবে' : 'Image must be under 5 MB');
      return;
    }
    setUploading(true);
    try {
      const { secureUrl, publicId } = await privateUpload(file, { folder: 'tolet/tenant-photos' });
      set({ photoUrl: secureUrl, photoPublicId: publicId });
      setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    } catch (e) {
      showToast?.(isBn ? 'ছবি আপলোড ব্যর্থ' : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    set({ photoUrl: '', photoPublicId: '' });
  };
  // Local blob first (just uploaded), else whatever the server handed us — which
  // is already signed by the time it reaches this form.
  const photoSrc = localPreview || v.photoUrl || '';

  return (
    <div className="space-y-3.5">

      {/* ══════════ THE ONLY REQUIRED PART ══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={`${labelCls} flex items-center gap-1`}>
            <User size={11} className="text-[#ba0036]" /> {isBn ? 'ভাড়াটিয়ার নাম' : 'Tenant Name'}
          </label>
          <input
            id={fieldId('name')}
            type="text"
            value={v.name || ''}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={isBn ? 'যেমন: আশরাফ আলম' : 'e.g. Asraf Alom'}
            className={`${inputCls} ${err('name')}`}
          />
        </div>
        <div>
          <label className={`${labelCls} flex items-center gap-1`}>
            <Phone size={11} className="text-[#ba0036]" /> {isBn ? 'মোবাইল নম্বর' : 'Mobile Number'}
          </label>
          <input
            id={fieldId('phone')}
            type="tel"
            value={v.phone || ''}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="+880 1xxx xxxxxx"
            className={`${inputCls} ${err('phone')}`}
          />
          <p className="text-[9px] font-bold text-gray-400 mt-1">
            {isBn ? 'নম্বর দিয়ে ভাড়াটিয়ার অ্যাকাউন্ট অটো-লিংক হয়' : 'The number auto-links the tenant’s account'}
          </p>
        </div>
        <div>
          <label className={`${labelCls} flex items-center gap-1`}>
            <Calendar size={11} className="text-[#ba0036]" /> {isBn ? 'মুভ-ইন তারিখ' : 'Move-In Date'}
          </label>
          <input
            id={fieldId('moveInDate')}
            type="date"
            value={v.moveInDate || ''}
            onChange={(e) => set({ moveInDate: e.target.value })}
            className={`${inputCls} ${err('moveInDate')}`}
          />
        </div>
      </div>

      {/* ══════════ অতিরিক্ত তথ্য — everything optional ══════════ */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3.5 py-3 hover:bg-gray-100/60 transition-colors text-left"
        >
          <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest flex-1">
            {isBn ? 'অতিরিক্ত তথ্য' : 'Additional Information'}
          </span>
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
            {isBn ? 'ঐচ্ছিক' : 'Optional'}
          </span>
          <span className="shrink-0 text-gray-400">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </button>

        {open && (
          <div className="px-3.5 pb-4 pt-1 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
              {isBn
                ? 'কোনোটিই বাধ্যতামূলক নয় — যা আছে শুধু তাই দিন, বাকিটা খালি রেখে সেভ করতে পারবেন।'
                : 'None of this is required — fill in what you have and save; the rest can stay empty.'}
            </p>

            {/* ── Photo ── */}
            <div>
              <label className={labelCls}>{isBn ? 'ভাড়াটিয়ার ছবি' : 'Tenant Photo'}</label>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-gray-300">
                  {photoSrc
                    ? <img src={photoSrc} alt={v.name || 'Tenant'} className="w-full h-full object-cover" />
                    : <Camera size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-700 hover:border-gray-300 active:scale-95 transition-all inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {uploading
                        ? <><Loader2 size={12} className="animate-spin" /> {isBn ? 'আপলোড হচ্ছে' : 'Uploading'}</>
                        : <><Camera size={12} /> {photoSrc ? (isBn ? 'বদলান' : 'Change') : (isBn ? 'ছবি যোগ করুন' : 'Add photo')}</>}
                    </button>
                    {photoSrc && (
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="px-2.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 transition-all"
                        title={isBn ? 'ছবি সরান' : 'Remove photo'}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 mt-1.5 leading-relaxed inline-flex items-start gap-1">
                    <Lock size={9} className="shrink-0 mt-0.5" />
                    <span>
                      {isBn
                        ? 'ছবিটি প্রাইভেট — শুধু আপনি দেখতে পাবেন। ভাড়াটিয়া অ্যাপ কোড দিয়ে যুক্ত হলে এটি মুছে যাবে এবং তার নিজের প্রোফাইল ছবি দেখাবে।'
                        : 'Kept private — only you can view it. Once the tenant joins with the app code it is deleted and their own profile picture is shown.'}
                    </span>
                  </p>
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { handlePhoto(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>

            {/* ── Personal ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>{isBn ? 'পিতার নাম' : "Father's Name"}</label>
                <input type="text" value={v.fatherName || ''} onChange={(e) => set({ fatherName: e.target.value })} className={subInputCls} />
              </div>
              <div>
                <label className={labelCls}>{isBn ? 'জন্ম তারিখ' : 'Date of Birth'}</label>
                <input type="date" value={v.dob || ''} onChange={(e) => set({ dob: e.target.value })} className={subInputCls} />
              </div>
              <div>
                <label className={labelCls}>{isBn ? 'বৈবাহিক অবস্থা' : 'Marital Status'}</label>
                <select value={v.maritalStatus || ''} onChange={(e) => set({ maritalStatus: e.target.value })} className={subInputCls}>
                  <option value="">{isBn ? 'নির্বাচন করুন' : 'Select'}</option>
                  {MARITAL_STATUSES.map((m) => (
                    <option key={m.id} value={m.id}>{isBn ? m.bn : m.en}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={`${labelCls} flex items-center gap-1`}>
                  <MapPin size={11} className="text-[#ba0036]" /> {isBn ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
                </label>
                <textarea rows="2" value={v.permanentAddress || ''} onChange={(e) => set({ permanentAddress: e.target.value })} className={`${subInputCls} resize-none`} />
              </div>
            </div>

            {/* ── Profession ── */}
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <label className={`${labelCls} flex items-center gap-1`}>
                <Briefcase size={11} className="text-[#ba0036]" /> {isBn ? 'পেশা' : 'Profession'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                {TENANT_TYPES.map((t) => {
                  const on = v.tenantType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set(on
                        // Unselecting clears every field that only existed for
                        // this profession, so a student ID can't survive a
                        // switch to "ব্যবসায়ী".
                        ? { tenantType: '', tenantTypeOther: '', organization: '', department: '', professionalIdStatus: '', professionalIdNumber: '' }
                        : { tenantType: t.id, tenantTypeOther: '', department: '', professionalIdStatus: '', professionalIdNumber: '' })}
                      className={`px-2 py-2.5 rounded-xl text-[10px] font-black border transition-all text-center leading-tight ${
                        on ? 'bg-[#ba0036] text-white border-[#ba0036] shadow-[0_4px_12px_rgba(186,0,54,0.2)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {isBn ? t.bn : t.en}
                    </button>
                  );
                })}
              </div>

              {type && (
                <div className="mt-3 space-y-3">
                  {/* 'Other' → let the landlord name the profession themselves. */}
                  {type.showCustomLabel && (
                    <div>
                      <label className={labelCls}>{isBn ? 'পেশা লিখুন' : 'Write the profession'}</label>
                      <input
                        id={fieldId('tenantTypeOther')}
                        type="text"
                        value={v.tenantTypeOther || ''}
                        onChange={(e) => set({ tenantTypeOther: e.target.value })}
                        placeholder={isBn ? 'যেমন: রিকশাচালক, গৃহিণী, অবসরপ্রাপ্ত' : 'e.g. Driver, Homemaker, Retired'}
                        className={`${subInputCls} ${err('tenantTypeOther')}`}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={type.showDepartment ? '' : 'sm:col-span-2'}>
                      <label className={labelCls}>{isBn ? type.orgLabel.bn : type.orgLabel.en}</label>
                      <input type="text" value={v.organization || ''} onChange={(e) => set({ organization: e.target.value })} className={subInputCls} />
                    </div>
                    {type.showDepartment && (
                      <div>
                        <label className={labelCls}>{isBn ? 'ডিপার্টমেন্ট' : 'Department'}</label>
                        <input type="text" value={v.department || ''} onChange={(e) => set({ department: e.target.value })} className={subInputCls} />
                      </div>
                    )}
                  </div>

                  <HasToggle
                    label={isBn ? `${type.idLabel.bn} আছে?` : `Has a ${type.idLabel.en}?`}
                    statusKey="professionalIdStatus"
                    clearKeys={['professionalIdNumber']}
                  />
                  {v.professionalIdStatus === HAS_STATUS.HAS && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className={labelCls}>{isBn ? type.idLabel.bn : type.idLabel.en}</label>
                      <input
                        id={fieldId('professionalIdNumber')}
                        type="text"
                        value={v.professionalIdNumber || ''}
                        onChange={(e) => set({ professionalIdNumber: e.target.value })}
                        className={`${subInputCls} ${err('professionalIdNumber')}`}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Government ID ── */}
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-3">
              <div className="flex items-center gap-1.5">
                <IdCard size={12} className="text-[#ba0036]" />
                <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                  {isBn ? 'পরিচয়পত্র' : 'Identity Document'}
                </span>
              </div>
              <HasToggle
                label={isBn ? 'NID / পাসপোর্ট আছে?' : 'Has an NID / Passport?'}
                statusKey="govtIdStatus"
                clearKeys={['govtIdType', 'govtIdNumber']}
              />
              {v.govtIdStatus === HAS_STATUS.HAS && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div>
                    <label className={labelCls}>{isBn ? 'ধরন' : 'ID Type'}</label>
                    <div id={fieldId('govtIdType')} className="grid grid-cols-2 gap-2 mt-1.5">
                      {GOVT_ID_TYPES.map((g) => {
                        const on = v.govtIdType === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => set({ govtIdType: g.id })}
                            className={`px-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                              on ? 'bg-gray-900 text-white border-gray-900' : `bg-white text-gray-500 border-gray-200 hover:border-gray-300 ${err('govtIdType')}`
                            }`}
                          >
                            {isBn ? g.bn : g.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{isBn ? 'আইডি নম্বর' : 'ID Number'}</label>
                    <input
                      id={fieldId('govtIdNumber')}
                      type="text"
                      inputMode="numeric"
                      value={v.govtIdNumber || ''}
                      onChange={(e) => set({ govtIdNumber: e.target.value })}
                      className={`${subInputCls} ${err('govtIdNumber')}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Emergency contact ── */}
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <PhoneCall size={12} className="text-[#ba0036]" />
                <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                  {isBn ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isBn ? 'নাম' : 'Name'}</label>
                  <input type="text" value={v.emergencyName || ''} onChange={(e) => set({ emergencyName: e.target.value })} className={subInputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isBn ? 'সম্পর্ক' : 'Relation'}</label>
                  <input type="text" value={v.emergencyRelation || ''} onChange={(e) => set({ emergencyRelation: e.target.value })} placeholder={isBn ? 'যেমন: পিতা, মাতা' : 'e.g. Father, Mother'} className={subInputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isBn ? 'মোবাইল নম্বর' : 'Mobile Number'}</label>
                  <input type="tel" value={v.emergencyPhone || ''} onChange={(e) => set({ emergencyPhone: e.target.value })} className={subInputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isBn ? 'ঠিকানা' : 'Address'}</label>
                  <input type="text" value={v.emergencyAddress || ''} onChange={(e) => set({ emergencyAddress: e.target.value })} className={subInputCls} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
