import { useEffect, useRef } from 'react';

/** How long the "press Back again" window stays open, in ms. */
const EXIT_CONFIRM_MS = 2000;

/**
 * useAndroidBackButton — makes the hardware Back button able to CLOSE the app.
 *
 * THE BUG THIS EXISTS FOR.
 * Nothing in src/ ever listened for `backButton`, so @capacitor/app's own
 * handler was in charge. Read it (node_modules/@capacitor/app/…/AppPlugin.java,
 * handleOnBackPressed) and the hole is obvious:
 *
 *     if (!hasListeners(EVENT_BACK_BUTTON)) {
 *         if (bridge.getWebView().canGoBack()) {
 *             bridge.getWebView().goBack();
 *         }
 *         // ← and nothing at all when it CANNOT go back
 *     }
 *
 * The callback it registers is `new OnBackPressedCallback(true)` — enabled
 * permanently — so it CONSUMES every Back press before Android's default
 * handler can see it. Once the WebView runs out of history the press is
 * swallowed and neither branch runs: no navigation, no finish(). The app simply
 * cannot be closed with Back. It is not a race or a device quirk; that `if` has
 * no `else`.
 *
 * Registering any `backButton` listener flips `hasListeners` to true and hands
 * the whole decision to us, which is what this hook does:
 *
 *   canGoBack  → history.back(). Going through window.history rather than the
 *                native goBack() keeps React Router and useBackGuard in the
 *                loop, so an open modal/drawer/sheet absorbs the press exactly
 *                as it does on the web (see hooks/useBackGuard.js — overlays
 *                push a real history entry, so they count as "can go back").
 *   otherwise  → we are at the bottom of the stack. First press arms and hints,
 *                a second press within EXIT_CONFIRM_MS exits.
 *
 * The two-press confirm is deliberate: at the bottom of the stack a single
 * stray press would kill the app mid-task, and "press Back again to exit" is
 * the behaviour Android users already expect there. Pass `confirmExit: false`
 * to exit on the first press instead.
 *
 * No-ops entirely off native — on the web the browser owns Back, and there is
 * no app to exit.
 *
 * @param {object}  [options]
 * @param {string}  [options.hint]        Text shown when the exit press is armed.
 * @param {boolean} [options.confirmExit] Require a second press (default true).
 */
export default function useAndroidBackButton({ hint, confirmExit = true } = {}) {
  // Read through refs so a re-render with a new language never re-registers the
  // native listener (which would drop the armed state mid-confirm).
  const hintRef = useRef(hint);
  hintRef.current = hint;
  const confirmRef = useRef(confirmExit);
  confirmRef.current = confirmExit;

  useEffect(() => {
    let cancelled = false;
    let remove = null;
    // Timestamp until which a second Back press means "exit". 0 = not armed.
    let armedUntil = 0;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor?.isNativePlatform?.()) return;

      const { App } = await import('@capacitor/app');

      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          // Anything left to unwind — a route, or an overlay's guard entry.
          // Disarm: the user is navigating, not trying to leave.
          armedUntil = 0;
          window.history.back();
          return;
        }

        if (!confirmRef.current) {
          App.exitApp();
          return;
        }

        const now = Date.now();
        if (armedUntil && now < armedUntil) {
          App.exitApp();
          return;
        }

        armedUntil = now + EXIT_CONFIRM_MS;
        // Imported here, not at module scope: a static `sonner` import in a
        // hook that App.jsx loads would pull the toast library into the ENTRY
        // chunk, which vite.config.js explicitly watches for. GlobalToaster
        // has already loaded it by the time anyone can press Back.
        import('sonner')
          .then(({ toast }) => toast(hintRef.current, { duration: EXIT_CONFIRM_MS }))
          .catch(() => {/* no toast is survivable; the second press still exits */});
      });

      if (cancelled) { handle.remove(); return; }
      remove = () => handle.remove();
    })();

    return () => { cancelled = true; if (remove) remove(); };
  }, []);
}
