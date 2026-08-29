import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tenantFieldReport } from '../../utils/tenantFields';
import { listUnits } from '../../services/buildingService';
import {
  X, Camera, Upload, Loader2, CheckCircle2, AlertCircle, ChevronDown,
  ChevronUp, Trash2, Plus, ScanLine, Sparkles, Check, RefreshCw,
  User, Phone, Banknote, Building, Home, Eye, Save,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// ── Helpers ────────────────────────────────────────────────────────────────────
function getToken() {
  try { return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || ''; }
  catch { return ''; }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result); // full data-URL
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// One editable tenant row in the review screen.
function TenantReviewRow({ tenant, idx, onChange, onProfileChange, scanMode, onRemove, language }) {
  const isBn = language === 'বাংলা';
  const [open, setOpen] = useState(true);

  // The four things a tenant cannot be saved without, plus anything the AI
  // flagged as uncertain. Optional fields left blank are not gaps: "no NID" is
  // a complete answer, and nagging about it is what made the old screen noisy.
  const gaps = [
    { key: 'name',        en: 'Name',        bn: 'নাম',        wide: true },
    { key: 'phone',       en: 'Mobile',      bn: 'মোবাইল' },
    { key: 'roomNumber',  en: 'Room / Flat', bn: 'রুম / ফ্ল্যাট' },
    { key: 'monthlyRent', en: 'Rent',        bn: 'ভাড়া' },
  ].filter(g => {
    const v = tenant[g.key];
    const empty = v === '' || v === undefined || v === null || (g.key === 'monthlyRent' && !Number(v));
    const unsure = tenant._flags?.[`${g.key}Low`];
    return empty || unsure;
  });

  const field = (key, value, flagKey) => (
    <div className="relative">
      {flagKey && tenant._flags?.[flagKey] && (
        <span className="absolute -top-1.5 -right-1 z-10 w-3 h-3 rounded-full bg-amber-400 border-2 border-white"
              title={isBn ? 'AI অনিশ্চিত — চেক করুন' : 'AI uncertain — please verify'} />
      )}
      <input
        id={`scan-${idx}-${key}`}
        value={value ?? ''}
        onChange={e => onChange(idx, key, e.target.value)}
        className={`w-full px-2.5 py-2 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 transition-all ${
          flagKey && tenant._flags?.[flagKey]
            ? 'border-amber-300 bg-amber-50 focus:ring-amber-400'
            : 'border-gray-200 bg-white focus:ring-[#ba0036]/40'
        }`}
      />
    </div>
  );

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      open ? 'border-gray-200 shadow-sm' : 'border-gray-100'
    }`}>
      {/* Row header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-left transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#ff004c] text-white flex items-center justify-center text-[11px] font-black shrink-0">
          {(tenant.name?.[0] || '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-gray-900 truncate">
            {tenant.name || (isBn ? '(নাম নেই)' : '(No name)')}
          </p>
          <p className="text-[10px] font-bold text-gray-500">
            {tenant.monthlyRent > 0 ? `৳${Number(tenant.monthlyRent).toLocaleString()}` : (isBn ? 'ভাড়া নেই' : 'No rent')}
            {tenant.phone ? ` · ${tenant.phone}` : ''}
          </p>
        </div>
        {/* Flag indicator */}
        {gaps.length > 0 ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tabular-nums">
            {gaps.length} {isBn ? 'বাকি' : 'to fill'}
          </span>
        ) : (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase inline-flex items-center gap-0.5">
            <Check size={9} strokeWidth={4}/> {isBn ? 'প্রস্তুত' : 'Ready'}
          </span>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(idx); }}
          className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
          title={isBn ? 'সরিয়ে দিন' : 'Remove'}
        >
          <Trash2 size={13} />
        </button>
        <div className="shrink-0 text-gray-400">{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
      </button>

      {/* ── Needs your input ──────────────────────────────────────────────
          Fields the AI could not read, or read with low confidence, listed
          FIRST and open by default. Amber stops meaning "warning" here and
          starts meaning "this one is waiting for you". */}
      {open && gaps.length > 0 && (
        <div className="px-3 pt-2 pb-1 bg-amber-50/50 border-t border-amber-100">
          <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <AlertCircle size={10}/> {isBn ? 'আপনার ইনপুট দরকার' : 'Needs your input'}
            <span className="tabular-nums">{gaps.length}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 pb-2">
            {gaps.map((g, gi) => (
              <div key={g.key} className={g.wide ? 'col-span-2' : ''}>
                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
                  {isBn ? g.bn : g.en}
                </label>
                <input
                  id={`scan-${idx}-${g.key}`}
                  autoFocus={gi === 0}
                  value={tenant[g.key] ?? ''}
                  onChange={e => onChange(idx, g.key, e.target.value)}
                  placeholder={isBn ? 'লিখুন' : 'Type here'}
                  className="w-full px-2.5 py-2 rounded-lg text-xs font-bold border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── What the admission form gave us ──────────────────────────────
          Form mode only. A khata page has none of this on it, so rendering
          fifteen empty boxes there would be noise. */}
      {open && scanMode === 'form' && (() => {
        const prof = tenant.tenantProfile || {};
        const { filled, missing } = tenantFieldReport(
          { ...prof, name: tenant.name, phone: tenant.phone, moveInDate: tenant.moveInDate },
          isBn,
        );
        const row = (key, label, wide) => (
          <div key={key} className={wide ? 'col-span-2' : ''}>
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</label>
            <input
              id={`scan-${idx}-${key}`}
              value={prof[key] ?? ''}
              onChange={e => onProfileChange(idx, key, e.target.value)}
              placeholder={isBn ? 'ফরমে পাওয়া যায়নি' : 'not found on the form'}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 transition-all ${
                String(prof[key] || '').trim()
                  ? 'border-gray-200 bg-white focus:ring-[#ba0036]/40'
                  : 'border-dashed border-amber-300 bg-amber-50/40 focus:ring-amber-400'
              }`}
            />
          </div>
        );
        return (
          <div className="px-3 pb-3 pt-2 bg-white border-t border-gray-100">
            {/* The account of the scan, before any of the boxes. */}
            <div className="mb-2 flex items-start gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tabular-nums">
                {isBn ? `পাওয়া গেছে ${filled.length}` : `read ${filled.length}`}
              </span>
              {missing.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tabular-nums">
                  {isBn ? `পাওয়া যায়নি ${missing.length}` : `not found ${missing.length}`}
                </span>
              )}
              {missing.length > 0 && (
                <span className="w-full text-[9px] font-bold text-amber-700/80 leading-relaxed">
                  {missing.map(f => f.label).join(' · ')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {row('fatherName',       isBn ? 'পিতার নাম' : "Father's name", true)}
              {row('dob',              isBn ? 'জন্ম তারিখ' : 'Date of birth')}
              {row('maritalStatus',    isBn ? 'বৈবাহিক অবস্থা' : 'Marital status')}
              {row('permanentAddress', isBn ? 'স্থায়ী ঠিকানা' : 'Permanent address', true)}
              {row('tenantType',       isBn ? 'পেশা' : 'Profession')}
              {row('organization',     isBn ? 'প্রতিষ্ঠান' : 'Organization')}
              {row('department',       isBn ? 'ডিপার্টমেন্ট' : 'Department')}
              {row('professionalIdNumber', isBn ? 'স্টুডেন্ট / এমপ্লয়ি আইডি' : 'Student / Employee ID')}
              {row('govtIdNumber',     isBn ? 'NID / পাসপোর্ট' : 'NID / Passport', true)}
              {row('emergencyName',    isBn ? 'জরুরি যোগাযোগ — নাম' : 'Emergency — name')}
              {row('emergencyPhone',   isBn ? 'জরুরি যোগাযোগ — মোবাইল' : 'Emergency — mobile')}
              {row('emergencyRelation', isBn ? 'সম্পর্ক' : 'Relation')}
              {row('emergencyAddress',  isBn ? 'জরুরি যোগাযোগ — ঠিকানা' : 'Emergency — address')}
            </div>
            <p className="text-[9px] font-bold text-gray-400 mt-2 leading-relaxed">
              {isBn
                ? 'ড্যাশ-বর্ডার মানে ফরমে পাওয়া যায়নি। এগুলো ঐচ্ছিক — খালি রেখেও সেভ করা যাবে।'
                : 'A dashed box means the form did not have it. These are optional — saving works without them.'}
            </p>
          </div>
        );
      })()}

      {/* What the AI already got — collapsed to a summary so it doesn't
          compete for attention with the boxes that still need filling. */}
      {open && (
        <div className="px-3 pb-3 pt-1 bg-gray-50/60 grid grid-cols-2 gap-2">
          {/* Name */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <User size={9}/> {isBn ? 'নাম *' : 'Name *'}
            </label>
            {field('name', tenant.name, 'nameLow')}
          </div>
          {/* Phone */}
          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Phone size={9}/> {isBn ? 'মোবাইল' : 'Phone'}
            </label>
            {field('phone', tenant.phone, 'phoneLow')}
          </div>
          {/* Monthly Rent */}
          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Banknote size={9}/> {isBn ? 'মাসিক ভাড়া *' : 'Monthly Rent *'}
            </label>
            {field('monthlyRent', tenant.monthlyRent, 'monthlyRentLow')}
          </div>
          {/* Advance */}
          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
              {isBn ? 'অগ্রিম' : 'Advance'}
            </label>
            {field('advancePayment', tenant.advancePayment)}
          </div>
          {/* Room */}
          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
              {isBn ? 'রুম নং' : 'Room No.'}
            </label>
            {field('roomNumber', tenant.roomNumber)}
          </div>
          {/* Property (building name — pre-filled from defaults) */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Building size={9}/> {isBn ? 'বাসা/বিল্ডিং' : 'Property'}
            </label>
            {field('property', tenant.property)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function AiLedgerScannerModal({
  isOpen,
  onClose,
  language,
  landlordProfile,
  currentBuildingId,
  showToast,
  onBookingsCreated,   // called with the array of new bookings after save
}) {
  const isBn = language === 'বাংলা';

  // ── Stage: 'upload' | 'scanning' | 'review' | 'saving' | 'done'
  const [stage, setStage] = useState('upload');

  // WHAT is being photographed. A খাতা page physically holds names, rooms and
  // amounts — never a father's name or an NID. Those live on the ভর্তি ফরম, one
  // page per tenant. Same review screen and same saved record either way; only
  // the prompt differs, because the two pages contain different things.
  const [scanMode, setScanMode] = useState('khata');

  const [imagePreview, setImagePreview] = useState(null);    // data-URL for <img>
  const [imageBase64,  setImageBase64]  = useState(null);    // full data-URL
  const [mimeType,     setMimeType]     = useState('image/jpeg');

  const [tenants,      setTenants]      = useState([]);      // parsed + reviewed list
  const [parseError,   setParseError]   = useState(false);
  const [aiRawText,    setAiRawText]    = useState('');

  const [saveResult,   setSaveResult]   = useState(null);    // { created, errors }
  // Floor for the whole page, for rows the ledger did not label individually.
  const [pageFloor,    setPageFloor]    = useState('');

  // ── Pinning the room BEFORE the photo ─────────────────────────────────────
  // The room number is the least reliable thing on a handwritten page and the
  // one with the worst failure mode: read "Room 101" where the app already has
  // "101" and you get a second room, a second booking and a second rent ledger
  // for one physical room.
  //
  // When the landlord already knows the room — which for an admission form they
  // always do, they are standing in it — saying so up front removes the guess
  // entirely. The server then ignores whatever the page says about rooms.
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [pinnedUnitId, setPinnedUnitId] = useState('');

  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  // ── Default settings from landlord profile ──────────────────────────────────
  const building = currentBuildingId
    ? landlordProfile?.buildings?.find(b => b.id === currentBuildingId)
    : landlordProfile?.buildingMode === 'single'
      ? landlordProfile?.buildings?.[0]
      : null;

  const defaultSettings = {
    property:        building?.name   || '',
    // `address` on a real Building record; `location` was the old profile-blob
    // spelling. Both read, because a landlord can be on either side of the
    // buildings/units migration.
    location:        building?.address || building?.location || '',
    rentDueDay:      landlordProfile?.rentDueDay      ?? 5,
    paymentMethod:   landlordProfile?.paymentMethod   || '',
    reminderLeadDays: landlordProfile?.reminderLeadDays ?? 3,
    autoReminder:    landlordProfile?.autoReminder    !== false,
    leaseStart:      new Date().toISOString().split('T')[0],
  };

  // Load this building's rooms so the landlord can pin one. Runs when the modal
  // opens rather than on mount, so a room added since last time is offered.
  useEffect(() => {
    if (!isOpen || !building?.id) { setUnits([]); return; }
    let alive = true;
    setUnitsLoading(true);
    listUnits(building.id)
      .then(({ units: rows }) => { if (alive) setUnits(Array.isArray(rows) ? rows : []); })
      // A failed room list must not block scanning — it only costs the landlord
      // the shortcut, and the server still de-duplicates by room number.
      .catch(() => { if (alive) setUnits([]); })
      .finally(() => { if (alive) setUnitsLoading(false); });
    return () => { alive = false; };
  }, [isOpen, building?.id]);

  // A room is remembered per building, not across them.
  useEffect(() => { setPinnedUnitId(''); }, [building?.id]);

  const pinnedUnit = units.find((u) => String(u.id) === String(pinnedUnitId)) || null;
  const floorLabel = (n) => (Number(n) === 0
    ? (isBn ? 'নিচতলা' : 'Ground')
    : (isBn ? `${n} তলা` : `Floor ${n}`));

  // ── Image selection ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    const preview = await toBase64(file);
    setImagePreview(preview);
    setImageBase64(preview);          // keep full data-URL; controller strips prefix
    setMimeType(file.type || 'image/jpeg');
    setStage('upload');               // stay on upload so user can confirm
    setTenants([]);
    setParseError(false);
  }, []);

  // ── Call AI scan API ─────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    if (!imageBase64) return;
    setStage('scanning');
    
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        const resp = await fetch(`${API_BASE}/ai/scan-ledger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            imageBase64,
            mimeType,
            defaultSettings,
            mode: scanMode,
          }),
        });
        
        if (resp.status === 429 || resp.status === 503) {
          throw new Error('OVERLOAD');
        }

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'SCAN_ERROR');

        setAiRawText(data.rawText || '');
        setParseError(!!data.parseError);
        setTenants(data.tenants || []);
        setStage('review');
        return; // Success, exit loop
      } catch (err) {
        const errMessage = (err.message || '').toLowerCase();
        const isOverload = err.message === 'OVERLOAD' || 
                           errMessage.includes('too many') || 
                           errMessage.includes('rate limit') || 
                           errMessage.includes('capacity') ||
                           errMessage.includes('503') ||
                           errMessage.includes('service unavailable') ||
                           errMessage.includes('high demand');

        if (isOverload && attempt < maxAttempts - 1) {
          attempt++;
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        let msgEn = "Same Problem, try again";
        let msgBn = "একই সমস্যা, আবার চেষ্টা করুন";

        if (isOverload) {
           msgEn = "AI server is currently busy. Please try again in a few moments.";
           msgBn = "AI সার্ভার এখন ব্যস্ত আছে। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।";
        } else if (err.message === 'Failed to fetch') {
           msgEn = "Network error. Please check your connection and try again.";
           msgBn = "নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
        }

        showToast(isBn ? msgBn : msgEn, { type: 'error', duration: 5000 });
        setStage('upload');
        return; // Failure, exit loop
      }
    }
  }, [imageBase64, mimeType, defaultSettings, scanMode, isBn, showToast]);

  // ── Edit tenant field inline ─────────────────────────────────────────────────
  const handleFieldChange = useCallback((idx, key, value) => {
    setTenants(prev => prev.map((t, i) => (i === idx ? { ...t, [key]: value } : t)));
  }, []);

  // Same, for the fields that live under `tenantProfile` — father's name, NID,
  // emergency contact and the rest of what an admission form carries.
  const handleProfileChange = useCallback((idx, key, value) => {
    setTenants(prev => prev.map((t, i) => (
      i === idx ? { ...t, tenantProfile: { ...(t.tenantProfile || {}), [key]: value } } : t
    )));
  }, []);

  const handleRemoveTenant = useCallback((idx) => {
    setTenants(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAddBlank = useCallback(() => {
    setTenants(prev => [...prev, {
      name: '', phone: '', monthlyRent: 0, advancePayment: 0,
      roomNumber: '', floorNumber: '', notes: '', property: defaultSettings.property,
      rentDueDay: defaultSettings.rentDueDay, paymentMethod: defaultSettings.paymentMethod,
      reminderLeadDays: defaultSettings.reminderLeadDays, autoReminder: true,
      leaseStart: defaultSettings.leaseStart,
      _flags: { nameLow: true, phoneLow: true, monthlyRentLow: true },
    }]);
  }, [defaultSettings]);

  // ── Save all ─────────────────────────────────────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    // Nothing saves while a REQUIRED box is empty, and the first one is scrolled
    // to and focused — hunting for it through a list of scanned rows is exactly
    // the work the scan was supposed to remove.
    //
    // Required means the same four things it means everywhere else (name,
    // mobile, room, move-in) plus the rent, which the ledger cannot work
    // without. Optional gaps are shown but never block: "no NID" is an answer.
    for (let i = 0; i < tenants.length; i += 1) {
      const t = tenants[i];
      const gaps = [];
      if (!String(t.name || '').trim()) gaps.push('name');
      if (!String(t.phone || '').trim()) gaps.push('phone');
      // A pinned room already answers this, and a form photo that never showed
      // a room number is the normal case then — demanding one would block a
      // scan whose destination is not in doubt.
      if (!pinnedUnitId && !String(t.roomNumber || '').trim()) gaps.push('roomNumber');
      if (!(Number(t.monthlyRent) > 0)) gaps.push('monthlyRent');
      if (!gaps.length) continue;

      showToast(isBn
        ? `${t.name?.trim() || `সারি ${i + 1}`} — ${gaps.length}টি ঘর খালি, পূরণ করুন`
        : `${t.name?.trim() || `Row ${i + 1}`} — ${gaps.length} required field(s) still empty`,
        { type: 'error' });
      setTenants(prev => prev.map((x, j) => (j === i ? { ...x, _forceOpen: Date.now() } : x)));
      setTimeout(() => {
        const el = document.getElementById(`scan-${i}-${gaps[0]}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          try { el.focus({ preventScroll: true }); } catch { /* focus optional */ }
        }
      }, 80);
      return;
    }

    const valid = tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0);
    if (valid.length === 0) {
      showToast(isBn ? 'কমপক্ষে একটি ভাড়াটিয়ার নাম ও ভাড়া দিন।' : 'At least one tenant with name & rent is required.', { type: 'error' });
      return;
    }

    // Check for duplicate rows in the scanned list (same name, rent, and room)
    const seen = new Set();
    const duplicates = [];
    for (const t of valid) {
      const key = `${t.name.trim().toLowerCase()}|${t.monthlyRent}|${(t.roomNumber || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        duplicates.push(t.name);
      }
      seen.add(key);
    }
    
    if (duplicates.length > 0) {
      showToast(isBn ? `ডুপ্লিকেট ডাটা পাওয়া গেছে: ${duplicates[0]}। সেভ করার আগে ডিলিট বা মডিফাই করুন।` : `Duplicate data found: ${duplicates[0]}. Please edit or delete before saving.`, { type: 'error', duration: 6000 });
      return;
    }

    if (!building?.id) {
      showToast(isBn ? 'কোন বিল্ডিং-এ যোগ হবে সেটি আগে বাছুন।' : 'Pick which building these tenants go into first.', { type: 'error' });
      return;
    }

    setStage('saving');
    try {
      const resp = await fetch(`${API_BASE}/bookings/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        // Scanned tenants are placed INTO units of this building, through the
        // same code the manual form uses. Without a buildingId the server
        // refuses rather than creating leases linked to nothing.
        //
        // `unitId`, when the landlord pinned a room, overrides every room and
        // floor on the page — so no room can be created and none can be
        // duplicated by a misread number.
        body: JSON.stringify({
          tenants: valid,
          buildingId: building?.id,
          ...(pinnedUnitId ? { unitId: pinnedUnitId } : {}),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Save failed');

      setSaveResult({ created: data.created, errors: data.errors });
      setStage('done');
      if (data.bookings?.length) onBookingsCreated?.(data.bookings);
      if (data.errors > 0 && data.errorDetails?.length > 0) {
        const firstErr = data.errorDetails[0];
        showToast(isBn ? `ব্যর্থ (${firstErr.name}): ${firstErr.reason}` : `Failed (${firstErr.name}): ${firstErr.reason}`, { type: 'error', duration: 8000 });
      } else {
        showToast(
          isBn
            ? `✅ ${data.created} জন ভাড়াটিয়া সেভ হয়েছে!`
            : `✅ ${data.created} tenant(s) saved!`,
        );
      }
    } catch (err) {
      showToast(isBn ? `সেভ ব্যর্থ: ${err.message}` : `Save failed: ${err.message}`, { type: 'error' });
      setStage('review');
    }
  }, [tenants, isBn, showToast, onBookingsCreated, building?.id, pinnedUnitId]);

  const handleReset = useCallback(() => {
    setStage('upload');
    setImagePreview(null);
    setImageBase64(null);
    setTenants([]);
    setParseError(false);
    setSaveResult(null);
    setAiRawText('');
  }, []);

  useEffect(() => {
    if (isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  if (!isOpen) return null;

  // ── Flag count for review stage header ──────────────────────────────────────
  const flagCount = tenants.filter(t => Object.values(t._flags || {}).some(Boolean)).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#ff004c] flex items-center justify-center text-white shrink-0">
            <ScanLine size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-gray-900">
              {isBn ? 'খাতা স্ক্যান করুন (AI)' : 'Scan Rent Ledger (AI)'}
            </h2>
            <p className="text-[10px] font-bold text-gray-500">
              {stage === 'upload'  && (isBn ? 'খাতার ছবি তুলুন বা আপলোড করুন' : 'Take or upload a photo of your rent book')}
              {stage === 'scanning' && (isBn ? 'AI বিশ্লেষণ করছে...' : 'AI is analysing the image...')}
              {stage === 'review'  && (isBn ? `${tenants.length} জন পাওয়া গেছে — যাচাই করুন` : `${tenants.length} tenant(s) found — review & confirm`)}
              {stage === 'saving'  && (isBn ? 'সেভ হচ্ছে...' : 'Saving...')}
              {stage === 'done'    && (isBn ? 'সম্পন্ন!' : 'Done!')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ── UPLOAD STAGE ── */}
          {(stage === 'upload') && (
            <div className="p-4 space-y-4">

              {/* What are we photographing? A খাতা lists many tenants but only
                  names, rooms and amounts. A ভর্তি ফরম is one tenant with
                  nearly every field on it — which is where the real time
                  saving is, because a ledger page has no father's name on it. */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  {isBn ? 'কীসের ছবি?' : 'What are you scanning?'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'khata', en: 'Rent Book', bn: 'ভাড়ার খাতা',
                      subEn: 'Many tenants', subBn: 'অনেক ভাড়াটিয়া',
                      readsEn: 'Reads: name, mobile, rent, advance, room',
                      readsBn: 'পড়বে: নাম, মোবাইল, ভাড়া, অগ্রিম, রুম' },
                    { id: 'form',  en: 'Admission Form', bn: 'ভর্তি ফরম',
                      subEn: 'One tenant', subBn: 'একজন ভাড়াটিয়া',
                      readsEn: 'Also reads: father, address, DOB, profession, IDs, emergency contact',
                      readsBn: 'আরও পড়বে: পিতা, ঠিকানা, জন্ম তারিখ, পেশা, আইডি, জরুরি যোগাযোগ' },
                  ].map(m => {
                    const on = scanMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScanMode(m.id)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${on ? 'border-[#ba0036] bg-red-50/70' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <p className={`text-[11px] font-black leading-tight ${on ? 'text-[#ba0036]' : 'text-gray-900'}`}>
                          {isBn ? m.bn : m.en}
                        </p>
                        <p className="text-[9px] font-bold text-gray-500 leading-tight mt-0.5">
                          {isBn ? m.subBn : m.subEn}
                        </p>
                        {/* Which fields this mode can actually extract. Without
                            it, scanning an admission form as a খাতা quietly
                            reads five fields out of fifteen. */}
                        <p className={`text-[9px] font-bold leading-tight mt-1 ${on ? 'text-[#ba0036]/80' : 'text-gray-400'}`}>
                          {isBn ? m.readsBn : m.readsEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Which room? ────────────────────────────────────────────
                  Asked BEFORE the photo, because this is the one field the
                  landlord always knows and the camera reads worst. Pinning a
                  room makes a duplicate impossible: the server places every
                  tenant from this scan into that unit and ignores whatever the
                  page says about rooms.

                  Left on "read from the page" this behaves as before — except
                  the server now matches "Room 101" to an existing "101" instead
                  of creating a second room beside it. */}
              {building?.id && units.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    {isBn ? 'কোন রুমে যুক্ত হবে?' : 'Which room does this go into?'}
                  </p>
                  <select
                    value={pinnedUnitId}
                    onChange={(e) => setPinnedUnitId(e.target.value)}
                    disabled={unitsLoading}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#ba0036] transition-colors"
                  >
                    <option value="">
                      {scanMode === 'form'
                        ? (isBn ? '— ফরম থেকে পড়ুন (ঝুঁকি আছে) —' : '— Read it from the form (riskier) —')
                        : (isBn ? '— পাতা থেকে পড়ুন —' : '— Read it from the page —')}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {floorLabel(u.floor)} · {isBn ? 'রুম' : 'Room'} {u.roomNumber}
                      </option>
                    ))}
                  </select>

                  {pinnedUnit ? (
                    <p className="text-[10px] font-bold text-emerald-700 mt-1.5 leading-relaxed flex items-start gap-1">
                      <Check size={11} className="shrink-0 mt-0.5" />
                      {isBn
                        ? `সবাই "${pinnedUnit.roomNumber}" রুমে যুক্ত হবেন। ফরমে যা-ই লেখা থাক, নতুন রুম তৈরি হবে না।`
                        : `Everyone goes into room ${pinnedUnit.roomNumber}. No new room will be created, whatever the form says.`}
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold text-gray-400 mt-1.5 leading-relaxed">
                      {scanMode === 'form'
                        ? (isBn
                            ? 'একটি ফরমের জন্য রুম বেছে নেওয়াই নিরাপদ — হাতে লেখা রুম নম্বর ভুল পড়া সবচেয়ে সাধারণ সমস্যা।'
                            : 'For a single form, picking the room is safest — a misread handwritten room number is the most common problem.')
                        : (isBn
                            ? 'রুম ও তলা নম্বর পাতা থেকে পড়া হবে; আগের তৈরি রুমের সাথে মিলিয়ে নেওয়া হবে।'
                            : 'Room and floor are read from the page and matched against rooms you already created.')}
                    </p>
                  )}
                </div>
              )}

              {/* Tips */}
              <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-100">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Sparkles size={10}/> {isBn ? 'সেরা ফলাফলের জন্য' : 'For best results'}
                </p>
                <ul className="space-y-1 text-[10px] font-bold text-blue-600">
                  <li>• {isBn ? 'পুরো পাতা ফ্রেমের মধ্যে রাখুন' : 'Keep the full page inside the frame'}</li>
                  <li>• {isBn ? 'পর্যাপ্ত আলোতে ছবি তুলুন' : 'Take the photo in good lighting'}</li>
                  <li>• {scanMode === 'form'
                    ? (isBn ? 'একটি ফরম = একজন ভাড়াটিয়া' : 'One form = one tenant')
                    : (isBn ? 'নাম, ভাড়া, নাম্বার একই পাতায় রাখুন' : 'Name, rent and phone on the same page')}</li>
                </ul>
              </div>

              {/* Image preview */}
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img src={imagePreview} alt="Ledger preview" className="w-full max-h-56 object-contain" />
                  <button
                    type="button"
                    onClick={handleReset}
                    className="absolute top-2 right-2 p-1.5 rounded-xl bg-white/90 text-gray-600 hover:text-red-600 border border-gray-200 shadow"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                /* Upload zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-[#ba0036]/40 hover:bg-red-50/30 transition-all group"
                >
                  <Upload size={28} className="mx-auto text-gray-300 group-hover:text-[#ba0036]/60 mb-2 transition-colors" />
                  <p className="text-xs font-black text-gray-500 group-hover:text-gray-700">
                    {isBn ? 'গ্যালারি থেকে ছবি বাছুন' : 'Choose a photo from gallery'}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 mt-0.5">JPG, PNG, WEBP — {isBn ? 'সর্বোচ্চ ৮ MB' : 'max 8 MB'}</p>
                </div>
              )}

              {/* Hidden inputs */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFileSelect(e.target.files?.[0])} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleFileSelect(e.target.files?.[0])} />

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-gray-200 text-gray-700 text-xs font-black hover:border-[#ba0036]/40 hover:bg-red-50/30 transition-all"
                >
                  <Camera size={16} /> {isBn ? 'ক্যামেরা' : 'Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-gray-200 text-gray-700 text-xs font-black hover:border-[#ba0036]/40 hover:bg-red-50/30 transition-all"
                >
                  <Upload size={16} /> {isBn ? 'আপলোড' : 'Gallery'}
                </button>
              </div>
            </div>
          )}

          {/* ── SCANNING STAGE ── */}
          {stage === 'scanning' && (
            <div className="p-8 text-center">
              {imagePreview && (
                <div className="relative rounded-2xl overflow-hidden mb-6">
                  <img src={imagePreview} alt="Scanning" className="w-full max-h-40 object-contain opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/95 rounded-2xl px-5 py-4 shadow-xl flex flex-col items-center gap-2">
                      <Loader2 size={28} className="text-[#ba0036] animate-spin" />
                      <p className="text-xs font-black text-gray-900">{isBn ? 'To-Let Pro AI বিশ্লেষণ করছে...' : 'To-Let Pro AI analysing...'}</p>
                      <p className="text-[10px] font-bold text-gray-500">{isBn ? 'এটি ৫–১০ সেকেন্ড নিতে পারে' : 'This may take 5–10 seconds'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW STAGE ── */}
          {stage === 'review' && (
            <div className="p-4 space-y-3">
              {/* Summary banner */}
              {parseError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-black text-amber-800">
                      {isBn ? 'পরিষ্কার ডাটা পাওয়া যায়নি' : 'Could not extract structured data'}
                    </p>
                    <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                      {isBn ? 'আরও স্পষ্ট আলোয় আবার চেষ্টা করুন, বা নিচে ম্যানুয়ালি যোগ করুন।' : 'Try a clearer image, or add tenants manually below.'}
                    </p>
                  </div>
                </div>
              ) : flagCount > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2">
                  <AlertCircle size={13} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700">
                    {isBn
                      ? `${flagCount}টি এন্ট্রিতে হলুদ ঘর আছে — AI অনিশ্চিত ছিল। চেক করুন।`
                      : `${flagCount} entry(ies) have highlighted fields where AI was uncertain. Please verify.`}
                  </p>
                </div>
              ) : tenants.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <p className="text-[10px] font-black text-emerald-700">
                    {isBn
                      ? `${tenants.length} জন ভাড়াটিয়া সফলভাবে পড়া হয়েছে।`
                      : `${tenants.length} tenant(s) successfully extracted.`}
                  </p>
                </div>
              ) : null}

              {/* Thumbnail + re-scan */}
              {imagePreview && (
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="Scanned" className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[10px] font-black text-gray-500 hover:text-[#ba0036] flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={11} /> {isBn ? 'অন্য ছবি দিন' : 'Use different image'}
                  </button>
                </div>
              )}

              {/* Default settings chip */}
              {building && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-xl w-fit">
                  <Home size={10} className="text-[#ba0036]" />
                  <span className="text-[10px] font-black text-gray-700">{building.name}</span>
                  <span className="text-[10px] font-bold text-gray-400">·</span>
                  <span className="text-[10px] font-bold text-gray-500">{isBn ? `${defaultSettings.rentDueDay} তারিখে ভাড়া` : `Due day ${defaultSettings.rentDueDay}`}</span>
                </div>
              )}

              {/* ── Floor for the whole page ──────────────────────────────
                  A ledger page normally names the floor once, at the top, and
                  not again on any row. Rows that came back without one would
                  otherwise land on the ground floor — splitting "Room 201" into
                  two rooms with two separate bookings. Setting it here fills
                  only the rows the page left blank. */}
              {/* A pinned room settles the destination, so everyone can see it
                  before saving — and the floor warning below is moot. */}
              {pinnedUnit && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                  <Home size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-black text-emerald-800 leading-relaxed">
                    {isBn
                      ? `সবাই যুক্ত হবেন: ${floorLabel(pinnedUnit.floor)} · রুম ${pinnedUnit.roomNumber} — নতুন রুম তৈরি হবে না।`
                      : `Everyone goes into ${floorLabel(pinnedUnit.floor)} · Room ${pinnedUnit.roomNumber} — no new room will be created.`}
                  </p>
                </div>
              )}

              {!pinnedUnitId && tenants.some(t => !String(t.floorNumber || '').trim()) && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <AlertCircle size={13} className="text-amber-600 shrink-0" />
                    <span className="text-[11px] font-black text-amber-800 flex-1 min-w-[140px]">
                      {isBn
                        ? `${tenants.filter(t => !String(t.floorNumber || '').trim()).length}টি সারিতে ফ্লোর নেই`
                        : `${tenants.filter(t => !String(t.floorNumber || '').trim()).length} row(s) have no floor`}
                    </span>
                    <input
                      type="number"
                      value={pageFloor}
                      onChange={(e) => setPageFloor(e.target.value)}
                      placeholder={isBn ? 'ফ্লোর' : 'Floor'}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-amber-500 tabular-nums"
                    />
                    <button
                      type="button"
                      disabled={pageFloor === ''}
                      onClick={() => {
                        setTenants(prev => prev.map(t => (
                          String(t.floorNumber || '').trim() ? t : { ...t, floorNumber: String(pageFloor) }
                        )));
                        showToast(isBn ? 'খালি সারিগুলোতে ফ্লোর বসানো হয়েছে' : 'Floor applied to the blank rows');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      {isBn ? 'বসান' : 'Apply'}
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-amber-700 mt-1.5 leading-relaxed">
                    {isBn
                      ? 'ফ্লোর ছাড়া একই রুম নম্বর আলাদা রুম হিসেবে তৈরি হতে পারে — যেমন "২০১" দুইবার।'
                      : 'Without a floor, one room number can become two separate rooms — e.g. "201" twice.'}
                  </p>
                </div>
              )}

              {/* Tenant rows */}
              <div className="space-y-2">
                {tenants.map((t, i) => (
                  <TenantReviewRow
                    key={i}
                    tenant={t}
                    idx={i}
                    onChange={handleFieldChange}
                    onProfileChange={handleProfileChange}
                    scanMode={scanMode}
                    onRemove={handleRemoveTenant}
                    language={language}
                  />
                ))}
              </div>

              {/* Add blank */}
              <button
                type="button"
                onClick={handleAddBlank}
                className="w-full py-2.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-[#ba0036]/40 hover:text-[#ba0036] text-[10px] font-black flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={12} /> {isBn ? 'আরেকজন যোগ করুন' : 'Add another tenant'}
              </button>
            </div>
          )}

          {/* ── SAVING STAGE ── */}
          {stage === 'saving' && (
            <div className="p-8 text-center">
              <Loader2 size={32} className="mx-auto text-[#ba0036] animate-spin mb-3" />
              <p className="text-sm font-black text-gray-900">{isBn ? 'সেভ হচ্ছে...' : 'Saving tenants...'}</p>
              <p className="text-[10px] font-bold text-gray-500 mt-1">
                {isBn ? `${tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0).length} জন` : `${tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0).length} tenant(s)`}
              </p>
            </div>
          )}

          {/* ── DONE STAGE ── */}
          {stage === 'done' && saveResult && (
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">
                {isBn ? 'সফল!' : 'Success!'}
              </h3>
              <p className="text-sm font-bold text-gray-600 mb-4">
                {isBn
                  ? `${saveResult.created} জন ভাড়াটিয়া বুকিং হয়েছে`
                  : `${saveResult.created} tenant booking(s) created`}
                {saveResult.errors > 0 && (
                  <span className="text-amber-600"> · {isBn ? `${saveResult.errors}টি ব্যর্থ` : `${saveResult.errors} failed`}</span>
                )}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-gray-900 text-white text-xs font-black hover:bg-black transition-colors"
              >
                {isBn ? 'ড্যাশবোর্ডে যান' : 'Go to Dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(stage === 'upload' || stage === 'review') && (
          <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
            {stage === 'upload' && (
              <button
                type="button"
                onClick={handleScan}
                disabled={!imageBase64}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ba0036] to-[#ff004c] text-white text-xs font-black uppercase tracking-widest shadow-[0_4px_14px_rgba(186,0,54,0.3)] hover:shadow-[0_6px_20px_rgba(186,0,54,0.4)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ScanLine size={14} />
                {isBn ? 'AI দিয়ে স্ক্যান করুন' : 'Scan with AI'}
              </button>
            )}

            {stage === 'review' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-none px-4 py-3 rounded-2xl border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> {isBn ? 'আবার স্ক্যান' : 'Re-scan'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0).length === 0}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#ba0036] to-[#ff004c] text-white text-xs font-black uppercase tracking-widest shadow-[0_4px_14px_rgba(186,0,54,0.3)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Save size={13} />
                  {isBn
                    ? `সবগুলো সেভ করুন (${tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0).length} জন)`
                    : `Save All (${tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0).length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
