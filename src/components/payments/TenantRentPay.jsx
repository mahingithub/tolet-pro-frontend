import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CreditCard, Copy, Check, Smartphone, Landmark, X, UploadCloud, Loader2,
  CheckCircle2, Hourglass, AlertCircle, Wallet, Calendar, Hash, StickyNote,
  Image as ImageIcon, BadgeCheck, ArrowRight, Home, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import { listPaymentMethodsForBooking } from '../../services/paymentMethodService';
import { submitRentPayment, uploadRentPaymentScreenshot } from '../../services/rentPaymentService';

const METHOD_META = {
  bkash:  { label: 'bKash',  icon: Smartphone, tint: 'bg-pink-50 text-pink-600 border-pink-100',       ring: 'ring-pink-300' },
  nagad:  { label: 'Nagad',  icon: Smartphone, tint: 'bg-orange-50 text-orange-600 border-orange-100', ring: 'ring-orange-300' },
  rocket: { label: 'Rocket', icon: Smartphone, tint: 'bg-violet-50 text-violet-600 border-violet-100', ring: 'ring-violet-300' },
  bank:   { label: 'Bank',   icon: Landmark,   tint: 'bg-blue-50 text-blue-600 border-blue-100',       ring: 'ring-blue-300' },
};

function fmtAmount(n) {
  return `৳${Number(n || 0).toLocaleString('en-IN')}`;
}
function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * TenantRentPay — a single booking's rent card for the tenant. Shows the
 * landlord's manual-payment account(s) + a "submit payment" flow.
 *
 * Props:
 *   booking     : tenant booking (id, property, monthlyRent, serviceCharge, ledger, ...)
 *   submissions : tenant's rent submissions (used to reflect pending/rejected status)
 *   onSubmitted : ()=>void — called after a successful submit so the parent refreshes
 */
export default function TenantRentPay({ booking, submissions = [], onSubmitted }) {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const [methods, setMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);
  const [qrZoom, setQrZoom] = useState('');

  const monthKey = currentMonthKey();
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(bn ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' }),
    [bn],
  );
  const totalDue = (Number(booking.monthlyRent) || 0) + (Number(booking.serviceCharge) || 0);

  useEffect(() => {
    let cancelled = false;
    setLoadingMethods(true);
    listPaymentMethodsForBooking(booking.id)
      .then((rows) => {
        if (cancelled) return;
        setMethods(rows);
        const def = rows.find((m) => m.isDefault) || rows[0];
        setSelectedId(def?.id || '');
      })
      .catch(() => { if (!cancelled) setMethods([]); })
      .finally(() => { if (!cancelled) setLoadingMethods(false); });
    return () => { cancelled = true; };
  }, [booking.id]);

  // Current-month status: ledger entry first (server marks 'submitted'/'full'),
  // then fall back to the latest submission for this booking+month.
  const entry = booking.ledger?.[monthKey] || null;
  const latestSub = useMemo(() => {
    return (submissions || [])
      .filter((s) => String(s.bookingId) === String(booking.id) && s.monthKey === monthKey)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
  }, [submissions, booking.id, monthKey]);

  const isPaid = !!entry && (entry.paid === true || entry.status === 'full' || entry.status === 'partial');
  const isPending = !isPaid && ((entry && entry.status === 'submitted') || latestSub?.status === 'pending');
  const isRejected = !isPaid && !isPending && latestSub?.status === 'rejected';

  const selected = methods.find((m) => m.id === selectedId) || methods[0] || null;

  const openModal = (auto = false) => {
    // Note: we intentionally allow submitting even when the landlord hasn't
    // added an account yet (e.g. rent was arranged/paid offline) — the tenant
    // can still record the payment for the landlord to verify.
    setAutoUpload(auto);
    setModalOpen(true);
  };

  return (
    <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Which lease this is for — property / owner name. Slim on purpose
            (the big "Monthly Rent" amount box was removed by request). */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0"><Home size={15} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-gray-900 truncate leading-tight">
              {booking.property || selected?.accountHolderName || (bn ? 'আপনার বাসা' : 'Your rental')}
            </p>
            <p className="text-[10px] font-bold text-gray-400 truncate leading-tight flex items-center gap-1">
              {booking.location
                ? (<><MapPin size={9} className="shrink-0" /> {booking.location}</>)
                : (bn ? 'ভাড়া পরিশোধ করুন' : 'Pay your rent')}
            </p>
          </div>
          {isPaid && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase tracking-widest shrink-0"><CheckCircle2 size={10} /> {bn ? 'পরিশোধিত' : 'Paid'}</span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black uppercase tracking-widest shrink-0"><Hourglass size={10} /> {bn ? 'যাচাই চলছে' : 'Pending'}</span>
          )}
        </div>

        {isRejected && latestSub?.rejectionReason && (
          <p className="mb-4 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {bn ? 'বাতিলের কারণ: ' : 'Rejected: '}{latestSub.rejectionReason}
          </p>
        )}

        {loadingMethods ? (
          <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : (
          <>
            {/* Landlord's payment account(s). If the landlord hasn't set one
                we hide the whole block (no warning) but still show the Pay
                buttons below so the tenant can record an offline payment. */}
            {methods.length > 0 && (
              <>
                {/* MOBILE — chip selector + the single selected account card */}
                <div className="md:hidden">
                  {methods.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {methods.map((m) => {
                        const meta = METHOD_META[m.type] || METHOD_META.bank;
                        const Icon = meta.icon;
                        const active = m.id === selected?.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${active ? `${meta.tint} ring-2 ${meta.ring} border-transparent` : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                          >
                            <Icon size={13} /> {meta.label}
                            {m.isDefault && <BadgeCheck size={12} className="text-amber-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selected && <AccountDetails method={selected} bn={bn} language={language} onZoomQr={setQrZoom} />}
                </div>

                {/* DESKTOP — every method shown side-by-side, each with its own
                    chip label + account card */}
                <div className={`hidden md:grid gap-4 ${methods.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                  {methods.map((m) => {
                    const meta = METHOD_META[m.type] || METHOD_META.bank;
                    const Icon = meta.icon;
                    return (
                      <div key={m.id} className="space-y-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black ${meta.tint}`}>
                          <Icon size={13} /> {meta.label}
                          {m.isDefault && <BadgeCheck size={12} className="text-amber-500" />}
                        </span>
                        <AccountDetails method={m} bn={bn} language={language} onZoomQr={setQrZoom} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Pay actions — available with or without a preset method (unless
                the month is already paid). */}
            {!isPaid ? (
              <div className={`grid grid-cols-2 gap-2 ${methods.length > 0 ? 'mt-4' : ''}`}>
                <button
                  onClick={() => openModal(false)}
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-[0_6px_12px_rgba(16,185,129,0.2)] active:scale-95 transition-all"
                >
                  <CheckCircle2 size={16} /> {bn ? 'আমি পরিশোধ করেছি' : 'I Have Paid'}
                </button>
                <button
                  onClick={() => openModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
                >
                  <UploadCloud size={16} /> {bn ? 'প্রুফ আপলোড' : 'Upload Proof'}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <CheckCircle2 size={18} />
                <span className="text-sm font-black">{bn ? 'এই মাসের ভাড়া পরিশোধিত — রিসিট তৈরি হয়েছে।' : "This month's rent is paid — a receipt has been generated."}</span>
              </div>
            )}

            {isPending && (
              <p className="mt-3 text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
                <Hourglass size={13} /> {bn ? 'আপনার পেমেন্ট মালিকের যাচাইয়ের অপেক্ষায় আছে।' : 'Your payment is awaiting your landlord\'s verification.'}
              </p>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <SubmitPaymentModal
          booking={booking}
          methods={methods}
          selectedMethod={selected}
          totalDue={totalDue}
          monthKey={monthKey}
          monthLabel={monthLabel}
          autoUpload={autoUpload}
          language={language}
          onClose={() => setModalOpen(false)}
          onDone={() => { setModalOpen(false); onSubmitted?.(); }}
        />
      )}

      {qrZoom && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setQrZoom('')}>
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" />
          <div className="relative z-10">
            <button onClick={() => setQrZoom('')} className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><X size={20} /></button>
            <img src={qrZoom} alt="QR" className="max-w-[80vw] max-h-[80vh] object-contain rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ isPaid, isPending, isRejected, bn }) {
  if (isPaid) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-widest shrink-0"><CheckCircle2 size={11} /> {bn ? 'পরিশোধিত' : 'Paid'}</span>;
  if (isPending) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-widest shrink-0"><Hourglass size={11} /> {bn ? 'যাচাই চলছে' : 'Pending'}</span>;
  if (isRejected) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-100 text-[10px] font-black uppercase tracking-widest shrink-0"><AlertCircle size={11} /> {bn ? 'বাতিল' : 'Rejected'}</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest shrink-0"><Wallet size={11} /> {bn ? 'বকেয়া' : 'Due'}</span>;
}

function CopyRow({ label, value, language, big }) {
  const bn = language === 'বাংলা';
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`font-black text-gray-900 truncate ${big ? 'text-lg tabular-nums tracking-tight' : 'text-sm'}`}>{value || '—'}</p>
      </div>
      {value && (
        <button
          onClick={() => { navigator.clipboard?.writeText(String(value)); setCopied(true); toast.success(bn ? 'কপি হয়েছে' : 'Copied'); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
        >
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
        </button>
      )}
    </div>
  );
}

function AccountDetails({ method, bn, language, onZoomQr }) {
  const meta = METHOD_META[method.type] || METHOD_META.bank;
  const Icon = meta.icon;
  return (
    <div className={`rounded-2xl border p-4 ${meta.tint}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0"><Icon size={18} /></div>
        <div>
          <p className="text-sm font-black">{meta.label}{method.type === 'bank' && method.bankName ? ` • ${method.bankName}` : ''}</p>
          {method.type === 'bank' && method.branchName && <p className="text-[10px] font-bold opacity-70">{method.branchName}</p>}
        </div>
      </div>
      <div className="bg-white/70 rounded-xl px-3 mt-2 divide-y divide-gray-100">
        <CopyRow label={bn ? 'অ্যাকাউন্ট নাম' : 'Account Name'} value={method.accountHolderName} language={language} />
        <CopyRow label={method.type === 'bank' ? (bn ? 'অ্যাকাউন্ট নম্বর' : 'Account Number') : (bn ? 'মোবাইল নম্বর' : 'Mobile Number')} value={method.accountNumber} language={language} big />
      </div>
      {method.qrImageUrl && (
        <button onClick={() => onZoomQr(method.qrImageUrl)} className="mt-3 flex items-center gap-3 w-full bg-white/70 rounded-xl p-2 text-left hover:bg-white transition-colors">
          <img src={method.qrImageUrl} alt="QR" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          <div>
            <p className="text-xs font-black text-gray-900 flex items-center gap-1"><ImageIcon size={13} /> {bn ? 'QR কোড স্ক্যান করুন' : 'Scan QR Code'}</p>
            <p className="text-[10px] font-bold text-gray-500">{bn ? 'বড় করে দেখতে ট্যাপ করুন' : 'Tap to enlarge'}</p>
          </div>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit payment modal
// ─────────────────────────────────────────────────────────────────────────────
function SubmitPaymentModal({ booking, methods, selectedMethod, totalDue, monthKey, monthLabel, autoUpload, language, onClose, onDone }) {
  const bn = language === 'বাংলা';
  const fileRef = useRef(null);

  const [methodId, setMethodId] = useState(selectedMethod?.id || methods[0]?.id || '');
  const [amount, setAmount] = useState(totalDue ? String(totalDue) : '');
  const [txnId, setTxnId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (autoUpload) setTimeout(() => fileRef.current?.click(), 250);
  }, [autoUpload]);

  const chosenMethod = methods.find((m) => m.id === methodId) || selectedMethod || null;

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast.error(bn ? 'ছবি নির্বাচন করুন' : 'Please pick an image'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr(bn ? 'সঠিক পরিমাণ দিন।' : 'Enter a valid amount.'); return; }
    setSaving(true);
    setErr('');
    try {
      const submission = await submitRentPayment({
        bookingId: booking.id,
        monthKey,
        monthLabel,
        amount: amt,
        txnId: txnId.trim(),
        paymentDate,
        paymentMethodType: chosenMethod?.type || '',
        paymentMethodLabel: chosenMethod ? (METHOD_META[chosenMethod.type]?.label || chosenMethod.type) : '',
        notes: notes.trim(),
      });
      if (file && submission?.id) {
        await uploadRentPaymentScreenshot(submission.id, file).catch(() => {
          toast.error(bn ? 'স্ক্রিনশট আপলোড হয়নি, কিন্তু পেমেন্ট সাবমিট হয়েছে।' : 'Screenshot upload failed, but the payment was submitted.');
        });
      }
      toast.success(bn ? 'পেমেন্ট সাবমিট হয়েছে — যাচাইয়ের অপেক্ষায়।' : 'Payment submitted — pending verification.');
      onDone();
    } catch (error) {
      setErr(error.message || (bn ? 'সাবমিট করা যায়নি।' : 'Could not submit.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <CreditCard className="text-emerald-600" size={22} />
            {bn ? 'পেমেন্ট সাবমিট করুন' : 'Submit Payment'}
          </h2>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{monthLabel}</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">{booking.property || (bn ? 'আপনার বাসা' : 'Your rental')}</p>
          </div>

          {methods.length > 1 && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'কোন অ্যাকাউন্টে পাঠিয়েছেন?' : 'Which account did you pay?'}</label>
              <div className="flex flex-wrap gap-2">
                {methods.map((m) => {
                  const meta = METHOD_META[m.type] || METHOD_META.bank;
                  const active = m.id === methodId;
                  return (
                    <button key={m.id} type="button" onClick={() => setMethodId(m.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black transition-all ${active ? `${meta.tint} ring-2 ${meta.ring} border-transparent` : 'bg-gray-50 border-transparent text-gray-500'}`}>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-emerald-500/30 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Calendar size={11} /> {bn ? 'পেমেন্ট তারিখ' : 'Payment Date'}</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-emerald-500/30 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={11} /> {bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}</label>
            <input type="text" value={txnId} onChange={(e) => setTxnId(e.target.value)}
              placeholder={bn ? 'যেমন: 8N7A6B5C4D' : 'e.g. 8N7A6B5C4D'}
              className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-emerald-500/30 transition-all" />
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'স্ক্রিনশট (ঐচ্ছিক)' : 'Screenshot (optional)'}</label>
            <div className="flex items-center gap-3">
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="proof" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  <button type="button" onClick={() => { setFile(null); setPreview(''); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow"><X size={12} /></button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-gray-300"><ImageIcon size={22} /></div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-[11px] font-black uppercase tracking-widest cursor-pointer transition-colors">
                <UploadCloud size={15} /> {bn ? 'আপলোড' : 'Upload'}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><StickyNote size={11} /> {bn ? 'নোট (ঐচ্ছিক)' : 'Notes (optional)'}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-emerald-500/30 transition-all resize-none" />
          </div>

          {err && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-sm shadow-[0_8px_15px_rgba(16,185,129,0.2)] active:scale-95 transition-all">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {saving ? (bn ? 'সাবমিট হচ্ছে...' : 'Submitting...') : (bn ? 'যাচাইয়ের জন্য পাঠান' : 'Submit for Verification')}
          </button>
        </form>
      </div>
    </div>
  );
}
