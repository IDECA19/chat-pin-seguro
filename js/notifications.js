/**
 * js/notifications.js
 * Sistema completo de notificaciones: nativas, visuales, sonido y vibración
 * 
 * Depende de:
 * - app.js (miPIN, prefsNotificaciones, contactoActual, obtenerNombreContacto, 
 *           abrirChat, actualizarBadgeChats, customAlert, logError)
 */

// ============================================
// 🔔 NOTIFICACIONES
// ============================================
function cargarPrefsNotificaciones() {
  var guardadas = localStorage.getItem('prefs_notificaciones_' + miPIN);
  if (guardadas) prefsNotificaciones = JSON.parse(guardadas);
}

function guardarPrefsNotificaciones() { 
  localStorage.setItem('prefs_notificaciones_' + miPIN, JSON.stringify(prefsNotificaciones)); 
}

async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) { 
    await customAlert('❌ Tu navegador no soporta notificaciones nativas.', '❌'); 
    return false; 
  }
  if (Notification.permission === 'granted') { 
    await customAlert('✅ Las notificaciones ya están autorizadas.', '✅'); 
    return true; 
  }
  if (Notification.permission === 'denied') { 
    await customAlert('❌ Permisos denegados. Debes habilitarlos manualmente desde el candado de la barra del navegador.', '❌'); 
    return false; 
  }
  try {
    var permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
      await customAlert('✅ Permiso de notificación concedido.', '✅');
      new Notification('Kerix Chat', { body: 'Notificaciones activadas con éxito. ✅' });
    }
    return permiso === 'granted';
  } catch (error) { 
    logError('Error solicitando permiso:', error); 
    return false; 
  }
}

function mostrarNotificacionNativa(titulo, cuerpo, pinRemitente, tipoMensaje) {
  if (!prefsNotificaciones.nativas) return;
  if (Notification.permission !== 'granted') return;
  // Solo suprimir si estás ACTIVAMENTE en el chat del remitente
  if (document.visibilityState === 'visible' && contactoActual === pinRemitente) return;
  
  var icono = '🔒';
  if (tipoMensaje === 'imagen') icono = '🖼️';
  else if (tipoMensaje === 'video') icono = '🎥';
  else if (tipoMensaje === 'documento') icono = '📎';
  
  var opciones = {
    body: cuerpo,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + icono + '</text></svg>',
    tag: 'chat-' + pinRemitente,
    requireInteraction: false,
    silent: !prefsNotificaciones.sonido,
    vibrate: prefsNotificaciones.vibracion ? [200, 100, 200] : undefined
  };
  
  try {
    var notificacion = new Notification(titulo, opciones);
    notificacion.onclick = function() { 
      window.focus(); 
      abrirChat(pinRemitente); 
      notificacion.close(); 
    };
    setTimeout(function() { notificacion.close(); }, 5000);
  } catch (error) { 
    logError('Error mostrando notificación:', error); 
  }
}

function mostrarNotificacionVisual(titulo, cuerpo, pinRemitente) {
  if (!prefsNotificaciones.visuales) return;
  
  var contenedor = document.getElementById('notificacionesContainer');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'notificacionesContainer';
    contenedor.style.cssText = 'position: fixed; top: 70px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(contenedor);
  }
  
  var burbuja = document.createElement('div');
  burbuja.style.cssText = 'background: linear-gradient(135deg, #1f2c34 0%, #2a3942 100%); border: 1px solid #00a884; border-radius: 12px; padding: 12px 16px; min-width: 250px; max-width: 320px; box-shadow: 0 8px 32px rgba(0, 168, 132, 0.3); animation: slideInRight 0.3s ease-out; pointer-events: auto; cursor: pointer;';
  burbuja.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;"><div style="flex: 1;"><div style="font-weight: bold; color: #00a884; font-size: 13px; margin-bottom: 4px;">' + titulo + '</div><div style="color: #e9edef; font-size: 12px; line-height: 1.4;">' + cuerpo + '</div></div><button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #8696a0; cursor: pointer; font-size: 16px; padding: 0; line-height: 1;">✕</button></div>';
  
  burbuja.onclick = function(e) { 
    if (e.target.tagName !== 'BUTTON') { 
      abrirChat(pinRemitente); 
      burbuja.remove(); 
    } 
  };
  
  contenedor.appendChild(burbuja);
  
  setTimeout(function() {
    if (burbuja.parentElement) {
      burbuja.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(function() { 
        if (burbuja.parentElement) burbuja.remove(); 
      }, 300);
    }
  }, 4000);
}

function reproducirSonidoNotificacion() {
  if (!prefsNotificaciones.sonido) return;
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (error) { 
    logError('Error reproduciendo sonido:', error); 
  }
}

function vibrarDispositivo() {
  if (!prefsNotificaciones.vibracion) return;
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function notificarNuevoMensaje(pinRemitente, texto, tipoMensaje) {
  var nombre = obtenerNombreContacto(pinRemitente);
  var titulo = 'Mensaje de ' + nombre;
  var cuerpo = '';
  
  if (tipoMensaje === 'imagen') cuerpo = '🖼️ Imagen adjunta';
  else if (tipoMensaje === 'video') cuerpo = '🎥 Video adjunto';
  else if (tipoMensaje === 'documento') cuerpo = ' Archivo adjunto';
  else cuerpo = prefsNotificaciones.mostrarContenido ? (texto.substring(0, 50) || 'Mensaje') : 'Nuevo mensaje';
  
  // Notificar SIEMPRE (sin importar dónde estés)
  mostrarNotificacionNativa(titulo, cuerpo, pinRemitente, tipoMensaje);
  mostrarNotificacionVisual(titulo, cuerpo, pinRemitente);
  reproducirSonidoNotificacion();
  vibrarDispositivo();
  actualizarBadgeChats();
}

async function guardarConfigNotificaciones() {
  prefsNotificaciones.nativas = document.getElementById('notifNativas').checked;
  prefsNotificaciones.visuales = document.getElementById('notifVisuales').checked;
  prefsNotificaciones.sonido = document.getElementById('notifSonido').checked;
  prefsNotificaciones.vibracion = document.getElementById('notifVibracion').checked;
  prefsNotificaciones.mostrarContenido = document.getElementById('notifContenido').checked;
  guardarPrefsNotificaciones();
  
  if (prefsNotificaciones.nativas && Notification.permission !== 'granted') {
    await solicitarPermisoNotificaciones();
  }
  
  cerrarModalNotificaciones();
  await customAlert('✅ Preferencias de notificación aplicadas con éxito.', '✅');
}

async function probarNotificacion() {
  if (Notification.permission === 'granted') {
    new Notification('Kerix Chat - Prueba', { body: 'Las notificaciones nativas se están ejecutando. ✅' });
    await customAlert('✅ Notificación de prueba disparada.', '✅');
  } else { 
    await customAlert('❌ No hay permisos aprobados para notificaciones aún.', '❌'); 
  }
}

console.log('🔔 Módulo notifications.js cargado correctamente');
