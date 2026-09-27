import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * OfflineNotice — the app's ONE "you have no internet" indicator.
 * ───────────────────────────────────────────────────────────────────────────
 * Before this, being offline was invisible. Five modules listened for the
 * online/offline events — ChatSystem, ErrorBoundary, useHostSyncStore,
 * useLivingStore, utils/lazyRoute — and not one of them changed anything the
 * user could see. The only written-out "ইন্টারনেট সংযোগ নেই" screen lived in
 * ErrorBoundary and is reachable only when a route chunk fails to download,
 * which the service worker's precache now prevents. So the app's single
 * offline message was, in practice, dead code, and the user's evidence that
 * the network was gone was a screen that quietly said there are no houses in
 * Dhaka.
 *
 * WHAT THIS IS AND IS NOT.
 * It is a statement of fact about the device, nothing more. It has no button,
 * it blocks nothing, and NOTHING may be gated on it. `navigator.onLine` is
 * only "is this device attached to a network" — it is true on a captive
 * portal, on a Wi-Fi router with a dead uplink, and on a connection too slow
 * to finish a request. It is reliably FALSE in exactly one case (aeroplane
 * mode / no data / no Wi-Fi), which is the case worth telling the user about,
 * and that is the whole of its job here.
 *
 * Delivery is still the queues' problem, not this component's:
 * useHostSyncStore and useLivingStore apply writes locally, persist an op log
 * and reconcile by opId when the server is reachable again. They already
 * handle a connection that `navigator.onLine` swears is fine. Do not make
 * them — or any write path — ask this component whether to proceed.
 *
 * WHY AN OVERLAY AND NOT A BAR IN THE FLOW.
 * The events flap: walking past a lift, a phone can fire offline/online
 * several times a minute. A strip in normal flow would push and pop the whole
 * page by its own height on every one of those, moving the button under the
 * user's thumb mid-tap. `position: fixed` keeps it out of layout entirely, so
 * a flap costs one repaint of ~28px and nothing reflows.
 *
 * WHY pointer-events-none.
 * It is pinned above everything, including the full-screen modals at z-[100000]
 * (LocationSearchModal, VideoModal) — an offline notice the user cannot see
 * because a sheet is open is no better than no notice. Covering a modal's
 * close button would make it UNTAPPABLE, which is the exact failure
 * src/test/safeArea.test.js exists to catch. There is nothing to tap in here,
 * so clicks pass straight through and the control underneath still works.
 *
 * WHY var(--sat) AND NEVER env(safe-area-inset-top).
 * This is anchored to the physical top of the screen, and the app is
 * edge-to-edge by force (targetSdk 36), so the status bar is drawn over us.
 * --sat resolves the Android measurement, Capacitor's injected variable and
 * env() in the one order that doesn't double-pad — see the token comment in
 * index.css.
 */

// useSyncExternalStore rather than useState + useEffect, the same way
// hooks/useNativeExperience.js reads the device key. It matters for one reason
// beyond tidiness: with an effect, a drop that happens between the first render
// and the listener attaching is LOST — the event has already fired, and the
// next one may not come for hours, so the app would sit there silently offline.
// React re-reads the snapshot itself when it subscribes, so that window closes.
const subscribe = (onChange) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

// Must stay a cheap primitive: React calls this on every render.
const getSnapshot = () => navigator.onLine === false;
// A non-browser render has no navigator and no network state to report.
// `false` so a crawler is never handed a page with this strip on it.
const getServerSnapshot = () => false;

export default function OfflineNotice() {
  const { language } = useLanguage();
  const offline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!offline) return null;

  const isBn = language === 'বাংলা';

  return (
    // `role="status"` + aria-live="polite" so a screen reader is told once,
    // when it appears, without interrupting whatever is being read.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100003] pointer-events-none animate-tp-fade-in"
      style={{ paddingTop: 'var(--sat)' }}
    >
      <div className="flex items-center justify-center gap-2 bg-slate-900/95 px-4 py-1.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(15,23,42,0.28)]">
        <WifiOff size={14} className="shrink-0 opacity-90" aria-hidden="true" />
        <span>{isBn ? 'ইন্টারনেট সংযোগ নেই' : 'No internet connection'}</span>
      </div>
    </div>
  );
}
