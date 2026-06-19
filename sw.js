// sw.js - Service Worker para notificaciones en background
var CACHE_NAME = 'kerix-cache-v1';

// Instalar Service Worker
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll([
                '/',
                '/index.html'
            ]);
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
    var data = event.data ? event.data.json() : {};
    
    var options = {
        body: data.body || 'Nuevo mensaje',
        icon: data.icon || '/icon.png',
        badge: data.badge || '/badge.png',
        tag: data.tag || 'chat-notification',
        requireInteraction: false,
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Abrir chat' },
            { action: 'close', title: 'Cerrar' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Kerix', options)
    );
});

// Manejar clic en notificaciones
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(function(clientList) {
                    // Si ya hay una ventana abierta, enfocarla
                    for (var i = 0; i < clientList.length; i++) {
                        var client = clientList[i];
                        if (client.url.includes('kerix') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Si no, abrir nueva ventana
                    if (clients.openWindow) {
                        return clients.openWindow(event.notification.data.url || '/');
                    }
                })
        );
    }
});

// Fetch handler para caché
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
