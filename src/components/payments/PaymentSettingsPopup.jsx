import React, { useState, useEffect } from 'react';
import { X, CreditCard, ArrowRight, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// "Remind Me Later" — quiet for the rest of this session only.
const SNOOZE_KEY = 'tolet_payment_settings_snoozed';
// "Don't show again" — quiet for good, across sessions. Everything used to be
// a session snooze, so the popup returned on every new tab and every browser
// restart: dismissing it never actually dismissed it.
//
// Turning it off permanently is safe because it is not the only nudge — the
// inline Payment Settings card stays on the dashboard, and the popup never
// appears at all once a payment method exists.
const DISMISS_KEY = 'tolet_payment_settings_dismissed';

/**
 * PaymentSettingsPopup — reminds a landlord to configure Payment Settings when
 * they haven't added any payment method yet. Shows once per session, but ONLY
 * once a tenant is actually connected to one of their properties.
 *
 * The bookings gate is the point of this component's timing: a brand-new
 * landlord with no tenant has nobody to collect rent from, so a modal demanding
 * a payment account is a dead end on their first visit. It becomes useful the
 * moment there IS someone to be paid by. This mirrors the inline promo card in
 * HostDashboard / DashboardTab, which has always required `bookings.length > 0`
 * — the two surfaces now agree instead of one firing on day zero.
 *
 * Props:
 *   hasPaymentMethod : boolean  — landlord already has ≥1 method
 *   hasBookings      : boolean  — ≥1 tenant connected to a property
 *   loading          : boolean  — methods still loading (suppress until known)
 *   onAddMethod      : ()=>void — open the Payment Settings screen
 */
export default function PaymentSettingsPopup({ hasPaymentMethod, hasBookings, loading, onAddMethod }) {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (hasPaymentMethod) { setVisible(false); return; }
    // No tenant connected yet → nothing to collect, so don't interrupt. Bookings
    // arrive from an async fetch (and refresh on a 30s poll), so this correctly
    // stays closed on first paint and opens later if a tenant connects while the
    // dashboard is open.
    if (!hasBookings) { setVisible(false); return; }
    let quiet = false;
    try {
      quiet = sessionStorage.getItem(SNOOZE_KEY) === '1'
        || localStorage.getItem(DISMISS_KEY) === '1';
    } catch { /* storage unavailable — show it rather than swallow the reminder */ }
    if (!quiet) setVisible(true);
  }, [hasPaymentMethod, hasBookings, loading]);

  if (!visible) return null;

  const snooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  // Permanent. Separate from snooze so "later" and "never" stay distinguishable.
  const dismissForever = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const add = () => {
    try {
      sessionStorage.setItem(SNOOZE_KEY, '1');
      localStorage.setItem(DISMISS_KEY, '1');
    } catch { /* ignore */ }
    setVisible(false);
    onAddMethod?.();
  };

  return (
    // `role="dialog"` + `data-tour-blocker` are what keep the guided tour from
    // opening behind this popup — see BLOCKING_UI in context/TourContext.jsx.
    // Both bookings and payment methods arrive from async fetches, so this can
    // pop open a beat AFTER the tour has already checked for a clear screen.
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={bn ? 'পেমেন্ট সেটিংস সম্পূর্ণ করুন' : 'Complete your payment settings'}
      data-tour-blocker
    >
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={snooze} />
      <div className="bg-white rounded-[2rem] w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Accent header */}
        <div className="relative bg-gradient-to-br from-[#ba0036] to-[#ff004c] px-6 pt-7 pb-8 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl" />
          <button
            onClick={dismissForever}
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
