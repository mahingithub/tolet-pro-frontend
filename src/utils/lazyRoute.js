import { lazy } from 'react';

/**
 * lazyRoute — React.lazy() that survives a failed chunk download.
 * ───────────────────────────────────────────────────────────────────────────
 * Every route in App.jsx is its own JavaScript file. A plain
 * `lazy(() => import('./X'))` turns any failure to fetch that file into a
 * thrown error, and the ErrorBoundary's "Something went wrong." is the last
 * thing the user sees. There are exactly two ways that fetch fails in
 * production, and they want opposite handling:
 *
 *   1. THE CHUNK IS GONE FROM THE SERVER. The user has an index.html from an
 *      older deploy — cached, or open in a tab since before the release — and
 *      it names asset files that release has replaced. Nothing that happens in
 *      this tab will fix it; the document itself is stale. The fix is to
 *      reload once, which fetches the current HTML and the current chunk
 *      names.
 *
 *   2. THERE IS NO NETWORK. Reloading is the WORST thing to do here: it throws
 *      away a running app that could still show the wallet, the rent register
 *      and everything else already cached, in exchange for a boot that has the
 *      same missing file. So we retry briefly, then surface a tagged error and
 *      let ErrorBoundary say "you're offline" with a Retry button.
 *
 * `navigator.onLine` decides between them. It is a famously weak signal for
 * "can I reach the internet" — but the question here is only "is this device
 * plugged into a network at all", which is exactly what it answers, and it is
 * false in the case that matters (aeroplane mode, no data, no Wi-Fi).
 *
 * WHY A WRAPPER AND NOT A try/catch AT THE CALL SITE: React caches the
 * promise a lazy component was created with, including a rejected one. Once
 * `lazy(() => import('./Living'))` has failed, that component is permanently
 * broken for the life of the page — reconnecting the network and navigating
 * back to /living re-throws the SAME rejection without retrying. Retrying has
 * to happen inside the factory, before the promise React holds settles.
 */

// One reload per tab, ever. A reload loop on a broken deploy is worse than the
// error screen it is trying to avoid: the user gets a flickering page they
// can't read, can't screenshot and can't escape.
const RELOAD_FLAG = 'tp:chunk-reloaded';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const alreadyReloaded = () => {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return true; // storage blocked — treat as "already used up", never loop
  }
};

const markReloaded = () => {
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* ignore */
  }
};

/**
 * @param {() => Promise<any>} factory the `() => import('./Thing')` call
 * @param {string} [name] route name, for the console line when it fails
 */
export default function lazyRoute(factory, name) {
  return lazy(async () => {
    let lastErr;
    // Three attempts over ~1.2s. Covers the common case: a chunk requested the
    // moment the connection drops in and out, or while the service worker is
    // still filling its cache on a first run.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await factory();
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(300 * (attempt + 1));
      }
    }

    const online = typeof navigator === 'undefined' || navigator.onLine !== false;

    if (online && !alreadyReloaded()) {
      markReloaded();
      // Case 1: the document is out of date. Reload rather than reject — there
      // is nothing to show the user about a problem a reload just fixed.
      window.location.reload();
      // Never settles; the reload takes the page down first. Returning a
      // pending promise keeps React on the Suspense fallback instead of
      // flashing the error screen for the moment before the reload commits.
      return new Promise(() => {});
    }

    console.warn(`[route] failed to load chunk${name ? ` for ${name}` : ''}:`, lastErr);
    const err = new Error(
      `Failed to load the ${name || 'page'} module${online ? '' : ' (offline)'}`,
    );
    err.isChunkLoadError = true;
    err.offline = !online;
    err.cause = lastErr;
    throw err;
  });
}
