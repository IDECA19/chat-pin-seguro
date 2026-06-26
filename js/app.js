/**
 * js/app.js
 * Orquestador principal: UI, navegación, mensajes, contactos, inicialización
 * 
 * Depende de:
 * - security.js (hashPIN, cifrarClaveConPIN, descifrarClaveConPIN, verificarPINConfigurado, etc.)
 * - crypto.js (generarClaves, cifrarMensaje, descifrarMensaje, etc.)
 * - notifications.js (notificarNuevoMensaje, cargarPrefsNotificaciones, etc.)
 * - webrtc.js (iniciarLlamada, suscribirseALlamadas, etc.)
 */

// ============================================
// 🌐 VARIABLES GLOBALES
// ============================================
var SUPABASE_URL = 'https://dksmoteiidjpymextrgj.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_HuXshjcD1Je934lVgBcJtw_5kFSuGzE';
var DEBUG = false;

var miPIN = '';
var clienteSupabase = null;
var contactoActual = '';
var canalRealtime = null;
var archivoSeleccionado = null;
var miClavePrivada = null;
var miClavePublica = null;
var mensajesNoLeidos = {};
var modoPrivado = false;
// Estas variables ya están definidas en security.js
// var pinAccesoHash = null;
// var codigoRecuperacionHash = null;
// var pinActualTemporal = null;
var modoSeleccion = false;
var mensajesSeleccionados = [];
var tabActual = 'chats';
var cacheArchivosDescifrados = {};

var prefs = {
  auto_destruccion_dias: 0, 
  rotacion_claves_dias: 0, 
  ocultar_al_cambiar: false,
  borrado_seguro: false, 
  dosfa_backup: false, 
  limpieza_metadatos: false, 
  forward_secrecy: false
};

var prefsNotificaciones = { 
  nativas: true, 
  visuales: true, 
  sonido: true, 
  vibracion: true, 
  mostrarContenido: true 
};

// ============================================
// 📝 LOGGING
// ============================================
function log(msg) { if (DEBUG) console.log(msg); }
function logError(msg, error) {
  console.error('', msg);
  if (error) {
    if (typeof error === 'object') {
      if (error.message) console.error('   Mensaje:', error.message);
      if (error.details) console.error('   Detalles:', error.details);
    } else { console.error('   Error:', error); }
  }
}

// ============================================
// ⏱️ RATE LIMITING BÁSICO
// ============================================
var ultimoEnvio = 0;
async function puedeEnviar() {
  var ahora = Date.now();
  if (ahora - ultimoEnvio < 1000) { 
    await customAlert('⏱️ Espera un momento antes de enviar otro mensaje.', '⏱️'); 
    return false; 
  }
  ultimoEnvio = ahora;
  return true;
}

// ============================================
// 🔧 UTILIDADES
// ============================================
function ofuscarClave(clave) { 
  if (!clave) return clave; 
  return btoa(clave.split('').reverse().join('')); 
}

function desofuscarClave(ofuscada) { 
  if (!ofuscada) return ofuscada; 
  return atob(ofuscada).split('').reverse().join(''); 
}

function formatBytes(bytes, decimals) {
  if (!bytes || bytes === 0) return '0 Bytes';
  decimals = decimals || 2;
  var k = 1024;
  var sizes = ['Bytes', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function obtenerPathDesdeUrl(url) {
  if (!url) return null;
  try {
    if (url.includes('/storage/v1/object/')) {
      var match = url.match(/\/chat-files\/([^?]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  } catch (e) { logError('Error extrayendo path:', e); }
  return null;
}

function escapeHtml(t) { 
  if(!t) return ''; 
  var d = document.createElement('div'); 
  d.appendChild(document.createTextNode(t)); 
  return d.innerHTML; 
}

// ============================================
//  NAVEGACIÓN Y UI
// ============================================
function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.getElementById('contenidoChats').classList.add('hidden');
  document.getElementById('contenidoContactos').classList.add('hidden');
  document.getElementById('contenidoAjustes').classList.add('hidden');
  document.getElementById('contenido' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
  document.getElementById('fabAgregar').style.display = (tab === 'chats' || tab === 'contactos') ? 'flex' : 'none';
  if (tab === 'chats') renderizarChats();
  else if (tab === 'contactos') renderizarContactos();
}

function abrirMenu() { 
  document.getElementById('menuOverlay').classList.add('active'); 
  document.getElementById('menuLateral').classList.add('active'); 
}

function cerrarMenu() { 
  document.getElementById('menuOverlay').classList.remove('active'); 
  document.getElementById('menuLateral').classList.remove('active'); 
}

function mostrarModalAgregar() { 
  document.getElementById('modalAgregar').classList.add('active'); 
  setTimeout(() => document.getElementById('nuevoContactoPin').focus(), 100); 
}

function cerrarModalAgregar() { 
  document.getElementById('modalAgregar').classList.remove('active'); 
}

function abrirConfigSeguridad() { 
  document.getElementById('modalSeguridad').classList.add('active'); 
}

function cerrarModalSeguridad() { 
  document.getElementById('modalSeguridad').classList.remove('active'); 
}

function abrirConfigNotificaciones() {
  document.getElementById('notifNativas').checked = prefsNotificaciones.nativas;
  document.getElementById('notifVisuales').checked = prefsNotificaciones.visuales;
  document.getElementById('notifSonido').checked = prefsNotificaciones.sonido;
  document.getElementById('notifVibracion').checked = prefsNotificaciones.vibracion;
  document.getElementById('notifContenido').checked = prefsNotificaciones.mostrarContenido;
  document.getElementById('modalNotificaciones').classList.add('active');
}

function cerrarModalNotificaciones() { 
  document.getElementById('modalNotificaciones').classList.remove('active'); 
}

function mostrarBackupMenu() { 
  document.getElementById('modalBackup').classList.add('active'); 
}

function cerrarModalBackup() { 
  document.getElementById('modalBackup').classList.remove('active'); 
}

function mostrarOpcionesChat() { 
  document.getElementById('modalOpcionesChat').classList.add('active'); 
}

function cerrarModalOpcionesChat() { 
  document.getElementById('modalOpcionesChat').classList.remove('active'); 
}

// ============================================
// 👤 GESTIÓN DE ALIAS
// ============================================
function getAliases() {
  var a = localStorage.getItem('aliases_' + miPIN);
  return a ? JSON.parse(a) : {};
}

function guardarAliases(a) {
  localStorage.setItem('aliases_' + miPIN, JSON.stringify(a));
}

function obtenerNombreContacto(pin) {
  var a = getAliases();
  return a[pin] || pin;
}

async function editarAliasContacto(pin) {
  var actual = obtenerNombreContacto(pin);
  var actualValor = (actual === pin) ? '' : actual;
  var nuevoNombre = await customPrompt(' Asignar Identificador', 'Escribe un nombre o alias para el PIN: ' + pin, actualValor);
  if (nuevoNombre === null) return;
  
  var a = getAliases();
  nuevoNombre = nuevoNombre.trim();
  if (nuevoNombre === '') { delete a[pin]; }
  else { a[pin] = nuevoNombre; }
  guardarAliases(a);
  
  await customAlert('✅ Identificador guardado con éxito localmente.', '✅');
  
  if (tabActual === 'chats') renderizarChats();
  else if (tabActual === 'contactos') renderizarContactos();
  
  if (contactoActual === pin) {
    var subtexto = (nuevoNombre !== '') ? ' (' + pin + ')' : '';
    document.getElementById('chatNombre').innerHTML = obtenerNombreContacto(pin) + ' <span style="font-size:11px; opacity:0.7; font-weight: normal;">' + subtexto + '</span>';
    document.getElementById('chatAvatar').innerText = obtenerNombreContacto(pin).substring(0, 2).toUpperCase();
  }
}

async function editarAliasContactoActual() {
  if (!contactoActual) return;
  cerrarModalOpcionesChat();
  await editarAliasContacto(contactoActual);
}

// ============================================
// ⚙️ PREFERENCIAS
// ============================================
async function cargarPreferencias() {
  try {
    var { data } = await clienteSupabase.from('usuarios')
      .select('auto_destruccion_dias, rotacion_claves_dias, ocultar_al_cambiar, borrado_seguro, dosfa_backup, limpieza_metadatos, forward_secrecy')
      .eq('pin', miPIN)
      .single();
    
    if (data) {
      prefs.auto_destruccion_dias = data.auto_destruccion_dias || 0;
      prefs.rotacion_claves_dias = data.rotacion_claves_dias || 0;
      prefs.ocultar_al_cambiar = data.ocultar_al_cambiar === true;
      prefs.borrado_seguro = data.borrado_seguro === true;
      prefs.dosfa_backup = data.dosfa_backup === true;
      prefs.limpieza_metadatos = data.limpieza_metadatos === true;
      prefs.forward_secrecy = data.forward_secrecy === true;
    }
    
    localStorage.setItem('prefs_' + miPIN, JSON.stringify(prefs));
    document.getElementById('prefAutoDestruccion').value = prefs.auto_destruccion_dias;
    document.getElementById('prefRotacionClaves').value = prefs.rotacion_claves_dias;
    document.getElementById('prefOcultarCambiar').checked = prefs.ocultar_al_cambiar;
    document.getElementById('prefBorradoSeguro').checked = prefs.borrado_seguro;
    document.getElementById('prefDosfa').checked = prefs.dosfa_backup;
    document.getElementById('prefLimpiezaMeta').checked = prefs.limpieza_metadatos;
    actualizarStatusPreferencias();
  } catch (error) {
    logError('Error prefs:', error);
    var prefsLocal = localStorage.getItem('prefs_' + miPIN);
    if (prefsLocal) { prefs = JSON.parse(prefsLocal); actualizarStatusPreferencias(); }
  }
}

function actualizarStatusPreferencias() {
  var btnA = document.getElementById('btnActivarFS');
  var btnD = document.getElementById('btnDesactivarFS');
  if (prefs.forward_secrecy) { 
    if (btnA) btnA.style.display = 'none'; 
    if (btnD) btnD.style.display = 'block'; 
  } else { 
    if (btnA) btnA.style.display = 'block'; 
    if (btnD) btnD.style.display = 'none'; 
  }
}

async function guardarPreferencia(campo, valor) {
  prefs[campo] = parseInt(valor);
  localStorage.setItem('prefs_' + miPIN, JSON.stringify(prefs));
  try { 
    await clienteSupabase.from('usuarios').update({ [campo]: parseInt(valor) }).eq('pin', miPIN); 
  } catch (e) { logError('Error:', e); }
}

async function guardarPreferenciaBool(campo, valor) {
  prefs[campo] = valor;
  localStorage.setItem('prefs_' + miPIN, JSON.stringify(prefs));
  try { 
    await clienteSupabase.from('usuarios').update({ [campo]: valor }).eq('pin', miPIN); 
  } catch (e) { logError('Error:', e); }
}

document.addEventListener('visibilitychange', function() {
  if (!prefs.ocultar_al_cambiar) return;
  document.querySelectorAll('.mensaje').forEach(m => {
    m.style.filter = document.hidden ? 'blur(15px)' : 'none';
  });
});

// ============================================
// 👥 CONTACTOS Y CHATS
// ============================================
function getContactos() { 
  var c = localStorage.getItem('contactos_' + miPIN); 
  return c ? JSON.parse(c) : []; 
}

function guardarContactos(c) { 
  localStorage.setItem('contactos_' + miPIN, JSON.stringify(c)); 
}

function getBloqueados() { 
  var b = localStorage.getItem('bloqueados_' + miPIN); 
  return b ? JSON.parse(b) : []; 
}

function guardarBloqueados(b) { 
  localStorage.setItem('bloqueados_' + miPIN, JSON.stringify(b)); 
}

// ============================================
// 🔔 RENDERIZAR CHATS CON INDICADORES VISUALES
// ============================================
function renderizarChats() {
  var contactos = getContactos();
  var cont = document.getElementById('contenidoChats');
  
  if (contactos.length === 0) {
    cont.innerHTML = '<div class="estado-vacio"><div class="estado-vacio-icono">💬</div><div class="estado-vacio-texto">No tienes chats activos</div><div class="estado-vacio-sub">Usa el botón "+" abajo para agregar un contacto</div></div>';
    return;
  }
  
  var html = '';
  contactos.forEach(function(pin) {
    var noLeidos = mensajesNoLeidos[pin] || 0;
    var badge = noLeidos > 0 ? '<div class="chat-badge">' + noLeidos + '</div>' : '';
    var ultimo = noLeidos > 0 ? '📨 Tienes mensajes sin leer' : 'Toca para abrir la conversación';
    var hora = '';
    var nombre = obtenerNombreContacto(pin);
    var subNombre = (nombre !== pin) ? ' <span style="font-size:11px; color:#8696a0; font-weight:normal;">(' + pin + ')</span>' : '';
    var claseExtra = noLeidos > 0 ? ' no-leido' : '';
    
    html += '<div class="chat-item' + claseExtra + '" onclick="abrirChat(\'' + pin + '\')">';
    html += '<div class="chat-avatar">' + nombre.substring(0, 2).toUpperCase() + '</div>';
    html += '<div class="chat-info">';
    html += '<div class="chat-info-top"><div class="chat-nombre">' + nombre + subNombre + '</div><div class="chat-hora">' + hora + '</div></div>';
    html += '<div class="chat-info-bottom"><div class="chat-ultimo">' + ultimo + '</div>' + badge + '</div>';
    html += '</div></div>';
  });
  
  cont.innerHTML = html;
  actualizarBadgeChats();
}

function renderizarContactos() {
  var contactos = getContactos();
  var bloqueados = getBloqueados();
  var cont = document.getElementById('contenidoContactos');
  var html = '';
  
  if (contactos.length === 0 && bloqueados.length === 0) {
    cont.innerHTML = '<div class="estado-vacio"><div class="estado-vacio-icono">👥</div><div class="estado-vacio-texto">Tu lista de contactos está vacía</div><div class="estado-vacio-sub">Agrega contactos compartiendo sus PINs de Kerix</div></div>';
    return;
  }
  
  if (contactos.length > 0) {
    html += '<div style="padding: 12px 16px; color: #00a884; font-size: 13px; font-weight: 700;">CONTACTOS (' + contactos.length + ')</div>';
    contactos.forEach(function(pin) {
      var nombre = obtenerNombreContacto(pin);
      var subNombre = (nombre !== pin) ? ' <span style="font-size:11px; color:#8696a0; font-weight:normal;">(' + pin + ')</span>' : '';
      html += '<div class="chat-item" onclick="abrirChat(\'' + pin + '\')">';
      html += '<div class="chat-avatar">' + nombre.substring(0, 2).toUpperCase() + '</div>';
      html += '<div class="chat-info"><div class="chat-nombre">' + nombre + subNombre + '</div></div>';
      html += '<button class="header-icon" onclick="event.stopPropagation(); mostrarMenuContacto(\'' + pin + '\', event)">⋮</button>';
      html += '</div>';
    });
  }
  
  if (bloqueados.length > 0) {
    html += '<div style="padding: 12px 16px; color: #ef4444; font-size: 13px; font-weight: 700; margin-top: 12px;">🚫 PINs BLOQUEADOS (' + bloqueados.length + ')</div>';
    bloqueados.forEach(function(pin) {
      var nombre = obtenerNombreContacto(pin);
      var subNombre = (nombre !== pin) ? ' <span style="font-size:11px; color:#8696a0; font-weight:normal;">(' + pin + ')</span>' : '';
      html += '<div class="chat-item" style="opacity: 0.6;">';
      html += '<div class="chat-avatar" style="background: linear-gradient(135deg, #ef4444, #991b1b);">' + nombre.substring(0, 2).toUpperCase() + '</div>';
      html += '<div class="chat-info"><div class="chat-nombre" style="color: #8696a0;">' + nombre + subNombre + '</div></div>';
      html += '<button class="header-icon" onclick="desbloquearPIN(\'' + pin + '\')">✅</button>';
      html += '</div>';
    });
  }
  
  cont.innerHTML = html;
}

async function mostrarMenuContacto(pin, event) {
  event.stopPropagation();
  var accion = await customConfirm(
    '¿Deseas editar el nombre o alias de este PIN (' + pin + ')?\n(Presiona "Cancelar" si en su lugar deseas eliminar el contacto)', 
    '👤'
  );
  if (accion) { 
    await editarAliasContacto(pin); 
  } else {
    var eliminar = await customConfirm(
      '¿Estás seguro de que deseas eliminar a ' + obtenerNombreContacto(pin) + ' de tus contactos?', 
      '🗑️'
    );
    if (eliminar) { eliminarContacto(pin); }
  }
}

async function agregarContacto() {
  var pin = document.getElementById('nuevoContactoPin').value.trim().toUpperCase();
  if (pin.length !== 8) { 
    await customAlert('El PIN de Kerix debe tener exactamente 8 caracteres hexadecimales.'); 
    return; 
  }
  if (pin === miPIN) { 
    await customAlert('No puedes agregarte a ti mismo.'); 
    return; 
  }
  var contactos = getContactos();
  if (contactos.includes(pin)) { 
    await customAlert('Este contacto ya se encuentra en tu lista.'); 
    return; 
  }
  if (getBloqueados().includes(pin)) {
    var desbloquear = await customConfirm('Este PIN está bloqueado. ¿Deseas desbloquearlo y agregarlo?', '🚫');
    if (!desbloquear) return;
    desbloquearPIN(pin);
  }
  
  contactos.push(pin);
  guardarContactos(contactos);
  document.getElementById('nuevoContactoPin').value = '';
  cerrarModalAgregar();
  
  var alias = await customPrompt('👤 Guardar Identificador', '¿Quieres ponerle un nombre o alias a este PIN para reconocerlo localmente? (Opcional):', '');
  if (alias && alias.trim() !== '') {
    var a = getAliases();
    a[pin] = alias.trim();
    guardarAliases(a);
  }
  
  cambiarTab('chats');
}

function eliminarContacto(pin) {
  guardarContactos(getContactos().filter(c => c !== pin));
  var a = getAliases();
  delete a[pin];
  guardarAliases(a);
  renderizarChats();
  renderizarContactos();
}

async function bloquearPIN(pin) {
  var confirmado = await customConfirm(
    '¿Deseas bloquear de forma definitiva el PIN ' + pin + '? No podrás recibir sus mensajes.', 
    '🚫'
  );
  if (!confirmado) return;
  
  var b = getBloqueados();
  if (!b.includes(pin)) b.push(pin);
  guardarBloqueados(b);
  guardarContactos(getContactos().filter(c => c !== pin));
  renderizarChats();
  renderizarContactos();
}

function desbloquearPIN(pin) {
  guardarBloqueados(getBloqueados().filter(b => b !== pin));
  renderizarContactos();
}

async function eliminarContactoActual() {
  if (!contactoActual) return;
  var confirmado = await customConfirm('¿Deseas eliminar a ' + obtenerNombreContacto(contactoActual) + '?', '🗑️');
  if (confirmado) { 
    eliminarContacto(contactoActual); 
    cerrarChat(); 
  }
  cerrarModalOpcionesChat();
}

async function bloquearContactoActual() {
  if (!contactoActual) return;
  await bloquearPIN(contactoActual);
  cerrarChat();
  cerrarModalOpcionesChat();
}

// ============================================
// 🔔 ACTUALIZAR BADGE CON CONTADOR
// ============================================
function actualizarBadgeChats() {
  var total = 0;
  Object.keys(mensajesNoLeidos).forEach(function(k) { total += mensajesNoLeidos[k]; });
  var badge = document.getElementById('badgeChats');
  if (total > 0) {
    badge.style.display = 'inline';
    badge.innerText = total;
    document.title = '(' + total + ') Kerix Chat';
  } else {
    badge.style.display = 'none';
    document.title = 'Kerix Chat';
  }
}

// ============================================
//  CARGAR MENSAJES NO LEÍDOS AL INICIAR
// ============================================
async function cargarMensajesNoLeidos() {
  try {
    var { data, error } = await clienteSupabase.from('mensajes')
      .select('pin_remitente')
      .eq('pin_destinatario', miPIN)
      .eq('leido', false);
    
    if (error) { logError('Error cargando no leídos:', error); return; }
    
    if (data) {
      mensajesNoLeidos = {};
      data.forEach(function(msg) {
        mensajesNoLeidos[msg.pin_remitente] = (mensajesNoLeidos[msg.pin_remitente] || 0) + 1;
      });
    }
    
    actualizarBadgeChats();
    if (tabActual === 'chats') renderizarChats();
  } catch (error) { logError('Error:', error); }
}

// ============================================
// 💬 CHAT INDIVIDUAL
// ============================================
function abrirChat(pin) {
  contactoActual = pin;
  var nombre = obtenerNombreContacto(pin);
  var subtexto = (nombre !== pin) ? ' <span style="font-size:11px; opacity:0.7; font-weight: normal;">(' + pin + ')</span>' : '';
  document.getElementById('chatNombre').innerHTML = nombre + subtexto;
  document.getElementById('chatAvatar').innerText = nombre.substring(0, 2).toUpperCase();
  document.getElementById('pantallaChatIndividual').style.display = 'block';
  modoSeleccion = false;
  mensajesSeleccionados = [];
  cargarMensajes();
  suscribirseAMensajes();
  marcarComoLeidos();
}

function cerrarChat() {
  document.getElementById('pantallaChatIndividual').style.display = 'none';
  contactoActual = '';
  cancelarSuscripciones();
  cambiarTab('chats');
}

// ============================================
// 💬 MENSAJES
// ============================================
async function cargarMensajes() {
  try {
    var { data, error } = await clienteSupabase.from('mensajes')
      .select('*')
      .or('and(pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + contactoActual + '),and(pin_remitente.eq.' + contactoActual + ',pin_destinatario.eq.' + miPIN + ')')
      .order('enviado_en', { ascending: true });
    
    if (error) throw error;
    
    var contenedor = document.getElementById('chatMensajes');
    if (!data || data.length === 0) { 
      contenedor.innerHTML = '<p style="color: #8696a0; text-align: center; padding: 40px 20px;">No hay mensajes aún</p>'; 
      return; 
    }
    
    var mensajes = [];
    for (var msg of data) {
      var texto = '';
      if (msg.mensaje_cifrado && msg.mensaje_cifrado.length > 0) {
        texto = await descifrarMensaje(msg.mensaje_cifrado);
      }
      mensajes.push({ ...msg, texto_descifrado: texto });
    }
    
    var html = '';
    mensajes.forEach(function(msg) {
      var esMio = msg.pin_remitente === miPIN;
      var clase = esMio ? 'mensaje-enviado' : 'mensaje-recibido';
      if (mensajesSeleccionados.includes(String(msg.id))) clase += ' seleccionado';
      var checks = esMio ? (msg.leido ? '<span class="check-leido">✓✓</span>' : '<span>✓</span>') : '';
      var onclickAttr = modoSeleccion ? 'onclick="toggleSeleccion(\'' + msg.id + '\')"' : '';
      html += '<div class="mensaje ' + clase + '" data-id="' + msg.id + '" ' + onclickAttr + '>';
      html += '<div class="mensaje-texto">' + construirContenidoMensaje(msg) + '</div>';
      html += '<div class="mensaje-meta">' + checks + '</div>';
      html += '</div>';
    });
    
    contenedor.innerHTML = html;
    contenedor.scrollTop = contenedor.scrollHeight;
    mensajes.forEach(function(msg) { 
      if (msg.archivo_url) cargarYDescifrarAdjunto(msg); 
    });
  } catch (error) { logError('Error cargando mensajes:', error); }
}

function construirContenidoMensaje(msg) {
  var contenido = '';
  if (msg.archivo_url) {
    contenido = '<div id="media-container-' + msg.id + '" class="media-container" data-loaded="false">';
    contenido += '<span class="loading-media">🔐 Descifrando adjunto seguro...</span>';
    contenido += '</div>';
  }
  if (msg.texto_descifrado) {
    var textoEscapado = escapeHtml(msg.texto_descifrado);
    if (contenido) contenido = textoEscapado + '<br>' + contenido;
    else contenido = textoEscapado;
  }
  if (!contenido) contenido = '<em style="color: #8696a0;">[Archivo]</em>';
  return contenido;
}

async function enviarMensaje() {
  if (!await puedeEnviar()) return;
  
  var texto = document.getElementById('nuevoMensaje').value.trim();
  if (!texto && !archivoSeleccionado) { 
    await customAlert('No puedes enviar un mensaje vacío.'); 
    return; 
  }
  
  var contenedor = document.getElementById('chatMensajes');
  var tipoMensaje = 'texto';
  var archivoInfo = null;
  var mensajeCifrado = '';
  
  if (texto) {
    var clavePub = await obtenerClavePublica(contactoActual);
    if (!clavePub) { 
      await customAlert('⚠️ No se pudo verificar la llave de cifrado del contacto.'); 
      return; 
    }
    try { 
      mensajeCifrado = await cifrarMensaje(texto, clavePub); 
    } catch (error) { 
      await customAlert('Error al intentar cifrar el mensaje.'); 
      return; 
    }
  }
  
  if (archivoSeleccionado) {
    try {
      document.getElementById('archivoInput').style.display = 'none';
      archivoInfo = await subirArchivo(archivoSeleccionado, contactoActual);
      var tipo = archivoInfo.tipo.split('/')[0];
      if (tipo === 'image') tipoMensaje = 'imagen';
      else if (tipo === 'video') tipoMensaje = 'video';
      else tipoMensaje = 'documento';
    } catch (error) {
      logError('❌ Error al subir archivo:', error);
      await customAlert('Error al subir el archivo adjunto: ' + error.message);
      return;
    }
  }
  
  var tempId = 'temp-' + Date.now();
  var mensajeTemp = {
    id: tempId, 
    pin_remitente: miPIN, 
    pin_destinatario: contactoActual, 
    tipo_mensaje: tipoMensaje,
    archivo_url: archivoInfo ? archivoInfo.url : null, 
    archivo_nombre: archivoInfo ? archivoInfo.nombre : null,
    archivo_tamaño: archivoInfo ? archivoInfo.tamaño : null, 
    archivo_iv: archivoInfo ? archivoInfo.iv : null,
    archivo_clave: archivoInfo ? archivoInfo.claveParaMi : null, 
    archivo_clave_destinatario: archivoInfo ? archivoInfo.claveParaDestinatario : null,
    archivo_cifrado: archivoInfo ? archivoInfo.cifrado : false, 
    texto_descifrado: texto,
    enviado_en: new Date().toISOString(), 
    leido: false
  };
  
  var sinMensajes = contenedor.querySelector('p');
  if (sinMensajes) contenedor.innerHTML = '';
  
  var divTemp = document.createElement('div');
  divTemp.className = 'mensaje mensaje-enviado';
  divTemp.setAttribute('data-id', tempId);
  divTemp.innerHTML = '<div class="mensaje-texto">' + construirContenidoMensaje(mensajeTemp) + '</div><div class="mensaje-meta"><span>✓</span></div>';
  contenedor.appendChild(divTemp);
  contenedor.scrollTop = contenedor.scrollHeight;
  
  if (archivoSeleccionado && archivoInfo) {
    var localContainer = document.getElementById('media-container-' + tempId);
    if (localContainer) {
      var localUrl = URL.createObjectURL(archivoSeleccionado);
      cacheArchivosDescifrados[archivoInfo.url] = localUrl;
      localContainer.setAttribute('data-loaded', 'true');
      if (tipoMensaje === 'imagen') {
        localContainer.innerHTML = '<img src="' + localUrl + '" style="max-width: 100%; border-radius: 8px;">';
      } else if (tipoMensaje === 'video') {
        localContainer.innerHTML = '<video controls style="max-width: 100%; border-radius: 8px;"><source src="' + localUrl + '"></video>';
      } else {
        localContainer.innerHTML = '<a href="' + localUrl + '" download="' + archivoInfo.nombre + '" style="color: #00a884;"> ' + archivoInfo.nombre + '</a>';
      }
    }
  }
  
  try {
    var { error } = await clienteSupabase.from('mensajes').insert({
      pin_remitente: miPIN, 
      pin_destinatario: contactoActual, 
      mensaje_cifrado: mensajeCifrado, 
      nonce: 'e2ee', 
      tipo_mensaje: tipoMensaje,
      archivo_url: archivoInfo ? archivoInfo.url : null, 
      archivo_nombre: archivoInfo ? archivoInfo.nombre : null,
      archivo_tamaño: archivoInfo ? archivoInfo.tamaño : null, 
      archivo_iv: archivoInfo ? archivoInfo.iv : null,
      archivo_clave: archivoInfo ? archivoInfo.claveParaMi : null, 
      archivo_clave_destinatario: archivoInfo ? archivoInfo.claveParaDestinatario : null,
      archivo_cifrado: archivoInfo ? archivoInfo.cifrado : false, 
      leido: false
    });
    
    if (error) throw error;
    
    document.getElementById('nuevoMensaje').value = '';
    document.getElementById('nuevoMensaje').style.height = 'auto';
    cancelarArchivo();
    cargarMensajes();
  } catch (error) { 
    await customAlert('Error al insertar el mensaje en la red.'); 
    divTemp.style.opacity = '0.5'; 
  }
}

async function marcarComoLeidos() {
  if (!contactoActual || !clienteSupabase) return;
  try {
    await clienteSupabase.from('mensajes')
      .update({ leido: true, leido_en: new Date().toISOString() })
      .eq('pin_remitente', contactoActual)
      .eq('pin_destinatario', miPIN)
      .eq('leido', false);
    
    delete mensajesNoLeidos[contactoActual];
    actualizarBadgeChats();
    if (tabActual === 'chats') renderizarChats();
  } catch (error) { logError('Error:', error); }
}

function suscribirseAMensajes() {
  if (!clienteSupabase) return;
  cancelarSuscripciones();
  
  canalRealtime = clienteSupabase.channel('mensajes_' + miPIN)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: 'pin_destinatario=eq.' + miPIN }, async function(payload) {
      var nuevo = payload.new;
      if (getBloqueados().includes(nuevo.pin_remitente)) return;
      if (modoPrivado && !getContactos().includes(nuevo.pin_remitente)) return;
      
      var texto = '';
      if (nuevo.mensaje_cifrado && nuevo.mensaje_cifrado.length > 0) {
        texto = await descifrarMensaje(nuevo.mensaje_cifrado);
      }
      
      mensajesNoLeidos[nuevo.pin_remitente] = (mensajesNoLeidos[nuevo.pin_remitente] || 0) + 1;
      notificarNuevoMensaje(nuevo.pin_remitente, texto, nuevo.tipo_mensaje);
      
      if (contactoActual === nuevo.pin_remitente) {
        nuevo.texto_descifrado = texto;
        var contenedor = document.getElementById('chatMensajes');
        var sinMensajes = contenedor.querySelector('p');
        if (sinMensajes) contenedor.innerHTML = '';
        var div = document.createElement('div');
        div.className = 'mensaje mensaje-recibido';
        div.setAttribute('data-id', nuevo.id);
        div.innerHTML = '<div class="mensaje-texto">' + construirContenidoMensaje(nuevo) + '</div><div class="mensaje-meta"></div>';
        contenedor.appendChild(div);
        contenedor.scrollTop = contenedor.scrollHeight;
        if (nuevo.archivo_url) cargarYDescifrarAdjunto(nuevo);
        setTimeout(marcarComoLeidos, 1000);
      } else {
        renderizarChats();
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes', filter: 'pin_remitente=eq.' + miPIN }, function(payload) {
      if (payload.new.leido) {
        document.querySelectorAll('.mensaje-enviado .mensaje-meta span:not(.check-leido)').forEach(function(span) {
          if (span.innerText === '✓') { 
            span.className = 'check-leido'; 
            span.innerText = '✓✓'; 
          }
        });
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes' }, function(payload) {
      if (contactoActual) cargarMensajes();
    })
    .subscribe();
}

function cancelarSuscripciones() { 
  if (canalRealtime) { 
    clienteSupabase.removeChannel(canalRealtime); 
    canalRealtime = null; 
  } 
}

// ============================================
// ️ SELECCIÓN Y BORRADO
// ============================================
async function seleccionarModo() {
  modoSeleccion = true;
  mensajesSeleccionados = [];
  cerrarModalOpcionesChat();
  await customAlert('Toca los mensajes para seleccionarlos individualmente. Usa la papelera para borrarlos.', '☑️');
  cargarMensajes();
}

function toggleSeleccion(id) {
  var idx = mensajesSeleccionados.indexOf(id);
  if (idx > -1) mensajesSeleccionados.splice(idx, 1); 
  else mensajesSeleccionados.push(id);
  document.querySelectorAll('.mensaje[data-id="' + id + '"]').forEach(div => div.classList.toggle('seleccionado'));
}

async function borrarSeleccionados() {
  if (mensajesSeleccionados.length === 0) { 
    await customAlert('No has seleccionado ningún mensaje.'); 
    return; 
  }
  var confirmado = await customConfirm(
    '¿Deseas borrar de forma irreversible los ' + mensajesSeleccionados.length + ' mensajes seleccionados?', 
    '️'
  );
  if (!confirmado) return;
  
  try {
    var ids = mensajesSeleccionados.map(id => parseInt(id));
    var { error } = await clienteSupabase.from('mensajes').delete().in('id', ids);
    if (error) throw error;
    await customAlert('✅ Mensajes borrados.', '✅');
    modoSeleccion = false;
    mensajesSeleccionados = [];
    cargarMensajes();
  } catch (error) { 
    await customAlert('Error: ' + error.message); 
  }
}

async function limpiarChatCompleto() {
  var confirmado = await customConfirm('⚠️ ¿Deseas borrar TODO el historial de este chat? Esta acción es irreversible.', '⚠️');
  if (!confirmado) return;
  
  try {
    var { error } = await clienteSupabase.from('mensajes').delete()
      .or('and(pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + contactoActual + '),and(pin_remitente.eq.' + contactoActual + ',pin_destinatario.eq.' + miPIN + ')');
    if (error) throw error;
    await customAlert('✅ Historial de chat vaciado.', '✅');
    cerrarModalOpcionesChat();
    cargarMensajes();
  } catch (error) { 
    await customAlert('Error: ' + error.message); 
  }
}

// ============================================
// 📎 ARCHIVOS
// ============================================
document.getElementById('archivoInput').addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { 
    await customAlert('El tamaño máximo de archivo admitido es de 50 MB.'); 
    return; 
  }
  archivoSeleccionado = file;
  await customAlert('📎 Archivo listo para enviar: ' + file.name, '📎');
});

function cancelarArchivo() {
  archivoSeleccionado = null;
  document.getElementById('archivoInput').value = '';
}

// ============================================
// 📡 ESTADO Y ACTIVAR
// ============================================
async function verificarEstado() {
  var estadoDiv = document.getElementById('estadoTexto');
  var form = document.getElementById('formActivacion');
  
  if (!clienteSupabase) { 
    estadoDiv.innerText = '⚠️ Sin conexión'; 
    form.classList.remove('hidden'); 
    return; 
  }
  
  try {
    var { data } = await clienteSupabase.from('usuarios')
      .select('fecha_expiracion')
      .eq('pin', miPIN)
      .maybeSingle();
    
    if (data && data.fecha_expiracion && new Date(data.fecha_expiracion) > new Date()) {
      estadoDiv.className = 'status active';
      estadoDiv.innerText = '✅ Servicio Activo';
      estadoDiv.style.background = 'rgba(0, 168, 132, 0.15)';
      estadoDiv.style.color = '#00a884';
      form.classList.add('hidden');
      document.getElementById('fechaVencimiento').innerText = new Date(data.fecha_expiracion).toLocaleDateString('es-ES');
      return;
    }
    
    estadoDiv.className = 'status expired';
    estadoDiv.innerText = '⚠️ Servicio Inactivo';
    form.classList.remove('hidden');
  } catch (error) { 
    estadoDiv.innerText = '❌ Error de conexión'; 
    form.classList.remove('hidden'); 
  }
}

async function activar() {
  var codigo = document.getElementById('codigoInput').value.trim().toUpperCase();
  if (codigo.length < 5) { 
    await customAlert('Código de activación inválido.'); 
    return; 
  }
  
  var btn = document.getElementById('btnActivar');
  btn.disabled = true; 
  btn.innerText = 'Procesando...';
  
  try {
    var resultado = await clienteSupabase.functions.invoke('activar-servicio', { body: { pin: miPIN, codigo: codigo } });
    if (resultado.error) {
      await customAlert('Error: ' + resultado.error.message);
    } else if (resultado.data && resultado.data.exito) {
      await customAlert('¡Servicio activado! Vence el: ' + resultado.data.nueva_fecha, '🎉');
      document.getElementById('codigoInput').value = '';
      verificarEstado();
    } else {
      await customAlert('Error: ' + (resultado.data ? resultado.data.mensaje : 'Código ya utilizado o inválido.'));
    }
  } catch (error) { 
    await customAlert('Fallo de conexión: ' + error.message); 
  } finally { 
    btn.disabled = false; 
    btn.innerText = 'Activar'; 
  }
}

function copiarPIN() { 
  navigator.clipboard.writeText(miPIN).then(() => {
    customAlert('Tu PIN ' + miPIN + ' ha sido copiado al portapapeles.', '📋');
  }); 
}

// ============================================
//  BACKUP Y FORWARD SECRECY
// ============================================
async function exportarClave() {
  var password = await customPrompt('🔒 Exportar Llave', 'Crea una contraseña para cifrar el respaldo (mínimo 4 caracteres):', '', 'password');
  if (!password || password.length < 4) { 
    await customAlert('La contraseña de respaldo debe ser de al menos 4 caracteres.'); 
    return; 
  }
  
  var codigo2FA = '';
  if (prefs.dosfa_backup) {
    codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    await customAlert('🔑 Tu código de seguridad 2FA es:\n' + codigo2FA + '\nEscríbelo para poder restaurarlo más tarde.', '🔑');
  }
  
  try {
    var privBase64 = '';
    var claveGuardada = localStorage.getItem('clave_privada_' + miPIN);
    if (claveGuardada.includes('.')) {
      if (!pinActualTemporal) { 
        await customAlert('Primero desbloquea la aplicación.'); 
        return; 
      }
      privBase64 = await descifrarClaveConPIN(claveGuardada, pinActualTemporal);
    } else {
      privBase64 = desofuscarClave(claveGuardada);
    }
    
    var encoder = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoder.encode(privBase64 + '|' + codigo2FA));
    var backup = btoa(String.fromCharCode.apply(null, salt)) + '.' + btoa(String.fromCharCode.apply(null, iv)) + '.' + btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado)));
    
    await navigator.clipboard.writeText(backup);
    await customAlert('✅ Respaldo copiado al portapapeles correctamente.' + (prefs.dosfa_backup ? '\n2FA obligatorio: ' + codigo2FA : ''), '✅');
    cerrarModalBackup();
  } catch (error) { 
    await customAlert('Error de empaquetado: ' + error.message); 
  }
}

async function importarClave() {
  var backup = await customPrompt('📥 Importar Llave', 'Pega aquí el contenido cifrado del respaldo:');
  if (!backup) return;
  
  var password = await customPrompt('📥 Contraseña', 'Ingresa la contraseña con la que cifraste el respaldo:', '', 'password');
  if (!password) return;
  
  try {
    var partes = backup.split('.');
    var salt = Uint8Array.from(atob(partes[0]), c => c.charCodeAt(0));
    var iv = Uint8Array.from(atob(partes[1]), c => c.charCodeAt(0));
    var cifrado = Uint8Array.from(atob(partes[2]), c => c.charCodeAt(0));
    var encoder = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var descifrado = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado));
    
    if (prefs.dosfa_backup) {
      var partesD = descifrado.split('|');
      if (partesD.length !== 2) throw new Error('Formato sin autenticación 2FA.');
      var codigo = await customPrompt('🔐 Doble Factor', 'Ingresa el código de seguridad 2FA que se generó al exportar:');
      if (codigo !== partesD[1]) { 
        await customAlert('❌ El código 2FA ingresado es incorrecto.', '❌'); 
        return; 
      }
      descifrado = partesD[0];
    }
    
    var aGuardar = pinAccesoHash && pinActualTemporal ? await cifrarClaveConPIN(descifrado, pinActualTemporal) : ofuscarClave(descifrado);
    localStorage.setItem('clave_privada_' + miPIN, aGuardar);
    await customAlert('✅ Clave de respaldo importada con éxito.', '✅');
    location.reload();
  } catch (error) { 
    await customAlert('❌ Respaldo corrupto o contraseña incorrecta.', '❌'); 
  }
}

async function activarForwardSecrecy() {
  if (prefs.rotacion_claves_dias === 0) { 
    await customAlert('⚠️ Debes activar primero la opción "Rotación de claves".'); 
    return; 
  }
  
  var confirmado = await customConfirm('⚠️ ALERTA DE SEGURIDAD\nTodos los mensajes antiguos quedarán completamente ILEGIBLES una vez que roten tus llaves.\n¿Quieres activar esta funcionalidad?', '⚠️');
  if (!confirmado) return;
  
  var backupPrevio = await customConfirm('¿Quieres descargar un backup descifrado en HTML de todos tus chats antes de activar esto?', '');
  if (backupPrevio) await generarBackupMensajes();
  
  var confirmarFinal = await customConfirm('🔐 ¿Activar Perfect Forward Secrecy ahora?', '🔐');
  if (!confirmarFinal) return;
  
  prefs.forward_secrecy = true;
  await guardarPreferenciaBool('forward_secrecy', true);
  await generarClaves();
  localStorage.setItem('rotacion_claves_' + miPIN, Date.now());
  await customAlert('✅ Forward Secrecy activado.', '✅');
  actualizarStatusPreferencias();
}

async function desactivarForwardSecrecy() {
  var des = await customConfirm('¿Desactivar la propiedad de Forward Secrecy?', '🔐');
  if (!des) return;
  
  prefs.forward_secrecy = false;
  await guardarPreferenciaBool('forward_secrecy', false);
  await customAlert('✅ Funcionalidad desactivada.', '✅');
  actualizarStatusPreferencias();
}

async function generarBackupMensajes() {
  try {
    var contactos = getContactos();
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Kerix Backup - ' + miPIN + '</title><style>body{font-family:Arial;background:#1a1a1a;color:#fff;padding:20px;max-width:600px;margin:0 auto;}.chat{margin:20px 0;padding:15px;background:#222;border-radius:10px;}.msg{padding:8px 12px;margin:6px 0;border-radius:12px;max-width:80%;}.enviado{background:#00a884;color:#000;margin-left:auto;}.recibido{background:#2a2a2a;color:#fff;}</style></head><body>';
    html += '<h1>🔒 Backup Local de Mensajes</h1><p>PIN de Usuario: <strong>' + miPIN + '</strong></p><p>Creado el: ' + new Date().toLocaleString('es-ES') + '</p><hr>';
    
    for (var pin of contactos) {
      var nombre = obtenerNombreContacto(pin);
      var { data: mensajes } = await clienteSupabase.from('mensajes')
        .select('*')
        .or('and(pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + pin + '),and(pin_remitente.eq.' + pin + ',pin_destinatario.eq.' + miPIN + ')')
        .order('enviado_en', { ascending: true });
      
      if (!mensajes || mensajes.length === 0) continue;
      
      html += '<div class="chat"><h2>💬 Conversación con: ' + nombre + ' (' + pin + ')</h2>';
      for (var msg of mensajes) {
        var texto = '';
        try { 
          if (msg.mensaje_cifrado) texto = await descifrarMensaje(msg.mensaje_cifrado); 
        } catch (e) { 
          texto = '[Ilegible / Clave Rotada]'; 
        }
        var esMio = msg.pin_remitente === miPIN;
        html += '<div class="msg ' + (esMio ? 'enviado' : 'recibido') + '">' + escapeHtml(texto) + '</div>';
      }
      html += '</div>';
    }
    
    html += '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; 
    a.download = 'backup_kerix_' + miPIN + '_' + Date.now() + '.html';
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await customAlert('✅ El archivo de respaldo se ha descargado de manera segura.', '✅');
  } catch (error) { 
    await customAlert('❌ Error al exportar: ' + error.message, '❌'); 
  }
}

async function backupClavePrivada() {
  try {
    var privBase64 = '';
    var claveGuardada = localStorage.getItem('clave_privada_' + miPIN);
    if (claveGuardada.includes('.')) {
      if (!pinActualTemporal) { 
        await customAlert('Por favor, desbloquea la aplicación.'); 
        return; 
      }
      privBase64 = await descifrarClaveConPIN(claveGuardada, pinActualTemporal);
    } else {
      privBase64 = desofuscarClave(claveGuardada);
    }
    
    var pubExp = await crypto.subtle.exportKey("spki", miClavePublica);
    var pubBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pubExp)));
    
    var html = '<!DOCTYPE html><html><body style="background:#1a1a1a;color:#fff;padding:20px;"><h1> Kerix Backup de Claves</h1><p style="color:#ef4444;">️ TEXTO PLANO - Guarda este archivo con estricto secreto.</p><h3>Clave Privada (RSA-OAEP Decrypt):</h3><textarea readonly style="width:100%;height:200px;">' + privBase64 + '</textarea><h3>Clave Pública (RSA-OAEP Encrypt):</h3><textarea readonly style="width:100%;height:200px;">' + pubBase64 + '</textarea></body></html>';
    
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; 
    a.download = 'claves_par_kerix_' + miPIN + '_' + Date.now() + '.html';
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await customAlert('✅ Clave de respaldo descargada en texto plano.', '✅');
  } catch (error) { 
    await customAlert('Error al generar el backup: ' + error.message); 
  }
}

// ============================================
// 🚀 INICIALIZACIÓN
// ============================================
async function generarPIN() {
  var pinGuardado = localStorage.getItem('chat_pin');
  if (pinGuardado) {
    miPIN = pinGuardado;
  } else {
    var bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    miPIN = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    localStorage.setItem('chat_pin', miPIN);
  }
  document.getElementById('menuPin').innerText = miPIN;
}

async function cargarModoPrivado() {
  try {
    var { data } = await clienteSupabase.from('usuarios')
      .select('modo_privado')
      .eq('pin', miPIN)
      .single();
    modoPrivado = data && data.modo_privado === true;
    document.getElementById('toggleModoPrivado').checked = modoPrivado;
  } catch (error) { logError('Error:', error); }
}

async function cambiarModoPrivado() {
  modoPrivado = document.getElementById('toggleModoPrivado').checked;
  try { 
    await clienteSupabase.from('usuarios').update({ modo_privado: modoPrivado }).eq('pin', miPIN); 
  } catch (e) { 
    customAlert('Fallo al actualizar el modo privado.'); 
  }
}

async function inicializarTodo() {
  try {
    if (typeof supabase === 'undefined') return false;
    clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await cargarModoPrivado();
    await cargarPreferencias();
    cargarPrefsNotificaciones();
    suscribirseALlamadas();
    await limpiarLlamadasAntiguas();
    return true;
  } catch (error) { 
    logError('Error:', error); 
    return false; 
  }
}

async function testearStorage() {
  try {
    var { data: buckets, error: bucketsError } = await clienteSupabase.storage.listBuckets();
    if (bucketsError) { 
      logError(' Error listando buckets:', bucketsError); 
      return; 
    }
    
    var chatFilesBucket = buckets.find(function(b) { return b.name === 'chat-files'; });
    if (!chatFilesBucket) { 
      await customAlert('❌ El bucket "chat-files" no existe en la instancia de Supabase.', '❌'); 
      return; 
    }
    
    var testBlob = new Blob(['test'], { type: 'text/plain' });
    var testFileName = 'test_' + miPIN + '_' + Date.now() + '.txt';
    var { data: uploadData, error: uploadError } = await clienteSupabase.storage.from('chat-files').upload(testFileName, testBlob);
    if (uploadError) { 
      await customAlert('❌ Error al subir archivo de prueba: ' + uploadError.message, '❌'); 
      return; 
    }
    
    var { data: urlData, error: urlError } = await clienteSupabase.storage.from('chat-files').createSignedUrl(testFileName, 60);
    if (urlError) { 
      await customAlert('❌ Error creando URL firmada: ' + urlError.message, '❌'); 
      return; 
    }
    
    await clienteSupabase.storage.from('chat-files').remove([testFileName]);
    await customAlert('✅ Storage y buckets de Supabase funcionan correctamente!', '✅');
  } catch (error) { 
    await customAlert('Error de conexión con Storage: ' + error.message, '❌'); 
  }
}

// ============================================
// 🎯 INICIALIZACIÓN DOM
// ============================================
window.addEventListener('DOMContentLoaded', async function() {
  try {
    generarPIN();
    await inicializarTodo();
    await verificarPINConfigurado();
    
    // Auto-crecimiento responsivo para el input del chat
    const textInput = document.getElementById('nuevoMensaje');
    if (textInput) {
      textInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      });
    }
  } catch (error) {
    logError('Error:', error);
    document.getElementById('pantallaBloqueo').style.display = 'none';
    document.getElementById('appPrincipal').style.display = 'block';
    await customAlert('⚠️ Error durante la inicialización de módulos: ' + error.message);
  }
});

console.log(' Módulo app.js cargado correctamente');

// Añadir esto al final de tu js/app.js actual:
window.abrirMenu = abrirMenu;
window.cerrarMenu = cerrarMenu;
window.cambiarTab = cambiarTab;
window.mostrarModalAgregar = mostrarModalAgregar;
window.cerrarChat = cerrarChat;
window.mostrarOpcionesChat = mostrarOpcionesChat;
window.enviarMensaje = enviarMensaje;
window.iniciarLlamada = iniciarLlamada;
window.colgarLlamada = colgarLlamada;
window.toggleSilenciar = toggleSilenciar;
window.toggleCamara = toggleCamara;
window.rechazarLlamada = rechazarLlamada;
window.aceptarLlamada = aceptarLlamada;
