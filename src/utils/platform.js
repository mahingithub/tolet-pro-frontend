/**
 * platform.js
 * ──────────────────────────────────────────────────────────────────────────
 * Tiny helpers for telling apart "the website open in a browser tab" from
 * "the app installed on the device" (native Capacitor build OR an installed
 * PWA running in standalone display mode).
 *
 * This distinction drives the session policy:
 *   • Website  → sessions persist for 1 year, then local data is wiped and the
 *                user must sign in again (a sane security backstop).
 *   • Installed app → the session stays put until the user logs out or
 *                uninstalls the app, so data is always there on next launch.
 */

let cachedCapacitorNative = null;

/** True when running inside the native Capacitor shell (Android / iOS). */
function isNativeCapacitor() {
  if (cachedCapacitorNative !== null) return cachedCapacitorNative;
  try {
    // Capacitor injects a global; reading it avoids a hard import dependency
    // in environments (tests, SSR) where the package isn't present.
    const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
    cachedCapacitorNative = !!(cap && typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform()
      : cap?.isNative);
  } catch {
    cachedCapacitorNative = false;
  }
  return cachedCapacitorNative;
}

/** True when the PWA has been installed and is running in standalone mode. */
export function isStandalonePwa() {
  try {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
      window.matchMedia?.('(display-mode: minimal-ui)')?.matches === true ||
      window.navigator?.standalone === true // iOS Safari "Add to Home Screen"
    );
  } catch {
    return false;
  }
}

/**
 * True when the app is "installed" — either the native build or an installed
 * PWA. Used to decide whether the website session cap applies (it does NOT for
 * installed apps — those never auto-logout).
 */
export function isInstalledApp() {
  return isNativeCapacitor() || isStandalonePwa();
}
