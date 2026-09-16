/**
 * iosViewport.js — stop iPhone's zoom-on-type.
 * ──────────────────────────────────────────────────────────────────────────
 * iOS WebKit (Safari, the home-screen web app, and Chrome/Firefox on iOS, which
 * are WebKit underneath) zooms the whole page in when a text field whose font
 * is smaller than 16px takes focus, and back out as focus or layout moves.
 * Nearly every field in this app is 14px (`text-sm`), so on an iPhone the page
 * lurched in and out while someone was typing — reported on an iPhone 13.
 * Android Chrome never does this, which is why it only ever showed on iOS.
 *
 * `maximum-scale=1` is what turns that auto-zoom off. It is added on iOS ONLY:
 *   • Everywhere else it would block pinch-zoom, which people with low vision
 *     rely on (and which Lighthouse flags as an accessibility failure).
 *   • iOS Safari has ignored maximum-scale for pinch-zoom since iOS 10, so an
 *     iPhone user loses the focus zoom and nothing else.
 *
 * The fields keep their 14px text on purpose: bumping them to 16px would fix it
 * too, but it changes every form in the app, and a blanket size bump has
 * already been tried and reverted as cluttered.
 *
 * The rest of the viewport string is left exactly as it is — `viewport-fit=cover`
 * in particular, which Capacitor's SystemBars plugin looks for (see index.html).
 */

/** True for iPhone, iPod, and iPad — including iPadOS, which reports itself as a Mac. */
export function isIosWebKit(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

/**
 * Append `maximum-scale=1` to the viewport meta on iOS. Idempotent.
 * @returns {boolean} whether the tag was changed.
 */
export function preventIosInputZoom(
  doc = typeof document !== 'undefined' ? document : undefined,
  nav = typeof navigator !== 'undefined' ? navigator : undefined,
) {
  if (!doc || !isIosWebKit(nav)) return false;
  const meta = doc.querySelector('meta[name="viewport"]');
  if (!meta) return false;
  const content = meta.getAttribute('content') || '';
  if (/maximum-scale\s*=/.test(content)) return false;
  meta.setAttribute('content', `${content.replace(/[\s,]+$/, '')}, maximum-scale=1`);
  return true;
}
