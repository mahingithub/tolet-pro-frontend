import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
})
