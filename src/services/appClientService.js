/**
 * appClientService.js — tell the server this account just opened the app.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * The admin console's "app installed" column was derived from FCM device
 * tokens, and a device token only exists once the user has ACCEPTED the
 * notification prompt. On Android 13+ that prompt is opt-in and most people
 * decline it, so a user with the app installed on their phone was listed as
 * not having it — and silently excluded from every campaign aimed at app users.
 *
 * An app launch needs no permission at all, so it is the honest signal. One
 * call per app load, fire-and-forget: nothing in the app waits on it and a
 * failure is swallowed.
 *
 * WHAT IS SENT: a random per-install id, the platform, and how the app is being
 * run. No device fingerprint, no advertising id, nothing the user did not
 * already tell us by signing in.
 */

import { getCurrentToken } from './authService';
import { isStandalonePwa } from '../utils/platform';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const DEVICE_ID_KEY = 'toletpro_device_id';

// One report per page load. A tab that stays open for a week does not need to
// keep saying so, and the server only stores a lastSeenAt.
let reported = false;

/**
 * A stable id for THIS INSTALL, minted on first launch.
 *
 * Deliberately not derived from anything about the device: it is a random
 * value in this origin's storage, so uninstalling (or clearing site data)
 * legitimately produces a new one, and it cannot be correlated with anything
 * outside the app.
 */
function deviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh = (window.crypto?.randomUUID?.()
      // randomUUID needs a secure context; a plain-http dev origin has none.
      || `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing / storage disabled. Without persistence every launch
    // would mint a new id and inflate the device list, so report nothing.
    return '';
  }
}

/**
 * Report the launch. Resolves either way — callers should not await it.
 * @returns {Promise<void>}
 */
export async function reportAppOpen() {
  if (reported) return;
  const token = getCurrentToken?.();
  // Anonymous launches cannot be attributed to anyone, so there is nothing to
  // record. The caller re-runs this once the user is authenticated.
  if (!token) return;

  const id = deviceId();
  if (!id) return;

  let platform = 'web';
  let kind = isStandalonePwa() ? 'pwa' : 'browser';
  try {
    // Dynamic import so the web build does not pull the Capacitor bridge into
    // the entry chunk for a call that is a no-op there.
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor?.isNativePlatform?.()) {
      platform = Capacitor.getPlatform(); // 'android' | 'ios'
      kind = 'native';
    }
  } catch { /* web build without the bridge — the defaults above are right */ }

  reported = true;
  try {
    await fetch(`${BASE}/api/app/opened`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        deviceId: id,
        platform,
        kind,
        appVersion: import.meta.env.VITE_APP_VERSION || '',
      }),
      keepalive: true,
    });
  } catch {
    // Offline, or the endpoint is not deployed yet. Allow a later attempt in
    // this session rather than marking the launch as reported.
    reported = false;
  }
}
