import api from './api.js';

// GET /api/notifications?unreadOnly=true
export async function getNotifications(unreadOnly = false) {
  const res = await api.get('/notifications', { params: { unreadOnly } });
  return res.data.data.notifications ?? res.data.data;
}

// PATCH /api/notifications/:id/read
export async function markNotificationRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.data;
}

// GET /api/notifications/preferences
export async function getNotificationPreferences() {
  const res = await api.get('/notifications/preferences');
  return res.data.data;
}

// PATCH /api/notifications/preferences
export async function updateNotificationPreferences(data) {
  const res = await api.patch('/notifications/preferences', data);
  return res.data.data;
}

// POST /api/notifications/subscribe  — web push subscription
export async function subscribePush(subscription) {
  const { endpoint, keys } = subscription;
  const res = await api.post('/notifications/subscribe', { endpoint, keys });
  return res.data.data;
}

// DELETE /api/notifications/subscribe  — unsubscribe
export async function unsubscribePush(endpoint) {
  const res = await api.delete('/notifications/subscribe', { data: { endpoint } });
  return res.data.data;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Converts the VAPID public key from base64url to Uint8Array for PushManager.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker and subscribes to web push.
 * Returns the subscription object or null if push is not available/configured.
 */
export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY is not set. Push notifications disabled.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await subscribePush(subscription.toJSON());
    return subscription;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return null;
  }
}

/**
 * Unsubscribes the current push subscription.
 */
export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('[Push] Unsubscription failed:', err);
  }
}
