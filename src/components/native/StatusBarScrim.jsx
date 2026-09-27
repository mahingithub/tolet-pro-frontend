import { useEffect, useState } from 'react';
import { isNativeApp } from '../../utils/nativeExperience';

/**
 * A backdrop behind the status bar once the page has scrolled.
 *
 * The app is edge-to-edge on Android (see --sat in index.css): the WebView
 * runs underneath the status bar, and each screen's header reserves that strip
 * with `padding-top: var(--sat)`. Most of those headers are not sticky, so the
 * moment the page scrolls the header leaves and nothing is behind the clock —
 * on the landlord dashboard, "Haji Bari 75%" scrolled straight through the time
 * and battery icons.
 *
 * This paints a header-like surface into that strip, but only while scrolled:
 * at the top the screen's own header is there, and anything full-bleed is left
 * as designed. The surface follows the app theme, which is also what decides
 * the status bar's icon colour (utils/systemBars.js), so the icons stay legible.
 *
 * z-[45]: above page content and sticky headers, below every sheet and modal —
 * the band the website's download banner uses, which never renders in the app.
 * pointer-events-none: the strip belongs to the OS, so taps never reach us.
 */
export default function StatusBarScrim() {
  const native = isNativeApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!native) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 4);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [native]);

  if (!native) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-x-0 top-0 z-[45] h-[var(--sat)] pointer-events-none bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl transition-opacity duration-200 ${
        scrolled ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
