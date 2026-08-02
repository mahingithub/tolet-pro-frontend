import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Star, Apple, Monitor, Share, PlusSquare } from 'lucide-react';

const STORAGE_KEY = 'toletpro_app_banner_dismissed';

/**
 * Persistent App Download Banner.
 *
 * ─ Android: Shows Play Store link.
 * ─ Apple/Desktop: Shows Native App download link.
 *
 * Once the user taps ✕ or downloads, the banner stays hidden permanently via localStorage.
 * The component renders nothing when:
 *   • the banner was previously dismissed, OR
 *   • the page is loaded inside the native Android WebView (user agent check).
 */
const AppDownloadBanner = () => {
  const [dismissed, setDismissed] = useState(true);  // default hidden until we check
  const [platform, setPlatform] = useState('android'); // 'android' | 'apple' | 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAppleGuide, setShowAppleGuide] = useState(false);
  const [appleDeviceType, setAppleDeviceType] = useState('ios'); // 'ios' | 'mac'

  useEffect(() => {
    // Already dismissed?
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    // Running inside the native Android wrapper? Don't show.
    const ua = navigator.userAgent || '';
    if (/ToLetProApp/i.test(ua)) return;
    
    // Already installed as standalone?
    if (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true) return;

    // Detect platform
    if (/android/i.test(ua)) {
      setPlatform('android');
    } else if (/iphone|ipad|ipod|macintosh/i.test(ua)) {
      setPlatform('apple');
    } else {
      setPlatform('desktop');
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    setDismissed(false);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (dismissed && !showAppleGuide) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
    setShowAppleGuide(false);
  };

  const handleDownload = async () => {
    if (platform === 'android') {
      window.open('https://play.google.com/store/apps/details?id=com.tolet.pro', '_blank');
      handleDismiss();
    } else {
      // Trigger PWA Install
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch {/* ignore */}
        setDeferredPrompt(null);
        handleDismiss();
      } else {
        // Fallback instructions for Safari (iOS / Mac)
        const ua = navigator.userAgent || '';
        if (/iphone|ipad|ipod/i.test(ua)) {
          setAppleDeviceType('ios');
          setShowAppleGuide(true);
        } else if (/macintosh/i.test(ua)) {
          setAppleDeviceType('mac');
          setShowAppleGuide(true);
        } else {
          alert("To install: Look for the install icon in your browser's address bar.");
        }
      }
    }
  };

  const isNative = platform !== 'android';
  const label = isNative ? 'Native App' : 'Play Store';

  return (
    <>
      {/* ─── VISUAL GUIDE MODAL (FOR APPLE DEVICES) ─── */}
      {showAppleGuide && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95">
            <button onClick={() => setShowAppleGuide(false)} className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
              <X size={18} className="text-gray-600" />
            </button>
            
            <div className="w-16 h-16 bg-[#ba0036]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Apple size={32} className="text-[#ba0036]" />
            </div>
            
            <h3 className="text-xl font-black text-center text-gray-900 mb-2">
              Install TO-LET PRO
            </h3>
            
            {appleDeviceType === 'ios' ? (
              <div className="space-y-4 mt-6">
                <p className="text-sm text-gray-600 text-center font-medium">
                  Follow these 2 simple steps to install the app on your iPhone/iPad:
                </p>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center shrink-0 text-blue-500">
                    <Share size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-800">1. Tap the <span className="text-blue-500">Share</span> button at the bottom of Safari.</p>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center shrink-0 text-gray-700">
                    <PlusSquare size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-800">2. Scroll down and tap <span className="text-gray-900">Add to Home Screen</span>.</p>
                </div>
                {/* Visual downward arrow hinting at the bottom menu */}
                <div className="flex justify-center pt-2">
                  <div className="animate-bounce">
                    <div className="w-1 h-8 bg-gradient-to-b from-transparent to-blue-500 mx-auto rounded-full" />
                    <div className="w-3 h-3 border-b-2 border-r-2 border-blue-500 rotate-45 mx-auto -mt-2" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-6">
                <p className="text-sm text-gray-600 text-center font-medium">
                  Install the Native App on your MacBook in one click:
                </p>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-center space-y-3">
                  <p className="text-sm font-bold text-gray-800">Click <span className="bg-white px-2 py-1 rounded shadow-sm border border-gray-200">File</span> in the top Safari menu bar.</p>
                  <p className="text-sm text-gray-400 font-black">↓</p>
                  <p className="text-sm font-bold text-gray-800">Select <span className="bg-white px-2 py-1 rounded shadow-sm border border-gray-200">Add to Dock...</span></p>
                </div>
              </div>
            )}
            
            <button onClick={handleDismiss} className="w-full mt-6 py-3 font-bold text-gray-500 hover:text-gray-800 transition-colors">
              Got it, thanks!
            </button>
          </div>
        </div>
      )}

      {/* ─── BANNER UI ─── */}
      {!dismissed && (
        <>
          {/* ─── MOBILE banner (above sticky Navbar) ─── */}
          <div className="md:hidden w-full bg-gradient-to-r from-[#0d0d14] via-[#1a0a14] to-[#0d0d20] text-white relative z-[61]">
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* App icon */}
              <div className="w-10 h-10 rounded-xl bg-[#ba0036] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(186,0,54,0.4)]">
                {platform === 'apple' ? <Apple size={18} className="text-white" /> : <Smartphone size={18} className="text-white" />}
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
                  <span className="text-[10px] text-slate-400 font-semibold ml-0.5">{label}</span>
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                className="shrink-0 bg-[#ba0036] hover:bg-[#d4004a] text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(186,0,54,0.4)] active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Download size={12} /> {isNative ? 'Install' : 'ডাউনলোড'}
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
                  {platform === 'desktop' ? <Monitor size={13} className="text-white" /> : platform === 'apple' ? <Apple size={13} className="text-white" /> : <Smartphone size={13} className="text-white" />}
                </div>
                <p className="text-xs font-bold text-slate-300">
                  <span className="font-black text-white">TO-LET PRO</span> {isNative ? 'Native App ডাউনলোড করুন — দ্রুত এবং নিরাপদ!' : 'অ্যাপ ডাউনলোড করুন — ১০× দ্রুত বাসা খুঁজুন!'}
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
                <Download size={11} /> {isNative ? 'Install App' : 'Download App'}
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
      )}
    </>
  );
};

export default AppDownloadBanner;
