import React, { useState, useEffect } from 'react';
import { X, Download, Star, Share, PlusSquare, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  useAppInstall,
  isAppAlreadyInstalled,
  safeStorageGet,
  safeStorageSet,
  INSTALL_GUIDE_EVENT,
} from '../hooks/useAppInstall';

const STORAGE_KEY = 'toletpro_app_banner_dismissed';

/**
 * Persistent App Download Banner.
 *
 * ─ Android: Play Store link only (no PWA flow).
 * ─ iPhone/iPad: App Store when available, otherwise the iOS
 *   Add-to-Home-Screen guide (iPadOS-as-Macintosh handled).
 * ─ Mac: native app when available, else PWA prompt / Safari Add-to-Dock guide.
 * ─ Windows/desktop: PWA prompt when supported, else an honest fallback.
 *
 * Hidden when already installed (native app or standalone PWA), after a
 * successful install (`appinstalled`), or permanently after the user taps ✕
 * ("don't show again"). Cancelling an install does NOT dismiss permanently.
 */
const AppDownloadBanner = () => {
  const { t } = useLanguage();
  const { platform, triggerDownload, installed } = useAppInstall();
  const [dismissed, setDismissed] = useState(true); // default hidden until we check
  const [guide, setGuide] = useState(null); // null | 'ios' | 'mac' | 'unsupported'

  useEffect(() => {
    // Previously dismissed, or already running as the app? Stay hidden.
    if (safeStorageGet(STORAGE_KEY) === '1') return;
    if (isAppAlreadyInstalled()) return;
    setDismissed(false);
  }, []);

  // Other components (HeroSection) can open the guide modal via this event
  // instead of duplicating the modal UI.
  useEffect(() => {
    const onRequest = (e) => setGuide(e.detail);
    window.addEventListener(INSTALL_GUIDE_EVENT, onRequest);
    return () => window.removeEventListener(INSTALL_GUIDE_EVENT, onRequest);
  }, []);

  // Successful install (via our prompt or the browser menu) → hide for good.
  useEffect(() => {
    if (installed) {
      safeStorageSet(STORAGE_KEY, '1');
      setDismissed(true);
      setGuide(null);
    }
  }, [installed]);

  if (dismissed && !guide) return null;

  // Intentional "don't show again" — the only path that persists dismissal.
  const handleDismiss = () => {
    safeStorageSet(STORAGE_KEY, '1');
    setDismissed(true);
    setGuide(null);
  };

  const handleDownload = async () => {
    const result = await triggerDownload();
    switch (result) {
      case 'store':
        // Store page opened — hide for this session only; if the user comes
        // back without installing, the banner returns.
        setDismissed(true);
        break;
      case 'prompted-accepted':
        // `appinstalled` will fire and persist the dismissal; hide right away.
        setDismissed(true);
        break;
      case 'prompted-cancelled':
        // User changed their mind — keep the banner, don't dismiss.
        break;
      case 'guide-ios':
        setGuide('ios');
        break;
      case 'guide-mac':
        setGuide('mac');
        break;
      default:
        setGuide('unsupported');
    }
  };

  const isNative = platform !== 'android';

  return (
    <>
      {/* ─── VISUAL GUIDE MODAL (APPLE GUIDES + UNSUPPORTED FALLBACK) ─── */}
      {guide && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] rounded-[32px] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.25)] border border-white/20 bg-white/80 dark:bg-[#151520]/80 backdrop-blur-3xl relative animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ba0036]/20 blur-[64px] rounded-full pointer-events-none" />

            <button onClick={() => setGuide(null)} className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors z-10">
              <X size={16} className="text-slate-700 dark:text-slate-300" />
            </button>

            <div className="w-16 h-16 bg-gradient-to-br from-[#ba0036] to-[#ff4d7d] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_8px_16px_rgba(186,0,54,0.3)] relative z-10">
              <img src="/icons/icon-192.png" alt="TO-LET PRO" className="w-10 h-10 object-contain drop-shadow-md rounded-lg" />
            </div>

            <h3 className="text-[22px] font-black text-center text-slate-900 dark:text-white mb-2 leading-tight">
              {t('bannerInstallTitle')}
            </h3>

            {guide === 'ios' && (
              <div className="space-y-4 mt-6 relative z-10">
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold mb-2">
                  {t('bannerIosSub')}
                </p>
                <div className="flex items-center gap-4 bg-white/60 dark:bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/40 dark:border-white/10 shadow-sm">
                  <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                    <Share size={20} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('bannerIosStep1')} <span className="text-blue-600 dark:text-blue-400">{t('bannerIosStep1b')}</span> {t('bannerIosStep1c')}</p>
                </div>
                <div className="flex items-center gap-4 bg-white/60 dark:bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/40 dark:border-white/10 shadow-sm">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
                    <PlusSquare size={20} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('bannerIosStep2')} <span className="text-slate-900 dark:text-white">{t('bannerIosStep2b')}</span> {t('bannerIosStep2c')}</p>
                </div>
                {/* Visual downward arrow hinting at the bottom menu */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="animate-bounce flex flex-col items-center">
                    <div className="w-[3px] h-8 bg-gradient-to-b from-blue-500/0 to-blue-500 mx-auto rounded-full" />
                    <div className="w-3 h-3 border-b-[3px] border-r-[3px] border-blue-500 rotate-45 mx-auto -mt-2 rounded-sm" />
                  </div>
                </div>
              </div>
            )}

            {guide === 'mac' && (
              <div className="space-y-4 mt-6 relative z-10">
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold mb-2">
                  {t('bannerMacSub')}
                </p>
                <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md p-5 rounded-2xl border border-white/40 dark:border-white/10 text-center space-y-4 shadow-sm">
                  <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
                    {t('bannerMacStep1')} <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm">{t('bannerMacStep1b')}</span> {t('bannerMacStep1c')}
                  </p>
                  <div className="text-slate-400">↓</div>
                  <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
                    {t('bannerMacStep2')} <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm">{t('bannerMacStep2b')}</span> {t('bannerMacStep2c')}
                  </p>
                </div>
              </div>
            )}

            {guide === 'unsupported' && (
              <div className="space-y-4 mt-6 relative z-10">
                <div className="flex items-start gap-4 bg-white/60 dark:bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/40 dark:border-white/10 shadow-sm">
                  <div className="w-10 h-10 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                    <Info size={20} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t('bannerUnsupportedMsg')}
                  </p>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold">
                  {t('bannerUnsupportedHint')}
                </p>
              </div>
            )}

            <button onClick={() => setGuide(null)} className="w-full mt-5 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-[18px] font-black text-sm tracking-wide transition-all active:scale-[0.98] relative z-10 shadow-md">
              {t('bannerGotItBtn')}
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#ff4d7d] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(186,0,54,0.4)] p-1.5">
                <img src="/icons/icon-192.png" alt="TO-LET PRO Logo" className="w-full h-full object-contain rounded-lg" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-black leading-tight truncate">TO-LET PRO</p>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#ff4d7d] bg-[#ff4d7d]/15 px-1.5 py-0.5 rounded-full leading-none">{t('bannerMobileFree')}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={9} className="text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-[10px] text-slate-400 font-semibold ml-0.5">{isNative ? t('bannerNativeApp') : t('bannerPlayStore')}</span>
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                className="shrink-0 bg-[#ba0036] hover:bg-[#d4004a] text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(186,0,54,0.4)] active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Download size={12} /> {isNative ? t('bannerBtnInstall') : t('bannerBtnDownload')}
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
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ba0036] to-[#ff4d7d] flex items-center justify-center shrink-0 shadow-sm p-1">
                  <img src="/icons/icon-192.png" alt="TO-LET PRO Logo" className="w-full h-full object-contain rounded-md" />
                </div>
                <p className="text-xs font-bold text-slate-300">
                  <span className="font-black text-white">TO-LET PRO</span> {isNative ? t('bannerDesktopNativeTxt') : t('bannerDesktopStoreTxt')}
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
                <Download size={11} /> {isNative ? t('bannerBtnInstall') : t('bannerBtnDownload')}
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
