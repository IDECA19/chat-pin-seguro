/**
 * js/event-listeners.js
 * Asignación programática de todos los event listeners
 * Reemplaza los onclick inline para cumplir con CSP estricta
 * * Depende de: app.js y security.js expuestos globalmente
 * Cargar de ÚLTIMO en el index.html
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Asignando Event Listeners de forma centralizada...');

  // ============================================
  // 🔒 PANTALLA DE BLOQUEO
  // ============================================
  var btnDesbloquear = document.getElementById('btnDesbloquear');
  if (btnDesbloquear) btnDesbloquear.addEventListener('click', function() { window.desbloquearApp(); });

  var btnConfigPIN = document.getElementById('btnConfigPIN');
  if (btnConfigPIN) btnConfigPIN.addEventListener('click', function() { window.configurarPIN(); });

  var btnRecuperar = document.getElementById('btnRecuperar');
  if (btnRecuperar) btnRecuperar.addEventListener('click', function() { window.recuperarAcceso(); });

  var btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', function() { window.resetEmergencia(); });

  var pinAccesoInput = document.getElementById('pinAccesoInput');
  if (pinAccesoInput) {
    pinAccesoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value) {
        e.preventDefault();
        window.desbloquearApp();
      }
    });
  }

  // ============================================
  // 🧭 NAVEGACIÓN PRINCIPAL
  // ============================================
  var btnAbrirMenu = document.querySelector('.header-icon[title="Menú"]');
  if (btnAbrirMenu) btnAbrirMenu.addEventListener('click', function() { if(window.abrirMenu) window.abrirMenu(); });

  var tabChats = document.getElementById('tabChats');
  if (tabChats) tabChats.addEventListener('click', function() { if(window.cambiarTab) window.cambiarTab('chats'); });

  var tabContactos = document.getElementById('tabContactos');
  if (tabContactos) tabContactos.addEventListener('click', function() { if(window.cambiarTab) window.cambiarTab('contactos'); });

  var tabAjustes = document.getElementById('tabAjustes');
  if (tabAjustes) tabAjustes.addEventListener('click', function() { if(window.cambiarTab) window.cambiarTab('ajustes'); });

  var fabAgregar = document.getElementById('fabAgregar');
  if (fabAgregar) fabAgregar.addEventListener('click', function() { if(window.mostrarModalAgregar) window.mostrarModalAgregar(); });

  // ============================================
  //  CHAT INDIVIDUAL
  // ============================================
  var btnCerrarChat = document.querySelector('.chat-header-back');
  if (btnCerrarChat) btnCerrarChat.addEventListener('click', function() { if(window.cerrarChat) window.cerrarChat(); });

  var btnLlamadaVoz = document.getElementById('btnLlamadaVoz');
  if (btnLlamadaVoz) btnLlamadaVoz.addEventListener('click', function() { if(window.iniciarLlamada) window.iniciarLlamada('voz'); });

  var btnLlamadaVideo = document.getElementById('btnLlamadaVideo');
  if (btnLlamadaVideo) btnLlamadaVideo.addEventListener('click', function() { if(window.iniciarLlamada) window.iniciarLlamada('video'); });

  var btnOpcionesChat = document.getElementById('btnOpcionesChat');
  if (btnOpcionesChat) btnOpcionesChat.addEventListener('click', function() { if(window.mostrarOpcionesChat) window.mostrarOpcionesChat(); });

  var btnAdjuntar = document.querySelector('.chat-btn-adjuntar');
  if (btnAdjuntar) btnAdjuntar.addEventListener('click', function() {
    var fileInput = document.getElementById('archivoInput');
    if (fileInput) fileInput.click();
  });

  var btnEnviar = document.querySelector('.chat-btn-enviar');
  if (btnEnviar) btnEnviar.addEventListener('click', function() { if(window.enviarMensaje) window.enviarMensaje(); });

  var nuevoMensaje = document.getElementById('nuevoMensaje');
  if (nuevoMensaje) {
    nuevoMensaje.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if(window.enviarMensaje) window.enviarMensaje();
      }
    });
    nuevoMensaje.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }

  // ============================================
  //  MENÚ LATERAL
  // ============================================
  var menuOverlay = document.getElementById('menuOverlay');
  if (menuOverlay) menuOverlay.addEventListener('click', function() { if(window.cerrarMenu) window.cerrarMenu(); });

  var menuItems = document.querySelectorAll('.menu-lateral .menu-item');
  menuItems.forEach(function(item) {
    var text = item.querySelector('.menu-item-text');
    if (!text) return;
    var txt = text.innerText.toLowerCase();
    
    item.addEventListener('click', function() {
      if (txt.includes('ajustes generales') && window.cambiarTab) { window.cambiarTab('ajustes'); window.cerrarMenu(); }
      else if (txt.includes('seguridad') && window.abrirConfigSeguridad) { window.abrirConfigSeguridad(); window.cerrarMenu(); }
      else if (txt.includes('notificaciones') && window.abrirConfigNotificaciones) { window.abrirConfigNotificaciones(); window.cerrarMenu(); }
      else if (txt.includes('backup') && window.mostrarBackupMenu) { window.mostrarBackupMenu(); window.cerrarMenu(); }
      else if (txt.includes('cambiar pin') && window.cambiarPIN) { window.cambiarPIN(); window.cerrarMenu(); }
      else if ((txt.includes('diagnóstico') || txt.includes('diagnostico')) && window.testearStorage) { window.testearStorage(); window.cerrarMenu(); }
      else if (txt.includes('reset') && window.resetEmergencia) { window.resetEmergencia(); window.cerrarMenu(); }
    });
  });

  var btnCopiarPIN = document.querySelector('.menu-header button');
  if (btnCopiarPIN) btnCopiarPIN.addEventListener('click', function() { if(window.copiarPIN) window.copiarPIN(); });

  // ============================================
  //  MODALES - BOTONES DE CIERRE
  // ============================================
  var btnCerrarModalAgregar = document.getElementById('btnCerrarModalAgregar');
  if (btnCerrarModalAgregar) btnCerrarModalAgregar.addEventListener('click', function() { if(window.cerrarModalAgregar) window.cerrarModalAgregar(); });

  var btnCerrarModalSeguridad = document.getElementById('btnCerrarModalSeguridad');
  if (btnCerrarModalSeguridad) btnCerrarModalSeguridad.addEventListener('click', function() { if(window.cerrarModalSeguridad) window.cerrarModalSeguridad(); });

  var btnCerrarModalNotificaciones = document.getElementById('btnCerrarModalNotificaciones');
  if (btnCerrarModalNotificaciones) btnCerrarModalNotificaciones.addEventListener('click', function() { if(window.cerrarModalNotificaciones) window.cerrarModalNotificaciones(); });

  var btnCerrarModalBackup = document.getElementById('btnCerrarModalBackup');
  if (btnCerrarModalBackup) btnCerrarModalBackup.addEventListener('click', function() { if(window.cerrarModalBackup) window.cerrarModalBackup(); });

  var btnCerrarModalOpcionesChat = document.getElementById('btnCerrarModalOpcionesChat');
  if (btnCerrarModalOpcionesChat) btnCerrarModalOpcionesChat.addEventListener('click', function() { if(window.cerrarModalOpcionesChat) window.cerrarModalOpcionesChat(); });

  // ============================================
  // 👥 MODAL AGREGAR CONTACTO
  // ============================================
  var btnAgregarContacto = document.getElementById('btnAgregarContacto');
  if (btnAgregarContacto) btnAgregarContacto.addEventListener('click', function() { if(window.agregarContacto) window.agregarContacto(); });

  var nuevoContactoPin = document.getElementById('nuevoContactoPin');
  if (nuevoContactoPin) {
    nuevoContactoPin.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && window.agregarContacto) window.agregarContacto();
    });
  }

  // ============================================
  // ⚙️ MODAL SEGURIDAD Y AJUSTES
  // ============================================
  var prefAutoDestruccion = document.getElementById('prefAutoDestruccion');
  if (prefAutoDestruccion) prefAutoDestruccion.addEventListener('change', function() {
    if(window.guardarPreferencia) window.guardarPreferencia('auto_destruccion_dias', this.value);
  });

  var prefRotacionClaves = document.getElementById('prefRotacionClaves');
  if (prefRotacionClaves) prefRotacionClaves.addEventListener('change', function() {
    if(window.guardarPreferencia) window.guardarPreferencia('rotacion_claves_dias', this.value);
  });

  var btnBackupMensajes = document.getElementById('btnBackupMensajes');
  if (btnBackupMensajes) btnBackupMensajes.addEventListener('click', function() { if(window.generarBackupMensajes) window.generarBackupMensajes(); });

  // ============================================
  // ⚙️ MODAL OPCIONES CHAT (OPCIONES CRÍTICAS)
  // ============================================
  var btnEditarAlias = document.getElementById('btnEditarAlias');
  if (btnEditarAlias) btnEditarAlias.addEventListener('click', function() { if(window.editarAliasContactoActual) window.editarAliasContactoActual(); });

  var btnEliminarContacto = document.getElementById('btnEliminarContacto');
  if (btnEliminarContacto) btnEliminarContacto.addEventListener('click', function() { if(window.eliminarContactoActual) window.eliminarContactoActual(); });

  var btnBloquearPIN = document.getElementById('btnBloquearPIN');
  if (btnBloquearPIN) btnBloquearPIN.addEventListener('click', function() { if(window.bloquearContactoActual) window.bloquearContactoActual(); });

  var btnLimpiarChat = document.getElementById('btnLimpiarChat');
  if (btnLimpiarChat) btnLimpiarChat.addEventListener('click', function() { if(window.limpiarChatCompleto) window.limpiarChatCompleto(); });

  // ============================================
  // 📞 LLAMADAS WEBRTC CONTROLES
  // ============================================
  var btnColgarRapido = document.querySelector('#pantallaLlamada .chat-header-back');
  if (btnColgarRapido) btnColgarRapido.addEventListener('click', function() { if(window.colgarLlamada) window.colgarLlamada(); });

  var btnColgar = document.getElementById('btnColgar');
  if (btnColgar) btnColgar.addEventListener('click', function() { if(window.colgarLlamada) window.colgarLlamada(); });

  var btnSilenciar = document.getElementById('btnSilenciar');
  if (btnSilenciar) btnSilenciar.addEventListener('click', function() { if(window.toggleSilenciar) window.toggleSilenciar(); });

  var btnCamara = document.getElementById('btnCamara');
  if (btnCamara) btnCamara.addEventListener('click', function() { if(window.toggleCamara) window.toggleCamara(); });

  var btnRechazarLlamada = document.getElementById('btnRechazarLlamada');
  if (btnRechazarLlamada) btnRechazarLlamada.addEventListener('click', function() { if(window.rechazarLlamada) window.rechazarLlamada(); });

  var btnAceptarLlamada = document.getElementById('btnAceptarLlamada');
  if (btnAceptarLlamada) btnAceptarLlamada.addEventListener('click', function() { if(window.aceptarLlamada) window.aceptarLlamada(); });

  // ============================================
  // 🖱️ CERRAR MODALES AL HACER CLIC FUERA
  // ============================================
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Atajos de escape globales
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
      });
      if (window.cerrarMenu) window.cerrarMenu();
    }
  });

  console.log('✅ Todos los listeners mapeados con seguridad a la capa global.');
});
