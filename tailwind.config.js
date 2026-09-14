import plugin from 'tailwindcss/plugin';

/**
 * SAFE-AREA UTILITIES
 * ──────────────────────────────────────────────────────────────────────────
 * Layer 2 of the three that keep the app off the system bars:
 *
 *   1. MEASURE  MainActivity.java works out how much of each system bar is
 *               still covering the WebView and publishes --tp-inset-*.
 *               index.css folds that into --sat / --sab / --bottom-nav-h.
 *   2. CONSUME  these utilities — so reserving an inset is as short as any
 *               other Tailwind class and nobody hand-writes calc() again.
 *   3. VERIFY   src/test/safeArea.test.js (static, CI) and
 *               src/utils/insetAudit.js (runtime, real device).
 *
 * Before this, 33 files reserved insets by hand in eleven different spellings
 * — `paddingTop: 'var(--sat)'`, `pt-[calc(var(--sat)+0.5rem)]`,
 * `pb-[calc(1.5rem+var(--sab))]` — which is how the map view ended up with a
 * flat `pt-3` and the AI launcher with a flat 110px.
 *
 *   pt-safe / pb-safe        the bare inset
 *   pt-safe-4 / pb-safe-4    the inset PLUS a spacing step (the common case:
 *                            the bar wants its own breathing room too)
 *   top-safe                 top: var(--sat), for a bar pinned to the edge
 *   pb-rail / bottom-rail    clear the mobile rail, which is 64px of touch
 *                            target PLUS the gesture inset — never a literal
 *   pb-rail-6 / bottom-rail-6  the rail plus a spacing step
 *   h-rail                   the rail's own height
 *
 * The inset is always ADDED, never absorbed: every one of these resolves to
 * calc(<inset> + <your value>), so a phone with no inset keeps the exact
 * spacing you asked for and a phone with one gets that spacing clear of the
 * bar. Tailwind preflight makes everything border-box, which is what made the
 * original rail bug ("h-64px with padding-bottom: inset") crush its contents.
 */
const safeArea = plugin(({ addUtilities, matchUtilities, theme }) => {
  addUtilities({
    '.pt-safe': { paddingTop: 'var(--sat)' },
    '.pb-safe': { paddingBottom: 'var(--sab)' },
    '.mt-safe': { marginTop: 'var(--sat)' },
    '.mb-safe': { marginBottom: 'var(--sab)' },
    '.top-safe': { top: 'var(--sat)' },
    '.bottom-safe': { bottom: 'var(--sab)' },
    '.h-safe-top': { height: 'var(--sat)' },
    '.h-safe-bottom': { height: 'var(--sab)' },
    '.pb-rail': { paddingBottom: 'var(--bottom-nav-h)' },
    '.bottom-rail': { bottom: 'var(--bottom-nav-h)' },
    '.h-rail': { height: 'var(--bottom-nav-h)' },
  });

  // The "+ a spacing step" variants, driven off the normal spacing scale so
  // `pt-safe-3` lines up with `pt-3` on a device with no inset.
  const scaled = (prop, token) => (value) => ({ [prop]: `calc(${token} + ${value})` });
  const spacing = () => ({ values: theme('spacing'), supportsNegativeValues: false });

  matchUtilities({ 'pt-safe': scaled('paddingTop', 'var(--sat)') }, spacing());
  matchUtilities({ 'pb-safe': scaled('paddingBottom', 'var(--sab)') }, spacing());
  matchUtilities({ 'mt-safe': scaled('marginTop', 'var(--sat)') }, spacing());
  matchUtilities({ 'mb-safe': scaled('marginBottom', 'var(--sab)') }, spacing());
  matchUtilities({ 'top-safe': scaled('top', 'var(--sat)') }, spacing());
  matchUtilities({ 'bottom-safe': scaled('bottom', 'var(--sab)') }, spacing());
  matchUtilities({ 'pb-rail': scaled('paddingBottom', 'var(--bottom-nav-h)') }, spacing());
  matchUtilities({ 'bottom-rail': scaled('bottom', 'var(--bottom-nav-h)') }, spacing());
});

/** @type {import('tailwindcss').Config} */
export default {
  // Class-based dark mode: SettingsContext toggles `.dark` on <html> from the
  // user's theme preference (light/dark/system). `dark:` variants opt in per
  // component; until they do, the theme still applies via color-scheme.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Your existing brand colors (Kept for backward compatibility)
        brandRed: '#ba0036',
        darkBg: '#0f172a',
        
        // 🎨 NEW: Bangladesh-Inspired Premium Palette
        emerald: {
          50: '#ECF7F2',   // Light bg / Success state
          100: '#CDE8DB',  // Muted borders
          500: '#1B8553',  // Primary Green (Rich Forest)
          600: '#136B41',  // Hover state
          800: '#0A4529',  // Active state
          900: '#062E1A',  // Deep dark green
        },
        crimson: {
          50: '#FDF2F5',   // Light bg / Error state
          100: '#FBE5EB',  // Muted borders
          500: '#ba0036',  // Secondary Red (Synced with brandRed)
          600: '#90002A',  // Hover state
          800: '#60001C',  // Active state
          900: '#400013',  // Deep dark red
        },
        gold: {
          500: '#D99B28',  // Accent / Highlights / Ratings
        },
        slate: {
          50: '#F8F9FA',   // App Main Background
          200: '#E5E7EB',  // Dividers / Borders
          600: '#4B5563',  // Subtext / Paragraphs
          800: '#1F2937',  // Primary Body Text
          900: '#111827',  // Headings (H1, H2, etc.)
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'border-shimmer': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        }
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'border-shimmer': 'border-shimmer 3s ease infinite',
      }
    },
  },
  plugins: [safeArea],
}