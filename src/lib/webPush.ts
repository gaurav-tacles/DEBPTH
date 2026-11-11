/**
 * Web Push and Notification Manager for DEBPTH
 * Zero-cost, 100% free native browser push using Web Push API + Supabase persistence.
 */

import { getVapidPublicKey, urlBase64ToUint8Array } from './vapid';
import { getSupabaseClient } from './supabase';
import { logger } from './logger';
import { generateUuid } from './crypto';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface WebPushStatus {
  isSupported: boolean;
  permission: PushPermissionState;
  isSubscribed: boolean;
  subscriptionEndpoint?: string;
}

/**
 * Checks if Service Worker and Push API are supported in current browser environment.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Retrieves current browser push permission and subscription status.
 */
export async function getPushStatus(): Promise<WebPushStatus> {
  if (!isPushSupported()) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
    };
  }

  const permission = Notification.permission as PushPermissionState;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(subscription),
      subscriptionEndpoint: subscription?.endpoint,
    };
  } catch (err) {
    logger.warn('WebPush', 'Could not query pushManager subscription status', err);
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
    };
  }
}

/**
 * Requests notification permission from user and subscribes device to push notifications.
 * Persists the subscription details (endpoint, p256dh, auth) to Supabase push_subscriptions table.
 */
export async function subscribeToPush(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was not granted.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as Uint8Array<ArrayBuffer>,
      });
    }

    // Extract subscription keys
    const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
    const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

    const p256dh = rawKey
      ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))))
      : '';
    const auth = rawAuth
      ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))))
      : '';

    // Save to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          id: generateUuid(),
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
        },
        { onConflict: 'user_id,endpoint' }
      );

      if (error) {
        logger.warn('WebPush', 'Failed to store push subscription in Supabase', error);
      }
    }

    // Store in localStorage for fast local state retrieval
    localStorage.setItem('debpth_push_subscribed', 'true');
    localStorage.setItem('debpth_push_endpoint', subscription.endpoint);

    return { success: true };
  } catch (err) {
    logger.error('WebPush', 'Error subscribing to push notifications', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unsubscribes current device from push notifications and deletes record from Supabase.
 */
export async function unsubscribeFromPush(userId: string): Promise<{ success: boolean }> {
  if (!isPushSupported()) return { success: true };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .match({ user_id: userId, endpoint });
      }
    }

    localStorage.removeItem('debpth_push_subscribed');
    localStorage.removeItem('debpth_push_endpoint');
    return { success: true };
  } catch (err) {
    logger.error('WebPush', 'Error unsubscribing from push', err);
    return { success: false };
  }
}

/**
 * Sends a client-side notification if permitted (fallback or in-app foreground notification).
 */
export function displayLocalNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        ...options,
      });
    } catch {
      // Notification constructor not permitted in some mobile contexts; service worker will handle
    }
  }
}
