/**
 * DEBPTH Workspace - Push & Background Notification Service Worker Handler
 * Free Native Browser Push API (W3C Push API / Web Notifications standard)
 */

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
  const options = {
    body: data.body || 'You have an update in your workspace.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'debpth-notification',
    data: {
      url: data.url || data.link || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
