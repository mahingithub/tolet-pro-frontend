import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Star } from 'lucide-react';

const STORAGE_KEY = 'toletpro_app_banner_dismissed';

/**
 * Persistent "Download our Android app" banner.
 *
 * ─ Mobile:  slim bar above the Navbar (smart-app-banner style)
 * ─ Desktop: thin top strip across the full width
 *
 * Once the user taps ✕ the banner stays hidden permanently via localStorage.
 * The component renders nothing when:
 *   • the banner was previously dismissed, OR
 *   • the page is loaded inside the native Android WebView (user agent check).
 */
const AppDownloadBanner = () => {
  const [dismissed, setDismissed] = useState(true);  // default hidden until we check

  useEffect(() => {
    // Already dismissed?
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    // Running inside the native Android wrapper? Don't show.
    const ua = navigator.userAgent || '';
    if (/ToLetProApp/i.test(ua)) return;

    setDismissed(false);
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const handleDownload = () => {
    window.open(
      'https://play.google.com/store/apps/details?id=com.tolet.pro',
      '_blank',
    );
  };

  return (
    <>
      {/* ─── MOBILE banner (above sticky Navbar) ─── */}
      <div className="md:hidden w-full bg-gradient-to-r from-[#0d0d14] via-[#1a0a14] to-[#0d0d20] text-white relative z-[61]">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {/* App icon */}
          <div className="w-10 h-10 rounded-xl bg-[#ba0036] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(186,0,54,0.4)]">
            <Smartphone size={18} className="text-white" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-black leading-tight truncate">TO-LET PRO</p>
              <span className="text-[8px] font-black uppercase tracking-widest text-[#ff4d7d] bg-[#ff4d7d]/15 px-1.5 py-0.5 rounded-full leading-none">Free</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={9} className="text-amber-400 fill-amber-400" />
              ))}
              <span className="text-[10px] text-slate-400 font-semibold ml-0.5">Play Store</span>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="shrink-0 bg-[#ba0036] hover:bg-[#d4004a] text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(186,0,54,0.4)] active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Download size={12} /> ডাউনলোড
          </button>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ─── DESKTOP banner (thin top strip) ─── */}
      <div className="hidden md:block w-full bg-gradient-to-r from-[#0d0d14] via-[#1a0a14] to-[#0d0d20] text-white relative z-[61]">
        <div className="w-full max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center justify-center gap-4 h-[38px]">
          {/* Left: icon + text */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#ba0036] flex items-center justify-center shrink-0 shadow-sm">
              <Smartphone size={13} className="text-white" />
            </div>
            <p className="text-xs font-bold text-slate-300">
              <span className="font-black text-white">TO-LET PRO</span> অ্যাপ ডাউনলোড করুন — ১০× দ্রুত বাসা খুঁজুন!
            </p>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleDownload}
            className="shrink-0 bg-[#ba0036] hover:bg-[#d4004a] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_4px_14px_rgba(186,0,54,0.35)] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Download size={11} /> Download App
          </button>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 text-slate-500 hover:text-white transition-colors ml-1"
            aria-label="Dismiss banner"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
};

export default AppDownloadBanner;
