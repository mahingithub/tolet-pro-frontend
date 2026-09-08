import { CapacitorUpdater } from '@capgo/capacitor-updater';
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'
import { setupFetchInterceptor } from './utils/fetchInterceptor.js'

// Setup global fetch interceptor for auto token refresh
setupFetchInterceptor()

// ─── Sentry: frontend error tracking (Phase 7) ─────────────────────────────
// DSN comes from VITE_SENTRY_DSN (set it on Vercel). If unset, Sentry stays
// disabled — the app runs normally. Only enabled in production builds so dev
// noise doesn't fill your Sentry quota.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Capture 10% of transactions for performance — plenty for beta, stays in
    // the free tier. Raise toward 1.0 for more detail.
    tracesSampleRate: 0.1,
    // Session Replay is OFF by default (it can be heavy + privacy-sensitive).
    // Enable later if you want to watch what led to an error.
  });
}


try {
  CapacitorUpdater.notifyAppReady();
} catch (e) {
  console.warn('CapacitorUpdater not available in this environment');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// ─── PWA: register the service worker (Phase Call-5) ───────────────────────
// Production only — in dev it interferes with Vite hot-reload.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Once the worker is running, tell it to pull the rest of the route chunks
  // into the cache. This is what makes /living and /host-dashboard openable on
  // a phone that has never been to those routes — see the precache comment in
  // public/service-worker.js.
  //
  // It is deliberately the LAST thing that happens on a page load: after the
  // app has painted (`app-ready`, dispatched by AppLayout) and after the main
  // thread goes idle. Warming ~5MB of chunks matters a lot on the day the
  // network disappears and not at all before then, so it must never compete
  // with the page the user is waiting for.
  // `ready`, not the registration this page created. On a FIRST visit the
  // registration resolves while the worker is still installing, so `.active`
  // is null and there is no controller yet — the launch that most needs the
  // warm is exactly the launch that would have skipped it. `ready` waits for
  // an activated worker.
  const send = () => {
    navigator.serviceWorker.ready
      .then((reg) => { if (reg.active) reg.active.postMessage({ type: 'WARM_CACHE' }); })
      .catch(() => {});
  };
  const idle = () => (window.requestIdleCallback
    ? window.requestIdleCallback(send, { timeout: 10000 })
    : window.setTimeout(send, 3000));

  const warm = () => {
    window.addEventListener('app-ready', () => window.setTimeout(idle, 1500), { once: true });
    // `app-ready` fires from AppLayout's first frame. If React never gets that
    // far — a route that crashed, a boot that stalled — warming is MORE
    // important, not less, so fall back to a timer rather than silently
    // skipping it. The worker ignores the second request; warmRouteAssets()
    // there is memoised.
    window.setTimeout(idle, 12000);
  };

  const register = () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(warm)
      .catch((err) => {
        console.warn('[pwa] service worker registration failed:', err);
      });
  };

  // Registering on 'load' alone loses the race whenever the event has already
  // fired by the time this module runs — a bfcache restore, a prerendered
  // document, a slow chunk that arrives after load. When that happened the
  // listener simply never ran and the device ended up with NO service worker,
  // i.e. no offline support at all, with nothing logged to say so.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}