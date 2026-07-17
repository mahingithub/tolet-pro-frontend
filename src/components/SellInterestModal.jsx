import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ShoppingBag, AlertCircle, ArrowRight } from 'lucide-react';
import { recordSellInterest } from '../services/sellInterestService';

/**
 * SellInterestModal
 * ──────────────────────────────────────────────────────────────────────────
 * "Coming Soon" interstitial for the Sell option in Add Property. Selling isn't
 * self-service yet (handled by the support team / agency), so instead of a
 * listing form we offer a single "I am interested in selling my property"
 * button. Tapping it records ONE interest click (no PII form — the backend
 * attaches the logged-in user's name/phone automatically; guests count too) and
 * shows a confirmation that the request went to the support team.
 *
 * Props:
 *   open     boolean — whether the modal is shown
 *   onClose  () => void
 *   isBn     boolean — Bengali copy when true
 */
export default function SellInterestModal({ open, onClose, isBn = false }) {
  // 'idle' → 'loading' → 'done' | 'error'
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  // Reset to a fresh state every time the modal is (re)opened so a previous
  // "done"/"error" never lingers on the next visit.
  useEffect(() => {
    if (open) { setStatus('idle'); setErrMsg(''); }
  }, [open]);

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    setErrMsg('');
    try {
      await recordSellInterest({ source: 'add_property', kind: 'sell' });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrMsg(
        isBn
          ? 'অনুরোধ পাঠানো যায়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।'
          : "Couldn't send your request. Check your connection and try again.",
      );
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={isBn ? 'সম্পত্তি বিক্রির আগ্রহ' : 'Sell property interest'}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            className="relative bg-white rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.2)] w-full max-w-sm overflow-hidden"
          >
            {/* Accent glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ba0036]/10 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={onClose}
              aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-[#ba0036] bg-gray-50 hover:bg-red-50 border border-gray-100 rounded-full p-2 transition-all"
            >
              <X size={18} />
            </button>

            <div className="p-7 pt-8 text-center relative">
              {status === 'done' ? (
                /* ── Confirmation ── */
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[0_12px_28px_rgba(16,185,129,0.35)]"
                  >
                    <Check size={38} className="text-white" strokeWidth={3} />
                  </motion.div>
                  <h2 className="text-xl font-black text-gray-900 mb-2">
                    {isBn ? 'ধন্যবাদ! আগ্রহ নথিভুক্ত হয়েছে' : 'Thanks! Your interest is noted'}
                  </h2>
                  <p className="text-sm font-bold text-gray-500 leading-relaxed mb-6">
                    {isBn
                      ? 'আপনার অনুরোধ আমাদের সাপোর্ট টিমে পাঠানো হয়েছে। সম্পত্তি বিক্রির সুবিধা চালু হলে আমরা আপনার সাথে যোগাযোগ করব।'
                      : 'Your request has been sent to our support team. We\u2019ll reach out when property selling goes live.'}
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl font-black text-sm transition-all active:scale-95"
                  >
                    {isBn ? 'ঠিক আছে' : 'Done'}
                  </button>
                </>
              ) : (
                /* ── Coming soon + interest CTA ── */
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-[#ba0036] to-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[0_12px_28px_rgba(186,0,54,0.3)]">
                    <ShoppingBag size={36} className="text-white" />
                  </div>

                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-amber-200 mb-4">
                    <Sparkles size={11} className="fill-amber-500" />
                    {isBn ? 'শীঘ্রই আসছে' : 'Coming Soon'}
                  </span>

                  <h2 className="text-xl font-black text-gray-900 mb-2">
                    {isBn ? 'সম্পত্তি বিক্রি করতে চান?' : 'Want to sell your property?'}
                  </h2>
                  <p className="text-sm font-bold text-gray-500 leading-relaxed mb-6">
                    {isBn
                      ? 'সম্পত্তি বিক্রির সুবিধা আমরা শীঘ্রই চালু করছি। আগ্রহ প্রকাশ করুন — আমাদের সাপোর্ট টিম আপনাকে সহায়তা করবে।'
                      : 'Property selling is on the way. Register your interest and our support team will help you when it launches.'}
                  </p>

                  {status === 'error' && (
                    <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#ba0036] mb-3" role="alert">
                      <AlertCircle size={13} /> {errMsg}
                    </p>
                  )}

                  <button
                    onClick={submit}
                    disabled={status === 'loading'}
                    className="w-full bg-[#ba0036] hover:bg-[#a0002d] text-white py-3.5 rounded-xl font-black text-sm shadow-[0_10px_24px_rgba(186,0,54,0.3)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {status === 'loading' ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                        />
                        {isBn ? 'পাঠানো হচ্ছে…' : 'Sending…'}
                      </>
                    ) : (
                      <>
                        {isBn ? 'আমি সম্পত্তি বিক্রিতে আগ্রহী' : 'I am interested in selling my property'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] font-semibold text-gray-400 mt-3">
                    {isBn ? 'কোনো তথ্য দিতে হবে না — শুধু এক ট্যাপ।' : 'No details needed — just one tap.'}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
