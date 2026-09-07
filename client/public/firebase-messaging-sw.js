// Firebase Cloud Messaging service worker — handles push notifications that
// arrive while the CRM tab isn't focused (or isn't open at all). This file
// is static (not processed by Vite), so it can't read the app's env vars at
// build time — it fetches the public Firebase config from the backend
// instead (see server/routes/configRoutes.js). No-ops entirely until real
// Firebase keys are set server-side (`{ configured: false }` response).
//
// Assumes the API is reachable at the same origin as this file under /api —
// if the backend ever moves to a different origin in production, change
// API_CONFIG_URL below to the full absolute URL.
const API_CONFIG_URL = '/api/config/firebase-public';

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

fetch(API_CONFIG_URL)
  .then((res) => res.json())
  .then((config) => {
    if (!config?.configured) return;

    firebase.initializeApp({
      apiKey: config.apiKey,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      self.registration.showNotification(title || 'Vedhunt CRM', {
        body: body || '',
        icon: '/favicon.svg',
        data: payload.data || {}
      });
    });
  })
  .catch(() => {
    // Backend unreachable or Firebase not configured yet — push just stays off.
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link;
  if (link) {
    event.waitUntil(self.clients.openWindow(link));
  }
});
