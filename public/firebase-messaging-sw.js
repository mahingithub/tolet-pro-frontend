/* firebase-messaging-sw.js — FCM background message handler. [Phase Call-6]
 * ───────────────────────────────────────────────────────────────────────────
 * This is a SEPARATE service worker from service-worker.js. Firebase Messaging
 * requires a worker at this exact path (/firebase-messaging-sw.js) to receive
 * push messages when the app/tab is closed or in the background.
 *
 * ► firebaseConfig below holds your real Firebase web config. These values are
 *   PUBLIC (they ship in every Firebase web app and are safe to commit) — they
 *   are NOT secrets. Service workers can't read import.meta.env, so they're
 *   hardcoded here. They match your VITE_FIREBASE_* env vars.
 *
 * ► The compat scripts below are the supported way to use Firebase inside a
 *   service worker. Keep the version in sync with your app's firebase package
 *   (11.x here — change both together if you upgrade).
 */

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// Real Firebase web config (public values).
const firebaseConfig = {
  apiKey: 'AIzaSyBHArOG7EPDBVVbtnt9J8YKdkb5MN9SV08',
  authDomain: 'to-let-pro-14e09.firebaseapp.com',
  projectId: 'to-let-pro-14e09',
  storageBucket: 'to-let-pro-14e09.firebasestorage.app',
  messagingSenderId: '100291826945',
  appId: '1:100291826945:web:78671cae8a8eb831a27700',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message → show an incoming-call notification with actions.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const callerName = data.callerName || 'Someone';
  const isVideo = data.type === 'video';

  const title = `${callerName} is calling`;
  const options = {
    body: isVideo ? 'Incoming video call' : 'Incoming voice call',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,         // stays until the user acts
    tag: data.callId || 'incoming-call', // collapse duplicate pushes
    data,                              // forwarded to notificationclick
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'decline', title: 'Decline' },
    ],
  };

  return self.registration.showNotification(title, options);
});

// Handle taps on the notification (or its action buttons).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  // Build a URL that opens the app on the messages screen. We pass the call
  // info + whether the user tapped Accept so the app can auto-join.
  const params = new URLSearchParams({
    incomingCall: '1',
    action: event.action || 'open',
    callId: data.callId || '',
    callerId: data.callerId || '',
    callerName: data.callerName || '',
    type: data.type || 'voice',
    roomId: data.roomId || '',
  });
  const url = `/messages?${params.toString()}`;

  // Focus an existing tab if one is open; otherwise open a new one.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});