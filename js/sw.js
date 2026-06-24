/**
 * sw.js
 * Service Worker oficial para Kerix que intercepta peticiones locales
 * y garantiza la resiliencia offline de los recursos estáticos.
 */

const CACHE_NAME = 'kerix-v2-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/supabase-client.js',
  '/js/webrtc.js',
  '/js/app.js',
  '/manifest.json'
];

// Instalar Service Worker y Almacenar Assets de forma preventiva
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Inicializando almacenamiento estático...');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Limpieza de caches antiguos al activar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Eliminando caché obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones y servir desde caché o red
self.addEventListener('fetch', (event) => {
  // Evitar interceptar solicitudes de Supabase o CDNs dinámicos para escritura directa
  if (event.request.url.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Clonar la respuesta y guardarla en caché si corresponde
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback si no hay conexión y no está en caché
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});