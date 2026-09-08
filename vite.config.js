import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// A production build that still points at localhost is not a broken build — it
// is a build that SUCCEEDS and ships a dead app. That is exactly how an AAB got
// to the point of upload with `http://localhost:5000/api` baked in 41 times:
// there was no `.env.production`, so `vite build` fell through to `.env.local`,
// printed a clean green summary, and produced a bundle whose every API call
// resolved to the phone's own loopback.
//
// The website never showed the fault because Vercel injects its env vars at
// build time. Only the Android bundle, built from this machine's `dist/`, was
// affected — which is the one place nobody reloads to check.
//
// So the check has to be here, at the point of no return, and it has to be
// fatal. A warning scrolls past in a 200-line build log.
const assertProductionEnv = (mode) => {
  if (mode !== 'production') return
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const api = env.VITE_API_BASE_URL
  const fail = (why) => {
    throw new Error(
      `\n\n  Refusing to build for production: ${why}\n` +
        `  VITE_API_BASE_URL = ${api ?? '(unset)'}\n\n` +
        `  Create .env.production with the production API base, e.g.\n` +
        `    VITE_API_BASE_URL=https://api.toletpro.rent/api\n\n` +
        `  (.env.production is gitignored, so a fresh clone will not have it.)\n`,
    )
  }
  if (!api) fail('VITE_API_BASE_URL is not set')
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(api)) fail('VITE_API_BASE_URL points at localhost')
  // Android 9+ blocks cleartext HTTP by default, so an http:// API is not just
  // insecure here — it silently fails inside the Capacitor WebView.
  if (!/^https:\/\//.test(api)) fail('VITE_API_BASE_URL is not https://')
}

export default defineConfig(({ mode }) => {
  assertProductionEnv(mode)

  return {
  plugins: [react()],
  base: '/',

  build: {
    // The entry chunk was 4.4MB (1.17MB brotli) because every route was a
    // static import and every dependency landed in one file. Routes are now
    // lazy() in App.jsx; this splits the REMAINING weight — the vendor code —
    // along cache-lifetime lines.
    //
    // WHY SPLIT VENDORS AT ALL. A vendor chunk changes only when you upgrade a
    // dependency, but app code changes on every deploy. Bundled together, one
    // typo fix invalidates React, the router, Firebase and the charting library
    // in every returning user's cache, and they re-download the lot. Split, a
    // normal release invalidates only the small app chunk.
    //
    // Grouped by WHEN they load, not by what they do:
    //   react-vendor    — needed before first paint, on every route.
    //   firebase-vendor — the single heaviest dependency (auth + messaging).
    //                     Kept apart so a push-notification library upgrade
    //                     does not evict React from everyone's cache.
    //   Everything else stays in per-route chunks, where it is only fetched by
    //   the routes that actually import it.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) {
            return 'firebase-vendor';
          }
          return undefined;
        },
      },
    },

    // Vite's default warning fires at 500KB. Raised to 600 so the ENTRY chunk
    // (~521KB raw / 169KB gzip) does not cry wolf on every build.
    //
    // This build still trips the warning, and that is correct — HostDashboard
    // is ~700KB raw. It is a LAZY chunk, so only a landlord opening their own
    // dashboard ever downloads it, and it is not in anyone's critical path.
    // Worth splitting further one day; not worth blocking this fix on.
    //
    // What to watch: if the warning ever names `index-*.js`, a static import
    // has crept back into App.jsx and the entry chunk is regrowing — that is
    // the regression this whole config exists to prevent.
    chunkSizeWarningLimit: 600,

    // Source maps for production error reporting (Sentry/instrument.js). Vite
    // emits them as separate .map files, so they cost users nothing — the
    // browser fetches them only when devtools is open.
    sourcemap: true,
  },
  }
})
