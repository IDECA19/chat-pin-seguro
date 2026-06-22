// sw.js - Service Worker para Kerix Chat
var CACHE_NAME = 'kerix-cache-v1';
var urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Manejar notificaciones push
self.addEventListener('push', function(event) {
  console.log('Push recibido:', event);
  
  var data = event.data ? event.data.json() : {};
  
  var options = {
    body: data.body || 'Nuevo mensaje',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'kerix-message',
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Abrir chat' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kerix Chat', options)
  );
});

// Manejar clic en notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('Notificación clickeada:', event);
  
  event.notification.close();
  
  if (event.action === 'close' || !event.action) {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('kerix') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Fetch handler
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
