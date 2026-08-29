import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CreditCard, Copy, Check, Smartphone, Landmark, X, UploadCloud, Loader2,
  CheckCircle2, Hourglass, AlertCircle, Wallet, Calendar, Hash, StickyNote,
  Image as ImageIcon, BadgeCheck, ArrowRight, Home, MapPin, DoorOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import { listPaymentMethodsForBooking } from '../../services/paymentMethodService';
import { submitRentPayment, uploadRentPaymentScreenshot } from '../../services/rentPaymentService';
import {
  PAYMENT_METHOD_META, sortPaymentMethods, unitParts, formatUnitLabel, currentMonthKey,
} from '../../utils/tenantRent';

// Rail presentation comes from utils/tenantRent (ONE definition app-wide); the
// icon component is bound here because that module stays React-free.
const METHOD_ICONS = { smartphone: Smartphone, landmark: Landmark };
const metaFor = (type) => {
  const m = PAYMENT_METHOD_META[String(type || '').toLowerCase()] || PAYMENT_METHOD_META.bank;
  return { ...m, icon: METHOD_ICONS[m.icon] || Landmark };
};

function fmtAmount(n) {
  return `৳${Number(n || 0).toLocaleString('en-IN')}`;
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
  // The booking handed in here is already normalized to THIS tenant's row
  // (normalizeTenantBooking), so monthlyRent/serviceCharge are their own —
  // not the whole unit's. That distinction is the ৳6,000-vs-৳45,600 bug.
  const totalDue = (Number(booking.monthlyRent) || 0) + (Number(booking.serviceCharge) || 0);
  const where = useMemo(() => unitParts(booking, language), [booking, language]);

  // The landlord's accounts for THIS booking. Sorted centrally (default first,
  // then the canonical bKash → Nagad → Rocket → Bank order) so the tabs don't
  // reshuffle between this card and the submit modal.
  //
  // `methodsError` matters: a failure here used to be swallowed into an empty
  // list, which renders identically to "my landlord hasn't added an account".
  // For anyone who joined by invite code that was permanently wrong — the
  // endpoint was rejecting members outright (fixed in paymentMethod.controller)
  // — and the tenant had no way to know they were being shown a lie.
  const [methodsError, setMethodsError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoadingMethods(true);
    setMethodsError(false);
    listPaymentMethodsForBooking(booking.id)
      .then((rows) => {
        if (cancelled) return;
        const sorted = sortPaymentMethods(rows);
        setMethods(sorted);
        const def = sorted.find((m) => m.isDefault) || sorted[0];
        setSelectedId(def?.id || '');
      })
      .catch(() => { if (!cancelled) { setMethods([]); setMethodsError(true); } })
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
        {/* WHICH TENANCY THIS CARD IS FOR.
            With two rooms in one building, two of these cards appear on the
            same screen and used to differ only in the amounts inside them.
            The floor / room / seat chips are what tell them apart, and the
            month's total is spelled out (rent + service) so the number the
            tenant is asked to send is never unexplained. */}
        <div className="flex items-start gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0"><Home size={15} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-gray-900 truncate leading-tight">
              {booking.property || selected?.accountHolderName || (bn ? 'আপনার বাসা' : 'Your rental')}
            </p>
            {where.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {where.map((part) => (
                  <span key={part} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[9px] font-black text-gray-600 uppercase tracking-wider">
                    <DoorOpen size={9} className="text-gray-400" /> {part}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] font-bold text-gray-400 truncate leading-tight flex items-center gap-1 mt-1">
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

        {/* This month's obligation, itemised. */}
        {!isPaid && totalDue > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{monthLabel}</p>
              <p className="text-[10px] font-bold text-gray-500 leading-tight mt-0.5 tabular-nums">
                {Number(booking.serviceCharge) > 0
                  ? `${fmtAmount(booking.monthlyRent)} + ${fmtAmount(booking.serviceCharge)} ${bn ? 'সার্ভিস' : 'service'}`
                  : (bn ? 'মাসিক ভাড়া' : 'Monthly rent')}
              </p>
            </div>
            <p className="text-lg font-black text-gray-900 tabular-nums shrink-0">{fmtAmount(totalDue)}</p>
          </div>
        )}

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
                {/* Unified Tab selector for all screens */}
                <div className="flex flex-col gap-2.5">
                  {methods.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {methods.map((m) => {
                        const meta = metaFor(m.type);
                        const Icon = meta.icon;
                        const active = m.id === selected?.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className={`relative inline-flex items-center gap-1.5 px-3 md:px-3.5 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${
                              active 
                                ? `${meta.tint} ring-2 ${meta.ring} border-transparent shadow-sm` 
                                : 'bg-gray-50 dark:bg-gray-800/50 border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <Icon size={14} className={active ? '' : 'opacity-70'} /> 
                            {meta.label}
                            {m.isDefault && <BadgeCheck size={12} className={active ? 'text-amber-500' : 'text-gray-400'} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Single selected card with fade/slide animation */}
                  {selected && (
                    <div key={selected.id} className="animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
                      <AccountDetails method={selected} bn={bn} language={language} onZoomQr={setQrZoom} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* We couldn't LOAD the accounts — say so, instead of silently
                rendering the same thing as "the landlord has none". The tenant
                can still record an offline payment below. */}
            {methods.length === 0 && methodsError && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-700 leading-snug">
                  {bn
                    ? 'বাড়িওয়ালার পেমেন্ট অ্যাকাউন্ট লোড করা যায়নি। আপনি এখনো পেমেন্ট রেকর্ড করতে পারবেন।'
                    : "Couldn't load your landlord's payment accounts. You can still record a payment below."}
                </p>
              </div>
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
  const meta = metaFor(method.type);
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl md:rounded-2xl border p-3 md:p-3.5 ${meta.tint}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm"><Icon size={16} /></div>
        <div className="min-w-0">
          <p className="text-sm md:text-base font-black leading-none">{meta.label}{method.type === 'bank' && method.bankName ? ` • ${method.bankName}` : ''}</p>
          {method.type === 'bank' && method.branchName && <p className="text-[10px] font-bold opacity-70 mt-0.5 truncate">{method.branchName}</p>}
        </div>
      </div>
      <div className="bg-white/80 rounded-xl px-3 mt-3 divide-y divide-black/5 shadow-sm">
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
        paymentMethodLabel: chosenMethod ? (metaFor(chosenMethod.type).label || chosenMethod.type) : '',
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
          {/* Name the exact unit on the submit form too — the landlord will
              see this claim next to eleven others from the same building. */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{monthLabel}</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">{formatUnitLabel(booking, language)}</p>
            {totalDue > 0 && (
              <p className="text-[11px] font-black text-gray-500 mt-1 tabular-nums">
                {bn ? 'এই মাসের মোট' : "This month's total"}: {fmtAmount(totalDue)}
              </p>
            )}
          </div>

          {methods.length > 1 && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'কোন অ্যাকাউন্টে পাঠিয়েছেন?' : 'Which account did you pay?'}</label>
              <div className="flex flex-wrap gap-2">
                {methods.map((m) => {
                  const meta = metaFor(m.type);
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
