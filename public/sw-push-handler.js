/**
 * DEBPTH Workspace - Push & Background Notification Service Worker Handler
 * Free Native Browser Push API (W3C Push API / Web Notifications standard)
 */

function resolveSafeAppUrl(rawUrl) {
  const fallback = self.location.origin + '/';
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }
  try {
    const resolved = new URL(trimmed, self.location.origin);
    if (resolved.origin !== self.location.origin) {
      return fallback;
    }
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
      return fallback;
    }
    return resolved.href;
  } catch {
    return fallback;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'DEBPTH Workspace', body: event.data.text() };
    }
  } else {
    data = { title: 'DEBPTH Workspace', body: 'New workspace activity detected.' };
  }

  const title = data.title || 'DEBPTH Workspace';
  const safeTargetUrl = resolveSafeAppUrl(data.url || data.link || '/');
  const options = {
    body: data.body || 'You have an update in your workspace.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'debpth-notification',
    data: {
      url: safeTargetUrl,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = (event.notification.data && event.notification.data.url) || '/';
  const safeTargetHref = rawTarget.startsWith(self.location.origin)
    ? rawTarget
    : resolveSafeAppUrl(rawTarget);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetPath = new URL(safeTargetHref).pathname;
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && clientUrl.pathname === targetPath && 'focus' in client) {
            return client.focus();
          }
        } catch {
          // Ignore malformed client URLs
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(safeTargetHref);
      }
    })
  );
});
