// fcmService.js — Firebase Cloud Messaging client. [Phase Call-6]
// ───────────────────────────────────────────────────────────────────────────
// Requests notification permission, gets the FCM device token, and registers
// it with our backend so the user can receive incoming-call pushes when the
// PWA is closed/backgrounded.
//
// Self-contained: it initialises its own Firebase app instance from the
// VITE_FIREBASE_* env vars so it doesn't depend on how the rest of the app
// sets up Firebase (phone auth). Safe to call repeatedly.
//
// ► REQUIRES these env vars (Vercel + .env.local):
//     VITE_FIREBASE_API_KEY
//     VITE_FIREBASE_AUTH_DOMAIN
//     VITE_FIREBASE_PROJECT_ID
//     VITE_FIREBASE_MESSAGING_SENDER_ID
//     VITE_FIREBASE_APP_ID
//     VITE_FIREBASE_VAPID_KEY   ← the Web Push certificate key pair
//
// ► Foreground messages (tab open) are handled here via onMessage; background
//   messages are handled by /public/firebase-messaging-sw.js.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getCurrentToken } from './authService';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/notifications`
  : 'http://localhost:5000/api/notifications';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
let _onMessageBound = false;

// Get (or lazily create) a Messaging instance, but only if the browser
// supports it (e.g. not old iOS, not some in-app webviews).
async function getMessagingSafe() {
  try {
    if (!(await isSupported())) return null;
    if (!firebaseConfig.apiKey || !VAPID_KEY) {
      console.warn('[fcm] Firebase/VAPID env vars missing — push disabled.');
      return null;
    }
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    if (!_messaging) _messaging = getMessaging(app);
    return _messaging;
  } catch (err) {
    console.warn('[fcm] messaging unavailable:', err?.message);
    return null;
  }
}

async function postToBackend(path, body) {
  const auth = getCurrentToken();
  if (!auth) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Ask for notification permission, get a token, and register it.
 * Call this AFTER login (when you have an auth token). No-ops safely if the
 * user denies permission or the browser can't do push.
 *
 * @returns {Promise<string|null>} the FCM token, or null
 */
export async function enableCallNotifications() {
  // Must be served over HTTPS (or localhost) and have Notification API.
  if (typeof Notification === 'undefined') return null;

  const messaging = await getMessagingSafe();
  if (!messaging) return null;

  // Ask permission if not already decided.
  let permission = Notification.permission;
  if (permission === 'default') {
    try { permission = await Notification.requestPermission(); } catch { return null; }
  }
  if (permission !== 'granted') return null;

  try {
    // The background SW must be registered for getToken to work. We point
    // getToken at /firebase-messaging-sw.js explicitly so it doesn't depend
    // on registration order with the main service-worker.js.
    let swReg;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return null;

    await postToBackend('/register-device', { token, platform: 'web' });
    bindForegroundHandler(messaging);
    return token;
  } catch (err) {
    console.warn('[fcm] enableCallNotifications failed:', err?.message);
    return null;
  }
}

// Show a notification for messages that arrive while the tab is in the
// FOREGROUND (background ones are handled by the SW). Bound once.
function bindForegroundHandler(messaging) {
  if (_onMessageBound) return;
  _onMessageBound = true;
  onMessage(messaging, (payload) => {
    const data = payload.data || {};
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    // Only auto-show if the tab is actually hidden; if it's visible the in-app
    // call UI (CALL_RINGING over socket) already handles it.
    if (document.visibilityState === 'visible') return;
    const callerName = data.callerName || 'Someone';
    const isVideo = data.type === 'video';
    try {
      new Notification(`${callerName} is calling`, {
        body: isVideo ? 'Incoming video call' : 'Incoming voice call',
        icon: '/icons/icon-192.png',
        tag: data.callId || 'incoming-call',
      });
    } catch { /* ignore */ }
  });
}

/** Turn off push for this device (e.g. on logout). */
export async function disableCallNotifications() {
  try {
    const messaging = await getMessagingSafe();
    if (!messaging) return;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
    if (token) await postToBackend('/unregister-device', { token });
  } catch { /* ignore */ }
}

/** Toggle the server-side call-notification preference. */
export async function setCallNotificationPref(enabled) {
  return postToBackend('/call-pref', { enabled: !!enabled });
}

export default { enableCallNotifications, disableCallNotifications, setCallNotificationPref };
