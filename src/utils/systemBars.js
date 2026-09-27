import { SystemBars, SystemBarsStyle } from '@capacitor/core';

import { isInsideNativeApp } from '../hooks/useAppInstall';

/**
 * systemBars.js — tell Android which theme we actually painted.
 * ───────────────────────────────────────────────────────────────────────────
 * THE BUG THIS FIXES: the clock, the battery percentage and the signal bars
 * disappear at the top of the screen.
 *
 * Nothing is hiding them and nothing is drawn over them. They are being
 * painted WHITE onto our WHITE header, and the reason is that two independent
 * things both decide "is this a light UI or a dark one", and they were never
 * introduced to each other:
 *
 *   • OURS. SettingsContext.resolveTheme() picks the app's theme, and inside
 *     the native shell it returns 'light' unconditionally — see the comment
 *     there: only ~19 files carry `dark:` styles, so the app is deliberately
 *     light until the screens are ready. The user can still choose dark from
 *     the theme widget.
 *
 *   • ANDROID'S. Capacitor's built-in SystemBars plugin decides the icon
 *     colour from the PHONE's night mode and nothing else:
 *
 *         getStyleForTheme()  →  UI_MODE_NIGHT_YES ? DARK : LIGHT
 *         setStyle(style)     →  setAppearanceLightStatusBars(style != DARK)
 *
 *     It runs that once at startup and again on every configuration change.
 *
 * So on a phone set to dark mode — which is a lot of phones — Android decides
 * the bars are over a dark surface and paints its icons white, while we paint
 * a white header underneath them. White on white. The status bar is still
 * there, still reporting the time; it is simply the same colour as what is
 * behind it. The same arithmetic makes the gesture bar's pill vanish at the
 * bottom, which is why this sets both bars at once (omitting `bar` applies to
 * the status bar AND the gesture bar).
 *
 * The fix is to stop letting the OS guess. We know which theme we rendered,
 * so we say so.
 *
 * ► NAMING TRAP, because it reads backwards. Capacitor's style names describe
 *   the BAR CONTENT, not the surface under it:
 *       SystemBarsStyle.Light → dark icons, for a LIGHT background  ← our light theme
 *       SystemBarsStyle.Dark  → white icons, for a DARK background  ← our dark theme
 *   Passing the effective theme name straight through would invert it.
 *
 * ► WHY THIS STICKS. The plugin stores whatever style it was last given and
 *   re-applies THAT on a configuration change, not the OS default — so one
 *   call survives rotation, split screen, and the user flipping the phone's
 *   own dark mode while the app is open.
 *
 * ► WEB IS UNTOUCHED. Off the native shell there is no status bar to colour,
 *   and the browser takes its cue from <meta name="theme-color"> instead.
 */

/**
 * Point the native status bar and gesture bar at the theme we just rendered.
 * Safe to call anywhere: a no-op on the website, and it never throws or
 * rejects into the caller.
 *
 * @param {'light'|'dark'} effective the theme actually applied to <html>,
 *   i.e. the return of resolveTheme() — not the user's raw 'system' setting.
 */
export function syncSystemBars(effective) {
  if (!isInsideNativeApp()) return;
  try {
    // Light UI wants dark icons; dark UI wants white ones. See the naming
    // trap above — this line is the whole fix.
    const style = effective === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
    SystemBars.setStyle({ style })?.catch?.(() => {
      /* bridge not up yet, or an OEM that refuses — the bars keep the OS
         default, which is what they do today. Never worth an error. */
    });
  } catch {
    /* plugin missing entirely (old shell, a test environment) — ignore */
  }
}

export default syncSystemBars;
