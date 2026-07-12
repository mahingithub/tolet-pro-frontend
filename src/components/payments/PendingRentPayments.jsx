import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, Copy, Check, RefreshCw, Loader2, Image as ImageIcon,
  Hourglass, X, Receipt, User, Building2, Calendar, Hash, StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import {
  listHostRentPayments, approveRentPayment, rejectRentPayment,
} from '../../services/rentPaymentService';
import { METHOD_META } from './PaymentSettings';

function fmtAmount(n) {
  return `৳${Number(n || 0).toLocaleString('en-IN')}`;
}

/**
 * PendingRentPayments — landlord reviews tenant "I have paid" claims.
 * Approve → writes the rent ledger + generates a receipt (server-side).
 * Reject  → notifies the tenant with a reason.
 *
 * Props:
 *   onChange : ()=>void  — called after approve/reject so the parent can
 *                          refresh badges / rent ledger.
 */
export default function PendingRentPayments({ onChange }) {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // submission being rejected
  const [lightbox, setLightbox] = useState('');     // screenshot url open in lightbox

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listHostRentPayments('pending');
      setItems(rows);
    } catch (err) {
      setError(err.message || (bn ? 'লোড করা যায়নি।' : 'Could not load pending payments.'));
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (s) => {
    setBusyId(s.id);
    try {
      await approveRentPayment(s.id);
      toast.success(bn ? 'পেমেন্ট অনুমোদিত ও রিসিট তৈরি হয়েছে' : 'Payment approved — receipt generated');
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      onChange?.();
    } catch (err) {
      toast.error(err.message || (bn ? 'অনুমোদন ব্যর্থ' : 'Approval failed'));
    } finally { setBusyId(null); }
  };

  const handleReject = async (reason) => {
    const s = rejecting;
    if (!s) return;
    setBusyId(s.id);
    try {
      await rejectRentPayment(s.id, reason);
      toast.success(bn ? 'পেমেন্ট বাতিল করা হয়েছে' : 'Payment rejected');
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      setRejecting(null);
      onChange?.();
    } catch (err) {
      toast.error(err.message || (bn ? 'বাতিল করা যায়নি' : 'Could not reject'));
    } finally { setBusyId(null); }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 relative">
            <Hourglass size={20} className="text-amber-600" />
            {items.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#ba0036] text-white text-[10px] font-black flex items-center justify-center">
                {items.length}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">
              {bn ? 'পেন্ডিং ভাড়া পেমেন্ট' : 'Pending Rent Payments'}
            </h3>
            <p className="text-[11px] md:text-xs font-bold text-gray-500 mt-0.5">
              {bn ? 'ভাড়াটিয়ার পেমেন্ট যাচাই করে অনুমোদন বা বাতিল করুন।' : 'Verify tenant payments, then approve or reject.'}
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

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-sm font-black text-gray-900">{bn ? 'সব পরিষ্কার!' : 'All caught up!'}</h4>
          <p className="text-xs font-bold text-gray-500 mt-1">
            {bn ? 'যাচাইয়ের অপেক্ষায় কোনো পেমেন্ট নেই।' : 'No payments waiting for verification.'}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((s) => {
            const meta = METHOD_META[s.paymentMethodType] || null;
            const busy = busyId === s.id;
            return (
              <div key={s.id} className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Tenant + property */}
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#ff004c] text-white font-black flex items-center justify-center shrink-0">
                      {(s.tenantName || 'T').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-gray-900 truncate flex items-center gap-1.5">
                          <User size={13} className="text-gray-400 shrink-0" /> {s.tenantName || (bn ? 'ভাড়াটিয়া' : 'Tenant')}
                        </h4>
                        <span className="text-base font-black text-emerald-600 tabular-nums shrink-0">{fmtAmount(s.amount)}</span>
                      </div>
                      {s.propertyTitle && (
                        <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate flex items-center gap-1.5">
                          <Building2 size={12} className="text-gray-400 shrink-0" /> {s.propertyTitle}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Hash size={10} /> {bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-gray-900 truncate">{s.txnId || '—'}</p>
                        {s.txnId && (
                          <button
                            onClick={() => { navigator.clipboard?.writeText(s.txnId); toast.success(bn ? 'কপি হয়েছে' : 'Copied'); }}
                            className="text-gray-400 hover:text-gray-700 shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={10} /> {bn ? 'পেমেন্ট তারিখ' : 'Payment Date'}</p>
                      <p className="text-xs font-black text-gray-900 truncate">{s.paymentDate || '—'}</p>
                    </div>
                  </div>

                  {s.notes && (
                    <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 flex items-start gap-1.5">
                      <StickyNote size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] font-bold text-gray-600">{s.notes}</p>
                    </div>
                  )}

                  {/* Screenshot */}
                  {s.screenshotUrl ? (
                    <button
                      onClick={() => setLightbox(s.screenshotUrl)}
                      className="mt-3 flex items-center gap-2 text-[11px] font-black text-blue-600 hover:underline"
                    >
                      <img src={s.screenshotUrl} alt="proof" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                      {bn ? 'পেমেন্ট স্ক্রিনশট দেখুন' : 'View payment screenshot'}
                    </button>
                  ) : (
                    <p className="mt-3 text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                      <ImageIcon size={13} /> {bn ? 'কোনো স্ক্রিনশট নেই' : 'No screenshot attached'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                  <button
                    disabled={busy}
                    onClick={() => handleApprove(s)}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-black text-xs shadow-[0_6px_12px_rgba(16,185,129,0.2)] active:scale-95 transition-all"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {bn ? 'অনুমোদন' : 'Approve'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setRejecting(s)}
                    className="inline-flex items-center justify-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs active:scale-95 transition-all"
                  >
                    <XCircle size={15} />
                    {bn ? 'বাতিল' : 'Reject'}
                  </button>
                </div>
              </div>
            );
          })}
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

      {/* Reject reason modal */}
      {rejecting && (
        <RejectModal
          submission={rejecting}
          language={language}
          busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}

function RejectModal({ submission, language, busy, onCancel, onConfirm }) {
  const bn = language === 'বাংলা';
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="bg-white rounded-[2rem] w-full max-w-sm relative z-10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <XCircle className="text-red-500" size={22} />
            {bn ? 'পেমেন্ট বাতিল করুন' : 'Reject Payment'}
          </h2>
          <button onClick={onCancel} className="w-9 h-9 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm font-bold text-gray-600 mb-3">
            {bn
              ? `${submission.tenantName || 'ভাড়াটিয়া'}-কে জানানো হবে কেন পেমেন্ট বাতিল হলো।`
              : `${submission.tenantName || 'The tenant'} will be told why the payment was rejected.`}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={bn ? 'কারণ (ঐচ্ছিক) — যেমন: ট্রানজেকশন আইডি মেলেনি' : 'Reason (optional) — e.g. Transaction ID not found'}
            className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-red-500/20 transition-all resize-none"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-3 rounded-xl font-black text-sm transition-colors"
            >
              {bn ? 'ফিরে যান' : 'Cancel'}
            </button>
            <button
              disabled={busy}
              onClick={() => onConfirm(reason)}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {bn ? 'বাতিল করুন' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
