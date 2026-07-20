import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History, Loader2, RefreshCw, CheckCircle2, XCircle, User, Building2,
  Hash, Copy, Image as ImageIcon, X, CalendarClock, Receipt, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import { listHostRentPayments, deleteRentPayment } from '../../services/rentPaymentService';
import { METHOD_META } from './PaymentSettings';

function fmtAmount(n) {
  return `৳${Number(n || 0).toLocaleString('en-IN')}`;
}

// Highlighted date + time — used everywhere we want the moment to stand out.
function fmtDateTime(value, bn) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: '', time: '' };
  const locale = bn ? 'bn-BD' : 'en-GB';
  return {
    date: d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * DateTimeBadge — a small highlighted pill that makes the date + time of a
 * payment pop. Reused across the payment surfaces so every record clearly
 * shows WHEN it happened.
 */
export function DateTimeBadge({ value, label, bn, tone = 'indigo' }) {
  const { date, time } = fmtDateTime(value, bn);
  if (!date) return null;
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black tabular-nums ${tones[tone] || tones.indigo}`}>
      <CalendarClock size={12} className="shrink-0" />
      {label && <span className="opacity-70 uppercase tracking-widest">{label}</span>}
      <span>{date}</span>
      <span className="opacity-40">•</span>
      <span>{time}</span>
    </span>
  );
}

/**
 * RentPaymentHistory — the landlord's record of already-reviewed tenant rent
 * payments (approved + rejected). Read-only companion to PendingRentPayments.
 * Every row highlights the date + time it was submitted and reviewed.
 */
export default function RentPaymentHistory() {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | approved | rejected
  const [lightbox, setLightbox] = useState('');
  const [confirming, setConfirming] = useState(null); // submission pending delete
  const [busyId, setBusyId] = useState(null);

  const handleDelete = async () => {
    const s = confirming;
    if (!s) return;
    setBusyId(s.id);
    try {
      await deleteRentPayment(s.id);
      setRows((prev) => prev.filter((x) => x.id !== s.id));
      setConfirming(null);
      toast.success(bn ? 'রেকর্ড মুছে ফেলা হয়েছে' : 'Record deleted');
    } catch (err) {
      toast.error(err.message || (bn ? 'মুছে ফেলা যায়নি' : 'Could not delete'));
    } finally {
      setBusyId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await listHostRentPayments();
      // History = everything the landlord has already acted on.
      setRows(all.filter((s) => s.status === 'approved' || s.status === 'rejected'));
    } catch (err) {
      setError(err.message || (bn ? 'লোড করা যায়নি।' : 'Could not load payment history.'));
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((s) => s.status === filter)),
    [rows, filter],
  );

  const approvedTotal = useMemo(
    () => rows.filter((s) => s.status === 'approved').reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [rows],
  );

  const FILTERS = [
    { id: 'all', en: 'All', bn: 'সব' },
    { id: 'approved', en: 'Approved', bn: 'অনুমোদিত' },
    { id: 'rejected', en: 'Rejected', bn: 'বাতিল' },
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <History size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">
              {bn ? 'পেমেন্ট হিস্ট্রি' : 'Payment History'}
            </h3>
            <p className="text-[11px] md:text-xs font-bold text-gray-500 mt-0.5">
              {bn ? 'যাচাই করা ভাড়া পেমেন্টের রেকর্ড।' : 'A record of rent payments you have reviewed.'}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors shrink-0"
          title={bn ? 'রিফ্রেশ' : 'Refresh'}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter chips + received total */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count = f.id === 'all' ? rows.length : rows.filter((s) => s.status === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${active ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'}`}
                >
                  {bn ? f.bn : f.en}
                  <span className={`tabular-nums ${active ? 'opacity-80' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-black">
            <Receipt size={13} />
            {bn ? 'মোট গ্রহণ' : 'Received'}: <span className="tabular-nums">{fmtAmount(approvedTotal)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <History size={24} />
          </div>
          <h4 className="text-sm font-black text-gray-900">{bn ? 'এখনো কোনো হিস্ট্রি নেই' : 'No history yet'}</h4>
          <p className="text-xs font-bold text-gray-500 mt-1">
            {bn ? 'আপনি পেমেন্ট অনুমোদন বা বাতিল করলে এখানে দেখা যাবে।' : 'Payments you approve or reject will appear here.'}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((s) => {
            const meta = METHOD_META[s.paymentMethodType] || null;
            const approved = s.status === 'approved';
            return (
              <div
                key={s.id}
                className={`bg-white rounded-[1.25rem] border shadow-sm overflow-hidden ${approved ? 'border-emerald-100' : 'border-rose-100'}`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl text-white font-black flex items-center justify-center shrink-0 ${approved ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
                      {(s.tenantName || 'T').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-gray-900 truncate flex items-center gap-1.5">
                          <User size={13} className="text-gray-400 shrink-0" /> {s.tenantName || (bn ? 'ভাড়াটিয়া' : 'Tenant')}
                        </h4>
                        <span className={`text-base font-black tabular-nums shrink-0 ${approved ? 'text-emerald-600' : 'text-rose-500 line-through'}`}>{fmtAmount(s.amount)}</span>
                      </div>
                      {s.propertyTitle && (
                        <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate flex items-center gap-1.5">
                          <Building2 size={12} className="text-gray-400 shrink-0" /> {s.propertyTitle}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${approved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                          {approved ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {approved ? (bn ? 'অনুমোদিত' : 'Approved') : (bn ? 'বাতিল' : 'Rejected')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-black text-gray-600">
                          {s.monthLabel || s.monthKey}
                        </span>
                        {meta && (
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${meta.tint}`}>
                            {s.paymentMethodLabel || meta.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Highlighted date + time row */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <DateTimeBadge value={s.createdAt} label={bn ? 'সাবমিট' : 'Submitted'} bn={bn} tone="slate" />
                    {s.reviewedAt && (
                      <DateTimeBadge value={s.reviewedAt} label={bn ? 'রিভিউ' : 'Reviewed'} bn={bn} tone={approved ? 'emerald' : 'rose'} />
                    )}
                  </div>

                  {/* Txn id + rejection reason */}
                  {s.txnId && (
                    <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                      <Hash size={12} className="text-gray-400 shrink-0" />
                      <p className="text-xs font-black text-gray-900 truncate">{s.txnId}</p>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(s.txnId); toast.success(bn ? 'কপি হয়েছে' : 'Copied'); }}
                        className="text-gray-400 hover:text-gray-700 shrink-0 ml-auto"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {!approved && s.rejectionReason && (
                    <p className="mt-2 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                      {bn ? 'কারণ: ' : 'Reason: '}{s.rejectionReason}
                    </p>
                  )}

                  {/* Screenshot */}
                  {s.screenshotUrl && (
                    <button
                      onClick={() => setLightbox(s.screenshotUrl)}
                      className="mt-3 flex items-center gap-2 text-[11px] font-black text-blue-600 hover:underline"
                    >
                      <img src={s.screenshotUrl} alt="proof" className="w-11 h-11 rounded-lg object-cover border border-gray-200" />
                      {bn ? 'স্ক্রিনশট দেখুন' : 'View screenshot'}
                    </button>
                  )}

                  {/* Footer — delete this record (asks for confirmation first) */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => setConfirming(s)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all"
                    >
                      <Trash2 size={14} /> {bn ? 'মুছুন' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && rows.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs font-bold text-gray-400">
          {bn ? 'এই ফিল্টারে কিছু নেই।' : 'Nothing under this filter.'}
        </div>
      )}

      {/* Screenshot lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setLightbox('')}>
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" />
          <div className="relative z-10 max-w-lg w-full">
            <button
              onClick={() => setLightbox('')}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <X size={20} />
            </button>
            <img src={lightbox} alt="payment proof" className="w-full max-h-[80vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Delete confirmation — bottom-sheet on mobile, centered on desktop */}
      {confirming && (
        <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => (busyId ? null : setConfirming(null))} />
          <div className="bg-white rounded-[1.75rem] w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-gray-900">{bn ? 'রেকর্ড মুছে ফেলবেন?' : 'Delete this record?'}</h3>
              <p className="text-sm font-bold text-gray-500 mt-1.5 leading-relaxed">
                {bn
                  ? 'এটি শুধু আপনার হিস্ট্রি থেকে সরানো হবে — ভাড়াটিয়ার তৈরি রিসিট মুছবে না।'
                  : "This only removes it from your history — the tenant's receipt is not deleted."}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={!!busyId}
                  className="flex-1 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-black text-sm transition-colors disabled:opacity-50"
                >
                  {bn ? 'ফিরে যান' : 'Cancel'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!!busyId}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-black text-sm active:scale-95 transition-all"
                >
                  {busyId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {bn ? 'মুছুন' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
