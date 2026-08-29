/*
 * DeepLinkHandler.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Makes a www.toletpro.rent link open INSIDE the installed app instead of
 * bouncing the user into a mobile browser.
 *
 * WHY THIS MATTERS MOST FOR INVITES
 * A landlord's invite QR is scanned by a tenant standing in the building. If
 * that opens Chrome, the tenant lands logged-out on a web view, has to sign in
 * again, and uploads their NID through a browser that does not have the camera
 * permissions the app already holds. With the app installed, none of that
 * happens — they land on the join screen, already signed in.
 *
 * HOW IT WORKS
 * Android App Links and iOS Universal Links both hand the app the ORIGINAL
 * https:// URL rather than a custom scheme. That is the point of them: the same
 * link works whether or not the app is installed, so a landlord only ever
 * shares one URL and never has to care which of the two the tenant has.
 *
 *   • App installed + domain verified → Android/iOS route it here.
 *   • App not installed              → it opens the website, as before.
 *
 * TWO ENTRY POINTS, BOTH NEEDED
 *   1. `appUrlOpen` — the app is already running (warm start). Fires reliably.
 *   2. `getLaunchUrl()` — the link COLD-STARTED the app. On a cold start the
 *      listener is frequently registered after the event has already been
 *      dispatched, so relying on appUrlOpen alone loses exactly the case that
 *      matters most: a tenant who does not have the app open scanning a QR.
 *
 * WHY IT LIVES INSIDE THE ROUTER
 * It needs useNavigate(). Routing with `window.location` would work, but it
 * would reload the whole web view and throw away the auth context the app just
 * restored — which is the one advantage opening in the app had.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Paths this app is willing to handle from an external link.
//
// An allow-list rather than "navigate to whatever arrives". The URL comes from
// outside the app, and turning an arbitrary attacker-supplied path into an
// in-app navigation is how a link ends up driving someone to a screen they did
// not ask for. /join is what the invite system needs; add to this list
// deliberately, not by loosening it to a catch-all.
const ROUTABLE = [/^\/join\/[A-Za-z0-9]{8,64}\/?$/];

/**
 * Reduce a deep link to an in-app path, or null when we won't handle it.
 * Exported for the unit test — the parsing is the part worth pinning down.
 */
export function pathFromDeepLink(url, { allowedHosts = [] } = {}) {
  if (!url || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // https only. A custom scheme (toletpro://) is not configured, and accepting
  // one "just in case" would mean accepting links from any app on the device.
  if (parsed.protocol !== 'https:') return null;

  // The host must be ours. Android verifies this before it ever reaches us, but
  // this function is also the unit under test and the iOS path is not wired up
  // yet, so it does not assume the platform already checked.
  if (allowedHosts.length && !allowedHosts.includes(parsed.hostname)) return null;

  const path = parsed.pathname.replace(/\/{2,}/g, '/');
  if (!ROUTABLE.some((re) => re.test(path))) return null;

  // Query and hash are dropped deliberately: nothing in ROUTABLE reads them,
  // and passing them through would widen what an external link can influence.
  return path;
}

// Hosts whose links this build will follow. Derived from the same public app
// URL the backend builds invite links with (see utils/inviteToken.js), so a
// deployment that changes domain does not silently stop routing.
function allowedHosts() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL || '';
  // www is the canonical host and the one the Android manifest verifies. The
  // apex is accepted too: it is not claimed in the manifest (it redirects, so
  // it cannot verify), but a link that reaches this handler by any other route
  // — a push notification payload, a pasted URL — should still resolve rather
  // than be dropped for a missing "www.".
  const hosts = ['www.toletpro.rent', 'toletpro.rent'];
  if (configured) {
    try { hosts.push(new URL(configured).hostname); } catch { /* ignore a malformed env value */ }
  }
  // The web build handles its own origin through the router already; including
  // it here is harmless and covers a custom domain served from the same code.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    hosts.push(window.location.hostname);
  }
  return [...new Set(hosts)];
}

export default function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let remove = null;

    (async () => {
      // Web build: there is no Capacitor bridge and the browser has already
      // routed the URL. Importing the plugin is harmless but pointless, so it
      // is skipped rather than loaded on every page view.
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor?.isNativePlatform?.()) return;

      const { App } = await import('@capacitor/app');
      const hosts = allowedHosts();

      const go = (url) => {
        const path = pathFromDeepLink(url, { allowedHosts: hosts });
        if (path) navigate(path, { replace: true });
      };

      // (1) Warm start — the app was already running.
      const handle = await App.addListener('appUrlOpen', ({ url }) => go(url));
      if (cancelled) { handle.remove(); return; }
      remove = () => handle.remove();

      // (2) Cold start — the link is what launched the app, and the event may
      // already have fired before this effect ran.
      try {
        const launch = await App.getLaunchUrl();
        if (!cancelled && launch?.url) go(launch.url);
      } catch { /* no launch URL is the normal case */ }
    })();

    return () => { cancelled = true; if (remove) remove(); };
  }, [navigate]);

  return null;
}
