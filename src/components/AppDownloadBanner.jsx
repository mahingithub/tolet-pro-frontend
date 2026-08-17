import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Star, Share, PlusSquare, Info, MonitorDown, MousePointerClick } from 'lucide-react';
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
 * Persistent App Download Banner — premium glass surface, To-Let Pro identity.
 *
 * ─ Android: Play Store link only (no PWA flow).
 * ─ iPhone/iPad: App Store when available, otherwise the iOS
 *   Add-to-Home-Screen guide (iPadOS-as-Macintosh handled).
 * ─ Mac: native app when available, else PWA prompt / Safari Add-to-Dock guide.
 * ─ Chromium without a prompt: honest "check your Dock / install from menu"
 *   panel (Chrome suppresses beforeinstallprompt when already installed).
 * ─ Firefox & co: honest "not supported" fallback.
 *
 * Hidden when already installed (native app or standalone PWA), after a
 * successful install (`appinstalled`), or permanently after the user taps ✕
 * ("don't show again"). Cancelling an install does NOT dismiss permanently.
 */

/* Numbered glass step tile used inside the guide modal. `last` hides the
   connector line below the badge. */
const GuideStep = ({ n, icon, tone, children, last = false }) => (
  <div className="relative flex items-stretch gap-4">
    {/* Number badge + connector */}
    <div className="flex flex-col items-center shrink-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-sm ${tone.badge}`}>
        {n}
      </div>
      {!last && <div className="w-px flex-1 mt-1.5 bg-gradient-to-b from-slate-300/60 to-transparent dark:from-white/15" />}
    </div>
    {/* Card */}
    <div className={`flex-1 flex items-center gap-3.5 bg-white/70 dark:bg-white/[0.06] backdrop-blur-xl p-4 rounded-2xl border border-white/60 dark:border-white/10 shadow-[0_2px_12px_rgba(15,23,42,0.06)] ${last ? '' : 'mb-3'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.well}`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">{children}</p>
    </div>
  </div>
);

const TONE_BLUE = {
  badge: 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]',
  well: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
};
const TONE_SLATE = {
  badge: 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.3)]',
  well: 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300',
};
const TONE_CRIMSON = {
  badge: 'bg-[#ba0036] text-white shadow-[0_2px_8px_rgba(186,0,54,0.4)]',
  well: 'bg-[#ba0036]/10 dark:bg-[#ba0036]/20 text-[#ba0036] dark:text-[#ff4d7d]',
};

const AppDownloadBanner = () => {
  const { t } = useLanguage();
  const { platform, triggerDownload, installed } = useAppInstall();
  const [dismissed, setDismissed] = useState(true); // default hidden until we check
  const [guide, setGuide] = useState(null); // null | 'ios' | 'mac' | 'chromium' | 'unsupported'
  // Unanimated wrapper around both strips, used purely for measurement. The
  // strips themselves run a slide-in transform on mount, which getBoundingClientRect
  // bakes into the result — measuring the wrapper's own border box instead keeps
  // the published height honest while that animation plays. Its height is
  // whichever strip is live at the current breakpoint (the other is display:none).
  const stripWrapRef = useRef(null);

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

  // ── PUBLISH THE BANNER'S VISIBLE HEIGHT AS `--app-banner-h` ───────────────
  // The banner lives in NORMAL DOCUMENT FLOW, so ordinary page content is
  // pushed down for free and needs nothing from us. This variable exists for
  // the one case flow can't solve: `position: fixed` UI anchored to a hardcoded
  // top offset (e.g. the Navbar's mobile search panel at `top: 56px`, which
  // assumes the navbar is flush against the viewport top). Those elements must
  // use
  //     top: calc(var(--app-banner-h) + <their own offset>)
  // to stay glued to the right place.
  //
  // The value is the banner's *currently visible* intrusion into the viewport,
  // not its intrinsic height: full height at scroll 0, shrinking to 0px as the
  // banner scrolls away. That's exactly the offset a `sticky top-0` navbar has
  // at any scroll position, so consumers stay correct all the way down the page
  // instead of only at the top. Always 0px when the banner isn't on screen, so
  // `calc()` consumers degrade to their original value.
  useEffect(() => {
    const root = document.documentElement;
    const reset = () => root.style.setProperty('--app-banner-h', '0px');
    if (dismissed) { reset(); return reset; }

    let frame = 0;
    const publish = () => {
      frame = 0;
      const wrap = stripWrapRef.current;
      if (!wrap) { reset(); return; }
      const { height, bottom } = wrap.getBoundingClientRect();
      // Clamp: `bottom` goes negative once scrolled past, and can exceed the
      // banner's own height during iOS rubber-band over-scroll.
      root.style.setProperty('--app-banner-h', `${Math.round(Math.max(0, Math.min(bottom, height)))}px`);
    };
    // rAF-coalesced so a scroll burst costs one layout read per frame.
    const schedule = () => { if (!frame) frame = requestAnimationFrame(publish); };

    publish();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Catches the breakpoint swap between the two strips (44px desktop vs the
    // taller mobile row) and any reflow of the banner's own content, e.g. a
    // language change making the text wrap.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (stripWrapRef.current) observer?.observe(stripWrapRef.current);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      reset();
    };
  }, [dismissed]);

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
      case 'chromium-menu':
        setGuide('chromium');
        break;
      default:
        setGuide('unsupported');
    }
  };

  const isNative = platform !== 'android';

  return (
    <>
      {/* ─── GUIDE MODAL (APPLE / CHROMIUM / UNSUPPORTED) ─── */}
      {guide && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-black/50 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <div className="w-full max-w-[360px] rounded-[32px] p-6 relative overflow-hidden motion-safe:animate-in motion-safe:slide-in-from-bottom-8 md:motion-safe:slide-in-from-bottom-0 md:motion-safe:zoom-in-95 motion-safe:duration-300
                          bg-white/85 dark:bg-[#12121c]/85 backdrop-blur-3xl
                          border border-white/40 dark:border-white/10
                          shadow-[0_32px_64px_-12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
            {/* Lit top edge — subtle futuristic surface cue */}
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/70 dark:via-white/25 to-transparent pointer-events-none" />
            {/* Ambient brand bloom */}
            <div className="absolute -top-28 -right-28 w-56 h-56 bg-[#ba0036]/15 blur-[72px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 -left-24 w-48 h-48 bg-blue-600/8 blur-[64px] rounded-full pointer-events-none" />

            <button onClick={() => setGuide(null)} className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba0036]/60" aria-label="Close guide">
              <X size={16} className="text-slate-700 dark:text-slate-300" />
            </button>

            {/* App icon tile with inner highlight */}
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-5 relative z-10
                            bg-gradient-to-br from-[#ba0036] to-[#ff4d7d]
                            shadow-[0_12px_24px_-6px_rgba(186,0,54,0.45),0_1px_0_rgba(255,255,255,0.35)_inset]">
              <img src="/icons/icon-192.png" alt="TO-LET PRO" className="w-10 h-10 object-contain drop-shadow-md rounded-lg" />
            </div>

            <h3 className="text-[22px] font-black text-center text-slate-900 dark:text-white mb-1 leading-tight tracking-tight relative z-10">
              {guide === 'chromium' ? t.bannerChromiumTitle : t.bannerInstallTitle}
            </h3>

            {guide === 'ios' && (
              <div className="mt-6 relative z-10">
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold mb-5">
                  {t.bannerIosSub}
                </p>
                <GuideStep n="1" tone={TONE_BLUE} icon={<Share size={20} strokeWidth={2.5} />}>
                  {t.bannerIosStep1} <span className="text-blue-600 dark:text-blue-400">{t.bannerIosStep1b}</span> {t.bannerIosStep1c}
                </GuideStep>
                <GuideStep n="2" tone={TONE_SLATE} icon={<PlusSquare size={20} strokeWidth={2.5} />} last>
                  {t.bannerIosStep2} <span className="text-slate-900 dark:text-white">{t.bannerIosStep2b}</span> {t.bannerIosStep2c}
                </GuideStep>
              </div>
            )}

            {guide === 'mac' && (
              <div className="mt-6 relative z-10">
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold mb-5">
                  {t.bannerMacSub}
                </p>
                <GuideStep n="1" tone={TONE_SLATE} icon={<MousePointerClick size={20} strokeWidth={2.5} />}>
                  {t.bannerMacStep1} <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[13px]">{t.bannerMacStep1b}</span> {t.bannerMacStep1c}
                </GuideStep>
                <GuideStep n="2" tone={TONE_CRIMSON} icon={<MonitorDown size={20} strokeWidth={2.5} />} last>
                  {t.bannerMacStep2} <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[13px]">{t.bannerMacStep2b}</span> {t.bannerMacStep2c}
                </GuideStep>
              </div>
            )}

            {guide === 'chromium' && (
              <div className="mt-6 relative z-10">
                <GuideStep n="1" tone={TONE_CRIMSON} icon={<MonitorDown size={20} strokeWidth={2.5} />}>
                  {t.bannerChromiumMsg1} <span className="text-[#ba0036] dark:text-[#ff4d7d]">{t.bannerChromiumMsg1b}</span> {t.bannerChromiumMsg1c}
                </GuideStep>
                <GuideStep n="2" tone={TONE_BLUE} icon={<MousePointerClick size={20} strokeWidth={2.5} />} last>
                  {t.bannerChromiumMsg2} <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[12px] whitespace-nowrap">{t.bannerChromiumMsg2b}</span> {t.bannerChromiumMsg2c}
                </GuideStep>
              </div>
            )}

            {guide === 'unsupported' && (
              <div className="space-y-4 mt-6 relative z-10">
                <div className="flex items-start gap-4 bg-white/70 dark:bg-white/[0.06] backdrop-blur-xl p-4 rounded-2xl border border-white/60 dark:border-white/10 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
                  <div className="w-10 h-10 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                    <Info size={20} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">
                    {t.bannerUnsupportedMsg}
                  </p>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 text-center font-semibold">
                  {t.bannerUnsupportedHint}
                </p>
              </div>
            )}

            <button
              onClick={() => setGuide(null)}
              className="w-full mt-6 py-3.5 rounded-[18px] font-black text-sm tracking-wide relative z-10 transition-all active:scale-[0.98]
                         bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900
                         shadow-[0_8px_20px_-4px_rgba(15,23,42,0.4)] dark:shadow-[0_8px_20px_-4px_rgba(255,255,255,0.15)]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba0036]/60"
            >
              {t.bannerGotItBtn}
            </button>
          </div>
        </div>
      )}

      {/* ─── BANNER UI ─── */}
      {!dismissed && (
        <>
        {/* Measurement wrapper — an unstyled block whose only job is to give the
            --app-banner-h publisher a border box that the strips' slide-in
            transform can't distort. Deliberately carries no classes, so it adds
            nothing to layout and creates no stacking context. */}
        <div ref={stripWrapRef}>
          {/* ─── MOBILE banner ───
              z-[45] — NOT higher. See the layering note above the desktop
              strip; this value must stay below the z-50+ overlay band. */}
          <div
            className="md:hidden w-full relative z-[45] overflow-hidden bg-[#0d0d14] motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in motion-safe:duration-500">
            {/* Ambient brand bloom + lit bottom hairline */}
            <div className="absolute -top-10 right-10 w-40 h-40 bg-[#ba0036]/25 blur-[48px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-12 -left-6 w-32 h-32 bg-blue-600/10 blur-[40px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <div className="relative flex items-center gap-3 px-3 py-2.5">
              {/* App icon tile */}
              <div className="w-10 h-10 rounded-xl shrink-0 p-1.5 flex items-center justify-center
                              bg-gradient-to-br from-[#ba0036] to-[#ff4d7d]
                              shadow-[0_6px_16px_-2px_rgba(186,0,54,0.5),0_1px_0_rgba(255,255,255,0.3)_inset]">
                <img src="/icons/icon-192.png" alt="TO-LET PRO Logo" className="w-full h-full object-contain rounded-lg" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 text-white">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-black leading-tight truncate tracking-tight">TO-LET PRO</p>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#ff4d7d] bg-white/[0.06] border border-[#ff4d7d]/30 px-1.5 py-0.5 rounded-full leading-none backdrop-blur-sm">{t.bannerMobileFree}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={9} className="text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-[10px] text-slate-400 font-semibold ml-1 flex items-center gap-1">
                    <span className="w-0.5 h-0.5 rounded-full bg-slate-500 inline-block" />
                    {isNative ? t.bannerNativeApp : t.bannerPlayStore}
                  </span>
                </div>
              </div>

              {/* Download CTA */}
              <button
                onClick={handleDownload}
                className="group shrink-0 relative overflow-hidden px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider text-white
                           bg-gradient-to-r from-[#ba0036] to-[#d4004a]
                           shadow-[0_6px_16px_-2px_rgba(186,0,54,0.55),0_1px_0_rgba(255,255,255,0.25)_inset]
                           active:scale-95 transition-all flex items-center gap-1.5
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Download size={12} /> {isNative ? t.bannerBtnInstall : t.bannerBtnDownload}
              </button>

              {/* Close */}
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Dismiss banner"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ─── DESKTOP banner (glass top strip) ───
              ── WHY z-[45] AND NOT HIGHER ──────────────────────────────────
              This strip is `position: relative` in normal document flow, so
              NOTHING in flow can overlap it — page content is pushed down and
              a `sticky top-0` navbar only pins itself after the banner has
              scrolled off. Its z-index therefore only ever competes with
              `position: fixed` overlays, and those must always win: a modal,
              drawer or full-screen dialog covering the viewport has to cover
              the banner too.

              It used to be z-[61], which beat the entire z-50…z-60 overlay
              band and left the banner painting over the top ~44-60px of every
              one of them — most visibly the map view's floating search bar
              (PropertyListing's map dialog is `fixed inset-0 z-[60]`).

              LAYERING CONTRACT — keep this strip below the overlay band:
                z-0…z-40   in-flow page content and sticky page headers
                z-[45]     ← this banner
                z-50+      fixed overlays: modals, drawers, sheets, dialogs
              Fixed UI that instead wants to sit *below* the banner should be
              `sticky` (so flow handles it) or offset by var(--app-banner-h). */}
          <div
            className="hidden md:block w-full relative z-[45] overflow-hidden bg-[#0d0d14] motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in motion-safe:duration-500">
            {/* Ambient blooms + lit bottom hairline */}
            <div className="absolute -top-16 left-1/3 w-72 h-40 bg-[#ba0036]/20 blur-[64px] rounded-full pointer-events-none" />
            <div className="absolute -top-10 right-1/4 w-48 h-32 bg-blue-600/10 blur-[56px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <div className="relative w-full max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center justify-between gap-4 h-[44px]">
              {/* Left: icon + text */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg shrink-0 p-1 flex items-center justify-center
                                bg-gradient-to-br from-[#ba0036] to-[#ff4d7d]
                                shadow-[0_4px_10px_-1px_rgba(186,0,54,0.5),0_1px_0_rgba(255,255,255,0.3)_inset]
                                transition-transform duration-300 hover:scale-110 hover:-translate-y-px">
                  <img src="/icons/icon-192.png" alt="TO-LET PRO Logo" className="w-full h-full object-contain rounded-md" />
                </div>
                <p className="text-xs font-bold text-slate-300 truncate">
                  <span className="font-black text-white tracking-tight">TO-LET PRO</span>
                  <span className="mx-2 inline-block w-1 h-1 rounded-full bg-slate-600 align-middle" />
                  {isNative ? t.bannerDesktopNativeTxt : t.bannerDesktopStoreTxt}
                </p>
                <div className="hidden lg:flex items-center gap-0.5 shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>

              {/* Right: CTA + close */}
              <div className="flex items-center gap-2 shrink-0">
                {/* CTA with hover sheen */}
                <button
                  onClick={handleDownload}
                  className="group shrink-0 relative overflow-hidden px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white
                             bg-gradient-to-r from-[#ba0036] to-[#d4004a]
                             shadow-[0_6px_16px_-2px_rgba(186,0,54,0.5),0_1px_0_rgba(255,255,255,0.25)_inset]
                             hover:shadow-[0_8px_24px_-2px_rgba(186,0,54,0.65)] hover:scale-[1.04] active:scale-95
                             transition-all duration-300 flex items-center gap-1.5
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {/* Sheen sweep — hover only, motion-safe */}
                  <span className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 motion-safe:group-hover:animate-[banner-sheen_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full" aria-hidden="true" />
                  <Download size={11} /> {isNative ? t.bannerBtnInstall : t.bannerBtnDownload}
                </button>

                {/* Close */}
                <button
                  onClick={handleDismiss}
                  className="shrink-0 p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label="Dismiss banner"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sheen keyframes (scoped, tiny) */}
        <style>{`@keyframes banner-sheen { 0% { transform: translateX(-100%);} 60%,100% { transform: translateX(100%);} }`}</style>
        </>
      )}
    </>
  );
};

export default AppDownloadBanner;
