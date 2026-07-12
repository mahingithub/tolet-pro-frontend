import React, { useState, useEffect } from 'react';
import { X, CreditCard, ArrowRight, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// Once-per-session dismissal key so "Remind Me Later" doesn't nag on every
// re-render / tab switch within the same login session.
const SNOOZE_KEY = 'tolet_payment_settings_snoozed';

/**
 * PaymentSettingsPopup — reminds a landlord to configure Payment Settings when
 * they haven't added any payment method yet. Shows automatically after login
 * (once per session). Parent passes whether a method exists + a loading flag.
 *
 * Props:
 *   hasPaymentMethod : boolean  — landlord already has ≥1 method
 *   loading          : boolean  — methods still loading (suppress until known)
 *   onAddMethod      : ()=>void — open the Payment Settings screen
 */
export default function PaymentSettingsPopup({ hasPaymentMethod, loading, onAddMethod }) {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (hasPaymentMethod) { setVisible(false); return; }
    let snoozed = false;
    try { snoozed = sessionStorage.getItem(SNOOZE_KEY) === '1'; } catch { /* ignore */ }
    if (!snoozed) setVisible(true);
  }, [hasPaymentMethod, loading]);

  if (!visible) return null;

  const snooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const add = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
    onAddMethod?.();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={snooze} />
      <div className="bg-white rounded-[2rem] w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Accent header */}
        <div className="relative bg-gradient-to-br from-[#ba0036] to-[#ff004c] px-6 pt-7 pb-8 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl" />
          <button
            onClick={snooze}
            className="absolute top-4 right-4 w-9 h-9 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-4">
            <CreditCard size={26} />
          </div>
          <h2 className="text-xl font-black leading-tight">
            {bn ? 'পেমেন্ট সেটিংস সম্পূর্ণ করুন' : 'Complete Your Payment Settings'}
          </h2>
        </div>

        <div className="p-6">
          <p className="text-sm font-bold text-gray-600 leading-relaxed">
            {bn
              ? 'আপনার পছন্দের পেমেন্ট অ্যাকাউন্ট যোগ করুন যাতে ভাড়াটিয়া সরাসরি আপনাকে ভাড়া পাঠাতে পারে।'
              : 'Add your preferred payment account so tenants can pay rent directly to you.'}
          </p>

          <div className="mt-6 space-y-2.5">
            <button
              onClick={add}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#ba0036] hover:bg-[#a1002f] text-white py-3.5 rounded-xl font-black text-sm shadow-[0_8px_15px_rgba(186,0,54,0.2)] active:scale-95 transition-all"
            >
              {bn ? 'পেমেন্ট মেথড যোগ করুন' : 'Add Payment Method'}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={snooze}
              className="w-full inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-600 py-3.5 rounded-xl font-black text-sm transition-colors"
            >
              <Clock size={15} />
              {bn ? 'পরে মনে করিয়ে দিন' : 'Remind Me Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
