const getCurrentToken = () => window.localStorage.getItem('auth:token');
const API_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : 'http://localhost:5000/api';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPushNotifications = async () => {
  // NATIVE FIRST. Inside the Android WebView this function used to run its full
  // web path and quietly achieve nothing: `serviceWorker` and `PushManager` are
  // present, so neither guard below trips, but a Capacitor WebView never
  // receives a Web Push — delivery goes through FCM to the app process, not to
  // a service worker. The app therefore appeared to subscribe, stored nothing
  // the server could push to, and no notification ever arrived.
  //
  // Routing to the FCM registration here rather than at the call sites keeps the
  // two existing callers (NotificationBell) platform-agnostic — they ask for
  // "push", and the platform decides what that means.
  //
  // Imported dynamically to break a cycle: authService imports this module for
  // unsubscribe, and nativePush imports authService for the bearer token. A
  // static import would close that loop. It also keeps the Capacitor plugins out
  // of the web bundle, where they are dead code.
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { registerNativePush } = await import('../services/nativePush.js');
    await registerNativePush();
    return null;
  }

  if (!('serviceWorker' in navigator)) return null;
  if (!('PushManager' in window)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.warn('VITE_VAPID_PUBLIC_KEY is missing');
        return null;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    await saveSubscriptionToBackend(subscription);
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
};

const saveSubscriptionToBackend = async (subscription) => {
  const token = getCurrentToken();
  if (!token) return;
  try {
    await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription })
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
  }
};

/**
 * Tear down this device's push subscription.
 *
 * `token` may be passed explicitly by callers that have already cleared the
 * stored session (logout does this so the UI can flip instantly). Without it
 * the token read below would come back null once storage is wiped, the DELETE
 * would be skipped, and the server would keep pushing to a signed-out device.
 */
export const unsubscribeFromPushNotifications = async ({ token: explicitToken } = {}) => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const token = explicitToken || getCurrentToken();
      if (token) {
        await fetch(`${API_URL}/push/subscribe`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      }
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Error unsubscribing:', error);
  }
};
