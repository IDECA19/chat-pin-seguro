// ============================================
// 🌍 SISTEMA MULTI-IDIOMA - KERIX CHAT
// ============================================

var translations = {
  es: {
    // Pantalla de bloqueo
    'chat_bloqueado': 'Kerix Bloqueado',
    'ingresa_pin': 'Ingresa tu PIN de acceso',
    'desbloquear': 'Desbloquear',
    'configurar_pin': 'Configurar PIN',
    'olvide_pin': 'Olvidé mi PIN',
    'reset_emergencia': 'Reset de Emergencia',
    'pin_incorrecto': 'PIN incorrecto',
    
    // Pantalla principal
    'chat_anonimo': 'Chat Anónimo',
    'tu_pin_identidad': 'Tu PIN es tu identidad',
    'tu_pin': 'TU PIN',
    'copiar_pin': 'Copiar mi PIN',
    'servicio_activo': '✅ Servicio Activo',
    'servicio_inactivo': '⚠️ Servicio Inactivo',
    'sin_conexion': '⚠️ Sin conexión',
    'codigo_activacion': 'Código de Activación:',
    'activar': 'Activar',
    'ir_chat': 'Ir al Chat',
    'vence': 'Vence:',
    'cifrado_hibrido': '🔐 Cifrado Híbrido AES+RSA',
    'modo_privado': 'Modo Privado',
    'solo_contactos': 'Solo recibir de contactos guardados',
    'mensajes_desconocidos_rechazados': 'Los mensajes de PINs desconocidos se rechazarán',
    'seguridad_avanzada': 'Seguridad Avanzada',
    'backup_claves': 'Backup de Claves',
    'cambiar_pin_acceso': 'Cambiar PIN de acceso',
    'diagnostico_storage': 'Diagnóstico de Storage',
    
    // Contactos
    'mis_contactos': 'Mis Contactos',
    'volver': 'Volver',
    'agregar_contacto': 'Agregar contacto',
    'nuevo_contacto': 'Agregar nuevo contacto',
    'pin_contacto': 'PIN del contacto (8 caracteres)',
    'agregar': 'Agregar',
    'no_contactos': 'No tienes contactos aún',
    'pins_bloqueados': '🚫 PINs Bloqueados',
    'mensajes_desconocidos': '📨 Mensajes de desconocidos',
    'desbloquear': 'Desbloquear',
    
    // Chat
    'chat_con': 'Chat con',
    'en_linea': 'en línea',
    'no_mensajes': 'No hay mensajes aún',
    'escribe_mensaje': 'Escribe un mensaje...',
    'adjuntar': 'Adjuntar',
    'enviar': 'Enviar',
    'seleccionados': 'seleccionados',
    'cancelar': 'Cancelar',
    'borrar': 'Borrar',
    
    // Tabs
    'chats': 'Chats',
    'contactos': 'Contactos',
    'ajustes': 'Ajustes',
    
    // Menú lateral
    'tu_pin_kerix': 'Tu PIN de Kerix',
    'copiar': 'Copiar',
    'ajustes_generales': 'Ajustes generales',
    'cambiar_pin': 'Cambiar PIN de acceso',
    
    // Mensajes de sistema
    'espera_momento': '⏱️ Espera un momento antes de enviar otro mensaje.',
    'pin_invalido': 'PIN inválido (debe contener entre 4 y 6 números).',
    'pins_no_coinciden': 'Los PINs ingresados no coinciden.',
    'guarda_codigo': '⚠️ GUARDA ESTE CÓDIGO DE RECUPERACIÓN:',
    'si_olvidas_pin': 'Si olvidas tu PIN, lo necesitarás obligatoriamente para no perder el acceso.',
    'ya_copiaste': '¿Ya lo copiaste y guardaste en un lugar seguro?',
    'operacion_cancelada': 'Operación cancelada. Debes guardar el código de recuperación.',
    'pin_configurado': '✅ PIN configurado exitosamente.',
    'codigo_recuperacion': 'Ingresa tu código de recuperación (formato XXXX-XXXX-...):',
    'nuevo_pin': 'Ingresa tu nuevo PIN de acceso (4-6 dígitos):',
    'confirma_pin': 'Confirma tu nuevo PIN:',
    'pin_restablecido': '✅ Tu PIN ha sido restablecido exitosamente.',
    'codigo_incorrecto': '❌ El código de recuperación ingresado es incorrecto.',
    'reset_confirmacion1': '⚠️ RESET DE EMERGENCIA\n• Eliminará tu PIN\n• Eliminará tu código de recuperación\n• Eliminará tu clave privada local\n• ¡NO podrás volver a descifrar mensajes antiguos!\n¿Deseas continuar bajo tu propio riesgo?',
    'reset_confirmacion2': 'ÚLTIMA ADVERTENCIA\n¿Estás absolutamente seguro de que deseas proceder?',
    'confirmacion_final': 'Para confirmar el borrado completo, escribe la palabra "RESET":',
    'cancelado': '❌ Cancelado. No se realizaron cambios.',
    'reset_completado': '✅ Reset completado. La aplicación se reiniciará.',
    'no_pin_configurado': 'No tienes un PIN de acceso configurado.\n¿Deseas configurar uno ahora?',
    'pin_actual': 'Ingresa tu PIN actual:',
    'pin_modificado': '✅ Tu PIN ha sido modificado correctamente.',
    'identificador_guardado': '✅ Identificador guardado con éxito localmente.',
    'asignar_identificador': '👤 Asignar Identificador',
    'escribe_nombre': 'Escribe un nombre o alias para el PIN:',
    'error_prefs': 'Error prefs:',
    'error': 'Error:',
    'fallo_actualizar': 'Fallo al actualizar el modo privado.',
    'no_chats_activos': 'No tienes chats activos',
    'usa_boton': 'Usa el botón "+" abajo para agregar un contacto',
    'toca_abrir': 'Toca para abrir la conversación',
    'tienes_mensajes': '📨 Tienes mensajes sin leer',
    'lista_vacia': 'Tu lista de contactos está vacía',
    'agrega_contactos': 'Agrega contactos compartiendo sus PINs de Kerix',
    'editar_alias': '¿Deseas editar el nombre o alias de este PIN?',
    'presiona_cancelar': '(Presiona "Cancelar" si en su lugar deseas eliminar el contacto)',
    'eliminar_confirmacion': '¿Estás seguro de que deseas eliminar a',
    'de_tus_contactos': 'de tus contactos?',
    'pin_kerix_invalido': 'El PIN de Kerix debe tener exactamente 8 caracteres hexadecimales.',
    'no_puedes_agregarte': 'No puedes agregarte a ti mismo.',
    'ya_en_lista': 'Este contacto ya se encuentra en tu lista.',
    'pin_bloqueado': 'Este PIN está bloqueado. ¿Deseas desbloquearlo y agregarlo?',
    'guardar_identificador': '👤 Guardar Identificador',
    'quieres_nombre': '¿Quieres ponerle un nombre o alias a este PIN para reconocerlo localmente? (Opcional):',
    'bloquear_confirmacion': '¿Deseas bloquear de forma definitiva el PIN',
    'no_recibir_mensajes': '? No podrás recibir sus mensajes.',
    'eliminar_actual': '¿Deseas eliminar a',
    'seleccionar_mensajes_info': 'Toca los mensajes para seleccionarlos individualmente. Usa la papelera para borrarlos.',
    'no_seleccionados': 'No has seleccionado ningún mensaje.',
    'borrar_irreversible': '¿Deseas borrar de forma irreversible los',
    'mensajes_seleccionados': 'mensajes seleccionados?',
    'mensajes_borrados': '✅ Mensajes borrados.',
    'borrar_todo_chat': '⚠️ ¿Deseas borrar TODO el historial de este chat? Esta acción es irreversible.',
    'chat_vaciado': '✅ Historial de chat vaciado.',
    'archivo_listo': '📎 Archivo listo para enviar:',
    'tamaño_maximo': 'El tamaño máximo de archivo admitido es de 50 MB.',
    'no_verificar_llave': '⚠️ No se pudo verificar la llave de cifrado del contacto.',
    'error_cifrar': 'Error al intentar cifrar el mensaje.',
    'error_subir': 'Error al subir el archivo adjunto:',
    'error_insertar': 'Error al insertar el mensaje en la red.',
    'no_mensaje_vacio': 'No puedes enviar un mensaje vacío.',
    'descifrando_adjunto': '🔐 Descifrando adjunto seguro...',
    'error_ruta': '⚠️ Error: Ruta corrupta',
    'no_descifrar': '⚠️ No se pudo descifrar este archivo',
    'codigo_invalido': 'Código de activación inválido.',
    'procesando': 'Procesando...',
    'servicio_activado': '¡Servicio activado! Vence el:',
    'error_activacion': 'Error:',
    'codigo_usado': 'Código ya utilizado o inválido.',
    'fallo_conexion': 'Fallo de conexión:',
    'pin_copiado': 'Tu PIN',
    'ha_copiado': 'ha sido copiado al portapapeles.',
    'exportar_llave': '🔒 Exportar Llave',
    'contraseña_respaldo': 'Crea una contraseña para cifrar el respaldo (mínimo 4 caracteres):',
    'contraseña_minima': 'La contraseña de respaldo debe ser de al menos 4 caracteres.',
    'codigo_2fa': '🔑 Tu código de seguridad 2FA es:',
    'escrbelo': 'Escríbelo para poder restaurarlo más tarde.',
    'primero_desbloquea': 'Primero desbloquea la aplicación.',
    'respaldo_copiado': '✅ Respaldo copiado al portapapeles correctamente.',
    '2fa_obligatorio': '2FA obligatorio:',
    'error_empaquetado': 'Error de empaquetado:',
    'importar_llave': '📥 Importar Llave',
    'pega_respaldo': 'Pega aquí el contenido cifrado del respaldo:',
    'contraseña': 'Contraseña',
    'ingresa_contraseña': 'Ingresa la contraseña con la que cifraste el respaldo:',
    'doble_factor': '🔐 Doble Factor',
    'ingresa_codigo_2fa': 'Ingresa el código de seguridad 2FA que se generó al exportar:',
    'codigo_2fa_incorrecto': '❌ El código 2FA ingresado es incorrecto.',
    'clave_importada': '✅ Clave de respaldo importada con éxito.',
    'respaldo_corrupto': '❌ Respaldo corrupto o contraseña incorrecta.',
    'advertencia_fs': '⚠️ ALERTA DE SEGURIDAD\nTodos los mensajes antiguos quedarán completamente ILEGIBLES una vez que roten tus llaves.\n¿Quieres activar esta funcionalidad?',
    'backup_descifrado': '¿Quieres descargar un backup descifrado en HTML de todos tus chats antes de activar esto?',
    'activar_fs': '🔐 ¿Activar Perfect Forward Secrecy ahora?',
    'fs_activado': '✅ Forward Secrecy activado.',
    'desactivar_fs': '¿Desactivar la propiedad de Forward Secrecy?',
    'funcionalidad_desactivada': '✅ Funcionalidad desactivada.',
    'backup_descargado': '✅ El archivo de respaldo se ha descargado de manera segura.',
    'error_exportar': '❌ Error al exportar:',
    'desbloquea_app': 'Por favor, desbloquea la aplicación.',
    'backup_descargado_plano': '✅ Clave de respaldo descargada en texto plano.',
    'error_generar_backup': 'Error al generar el backup:',
    'no_soporta_notificaciones': '❌ Tu navegador no soporta notificaciones nativas.',
    'notificaciones_autorizadas': '✅ Las notificaciones ya están autorizadas.',
    'permisos_denegados': '❌ Permisos denegados. Debes habilitarlos manualmente desde el candado de la barra del navegador.',
    'permiso_concedido': '✅ Permiso de notificación concedido.',
    'notificaciones_activadas': 'Notificaciones activadas con éxito. ✅',
    'preferencias_aplicadas': '✅ Preferencias de notificación aplicadas con éxito.',
    'notificacion_prueba': 'Kerix Chat - Prueba',
    'notificaciones_ejecutando': 'Las notificaciones nativas se están ejecutando. ✅',
    'notificacion_disparada': '✅ Notificación de prueba disparada.',
    'no_permisos_aprobados': '❌ No hay permisos aprobados para notificaciones aún.',
    'error_inicializacion': '⚠️ Error durante la inicialización de módulos:',
    'storage_funciona': '✅ Storage y buckets de Supabase funcionan correctamente!',
    'error_conexion_storage': 'Error de conexión con Storage:',
    'error_listando': '❌ Error listando buckets:',
    'bucket_no_existe': '❌ El bucket "chat-files" no existe en la instancia de Supabase.',
    'error_subir_prueba': '❌ Error al subir archivo de prueba:',
    'error_url_firmada': '❌ Error creando URL firmada:',
    
    // Selector de idioma
    'idioma': 'Idioma',
    'espanol': 'Español',
    'ingles': 'English',
    'portugues': 'Português'
  },
  
  en: {
    // Agrega aquí las traducciones al inglés
    'chat_bloqueado': 'Kerix Locked',
    'ingresa_pin': 'Enter your access PIN',
    'desbloquear': 'Unlock',
    // ... más traducciones
  },
  
  pt: {
    // Agrega aquí las traducciones al portugués
    'chat_bloqueado': 'Kerix Bloqueado',
    'ingresa_pin': 'Digite seu PIN de acesso',
    'desbloquear': 'Desbloquear',
    // ... más traducciones
  }
};

// Idioma actual (por defecto español)
var idiomaActual = localStorage.getItem('kerix_idioma') || 'es';

// Función para obtener traducción
function t(key) {
  if (translations[idiomaActual] && translations[idiomaActual][key]) {
    return translations[idiomaActual][key];
  }
  // Fallback a español si no existe la traducción
  if (translations['es'][key]) {
    return translations['es'][key];
  }
  // Si no existe en ningún idioma, devuelve la clave
  return key;
}

// Función para cambiar idioma
function cambiarIdioma(nuevoIdioma) {
  if (!translations[nuevoIdioma]) {
    console.error('Idioma no soportado:', nuevoIdioma);
    return;
  }
  
  idiomaActual = nuevoIdioma;
  localStorage.setItem('kerix_idioma', nuevoIdioma);
  
  // Actualizar todos los elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(function(element) {
    var key = element.getAttribute('data-i18n');
    var traduccion = t(key);
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      if (element.hasAttribute('placeholder')) {
        element.placeholder = traduccion;
      } else {
        element.value = traduccion;
      }
    } else if (element.tagName === 'BUTTON' || element.tagName === 'SPAN' || element.tagName === 'DIV' || element.tagName === 'H2' || element.tagName === 'P') {
      element.innerText = traduccion;
    }
  });
  
  // Actualizar select de idioma si existe
  var selectIdioma = document.getElementById('selectorIdioma');
  if (selectIdioma) {
    selectIdioma.value = idiomaActual;
  }
  
  console.log('Idioma cambiado a:', idiomaActual);
}

// Función para inicializar el sistema de idiomas
function inicializarIdioma() {
  // Cargar idioma guardado o usar español por defecto
  idiomaActual = localStorage.getItem('kerix_idioma') || 'es';
  
  // Aplicar traducciones al cargar
  document.addEventListener('DOMContentLoaded', function() {
    cambiarIdioma(idiomaActual);
  });
}

// Inicializar automáticamente
inicializarIdioma();
