/**
 * js/app.js
 * Orquestador principal: UI, navegación, mensajes, contactos, inicialización e integraciones.
 * * Correcciones añadidas:
 * - Integración de E2EE en enviarMensaje y descarga de historial.
 * - Subida básica de archivos a Supabase Storage y mensajería con metadatos.
 * - Gestión local de contactos y alias.
 * - Utilidades: obtenerNombreContacto, actualizarBadgeChats, copiarPIN, testearStorage.
 */

var SUPABASE_URL = 'https://dksmoteiidjpymextrgj.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_HuXshjcD1Je934lVgBcJtw_5kFSuGzE';
var DEBUG = false;

var miPIN = '';
var contactoActual = '';
var canalRealtime = null;
var archivoSeleccionado = null;
var miClavePrivada = null;
var miClavePublica = null;
var mensajesNoLeidos = {};
var modoPrivado = false;
var modoSeleccion = false;
var mensajesSeleccionados = [];
var tabActual = 'chats';
var cacheArchivosDescifrados = {};

var prefs = {
  autoEliminarMin: 0,
  rotacionClavesDias: 0,
  forwardSecrecy: false
};

var prefsNotificaciones = {
  nativas: true,
  visuales: true,
  sonido: true,
  vibracion: true,
  mostrarContenido: true
};

// ============================================
// INICIALIZACIÓN GENERAL
// ============================================
async function inicializarTodo() {
  if (typeof inicializarSupabase === 'function') {
    inicializarSupabase();
  }
  if (typeof cargarPrefsNotificaciones === 'function') {
    cargarPrefsNotificaciones();
  }
  console.log('🚀 Todo el sistema Kerix ha sido inicializado.');
}

function generarPIN() {
  if (miPIN) return miPIN;
  var localPin = localStorage.getItem('kerix_mi_pin');
  if (localPin) {
    miPIN = localPin;
  } else {
    var caracteres = '0123456789ABCDEF';
    var resultado = '';
    var randomBytes = crypto.getRandomValues(new Uint8Array(8));
    for (var i = 0; i < 8; i++) {
      resultado += caracteres[randomBytes[i] % 16];
    }
    miPIN = resultado;
    localStorage.setItem('kerix_mi_pin', miPIN);
  }
  var elPin = document.getElementById('menuMiPin');
  if (elPin) elPin.innerText = miPIN;
  return miPIN;
}

// ============================================
// MENÚ LATERAL Y NAVEGACIÓN
// ============================================
function abrirMenu() {
  var menu = document.getElementById('menuLateral');
  var overlay = document.getElementById('menuOverlay');
  if (menu) { menu.classList.add('active'); menu.classList.add('open'); }
  if (overlay) { overlay.classList.add('active'); overlay.classList.add('open'); }
}

function cerrarMenu() {
  var menu = document.getElementById('menuLateral');
  var overlay = document.getElementById('menuOverlay');
  if (menu) { menu.classList.remove('active'); menu.classList.remove('open'); }
  if (overlay) { overlay.classList.remove('active'); overlay.classList.remove('open'); }
}

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab').forEach(function(el) {
    el.classList.remove('active');
  });
  var tabActivo = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (tabActivo) tabActivo.classList.add('active');
  console.log('Navegando a la pestaña: ' + tab);
}

// ============================================
// CONTACTOS
// ============================================
function obtenerNombreContacto(pin) {
  var data = localStorage.getItem('contacto_' + pin);
  if (!data) return pin;
  try {
    var obj = JSON.parse(data);
    return obj.alias || pin;
  } catch (e) { return pin; }
}

function guardarContactoLocal(pin, alias) {
  var obj = { pin: pin, alias: alias || '' };
  localStorage.setItem('contacto_' + pin, JSON.stringify(obj));
}

function renderContactosList() {
  var cont = document.getElementById('contenedorContactos');
  if (!cont) return;
  cont.innerHTML = '';
  // iterate localStorage keys for contactos
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k || !k.startsWith('contacto_')) continue;
    try {
      var obj = JSON.parse(localStorage.getItem(k));
      var div = document.createElement('div');
      div.className = 'chat-item';
      div.innerHTML = '<div class="chat-avatar">' + (obj.alias ? obj.alias.charAt(0).toUpperCase() : obj.pin.charAt(0)) + '</div>'
        + '<div class="chat-info"><div class="chat-nombre">' + (obj.alias || obj.pin) + '</div><div class="chat-ultimo">' + obj.pin + '</div></div>';
      div.addEventListener('click', (function(pin){ return function(){ abrirChat(pin); }; })(obj.pin));
      cont.appendChild(div);
    } catch (e) { continue; }
  }
}

function agregarContacto() {
  var input = document.getElementById('nuevoContactoPin');
  if (!input) return;
  var pin = input.value.trim().toUpperCase();
  if (!window.validarPIN || !window.validarPIN(pin)) {
    customAlert('El PIN debe tener 8 caracteres hexadecimales.');
    return;
  }
  if (pin === miPIN) { customAlert('No puedes agregarte a ti mismo.'); return; }

  // Guardar localmente
  guardarContactoLocal(pin, '');
  renderContactosList();

  // Intentar obtener clave pública del backend y guardarla
  if (typeof SupabaseUsuarios !== 'undefined') {
    SupabaseUsuarios.obtenerUsuario(pin).then(function(u){
      if (u && u.clave_publica) {
        localStorage.setItem('clave_pub_' + pin, u.clave_publica);
      } else {
        console.log('Usuario no registrado en backend (clave pública no encontrada)');
      }
    }).catch(function(e){ console.warn('Fallo busqueda usuario:', e); });
  }

  console.log('Contacto agregado: ' + pin);
  input.value = '';
  cerrarModalAgregar();
}

// ============================================
// RENDER MENSAJES (UI)
// ============================================
function appendMessageToUI(pinRemitente, texto, enviado) {
  var zona = document.getElementById('zonaMensajes');
  if (!zona) return;
  var m = document.createElement('div');
  m.className = 'mensaje ' + (enviado ? 'mensaje-enviado' : 'mensaje-recibido');
  m.innerHTML = '<div class="mensaje-texto">' + (texto) + '</div><div class="mensaje-meta">' + (new Date()).toLocaleTimeString() + '</div>';
  zona.appendChild(m);
  zona.scrollTop = zona.scrollHeight;
}

// ============================================
// ENVÍO Y PROCESAMIENTO DE MENSAJES Y ARCHIVOS
// ============================================
async function enviarMensaje() {
  var input = document.getElementById('nuevoMensaje');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto) return;
  if (!contactoActual) { await customAlert('Selecciona un contacto primero.'); return; }

  // Intentar obtener clave pública del contacto
  var clavePub = localStorage.getItem('clave_pub_' + contactoActual);
  if (!clavePub && typeof SupabaseUsuarios !== 'undefined') {
    try {
      var u = await SupabaseUsuarios.obtenerUsuario(contactoActual);
      if (u && u.clave_publica) {
        clavePub = u.clave_publica;
        localStorage.setItem('clave_pub_' + contactoActual, clavePub);
      }
    } catch (e) { console.warn('No se pudo obtener clave pública:', e); }
  }

  var payloadToStore = null;
  var tipo = 'text';

  if (clavePub && typeof cifrarMensajeE2EE === 'function') {
    // cifrado E2EE
    try {
      var cif = await cifrarMensajeE2EE(texto, clavePub);
      payloadToStore = cif; // object with iv, ciphertext, key_receptor, key_emisor
      tipo = 'text_e2ee';
    } catch (e) {
      console.error('Error cifrando mensaje:', e);
      await customAlert('No se pudo cifrar el mensaje. Enviando sin cifrar.');
      payloadToStore = { plaintext: texto };
      tipo = 'text_plain';
    }
  } else {
    // sin clave pública, enviar en texto claro (temporal)
    payloadToStore = { plaintext: texto };
    tipo = 'text_plain';
  }

  // Construir objeto para DB
  var mensajeDB = {
    pin_remitente: miPIN,
    pin_destinatario: contactoActual,
    tipo: tipo,
    contenido: JSON.stringify(payloadToStore),
    creado_en: new Date().toISOString()
  };

  if (typeof SupabaseMensajes !== 'undefined') {
    try {
      var inserted = await SupabaseMensajes.enviarMensajePayload(mensajeDB);
      console.log('Mensaje almacenado en backend:', inserted);
    } catch (e) { console.error('Error guardando mensaje en backend:', e); }
  }

  appendMessageToUI(miPIN, texto, true);
  input.value = '';
  input.style.height = 'auto';
}

async function enviarArchivo(file) {
  if (!file) return;
  if (!contactoActual) { await customAlert('Selecciona un contacto primero.'); return; }
  if (typeof inicializarSupabase === 'function') inicializarSupabase();
  if (typeof clienteSupabase === 'undefined' || !clienteSupabase) { await customAlert('Supabase no inicializado.'); return; }

  var valid = validarArchivo(file);
  if (!valid.valido) { await customAlert('Archivo inválido: ' + valid.error); return; }

  var path = miPIN + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  var bucket = 'chat-files';
  try {
    var up = await clienteSupabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
    if (up.error) throw up.error;
    // Crear URL firmada corta
    var urlRes = await clienteSupabase.storage.from(bucket).createSignedUrl(path, 60*60);
    var fileUrl = urlRes.data && urlRes.data.signedUrl ? urlRes.data.signedUrl : null;

    var payload = { fileName: file.name, url: fileUrl, size: file.size };
    var mensajeDB = {
      pin_remitente: miPIN,
      pin_destinatario: contactoActual,
      tipo: 'file',
      contenido: JSON.stringify(payload),
      creado_en: new Date().toISOString()
    };
    if (typeof SupabaseMensajes !== 'undefined') await SupabaseMensajes.enviarMensajePayload(mensajeDB);

    appendMessageToUI(miPIN, '📎 Archivo enviado: ' + file.name, true);
  } catch (e) {
    console.error('Error subiendo archivo:', e);
    await customAlert('Error subiendo archivo: ' + e.message);
  }
}

async function descargarYDescifrarArchivo(url, claveCifrada) {
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('Error descargando archivo: ' + res.status);
    var blob = await res.blob();
    // TODO: Si se aplica cifrado de archivo, descifrar aquí usando claveCifrada
    return blob;
  } catch (e) {
    console.error('Error en descarga/descifrado:', e);
    throw e;
  }
}

// ============================================
// HISTORIAL
// ============================================
async function cargarHistorial(contactoPin) {
  if (typeof SupabaseMensajes === 'undefined') return;
  var mensajes = await SupabaseMensajes.descargarHistorial(miPIN, contactoPin);
  var zona = document.getElementById('zonaMensajes');
  if (zona) zona.innerHTML = '';
  for (var i = 0; i < mensajes.length; i++) {
    var m = mensajes[i];
    var contenido = null;
    try { contenido = JSON.parse(m.contenido); } catch (e) { contenido = { plaintext: m.contenido }; }
    var soyRemitente = (m.pin_remitente === miPIN);
    if (m.tipo === 'text_e2ee' && contenido) {
      try {
        var texto = await descifrarMensajeE2EE(contenido, soyRemitente);
        appendMessageToUI(m.pin_remitente, texto, soyRemitente);
      } catch (e) {
        appendMessageToUI(m.pin_remitente, '[No se pudo descifrar mensaje]', soyRemitente);
      }
    } else if (m.tipo === 'text_plain') {
      var texto = contenido && contenido.plaintext ? contenido.plaintext : '[Sin contenido]';
      appendMessageToUI(m.pin_remitente, texto, soyRemitente);
    } else if (m.tipo === 'file') {
      var info = contenido || {};
      appendMessageToUI(m.pin_remitente, '📎 Archivo: ' + (info.fileName || 'adjunto'), soyRemitente);
    } else {
      appendMessageToUI(m.pin_remitente, '[Tipo desconocido]', soyRemitente);
    }
  }
}

// ============================================
// UTILIDADES DE INTERFAZ Y NOTIFICACIONES
// ============================================
function actualizarBadgeChats() {
  var badge = document.getElementById('badgeTotalChats');
  var count = Object.keys(mensajesNoLeidos).reduce(function(acc, k){ return acc + (mensajesNoLeidos[k] || 0); }, 0);
  if (badge) {
    if (count > 0) { badge.style.display = 'inline-block'; badge.innerText = String(count); }
    else badge.style.display = 'none';
  }
}

async function copiarPIN() {
  try {
    await navigator.clipboard.writeText(miPIN);
    await customAlert('✅ PIN copiado al portapapeles.');
  } catch (e) {
    console.warn('No se pudo copiar al portapapeles', e);
    await customAlert('No se pudo copiar al portapapeles.');
  }
}

async function testearStorage() {
  try {
    if (typeof inicializarSupabase === 'function') inicializarSupabase();
    if (!clienteSupabase) { await customAlert('Supabase no inicializado.'); return; }
    var bucket = 'chat-files';
    // Intentar listar u obtener info
    var { data, error } = await clienteSupabase.storage.list(bucket);
    if (error) { await customAlert('Error accediendo storage: ' + error.message); return; }
    await customAlert('✅ Storage accesible. Objetos: ' + (data.length || 0));
  } catch (e) {
    console.error('Error testearStorage:', e);
    await customAlert('Error testando storage: ' + e.message);
  }
}

// ============================================
// DOM LOADED TRIGGER
// ============================================
window.addEventListener('DOMContentLoaded', async function() {
  try {
    generarPIN();
    await inicializarTodo();
    if (typeof verificarPINConfigurado === 'function') {
      await verificarPINConfigurado();
    }
    renderContactosList();

    // Hook archivo input
    var fileInput = document.getElementById('archivoInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e){
        var f = e.target.files && e.target.files[0];
        if (f) enviarArchivo(f);
      });
    }

    // Crecimiento elástico para textarea de chat
    var textInput = document.getElementById('nuevoMensaje');
    if (textInput) {
      textInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      });
    }
  } catch (error) {
    console.error('Error durante la inicialización:', error);
    var bloqueo = document.getElementById('pantallaBloqueo');
    var principal = document.getElementById('appPrincipal');
    if (bloqueo) bloqueo.style.display = 'none';
    if (principal) principal.style.display = 'block';
    await customAlert('⚠️ Error de arranque de módulos de seguridad: ' + (error.message || error));
  }
});

// ============================================
// 🌍 EXPOSICIÓN EXPLÍCITA PARA CSP Y HANDLERS
// ============================================
window.abrirMenu = abrirMenu;
window.cerrarMenu = cerrarMenu;
window.cambiarTab = cambiarTab;
window.abrirChat = function(pin){ abrirChat(pin); cargarHistorial(pin); };
window.cerrarChat = cerrarChat;
window.mostrarModalAgregar = mostrarModalAgregar;
window.cerrarModalAgregar = cerrarModalAgregar;
window.agregarContacto = agregarContacto;
window.enviarMensaje = enviarMensaje;
window.enviarArchivo = enviarArchivo;
window.descargarYDescifrarArchivo = descargarYDescifrarArchivo;
window.customAlert = customAlert;
window.customConfirm = customConfirm;
window.customPrompt = customPrompt;
window.generarPIN = generarPIN;
window.obtenerNombreContacto = obtenerNombreContacto;
window.actualizarBadgeChats = actualizarBadgeChats;
window.copiarPIN = copiarPIN;
window.testearStorage = testearStorage;

console.log('🎯 Orquestador de la app (app.js) actualizado y cargado correctamente.');
