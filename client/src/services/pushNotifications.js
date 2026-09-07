import { getApp, initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

let cachedConfig = null;

async function fetchPublicConfig() {
  if (cachedConfig) return cachedConfig;
  const res = await fetch(`${API_BASE}/config/firebase-public`);
  cachedConfig = await res.json();
  return cachedConfig;
}

/** Whether push is even worth offering — browser support + Firebase configured server-side. */
export async function isPushAvailable() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try {
    const config = await fetchPublicConfig();
    return !!config.configured;
  } catch {
    return false;
  }
}

/**
 * Registers this browser for push notifications: service worker, permission
 * prompt, FCM token, and posts the token to the backend. Call only from an
 * explicit user action (a button click) — browsers block/annoy on
 * unsolicited permission prompts. Silently no-ops (returns false) if push
 * isn't available yet (unsupported browser, or Firebase not configured).
 *
 * @param {object} apiClient    the admin or employee axios instance
 * @param {string} registerPath e.g. '/notifications/register-device'
 */
export async function enablePush(apiClient, registerPath) {
  if (!(await isPushAvailable())) {
    toast.error('Push notifications are not available yet.');
    return false;
  }

  try {
    const config = await fetchPublicConfig();
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.error('Notification permission was not granted.');
      return false;
    }

    let app;
    try {
      app = getApp();
    } catch {
      app = initializeApp({
        apiKey: config.apiKey,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      });
    }
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    if (!token) {
      toast.error('Could not get a push token.');
      return false;
    }

    await apiClient.post(registerPath, { token });

    // Foreground messages (tab open + focused) don't trigger the service
    // worker's background handler — show a toast instead.
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      toast(`${title || 'Notification'}${body ? ` — ${body}` : ''}`, { icon: '🔔' });
    });

    toast.success('Push notifications enabled');
    return true;
  } catch (err) {
    toast.error('Failed to enable push notifications');
    console.error('enablePush failed:', err);
    return false;
  }
}
