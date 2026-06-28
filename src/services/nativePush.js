import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getCurrentToken } from './authService';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}`
  : 'http://localhost:5000/api';

/**
 * Request permission and register native FCM token with the backend.
 * Call this once after login on native platforms only.
 * On web, do nothing — web FCM is handled by fcmService.js.
 */
export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async ({ value: fcmToken }) => {
    const token = getCurrentToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/notifications/register-device`, {
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
  });
}
