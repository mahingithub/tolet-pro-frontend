import React from 'react';
import { Home, LayoutDashboard, X, ArrowRight } from 'lucide-react';

/**
 * LandlordHomeChoiceModal
 *
 * For a landlord, the Host Dashboard *is* their home. So tapping the TO-LET PRO
 * logo shouldn't silently jump to the public marketing homepage — instead we
 * ask where they want to go:
 *
 *   • "Go to main Home"  → the public site ("/")
 *   • "Stay / Go to Dashboard" → their Host Dashboard ("/host-dashboard")
 *
 * The component is presentational only: the parent owns navigation, so the same
 * popup works from the dashboard header, the marketing navbar, and the mobile
 * drawer. Entrance uses the project's shared `.animate-tp-*` utilities
 * (index.css) since the tailwindcss-animate plugin isn't installed.
 *
 * @param {object}   props
 * @param {boolean}  props.open            - whether the popup is visible
 * @param {Function} props.onClose         - dismiss without navigating
 * @param {Function} props.onGoHome        - navigate to the public main home
 * @param {Function} props.onGoDashboard   - navigate to / stay on the dashboard
 * @param {boolean} [props.onDashboardPage=false] - true when opened FROM the
 *   dashboard, so the second option reads "Stay on Dashboard" instead of
 *   "Go to Dashboard".
 * @param {boolean} [props.isBn=false]     - Bangla copy toggle
 */
const LandlordHomeChoiceModal = ({
  open,
  onClose,
  onGoHome,
  onGoDashboard,
  onDashboardPage = false,
  isBn = false,
}) => {
  if (!open) return null;
  const L = (en, bn) => (isBn ? bn : en);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md animate-tp-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.2)] w-full max-w-sm overflow-hidden animate-tp-modal-in">
        {/* Brand header */}
        <div className="relative bg-gradient-to-br from-[#BA0036] to-[#7A0024] px-6 pt-7 pb-6 text-white text-center overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <button
            onClick={onClose}
            aria-label={L('Close', 'বন্ধ করুন')}
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-white/15 hover:bg-white/25 rounded-full p-2 transition-colors"
          >
            <X size={18} />
          </button>
          <h3 className="text-xl font-black tracking-tight">{L('Where to?', 'কোথায় যাবেন?')}</h3>
          <p className="text-white/80 text-sm mt-1">
            {L('Your dashboard is your home base', 'আপনার ড্যাশবোর্ডই আপনার হোম')}
          </p>
        </div>

        {/* Options */}
        <div className="p-5 grid gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#ba0036] hover:bg-red-50/40 transition-all text-left active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <Home size={22} className="text-[#ba0036]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900">{L('Go to main Home', 'মূল হোমে যান')}</p>
              <p className="text-xs text-gray-500">{L('Browse the public TO-LET PRO site', 'পাবলিক TO-LET PRO সাইট দেখুন')}</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-[#ba0036] group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          <button
            type="button"
            onClick={onGoDashboard}
            className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#ba0036] hover:bg-red-50/40 transition-all text-left active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <LayoutDashboard size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900">
                {onDashboardPage
                  ? L('Stay on Dashboard', 'ড্যাশবোর্ডে থাকুন')
                  : L('Go to Dashboard', 'ড্যাশবোর্ডে যান')}
              </p>
              <p className="text-xs text-gray-500">{L('Manage your properties & tenants', 'আপনার প্রপার্টি ও ভাড়াটিয়া পরিচালনা করুন')}</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-[#ba0036] group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandlordHomeChoiceModal;
