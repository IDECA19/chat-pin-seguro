/**
 * sw.js - Service Worker robusto para KERIX_SECURE
 */

var CACHE_NAME = 'kerix-secure-v2';
var ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',
  './icon.png',
  './badge.png',
  './js/app.js',
  './js/crypto.js',
  './js/security.js',
  './js/supabase-client.js',
  './js/notifications.js',
  './js/webrtc.js',
  './js/event-listeners.js'
];

// Instalación con tolerancia a fallos individuales de archivos
self.addEventListener('install', function(e) {
  console.log('sw: Instalando service worker y asegurando entorno...');
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Usamos promesas individuales para que si un archivo da 404, no rompa la instalación
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('sw: No se pudo pre-cargar en caché el archivo de la ruta: ' + url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activación y purga de cachés obsoletos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(k) {
          if (k !== CACHE_NAME) {
            console.log('sw: Eliminando caché obsoleto:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Estrategia: Network First, Fallback to Cache
self.addEventListener('fetch', function(e) {
  // Evitar interceptar llamadas externas a Supabase o WebSockets
  if (e.request.url.includes('supabase.co') || e.request.url.includes('websocket')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (!res || res.status !== 200 || res.type !== 'basic') {
        return res;
      }
      var resClone = res.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(e.request, resClone);
      });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
