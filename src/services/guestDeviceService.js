/**
 * guestDeviceService.js — tell the server this INSTALL exists, before we know
 * who is holding it.
 * ──────────────────────────────────────────────────────────────────────────
 * appClientService.js reports a launch once the user is signed in. This is its
 * twin for everybody else: somebody who installed the app, looked around, and
 * has not signed up. Until this existed they were completely invisible — we
 * knew nothing about them and could say nothing to them, ever.
 *
 * WHAT IS SENT: the same random per-install id appClientService already mints,
 * the platform, and the FCM token IF the device happens to have granted
 * notification permission. No phone number, no account, nothing that identifies
 * a person.
 *
 * ── A DEVICE WITH NO TOKEN IS STILL WORTH REGISTERING ─────────────────────
 * On Android 13+ notification permission is a runtime grant, and plenty of
 * people decline it. That used to mean we lost them. It no longer does: a
 * registered device with no token cannot be pushed, but it CAN be handed a tip
 * to show inside the app on its next launch — see fetchPendingTip() below.
 *
 * So this deliberately registers whether or not a token is available, and never
 * asks for notification permission itself. Asking is a decision about
 * interrupting somebody, and it belongs where the app already makes it.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

// The SAME key appClientService.js uses, on purpose. One install, one id —
// otherwise the guest row and the signed-in row describe different devices and
// the hand-over on login can never match them up.
const DEVICE_ID_KEY = 'toletpro_device_id';

// One registration per page load. A tab open for a week does not need to keep
// saying so; the server only stores lastSeenAt.
let reported = false;

function deviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh = (window.crypto?.randomUUID?.()
      || `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing. Without persistence every launch would mint a new id
    // and a new row, so register nothing at all.
    return '';
  }
}

/** Platform + kind, matching what the server's enums accept. */
async function describeClient() {
  let platform = 'web';
  let kind = 'browser';
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor?.isNativePlatform?.()) {
      platform = Capacitor.getPlatform(); // 'android' | 'ios'
      kind = 'native';
    } else if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
      kind = 'pwa';
    }
  } catch { /* web build without the bridge — defaults are right */ }
  return { platform, kind };
}

/**
 * The FCM token, but ONLY if this device already granted permission.
 *
 * Never prompts. A registration call is a background heartbeat, and a
 * permission dialog that appears because of one would be a dialog nobody asked
 * for at a moment nobody chose.
 */
async function existingPushToken() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor?.isNativePlatform?.()) return '';

    const { PushNotifications } = await import('@capacitor/push-notifications');
    const status = await PushNotifications.checkPermissions();
    if (status.receive !== 'granted') return '';

    // Already granted, so register() resolves without a prompt and the
    // 'registration' listener in services/nativePush.js receives the token.
    // We read it from where that listener parks it rather than racing it.
    return window.__toletproFcmToken || '';
  } catch {
    return '';
  }
}

/**
 * Register this install. Resolves either way — callers should not await it.
 * @param {string} language 'bn' | 'en' — the app's current language
 */
export async function reportGuestDevice(language = 'en') {
  if (reported) return;
  const id = deviceId();
  if (!id) return;

  reported = true;
  try {
    const { platform, kind } = await describeClient();
    const token = await existingPushToken();

    await fetch(`${BASE}/api/app/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: id,
        token,
        platform,
        kind,
        language: language === 'bn' ? 'bn' : 'en',
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

/**
 * Ask for a feature tip to show in-app, if one is due for this device.
 *
 * THE TIP IS CONSUMED BY THIS CALL. The server marks it delivered as it hands
 * it over, because the caller displays what it receives — a separate
 * acknowledge step would only add a round trip in which the app can be closed
 * and the tip lost. So: only call this when you are going to show the result.
 *
 * @returns {Promise<{step,title,body,path,image}|null>}
 */
export async function fetchPendingTip() {
  const id = deviceId();
  if (!id) return null;
  try {
    const res = await fetch(
      `${BASE}/api/app/tips/pending?deviceId=${encodeURIComponent(id)}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.tip || null;
  } catch {
    return null;
  }
}
