/**
 * js/event-listeners.js
 * Asignación programática de todos los event listeners
 * Reemplaza los onclick inline para cumplir con CSP estricta
 * * Depende de: app.js y security.js
 * Cargar ÚLTIMO, después de todos los demás scripts.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Asignando Event Listeners de forma centralizada...');

  // ============================================
  // 🔒 PANTALLA DE BLOQUEO
  // ============================================
  var btnDesbloquear = document.getElementById('btnDesbloquear');
  if (btnDesbloquear) btnDesbloquear.addEventListener('click', desbloquearApp);

  var btnConfigPIN = document.getElementById('btnConfigPIN');
  if (btnConfigPIN) btnConfigPIN.addEventListener('click', configurarPIN);

  var btnRecuperar = document.getElementById('btnRecuperar');
  if (btnRecuperar) btnRecuperar.addEventListener('click', recuperarAcceso);

  var btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', resetEmergencia);

  var pinAccesoInput = document.getElementById('pinAccesoInput');
  if (pinAccesoInput) {
    pinAccesoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value) {
        e.preventDefault();
        desbloquearApp();
      }
    });
  }

  // ============================================
  // 🧭 NAVEGACIÓN PRINCIPAL
  // ============================================
  var btnAbrirMenu = document.querySelector('.header-icon[title="Menú"]');
  if (btnAbrirMenu) btnAbrirMenu.addEventListener('click', abrirMenu);

  var tabChats = document.getElementById('tabChats');
  if (tabChats) tabChats.addEventListener('click', function() { cambiarTab('chats'); });

  var tabContactos = document.getElementById('tabContactos');
  if (tabContactos) tabContactos.addEventListener('click', function() { cambiarTab('contactos'); });

  var tabAjustes = document.getElementById('tabAjustes');
  if (tabAjustes) tabAjustes.addEventListener('click', function() { cambiarTab('ajustes'); });

  var fabAgregar = document.getElementById('fabAgregar');
  if (fabAgregar) fabAgregar.addEventListener('click', mostrarModalAgregar);

  // ============================================
  //  CHAT INDIVIDUAL
  // ============================================
  var btnCerrarChat = document.querySelector('.chat-header-back');
  if (btnCerrarChat) btnCerrarChat.addEventListener('click', cerrarChat);

  var btnLlamadaVoz = document.getElementById('btnLlamadaVoz');
  if (btnLlamadaVoz) btnLlamadaVoz.addEventListener('click', function() { iniciarLlamada('voz'); });

  var btnLlamadaVideo = document.getElementById('btnLlamadaVideo');
  if (btnLlamadaVideo) btnLlamadaVideo.addEventListener('click', function() { iniciarLlamada('video'); });

  var btnOpcionesChat = document.getElementById('btnOpcionesChat');
  if (btnOpcionesChat) btnOpcionesChat.addEventListener('click', mostrarOpcionesChat);

  var btnAdjuntar = document.querySelector('.chat-btn-adjuntar');
  if (btnAdjuntar) btnAdjuntar.addEventListener('click', function() {
    var fileInput = document.getElementById('archivoInput');
    if (fileInput) fileInput.click();
  });

  var btnEnviar = document.querySelector('.chat-btn-enviar');
  if (btnEnviar) btnEnviar.addEventListener('click', enviarMensaje);

  var nuevoMensaje = document.getElementById('nuevoMensaje');
  if (nuevoMensaje) {
    nuevoMensaje.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
      }
    });
    // Auto-crecimiento responsivo
    nuevoMensaje.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }

  // ============================================
  //  MENÚ LATERAL
  // ============================================
  var menuOverlay = document.getElementById('menuOverlay');
  if (menuOverlay) menuOverlay.addEventListener('click', cerrarMenu);

  var menuItems = document.querySelectorAll('.menu-lateral .menu-item');
  menuItems.forEach(function(item) {
    var text = item.querySelector('.menu-item-text');
    if (!text) return;
    var txt = text.innerText.toLowerCase();
    
    if (txt.includes('ajustes generales')) {
      item.addEventListener('click', function() { cambiarTab('ajustes'); cerrarMenu(); });
    } else if (txt.includes('seguridad')) {
      item.addEventListener('click', function() { abrirConfigSeguridad(); cerrarMenu(); });
    } else if (txt.includes('notificaciones')) {
      item.addEventListener('click', function() { abrirConfigNotificaciones(); cerrarMenu(); });
    } else if (txt.includes('backup')) {
      item.addEventListener('click', function() { mostrarBackupMenu(); cerrarMenu(); });
    } else if (txt.includes('cambiar pin')) {
      item.addEventListener('click', function() { cambiarPIN(); cerrarMenu(); });
    } else if (txt.includes('diagnóstico') || txt.includes('diagnostico')) {
      item.addEventListener('click', function() { testearStorage(); cerrarMenu(); });
    } else if (txt.includes('reset')) {
      item.addEventListener('click', function() { resetEmergencia(); cerrarMenu(); });
    }
  });

  var btnCopiarPIN = document.querySelector('.menu-header button');
  if (btnCopiarPIN) btnCopiarPIN.addEventListener('click', copiarPIN);

  // ============================================
  //  MODALES - BOTONES DE CIERRE
  // ============================================
  var btnCerrarModalAgregar = document.getElementById('btnCerrarModalAgregar');
  if (btnCerrarModalAgregar) btnCerrarModalAgregar.addEventListener('click', cerrarModalAgregar);

  var btnCerrarModalSeguridad = document.getElementById('btnCerrarModalSeguridad');
  if (btnCerrarModalSeguridad) btnCerrarModalSeguridad.addEventListener('click', cerrarModalSeguridad);

  var btnCerrarModalNotificaciones = document.getElementById('btnCerrarModalNotificaciones');
  if (btnCerrarModalNotificaciones) btnCerrarModalNotificaciones.addEventListener('click', cerrarModalNotificaciones);

  var btnCerrarModalBackup = document.getElementById('btnCerrarModalBackup');
  if (btnCerrarModalBackup) btnCerrarModalBackup.addEventListener('click', cerrarModalBackup);

  var btnCerrarModalOpcionesChat = document.getElementById('btnCerrarModalOpcionesChat');
  if (btnCerrarModalOpcionesChat) btnCerrarModalOpcionesChat.addEventListener('click', cerrarModalOpcionesChat);

  // ============================================
  // 👥 MODAL AGREGAR CONTACTO
  // ============================================
  var btnAgregarContacto = document.getElementById('btnAgregarContacto');
  if (btnAgregarContacto) btnAgregarContacto.addEventListener('click', agregarContacto);

  var nuevoContactoPin = document.getElementById('nuevoContactoPin');
  if (nuevoContactoPin) {
    nuevoContactoPin.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') agregarContacto();
    });
  }

  // ============================================
  // ⚙️ MODAL SEGURIDAD
  // ============================================
  var prefAutoDestruccion = document.getElementById('prefAutoDestruccion');
  if (prefAutoDestruccion) prefAutoDestruccion.addEventListener('change', function() {
    guardarPreferencia('auto_destruccion_dias', this.value);
  });

  var prefRotacionClaves = document.getElementById('prefRotacionClaves');
  if (prefRotacionClaves) prefRotacionClaves.addEventListener('change', function() {
    guardarPreferencia('rotacion_claves_dias', this.value);
  });

  var prefOcultarCambiar = document.getElementById('prefOcultarCambiar');
  if (prefOcultarCambiar) prefOcultarCambiar.addEventListener('change', function() {
    guardarPreferenciaBool('ocultar_al_cambiar', this.checked);
  });

  var prefBorradoSeguro = document.getElementById('prefBorradoSeguro');
  if (prefBorradoSeguro) prefBorradoSeguro.addEventListener('change', function() {
    guardarPreferenciaBool('borrado_seguro', this.checked);
  });

  var prefDosfa = document.getElementById('prefDosfa');
  if (prefDosfa) prefDosfa.addEventListener('change', function() {
    guardarPreferenciaBool('dosfa_backup', this.checked);
  });

  var prefLimpiezaMeta = document.getElementById('prefLimpiezaMeta');
  if (prefLimpiezaMeta) prefLimpiezaMeta.addEventListener('change', function() {
    guardarPreferenciaBool('limpieza_metadatos', this.checked);
  });

  var btnActivarFS = document.getElementById('btnActivarFS');
  if (btnActivarFS) btnActivarFS.addEventListener('click', activarForwardSecrecy);

  var btnDesactivarFS = document.getElementById('btnDesactivarFS');
  if (btnDesactivarFS) btnDesactivarFS.addEventListener('click', desactivarForwardSecrecy);

  var btnBackupMensajes = document.getElementById('btnBackupMensajes');
  if (btnBackupMensajes) btnBackupMensajes.addEventListener('click', generarBackupMensajes);

  var btnBackupClavePrivada = document.getElementById('btnBackupClavePrivada');
  if (btnBackupClavePrivada) btnBackupClavePrivada.addEventListener('click', backupClavePrivada);

  // ============================================
  // 🔔 MODAL NOTIFICACIONES
  // ============================================
  var btnGuardarConfigNotif = document.getElementById('btnGuardarConfigNotif');
  if (btnGuardarConfigNotif) btnGuardarConfigNotif.addEventListener('click', guardarConfigNotificaciones);

  var btnSolicitarPermiso = document.getElementById('btnSolicitarPermiso');
  if (btnSolicitarPermiso) btnSolicitarPermiso.addEventListener('click', solicitarPermisoNotificaciones);

  var btnProbarNotif = document.getElementById('btnProbarNotif');
  if (btnProbarNotif) btnProbarNotif.addEventListener('click', probarNotificacion);

  // ============================================
  // 🔑 MODAL BACKUP
  // ============================================
  var btnExportarClave = document.getElementById('btnExportarClave');
  if (btnExportarClave) btnExportarClave.addEventListener('click', exportarClave);

  var btnImportarClave = document.getElementById('btnImportarClave');
  if (btnImportarClave) btnImportarClave.addEventListener('click', importarClave);

  // ============================================
  // ⚙️ MODAL OPCIONES CHAT
  // ============================================
  var btnEditarAlias = document.getElementById('btnEditarAlias');
  if (btnEditarAlias) btnEditarAlias.addEventListener('click', editarAliasContactoActual);

  var btnSeleccionarModo = document.getElementById('btnSeleccionarModo');
  if (btnSeleccionarModo) btnSeleccionarModo.addEventListener('click', seleccionarModo);

  var btnEliminarContacto = document.getElementById('btnEliminarContacto');
  if (btnEliminarContacto) btnEliminarContacto.addEventListener('click', eliminarContactoActual);

  var btnBloquearPIN = document.getElementById('btnBloquearPIN');
  if (btnBloquearPIN) btnBloquearPIN.addEventListener('click', bloquearContactoActual);

  var btnLimpiarChat = document.getElementById('btnLimpiarChat');
  if (btnLimpiarChat) btnLimpiarChat.addEventListener('click', limpiarChatCompleto);

  // ============================================
  // 📞 LLAMADAS WEBRTC
  // ============================================
  var btnColgarRapido = document.querySelector('#pantallaLlamada .chat-header-back');
  if (btnColgarRapido) btnColgarRapido.addEventListener('click', colgarLlamada);

  var btnColgar = document.getElementById('btnColgar');
  if (btnColgar) btnColgar.addEventListener('click', colgarLlamada);

  var btnSilenciar = document.getElementById('btnSilenciar');
  if (btnSilenciar) btnSilenciar.addEventListener('click', toggleSilenciar);

  var btnCamara = document.getElementById('btnCamara');
  if (btnCamara) btnCamara.addEventListener('click', toggleCamara);

  var btnAltavoz = document.getElementById('btnAltavoz');
  if (btnAltavoz) btnAltavoz.addEventListener('click', toggleAltavoz);

  var btnRechazarLlamada = document.getElementById('btnRechazarLlamada');
  if (btnRechazarLlamada) btnRechazarLlamada.addEventListener('click', rechazarLlamada);

  var btnAceptarLlamada = document.getElementById('btnAceptarLlamada');
  if (btnAceptarLlamada) btnAceptarLlamada.addEventListener('click', aceptarLlamada);

  // ============================================
  //  ARCHIVOS
  // ============================================
  var archivoInput = document.getElementById('archivoInput');
  if (archivoInput) {
    archivoInput.addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { 
        await customAlert('El tamaño máximo de archivo admitido es de 50 MB.'); 
        return; 
      }
      archivoSeleccionado = file;
      await customAlert('📎 Archivo listo para enviar: ' + file.name, '📎');
    });
  }

  // ============================================
  //  MODO PRIVADO
  // ============================================
  var toggleModoPrivado = document.getElementById('toggleModoPrivado');
  if (toggleModoPrivado) toggleModoPrivado.addEventListener('change', cambiarModoPrivado);

  // ============================================
  // 📡 ACTIVAR SERVICIO
  // ============================================
  var btnActivar = document.getElementById('btnActivar');
  if (btnActivar) btnActivar.addEventListener('click', activar);

  var codigoInput = document.getElementById('codigoInput');
  if (codigoInput) {
    codigoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') activar();
    });
  }

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

  // ============================================
  // ⌨️ ATAJOS DE TECLADO GLOBALES
  // ============================================
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
      });
      if (typeof cerrarMenu === 'function') cerrarMenu();
    }
  });

  console.log('✅ Todos los event listeners asignados correctamente y limpios.');
});
