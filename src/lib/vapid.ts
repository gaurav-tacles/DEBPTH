/**
 * VAPID (Voluntary Application Server Identification) for Native Browser Web Push
 * 100% Free, zero third-party recurring fees.
 * RFC 8292 / NIST P-256 standard ECDSA keys.
 */

// Fallback application VAPID public key (NIST P-256 / prime256v1)
export const DEFAULT_VAPID_PUBLIC_KEY =
  'BPO5VxVxbAJvlK9xkCeyyyn45-Tx_DG2Rd5QtHCog8chqWMOVdlNWua99kSQFW9ivUhwoajcDtGh1yiu9-S6s3A';

/**
 * Resolves configured VAPID public key from environment or default.
 */
export function getVapidPublicKey(): string {
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 20) {
    return envKey.trim();
  }
  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Converts standard Base64 / URL-Safe Base64 string to Uint8Array for PushManager.subscribe.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  let rawData = '';
  if (typeof atob === 'function') {
    rawData = atob(base64);
  } else if (typeof Buffer !== 'undefined') {
    rawData = Buffer.from(base64, 'base64').toString('binary');
  }
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
