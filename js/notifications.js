/**
 * js/notifications.js
 * Gestión de notificaciones visuales nativas y alertas sonoras estructuradas.
 */

async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return;
  }
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
}

function dispararNotificacionVisual(remitentePin, texto) {
  // Verificar si las notificaciones nativas están permitidas en las preferencias
  if (typeof prefsNotificaciones !== 'undefined' && !prefsNotificaciones.nativas) return;

  // Alerta de audio sintética empleando la API de síntesis de audio para evitar carga de archivos estáticos
  reproducirSonidoAlerta();

  if ('Notification' in window && Notification.permission === 'granted') {
    var alias = typeof window.obtenerNombreContacto === 'function' ? window.obtenerNombreContacto(remitentePin) : remitentePin;
    new Notification('🔒 Kerix Secure (' + alias + ')', {
      body: texto,
      icon: 'icon.png'
    });
  }
}

function reproducirSonidoAlerta() {
  if (typeof prefsNotificaciones !== 'undefined' && !prefsNotificaciones.sonido) return;
  try {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var osc = context.createOscillator();
    var gain = context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, context.currentTime); // Nota D5 (Tono limpio de chat)
    
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(context.destination);
    
    osc.start();
    osc.stop(context.currentTime + 0.15);
  } catch (e) {
    console.warn('La política de interacción del navegador bloqueó el audio inicial:', e);
  }
}

window.addEventListener('DOMContentLoaded', function() {
  solicitarPermisoNotificaciones();
});

// Exposición global
window.solicitarPermisoNotificaciones = solicitarPermisoNotificaciones;
window.dispararNotificacionVisual = dispararNotificacionVisual;
window.reproducirSonidoAlerta = reproducirSonidoAlerta;

console.log('🔔 Módulo notifications.js cargado correctamente.');
