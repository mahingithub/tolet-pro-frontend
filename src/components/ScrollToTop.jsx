/**
 * ScrollToTop — a new page opens at its top.
 * ─────────────────────────────────────────────────────────────────────────────
 * BrowserRouter does not touch the scroll position, so a link clicked near the
 * bottom of a long page opened the next one at that same offset — clamped to
 * its end. From the homepage's "ফ্রি টুলগুলো দেখুন" that meant /meal-manager
 * landing at its footer. A few pages (HomePage, HowItWorks, SupportPage) reset
 * scroll themselves; FeatureLanding and ToLetHub never did, and every new page
 * would have had to remember to. So it happens once, here.
 *
 *   • PUSH / REPLACE only. A POP (Back, Forward, Android hardware back) is left
 *     to the browser's own scroll restoration, which returns you to where you
 *     were.
 *   • Pathname only. `?tab=` switches (useTabHistory) and filter query changes
 *     keep the reader where they are.
 *   • A #hash is left to the page — HowItWorks scrolls to #pricing itself.
 *
 * Layout effect, so the new page never paints one frame at the old offset.
 */

import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType === 'POP' || hash) return;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
