import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getCurrentToken } from './authService';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}`
  : 'http://localhost:5000/api';

// Listeners are registered ONCE per app process, not once per call.
//
// registerNativePush() is called from NotificationBell's `isAuthed` effect,
// which re-runs on every auth transition and on remount. Each call used to add
// another 'registration' listener to the same plugin, so after three mounts one
// token fired three identical POSTs to /register-device. Harmless but wasteful,
// and it would have multiplied a deep link into three navigations once the
// action listener below landed.
let _listenersBound = false;
let _registering = null;

// ─── Cold-start deep link ──────────────────────────────────────────────────
// Tapping a notification while the app is CLOSED launches the process, and
// Capacitor fires pushNotificationActionPerformed almost immediately — well
// before React has mounted and handed us a navigate(). With nowhere to put it,
// that tap was lost and the app opened on its default home screen, which is the
// same "tapping it does nothing" symptom as having no listener at all.
//
// So the tap is parked here until a handler shows up. Only the LAST one is
// kept: a user who taps two notifications wants the second destination, and a
// queue would navigate twice in a row.
let _pendingTap = null;
let _navigate = null;

/**
 * Install the navigation handler. Called once from the React tree (see
 * NativePushRouter in App.jsx), which is the only place that owns a router.
 * Any tap that arrived before this point is replayed immediately.
 */
export function setPushNavigationHandler(fn) {
  _navigate = typeof fn === 'function' ? fn : null;
  if (_navigate && _pendingTap) {
    const tap = _pendingTap;
    _pendingTap = null;
    // Defer a frame so the caller's own mount effect finishes first — routing
    // out of a component while it is still mounting is how you get a React
    // "cannot update during render" warning and a half-painted screen.
    setTimeout(() => { try { _navigate(tap); } catch { /* non-fatal */ } }, 0);
  }
  return () => { if (_navigate === fn) _navigate = null; };
}

function deliverTap(notification) {
  // FCM only forwards the `data` dict to the client; title/body live on the
  // notification envelope. The server puts the routing fields (type, targetId,
  // bookingId, conversationId…) in `data`, so that is what the route table
  // needs. Shape it like a Notification row so notificationDestination() can
  // read it unchanged.
  const data = notification?.data || {};
  const payload = {
    id: data.notificationId || '',
    type: data.type || 'system',
    title: notification?.title || '',
    body: notification?.body || '',
    data,
  };
  if (_navigate) {
    try { _navigate(payload); } catch { /* non-fatal */ }
  } else {
    _pendingTap = payload;
  }
}

async function postRegistration(fcmToken) {
  const token = getCurrentToken();
  if (!token) return;
  try {
    // VITE_API_BASE_URL ALREADY ENDS IN "/api" — every other caller in the
    // codebase treats it that way (`${API}/notifications/...`). This line used
    // to add a second one and POST to `/api/api/notifications/register-device`,
    // which is a 404, so the device token was never stored and the phone could
    // not receive a push even once the rest of the native setup was in place.
    await fetch(`${API_BASE}/notifications/register-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        token: fcmToken,
        platform: Capacitor.getPlatform(), // 'android' | 'ios'
      }),
    });
  } catch { /* non-fatal */ }
}

function bindListeners() {
  if (_listenersBound) return;
  _listenersBound = true;

  PushNotifications.addListener('registration', ({ value }) => {
    postRegistration(value);
  });

  // Worth a log line rather than silence: a registration failure here is the
  // difference between "the user declined" and "google-services.json is for a
  // different Firebase project", and those have completely different fixes.
  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] FCM registration failed:', err?.error || err);
  });

  // THE TAP. Without this listener the OS notification opened the app and
  // nothing else happened — the user landed on whatever screen they left,
  // having to go find the thing they were just told about. A notification that
  // does not take you to its subject is barely a notification.
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    deliverTap(notification);
  });
}

/**
 * Request permission and register this device's FCM token with the backend.
 * Safe to call repeatedly: listeners bind once and an in-flight request is
 * shared rather than duplicated.
 *
 * On web this is never reached — pushSubscription.js routes to fcmService.
 */
export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;
  if (_registering) return _registering;

  _registering = (async () => {
    try {
      bindListeners();

      // checkPermissions() first so an already-granted user is not re-prompted,
      // and — more importantly — so a user who explicitly DENIED is not asked
      // again on every launch. requestPermissions() on a denied permission
      // returns instantly without a dialog anyway, but asking is a statement of
      // intent we should not keep making after someone has said no.
      let status = await PushNotifications.checkPermissions();
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions();
      }
      if (status.receive !== 'granted') return;

      await PushNotifications.register();
    } catch (err) {
      console.warn('[push] native registration failed:', err?.message || err);
    } finally {
      _registering = null;
    }
  })();

  return _registering;
}
