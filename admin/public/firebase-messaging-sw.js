// Firebase Cloud Messaging service worker – receives push when app is in background.
// Config is loaded from API (api base passed as ?api= in registration URL).
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
          if (payload.notification) {
            self.registration.showNotification(
              payload.notification.title || 'Notification',
              {
                body: payload.notification.body,
                icon: payload.notification.icon || '/favicon.ico'
              }
            );
          }
        });
      } catch (e) {
        console.error('[firebase-messaging-sw] init error', e);
      }
    })
    .catch(function (e) {
      console.error('[firebase-messaging-sw] fetch config error', e);
    });
}
