/**
 * js/event-listeners.js
 * Vinculación centralizada de eventos del DOM compatible con CSP.
 */

window.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Vinculando listeners centralizados del mapa de menús Kerix...');

  // --- HEADER PRINCIPAL & MENÚ LATERAL ---
  var btnAbrirMenu = document.getElementById('btnAbrirMenu');
  if (btnAbrirMenu) {
    btnAbrirMenu.addEventListener('click', function() {
      if (typeof window.abrirMenu === 'function') window.abrirMenu();
    });
  }

  var menuOverlay = document.getElementById('menuOverlay');
  if (menuOverlay) {
    menuOverlay.addEventListener('click', function() {
      if (typeof window.cerrarMenu === 'function') window.cerrarMenu();
    });
  }

  // --- NAVEGACIÓN PRINCIPAL (TABS) ---
  var tabChats = document.getElementById('tabChats');
  if (tabChats) {
    tabChats.addEventListener('click', function() {
      if (typeof window.cambiarTab === 'function') window.cambiarTab('chats');
    });
  }

  var tabContactos = document.getElementById('tabContactos');
  if (tabContactos) {
    tabContactos.addEventListener('click', function() {
      if (typeof window.cambiarTab === 'function') window.cambiarTab('contactos');
    });
  }

  var tabAjustes = document.getElementById('tabAjustes');
  if (tabAjustes) {
    tabAjustes.addEventListener('click', function() {
      if (typeof window.cambiarTab === 'function') window.cambiarTab('ajustes');
    });
  }

  // --- CONTROL DE SALA DE CHAT INDIVIDUAL ---
  var btnCerrarChat = document.getElementById('btnCerrarChat');
  if (btnCerrarChat) {
    btnCerrarChat.addEventListener('click', function() {
      if (typeof window.cerrarChat === 'function') window.cerrarChat();
    });
  }

  var btnEnviar = document.getElementById('btnEnviar');
  if (btnEnviar) {
    btnEnviar.addEventListener('click', function() {
      if (typeof window.enviarMensaje === 'function') window.enviarMensaje();
    });
  }

  var nuevoMensajeInput = document.getElementById('nuevoMensaje');
  if (nuevoMensajeInput) {
    nuevoMensajeInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (typeof window.enviarMensaje === 'function') window.enviarMensaje();
      }
    });
  }

  // --- MODAL AGREGAR CONTACTO (+) ---
  var fabAgregar = document.getElementById('fabAgregar');
  if (fabAgregar) {
    fabAgregar.addEventListener('click', function() {
      if (typeof window.mostrarModalAgregar === 'function') window.mostrarModalAgregar();
    });
  }

  var btnCerrarModalAgregar = document.getElementById('btnCerrarModalAgregar');
  if (btnCerrarModalAgregar) {
    btnCerrarModalAgregar.addEventListener('click', function() {
      if (typeof window.cerrarModalAgregar === 'function') window.cerrarModalAgregar();
    });
  }

  var btnAgregarContacto = document.getElementById('btnAgregarContacto');
  if (btnAgregarContacto) {
    btnAgregarContacto.addEventListener('click', function() {
      if (typeof window.agregarContacto === 'function') window.agregarContacto();
    });
  }

  // --- LLAMADAS Y VIDEOLLAMADAS E2EE VIA WEBRTC P2P ---
  var btnLlamadaVoz = document.getElementById('btnLlamadaVoz');
  if (btnLlamadaVoz) {
    btnLlamadaVoz.addEventListener('click', function() {
      if (!contactoActual) {
        if (typeof window.customAlert === 'function') window.customAlert('Selecciona un contacto primero.');
        return;
      }
      if (typeof window.iniciarLlamadaWebRTC === 'function') {
        window.iniciarLlamadaWebRTC(contactoActual, false); // Solo Audio
      }
    });
  }

  var btnLlamadaVideo = document.getElementById('btnLlamadaVideo');
  if (btnLlamadaVideo) {
    btnLlamadaVideo.addEventListener('click', function() {
      if (!contactoActual) {
        if (typeof window.customAlert === 'function') window.customAlert('Selecciona un contacto primero.');
        return;
      }
      if (typeof window.iniciarLlamadaWebRTC === 'function') {
        window.iniciarLlamadaWebRTC(contactoActual, true); // Video + Audio
      }
    });
  }

  // --- ELEMENTOS DEL PANEL DE AJUSTES LATERAL ---
  var btnCopiarPIN = document.getElementById('btnCopiarPIN');
  if (btnCopiarPIN) {
    btnCopiarPIN.addEventListener('click', function() {
      if (typeof window.copiarPIN === 'function') window.copiarPIN();
    });
  }

  var btnBackup = document.getElementById('btnBackup');
  if (btnBackup) {
    btnBackup.addEventListener('click', function() {
      if (typeof window.exportarConfiguracion === 'function') window.exportarConfiguracion();
    });
  }

  // Mapear opciones de texto en la lista del menú lateral
  var menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(function(item) {
    if (item.classList.contains('danger') || item.innerText.includes('Reset')) {
      item.addEventListener('click', function() {
        if (typeof window.resetEmergenciaCompleto === 'function') window.resetEmergenciaCompleto();
      });
    }
    if (item.innerText.includes('Cambiar PIN')) {
      item.addEventListener('click', function() {
        if (typeof window.cambiarPIN === 'function') window.cambiarPIN();
      });
    }
  });

  // --- PANTALLA DE LOGUEO/BLOQUEO ---
  var btnDesbloquear = document.getElementById('btnDesbloquear');
  if (btnDesbloquear) {
    btnDesbloquear.addEventListener('click', function() {
      if (typeof window.desbloquearApp === 'function') window.desbloquearApp();
    });
  }

  var btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', function() {
      if (typeof window.resetEmergenciaCompleto === 'function') window.resetEmergenciaCompleto();
    });
  }

  var pinAccesoInput = document.getElementById('pinAccesoInput');
  if (pinAccesoInput) {
    pinAccesoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (typeof window.desbloquearApp === 'function') window.desbloquearApp();
      }
    });
  }
});
