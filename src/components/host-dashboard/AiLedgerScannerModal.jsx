import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
function TenantReviewRow({ tenant, idx, onChange, onRemove, language }) {
  const isBn = language === 'বাংলা';
  const [open, setOpen] = useState(true);

  const field = (key, value, flagKey) => (
    <div className="relative">
      {flagKey && tenant._flags?.[flagKey] && (
        <span className="absolute -top-1.5 -right-1 z-10 w-3 h-3 rounded-full bg-amber-400 border-2 border-white"
              title={isBn ? 'AI অনিশ্চিত — চেক করুন' : 'AI uncertain — please verify'} />
      )}
      <input
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
        {Object.values(tenant._flags || {}).some(Boolean) && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase">
            {isBn ? 'যাচাই করুন' : 'Check'}
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

      {/* Editable fields */}
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

  const [imagePreview, setImagePreview] = useState(null);    // data-URL for <img>
  const [imageBase64,  setImageBase64]  = useState(null);    // full data-URL
  const [mimeType,     setMimeType]     = useState('image/jpeg');

  const [tenants,      setTenants]      = useState([]);      // parsed + reviewed list
  const [parseError,   setParseError]   = useState(false);
  const [aiRawText,    setAiRawText]    = useState('');

  const [saveResult,   setSaveResult]   = useState(null);    // { created, errors }

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
    location:        building?.location || '',
    rentDueDay:      landlordProfile?.rentDueDay      ?? 5,
    paymentMethod:   landlordProfile?.paymentMethod   || '',
    reminderLeadDays: landlordProfile?.reminderLeadDays ?? 3,
    autoReminder:    landlordProfile?.autoReminder    !== false,
    leaseStart:      new Date().toISOString().split('T')[0],
  };

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
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Scan failed');

      setAiRawText(data.rawText || '');
      setParseError(!!data.parseError);
      setTenants(data.tenants || []);
      setStage('review');
    } catch (err) {
      showToast(isBn ? `স্ক্যান ব্যর্থ: ${err.message}` : `Scan failed: ${err.message}`, 'error');
      setStage('upload');
    }
  }, [imageBase64, mimeType, defaultSettings, isBn, showToast]);

  // ── Edit tenant field inline ─────────────────────────────────────────────────
  const handleFieldChange = useCallback((idx, key, value) => {
    setTenants(prev => prev.map((t, i) => i === idx ? { ...t, [key]: value } : t));
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
    const valid = tenants.filter(t => t.name?.trim() && Number(t.monthlyRent) > 0);
    if (valid.length === 0) {
      showToast(isBn ? 'কমপক্ষে একটি ভাড়াটিয়ার নাম ও ভাড়া দিন।' : 'At least one tenant with name & rent is required.', 'error');
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
        body: JSON.stringify({ tenants: valid }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Save failed');

      setSaveResult({ created: data.created, errors: data.errors });
      setStage('done');
      if (data.bookings?.length) onBookingsCreated?.(data.bookings);
      showToast(
        isBn
          ? `✅ ${data.created} জন ভাড়াটিয়া সেভ হয়েছে${data.errors > 0 ? `, ${data.errors}টি ব্যর্থ` : ''}!`
          : `✅ ${data.created} tenant(s) saved${data.errors > 0 ? `, ${data.errors} failed` : ''}!`,
      );
    } catch (err) {
      showToast(isBn ? `সেভ ব্যর্থ: ${err.message}` : `Save failed: ${err.message}`, 'error');
      setStage('review');
    }
  }, [tenants, isBn, showToast, onBookingsCreated]);

  const handleReset = () => {
    setStage('upload');
    setImagePreview(null);
    setImageBase64(null);
    setTenants([]);
    setParseError(false);
    setSaveResult(null);
  };

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
              {/* Tips */}
              <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-100">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Sparkles size={10}/> {isBn ? 'সেরা ফলাফলের জন্য' : 'For best results'}
                </p>
                <ul className="space-y-1 text-[10px] font-bold text-blue-600">
                  <li>• {isBn ? 'পুরো পাতা ফ্রেমের মধ্যে রাখুন' : 'Keep the full page inside the frame'}</li>
                  <li>• {isBn ? 'পর্যাপ্ত আলোতে ছবি তুলুন' : 'Take the photo in good lighting'}</li>
                  <li>• {isBn ? 'নাম, ভাড়া, নাম্বার একই পাতায় রাখুন' : 'Name, rent and phone on the same page'}</li>
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
                      <p className="text-xs font-black text-gray-900">{isBn ? 'Gemini AI বিশ্লেষণ করছে...' : 'Gemini AI analysing...'}</p>
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

              {/* Tenant rows */}
              <div className="space-y-2">
                {tenants.map((t, i) => (
                  <TenantReviewRow
                    key={i}
                    tenant={t}
                    idx={i}
                    onChange={handleFieldChange}
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
