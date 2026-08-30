/*
 * AgreementBrandModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * THE LANDLORD'S OWN LETTERHEAD, chosen just before the PDF is made.
 *
 * WHY THIS EXISTS
 * A hostel operator hands these agreements and receipts to real people. Handing
 * over a page headed with someone else's product name is not a document from
 * their business — it reads like a printout from an app. They asked for their
 * own name, number and logo on it, and that is a fair thing to want from a tool
 * they pay for.
 *
 * WHAT IT DOES NOT DO
 * It does not redesign the agreement. Everything below the header is exactly
 * what it was; this only decides whose name is at the top. TO-LET PRO keeps a
 * small mark in the corner and a link at the foot — visible, but not the
 * headline.
 *
 * The details are saved to the landlord profile, so this is a one-time setup
 * that then rides on every document. The modal still opens each time because
 * the ask was explicitly for the choice to sit at download time — and a
 * landlord with two buildings may want a different name on each.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Download, Trash2, Building2, ImageIcon, Loader2 } from 'lucide-react';
import ModalPortal from '../shared/ModalPortal.jsx';

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

export default function AgreementBrandModal({
  booking,
  member,            // set when the agreement is for ONE seat of a shared room
  people,            // the booking's occupants, for the picker when member is unset
  brand,             // { orgName, logoUrl, phone }
  language,
  onClose,
  onDownload,        // (brand) => void — persists + generates
  uploadLogo,        // async (file) => secureUrl
  showToast,
}) {
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);

  const [orgName, setOrgName] = useState(brand?.orgName || '');
  const [phone, setPhone] = useState(brand?.phone || '');
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // WHOSE FORM. A room with one occupant has nothing to ask, so it is chosen
  // already; a shared room must be asked, because a form that silently picks
  // the first person is how the second one never gets their paperwork.
  const occupants = (people || []).filter(p => p && p.status !== 'moved-out');
  const needsPick = !member && occupants.length > 1;
  const [picked, setPicked] = useState(member || (occupants.length === 1 ? occupants[0] : null));
  const [format, setFormat] = useState('pdf');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !uploading) onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, uploading]);

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';               // same file twice must still fire
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast?.(L('ছবি ফাইল দিন (PNG / JPG)', 'Pick an image file (PNG / JPG)'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast?.(L('লোগো ৩ MB এর কম হতে হবে', 'Logo must be under 3 MB'));
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
    } catch (err) {
      console.warn('[brand] logo upload failed:', err?.message || err);
      showToast?.(L('লোগো আপলোড ব্যর্থ — ইন্টারনেট দেখুন', 'Logo upload failed — check your connection'));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (uploading) return;
    if (needsPick && !picked) {
      showToast?.(L('কার ফরম ডাউনলোড করবেন সেটা বেছে নিন', 'Choose whose form to download'));
      return;
    }
    onDownload?.(
      { orgName: orgName.trim(), phone: phone.trim(), logoUrl },
      { member: picked || null, format },
    );
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#ba0036]/40 focus:bg-white transition-colors';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200" onClick={uploading ? undefined : onClose} />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={L('ডকুমেন্ট ব্র্যান্ডিং', 'Document branding')}
          className="relative bg-white w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.28)] max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        >
          <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-gray-900">{L('ডাউনলোডের আগে', 'Before you download')}</h3>
              {/* Say WHOSE agreement this is. On a shared room the landlord is
                  producing one paper per person, and the only thing that tells
                  the two downloads apart is the name. */}
              <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">
                {member
                  ? `${member.name || L('ভাড়াটিয়া', 'Tenant')}${member.seatLabel ? ` · ${member.seatLabel}` : ''}${booking?.roomNumber ? ` · ${L('রুম', 'Room')} ${booking.roomNumber}` : ''}`
                  : L('আপনার প্রতিষ্ঠানের নাম ও লোগো ডকুমেন্টে বসবে', 'Your business name and logo go on the document')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              aria-label={L('বন্ধ করুন', 'Close')}
              className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">

            {/* WHO — a card each, because two people in one room have two
                separate records and the landlord has to say which one. */}
            {needsPick && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  {L('কার তথ্য ডাউনলোড করবেন?', 'Whose record?')}
                </label>
                <div className="space-y-1.5">
                  {occupants.map((p, i) => {
                    const on = picked && (picked.id ? picked.id === p.id : picked === p);
                    return (
                      <button
                        key={p.id || i}
                        type="button"
                        onClick={() => setPicked(p)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          on ? 'bg-[#ba0036]/5 border-[#ba0036]/40 shadow-[0_2px_10px_rgba(186,0,54,0.08)]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-[#ba0036]' : 'border-gray-300'}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-[#ba0036]" />}
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-[11px] font-black shrink-0 overflow-hidden">
                          {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : (String(p.name || '?').trim().charAt(0) || '?').toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-black text-gray-900 truncate">{p.name || L('নামহীন', 'Unnamed')}</span>
                          <span className="block text-[9px] font-bold text-gray-500 truncate">
                            {[p.seatLabel, p.phone].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FORMAT — the same record, printed or as a spreadsheet. */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                {L('ফরম্যাট', 'Format')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'pdf', label: 'PDF', hint: L('ছাপার উপযোগী ফরম', 'Printable form') },
                  { id: 'excel', label: 'Excel', hint: L('স্প্রেডশিট (CSV)', 'Spreadsheet (CSV)') },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                      format === f.id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-[12px] font-black">{f.label}</span>
                    <span className={`block text-[9px] font-bold mt-0.5 ${format === f.id ? 'text-white/70' : 'text-gray-400'}`}>{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                {L('লোগো', 'Logo')}
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {uploading
                    ? <Loader2 size={20} className="text-gray-400 animate-spin" />
                    : logoUrl
                      ? <img src={logoUrl} alt={L('লোগো', 'Logo')} className="w-full h-full object-contain" />
                      : <ImageIcon size={20} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-2 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <Upload size={12} /> {logoUrl ? L('বদলান', 'Change') : L('লোগো দিন', 'Add logo')}
                  </button>
                  {logoUrl && !uploading && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-colors inline-flex items-center gap-1.5 active:scale-95"
                    >
                      <Trash2 size={12} /> {L('সরান', 'Remove')}
                    </button>
                  )}
                  <p className="w-full text-[9px] font-bold text-gray-400">PNG / JPG · {L('সর্বোচ্চ ৩ MB', 'max 3 MB')}</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickLogo} className="hidden" />
            </div>

            {/* Name + phone */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                {L('প্রতিষ্ঠানের নাম', 'Business name')}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                maxLength={80}
                placeholder={booking?.property || L('যেমন: হোয়াইট হাউস হোস্টেল', 'e.g. White House Hostel')}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                {L('যোগাযোগ নম্বর', 'Contact number')}
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                placeholder="01XXXXXXXXX"
                className={inputCls}
              />
            </div>

            {/* What the landlord is actually agreeing to — said plainly rather
                than discovered after printing fifty copies. */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex gap-2.5">
              <Building2 size={15} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                {L(
                  'এই তথ্য সেভ থাকবে — পরের বার আর লিখতে হবে না। ডকুমেন্টের বাকি অংশ অপরিবর্তিত। TO-LET PRO-এর নাম কোণায় ছোট করে ও নিচে একটি লিংক + QR থাকবে।',
                  "These are saved for next time. The rest of the document is unchanged. TO-LET PRO keeps a small mark in the corner and a link + QR at the foot.",
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {L('বাতিল', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={uploading}
              className="flex-[2] py-3 rounded-xl bg-[#ba0036] hover:bg-[#90002a] text-white text-[10px] font-black uppercase tracking-widest transition-colors active:scale-[0.98] shadow-[0_6px_18px_rgba(186,0,54,0.25)] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Download size={13} strokeWidth={3} />
              {uploading ? L('অপেক্ষা করুন…', 'Please wait…') : L('ডাউনলোড করুন', 'Download')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
