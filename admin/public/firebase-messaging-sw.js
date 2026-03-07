// Firebase Cloud Messaging service worker – receives push when app is in background.
// Config is loaded from API (api base passed as ?api= in registration URL).
// skipWaiting + claim so this SW controls the page immediately and getToken() works on first load.
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

const url = new URL(self.location.href);
const apiBase = url.searchParams.get('api') || '';

if (apiBase) {
  fetch(apiBase + '/chat/firebase-client-config')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.enabled || !data.config) return;
      try {
        importScripts(
          'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
          'https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js'
        );
        firebase.initializeApp(data.config);
        const messaging = firebase.messaging();
        messaging.onBackgroundMessage(function (payload) {
          var title = (payload.notification && payload.notification.title) || 'Support Chat';
          var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'New message';
          var opts = {
            body: body,
            icon: (payload.notification && payload.notification.icon) || '/favicon.ico',
            tag: 'support-chat',
            requireInteraction: false
          };
          if (payload.data && payload.data.sessionId) {
            opts.data = { url: self.location.origin + '/#/chat', sessionId: payload.data.sessionId };
          } else {
            opts.data = { url: self.location.origin + '/#/chat' };
          }
          self.registration.showNotification(title, opts);
        });
        self.addEventListener('notificationclick', function (event) {
          event.notification.close();
          var url = (event.notification.data && event.notification.data.url) || self.location.origin + '/#/chat';
          event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (var i = 0; i < clientList.length; i++) {
              if (clientList[i].url.indexOf(self.location.origin) === 0 && 'focus' in clientList[i]) {
                clientList[i].navigate(url);
                return clientList[i].focus();
              }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
          }));
        });
      } catch (e) {
        console.error('[firebase-messaging-sw] init error', e);
      }
    })
    .catch(function (e) {
      console.error('[firebase-messaging-sw] fetch config error', e);
    });
}
