/**
 * js/app.js
 * Orquestador principal: UI, navegación, mensajes, contactos, inicialización e integraciones.
 * Arquitectura modular final corregida con el comportamiento íntegro original.
 */

var SUPABASE_URL = 'https://dksmoteiidjpymextrgj.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_HuXshjcD1Je934lVgBcJtw_5kFSuGzE';
var DEBUG = false;

var miPIN = '';
var contactoActual = '';
var canalRealtime = null;
var mensajesNoLeidos = {};
var tabActual = 'chats';

var prefs = { autoEliminarMin: 0, rotacionClavesDias: 0, forwardSecrecy: false };
var prefsNotificaciones = { nativas: true, visuales: true, sonido: true, vibracion: true, mostrarContenido: true };

// ============================================
// COMPONENTES DE INTERFAZ GRÁFICA (UI MODAL)
// ============================================
function customAlert(texto, icono) {
  return new Promise(function(resolve) {
    var modal = document.getElementById('customAlert');
    var txt = document.getElementById('customAlertText');
    var btn = document.getElementById('customAlertBtn');
    if (!modal || !txt || !btn) { alert(texto); resolve(); return; }
    txt.innerText = (icono ? icono + " " : "") + texto;
    modal.classList.add('active');
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', function() { modal.classList.remove('active'); resolve(); });
  });
}

function customConfirm(texto, icono) {
  return new Promise(function(resolve) {
    var modal = document.getElementById('customConfirm');
    var txt = document.getElementById('customConfirmText');
    var btnOk = document.getElementById('customConfirmBtnOk');
    var btnCancel = document.getElementById('customConfirmBtnCancel');
    if (!modal || !txt || !btnOk || !btnCancel) { var r = confirm(texto); resolve(r); return; }
    txt.innerText = (icono ? icono + " " : "") + texto;
    modal.classList.add('active');
    var newOk = btnOk.cloneNode(true); btnOk.parentNode.replaceChild(newOk, btnOk);
    var newCancel = btnCancel.cloneNode(true); btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    newOk.addEventListener('click', function() { modal.classList.remove('active'); resolve(true); });
    newCancel.addEventListener('click', function() { modal.classList.remove('active'); resolve(false); });
  });
}

function customPrompt(titulo, texto, placeholder, tipo) {
  return new Promise(function(resolve) {
    var modal = document.getElementById('customPrompt');
    var txt = document.getElementById('customPromptText');
    var input = document.getElementById('customPromptInput');
    var btnOk = document.getElementById('customPromptBtnOk');
    var btnCancel = document.getElementById('customPromptBtnCancel');
    if (!modal || !txt || !input || !btnOk || !btnCancel) { var r = prompt(texto); resolve(r); return; }
    txt.innerText = titulo + "\n" + texto; input.placeholder = placeholder || ''; input.type = tipo || 'text'; input.value = '';
    modal.classList.add('active'); input.focus();
    var newOk = btnOk.cloneNode(true); btnOk.parentNode.replaceChild(newOk, btnOk);
    var newCancel = btnCancel.cloneNode(true); btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    newOk.addEventListener('click', function() { modal.classList.remove('active'); resolve(input.value); });
    newCancel.addEventListener('click', function() { modal.classList.remove('active'); resolve(null); });
  });
}

function mostrarModalAgregar() { var modal = document.getElementById('modalAgregarContacto'); if (modal) modal.classList.add('active'); }
function cerrarModalAgregar() { var modal = document.getElementById('modalAgregarContacto'); if (modal) modal.classList.remove('active'); }

function abrirChat(pin) {
  contactoActual = pin;
  if (mensajesNoLeidos[pin]) { mensajesNoLeidos[pin] = 0; actualizarBadgeChats(); }
  var panel = document.getElementById('panelDerechoPrincipal'); if (panel) panel.classList.add('active');
  var nombre = document.getElementById('chatHeaderNombre'); if (nombre) nombre.innerText = obtenerNombreContacto(pin);
  cargarHistorial(pin);
}
function cerrarChat() { contactoActual = ''; var panel = document.getElementById('panelDerechoPrincipal'); if (panel) panel.classList.remove('active'); }

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab').forEach(function(el) { el.classList.remove('active'); });
  var tabActivo = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)); if (tabActivo) tabActivo.classList.add('active');
  var vChats = document.getElementById('vistaChats'), vContactos = document.getElementById('vistaContactos'), vAjustes = document.getElementById('vistaAjustes');
  if (vChats) vChats.classList.add('hidden'); if (vContactos) vContactos.classList.add('hidden'); if (vAjustes) vAjustes.classList.add('hidden');
  if (tab === 'chats' && vChats) { vChats.classList.remove('hidden'); renderizarListaChats(); }
  if (tab === 'contactos' && vContactos) { vContactos.classList.remove('hidden'); renderizarContactos(); }
  if (tab === 'ajustes' && vAjustes) vAjustes.classList.remove('hidden');
}

// ============================================
// GESTIÓN Y RENDERIZADO DE CONVERSACIONES
// ============================================
function renderizarListaChats() {
  var cont = document.getElementById('contenedorChats'); var vacio = document.getElementById('chatsVacio'); if (!cont) return;
  cont.innerHTML = ''; var totalChats = 0;
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i); if (!k || !k.startsWith('contacto_')) continue; totalChats++;
    var pin = k.split('_')[1], alias = obtenerNombreContacto(pin), ultimoMsg = localStorage.getItem('last_msg_' + pin) || 'Sin mensajes', noLeidos = mensajesNoLeidos[pin] || 0;
    var div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = '<div class="chat-avatar">' + alias.charAt(0).toUpperCase() + '</div><div class="chat-info"><div class="chat-nombre">' + alias + ' <span style="font-size:10px;color:#8696a0;">(' + pin + ')</span></div><div class="chat-ultimo">' + ultimoMsg + '</div></div>' + (noLeidos > 0 ? '<div class="badge-no-leido" style="background:#00a884;color:#fff;border-radius:50%;padding:2px 7px;font-size:12px;margin-left:auto;">' + noLeidos + '</div>' : '');
    div.addEventListener('click', (function(p) { return function() { abrirChat(p); }; })(pin)); cont.appendChild(div);
  }
  if (vacio) vacio.style.display = totalChats === 0 ? 'block' : 'none';
}

function renderizarContactos() {
  var cont = document.getElementById('contenedorContactos'); if (!cont) return; cont.innerHTML = '';
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i); if (!k || !k.startsWith('contacto_')) continue;
    try {
      var obj = JSON.parse(localStorage.getItem(k)); var div = document.createElement('div'); div.className = 'chat-item'; div.style.position = 'relative'; div.style.display = 'flex'; div.style.alignItems = 'center';
      div.innerHTML = '<div class="chat-avatar" style="background:#075e54; flex-shrink: 0;">' + (obj.alias ? obj.alias.charAt(0).toUpperCase() : obj.pin.charAt(0)) + '</div><div class="chat-info" style="flex-grow: 1; margin-left: 10px; padding-right: 80px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;"><div class="chat-nombre" style="font-weight: bold;">' + (obj.alias || obj.pin) + '</div><div class="chat-ultimo" style="font-family: monospace; color:#8696a0; font-size: 12px;">PIN: ' + obj.pin + '</div></div><div style="position: absolute; right: 12px; display: flex; gap: 10px; align-items: center; justify-content: center;"><button style="background:none; border:none; color:#00a884; font-size:16px; cursor:pointer; padding: 4px;" id="edit_'+obj.pin+'">✏️</button><button style="background:none; border:none; color:#ef4444; font-size:18px; cursor:pointer; padding: 4px;" id="del_'+obj.pin+'">✕</button></div>';
      div.querySelector('#edit_' + obj.pin).addEventListener('click', (function(p, currentAlias) { return async function(e) { e.stopPropagation(); var nuevoAlias = await customPrompt('👤 Identificación', 'Cambia el alias para (' + p + '):', currentAlias); if (nuevoAlias !== null) { guardarContactoLocal(p, nuevoAlias.trim()); renderizarContactos(); renderizarListaChats(); } }; })(obj.pin, obj.alias || ""));
      div.querySelector('#del_' + obj.pin).addEventListener('click', (function(p) { return async function(e) { e.stopPropagation(); var conf = await customConfirm('¿Eliminar al contacto ' + p + '?'); if (conf) { localStorage.removeItem('contacto_' + p); localStorage.removeItem('last_msg_' + p); localStorage.removeItem('clave_pub_' + p); renderizarContactos(); renderizarListaChats(); } }; })(obj.pin));
      div.addEventListener('click', (function(p) { return function() { abrirChat(p); }; })(obj.pin)); cont.appendChild(div);
    } catch (e) { continue; }
  }
}

function obtenerNombreContacto(pin) { var data = localStorage.getItem('contacto_' + pin); if (!data) return pin; try { return JSON.parse(data).alias || pin; } catch (e) { return pin; } }
function guardarContactoLocal(pin, alias) { localStorage.setItem('contacto_' + pin, JSON.stringify({ pin: pin, alias: alias || '' })); }

async function agregarContacto() {
  var inputPin = document.getElementById('nuevoContactoPin'); if (!inputPin) return; var pin = inputPin.value.trim().toUpperCase();
  if (!window.validarPIN || !window.validarPIN(pin)) { customAlert('El PIN debe tener 8 caracteres hexadecimales.'); return; }
  if (pin === miPIN) { customAlert('No puedes agregarte a ti mismo.'); return; }
  var alias = await customPrompt('👤 Nueva Identificación', 'Asigna un nombre o alias:', ''); if (alias === null) return;
  guardarContactoLocal(pin, alias.trim());
  if (typeof SupabaseUsuarios !== 'undefined') {
    try { var u = await SupabaseUsuarios.obtenerUsuario(pin); if (u && u.clave_publica) localStorage.setItem('clave_pub_' + pin, u.clave_publica); } catch (e) { console.error(e); }
  }
  renderizarListaChats(); renderizarContactos(); inputPin.value = ''; cerrarModalAgregar();
}

async function asegurarLlavesYRegistro() {
  var priv = localStorage.getItem("clave_privada_" + miPIN); var pub = localStorage.getItem("clave_pub_propia_" + miPIN);
  if (!priv || !pub) {
    try {
      var kp = await window.crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
      var exportedPub = await window.crypto.subtle.exportKey("spki", kp.publicKey), exportedPriv = await window.crypto.subtle.exportKey("pkcs8", kp.privateKey);
      function bufToPem(buf, isPriv) { var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); return (isPriv ? "-----BEGIN PRIVATE KEY-----\n" : "-----BEGIN PUBLIC KEY-----\n") + b64 + (isPriv ? "\n-----END PRIVATE KEY-----" : "\n-----END PUBLIC KEY-----"); }
      pub = bufToPem(exportedPub, false); localStorage.setItem("clave_privada_" + miPIN, bufToPem(exportedPriv, true)); localStorage.setItem("clave_pub_propia_" + miPIN, pub);
    } catch(err) { console.error(err); return; }
  }
  if (typeof clienteSupabase !== 'undefined' && clienteSupabase) {
    try { await clienteSupabase.from('usuarios').upsert([{ pin: miPIN, clave_publica: pub }]); } catch(err) { console.error(err); }
  }
}

// ============================================
// RECUPERACIÓN DE UTILIDADES COMPLETAS
// ============================================
async function exportarConfiguracion() {
  try {
    var pass = await customPrompt('📦 Backup Seguro', 'Establece una contraseña:', '', 'password'); if (!pass) return;
    var backupObj = { miPIN: miPIN, timestamp: Date.now(), contactos: {}, previews: {} };
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i); if (!k) continue;
      if (k.startsWith('contacto_') || k.startsWith('clave_privada_') || k.startsWith('clave_pub_propia_')) backupObj.contactos[k] = localStorage.getItem(k);
      if (k.startsWith('last_msg_')) backupObj.previews[k] = localStorage.getItem(k);
    }
    var blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'backup_kerix_' + miPIN + '.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    await customAlert('✅ Respaldo descargado correctamente.', '📦');
  } catch (err) { console.error(err); }
}

async function limpiarChatActual() {
  if (!contactoActual) return; var conf = await customConfirm('¿Vaciar por completo esta conversación en la nube?'); if (!conf) return;
  if (typeof clienteSupabase !== 'undefined' && clienteSupabase) {
    try { await clienteSupabase.from('mensajes').delete().or('and(pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + contactoActual + '),and(pin_remitente.eq.' + contactoActual + ',pin_destinatario.eq.' + miPIN + ')'); } catch(e) { console.error(e); }
  }
  localStorage.removeItem('last_msg_' + contactoActual); var zona = document.getElementById('zonaMensajes'); if (zona) zona.innerHTML = '';
  renderizarListaChats(); await customAlert('🧹 Conversación vaciada.');
}

async function eliminarMensajeIndividual(idMensaje, elementoDom) {
  if (typeof clienteSupabase === 'undefined' || !clienteSupabase) return;
  try { var { error } = await clienteSupabase.from('mensajes').delete().eq('id', idMensaje); if (!error && elementoDom) elementoDom.remove(); } catch(err) { console.error(err); }
}

async function ejecutarResetEmergencia() {
  var conf = await customConfirm('⚠️ ATENCIÓN: Se destruirán tus llaves de forma irreversible. ¿Continuar?'); if (!conf) return;
  localStorage.clear(); location.reload();
}

// ============================================
// ENVÍO, RECEPCIÓN Y RENDERING EN TIEMPO REAL
// ============================================
function appendMessageToUI(pinRemitente, texto, enviado, idMensaje) {
  var zona = document.getElementById('zonaMensajes'); if (!zona) return;
  var m = document.createElement('div'); m.className = 'mensaje ' + (enviado ? 'mensaje-enviado' : 'mensaje-recibido');
  if (idMensaje) {
    m.dataset.id = idMensaje; m.addEventListener('dblclick', async function() {
      var conf = await customConfirm('¿Eliminar este mensaje para todos?'); if (conf) eliminarMensajeIndividual(idMensaje, m);
    });
  }
  m.innerHTML = '<div class="mensaje-texto"></div><div class="mensaje-meta">' + (new Date()).toLocaleTimeString() + '</div>';
  m.querySelector('.mensaje-texto').innerText = texto; zona.appendChild(m); zona.scrollTop = zona.scrollHeight;
}

async function enviarMensaje() {
  var input = document.getElementById('nuevoMensaje'); if (!input) return; var texto = input.value.trim();
  if (!texto) return; if (!contactoActual) { await customAlert('Selecciona un contacto primero.'); return; }
  var clavePubContacto = localStorage.getItem('clave_pub_' + contactoActual), clavePubPropia = localStorage.getItem('clave_pub_propia_' + miPIN);
  if (!clavePubContacto && typeof SupabaseUsuarios !== 'undefined') {
    try { var u = await SupabaseUsuarios.obtenerUsuario(contactoActual); if (u && u.clave_publica) { clavePubContacto = u.clave_publica; localStorage.setItem('clave_pub_' + contactoActual, clavePubContacto); } } catch(err) { console.error(err); }
  }
  if (!clavePubContacto || !clavePubPropia || typeof window.cifrarMensajeE2EE !== 'function') {
    await customAlert('❌ Error de Seguridad: Faltan llaves criptográficas activas.', '🛡️'); return;
  }
  try {
    // 1. Cifrar usando el modelo híbrido dual original (envoltura receptor + emisor)
    var cif = await window.cifrarMensajeE2EE(texto, clavePubContacto, clavePubPropia);
    var stringTuberíaClasico = cif.ciphertext + "|" + cif.iv + "|" + cif.wrappedKeyReceptor + "|" + cif.wrappedKeyEmisor;

    var mensajeDB = { pin_remitente: miPIN, pin_destinatario: contactoActual, mensaje_cifrado: stringTuberíaClasico, nonce: cif.iv, enviado_en: new Date().toISOString(), leido: false, tipo_mensaje: 'e2ee' };
    var data = null; if (typeof SupabaseMensajes !== 'undefined') data = await SupabaseMensajes.enviarMensajePayload(mensajeDB);
    var idCreado = (data && data[0]) ? data[0].id : "temp_" + Date.now();

    localStorage.setItem('last_msg_' + contactoActual, texto);
    appendMessageToUI(miPIN, texto, true, idCreado); input.value = ''; renderizarListaChats();
  } catch (e) { console.error(e); }
}

async function procesarMensajeEntrante(payload) {
  var de = payload.pin_remitente, para = payload.pin_destinatario; if (para !== miPIN) return;
  var textoClaro = '[Cifrado E2EE]';
  if (payload.tipo_mensaje === 'e2ee' && typeof window.descifrarMensajeE2EE === 'function') {
    try {
      var partes = payload.mensaje_cifrado.split('|');
      if (partes.length === 4) {
        textoClaro = await window.descifrarMensajeE2EE({ ciphertext: partes[0], iv: partes[1] }, partes[2]); // Usa wrappedKeyReceptor
      }
    } catch (e) { textoClaro = '❌ Paquete inaccesible.'; }
  } else { return; }
  localStorage.setItem('last_msg_' + de, textoClaro);
  if (contactoActual === de) { appendMessageToUI(de, textoClaro, false, payload.id); } 
  else { mensajesNoLeidos[de] = (mensajesNoLeidos[de] || 0) + 1; actualizarBadgeChats(); }
  renderizarListaChats();
}

async function cargarHistorial(contactoPin) {
  if (typeof SupabaseMensajes === 'undefined') return;
  try {
    var mensajes = await SupabaseMensajes.descargarHistorial(miPIN, contactoPin);
    var zona = document.getElementById('zonaMensajes'); if (zona) zona.innerHTML = '';
    for (var i = 0; i < mensajes.length; i++) {
      var m = mensajes[i], soyRemitente = (m.pin_remitente === miPIN), textoFinal = '[Cifrado]';
      if (m.tipo_mensaje === 'e2ee' && typeof window.descifrarMensajeE2EE === 'function') {
        try {
          var partes = m.mensaje_cifrado.split('|');
          if (partes.length === 4) {
            // SOLUCIÓN AL CANDADO TRAS RECARGAR: Si eres el remitente, abres con la envoltura 4, si eres receptor con la envoltura 3
            var llaveAAsignar = soyRemitente ? partes[3] : partes[2];
            textoFinal = await window.descifrarMensajeE2EE({ ciphertext: partes[0], iv: partes[1] }, llaveAAsignar);
          } else { textoFinal = '🔒 [Formato legacy incompatible]'; }
        } catch(e) { textoFinal = '🔒 [Mensaje cifrado con llaves anteriores]'; }
      }
      appendMessageToUI(m.pin_remitente, textoFinal, soyRemitente, m.id);
    }
  } catch(e) { console.error(e); }
}

function generarPIN() {
  if (miPIN) return miPIN;
  var localPin = localStorage.getItem('kerix_mi_pin');
  if (localPin) { miPIN = localPin; } else {
    var caracteres = '0123456789ABCDEF', resultado = ''; var randomBytes = crypto.getRandomValues(new Uint8Array(8));
    for (var i = 0; i < 8; i++) { resultado += caracteres[randomBytes[i] % 16]; }
    miPIN = resultado; localStorage.setItem('kerix_mi_pin', miPIN);
  }
  var elPin = document.getElementById('menuMiPin'); if (elPin) elPin.innerText = miPIN; return miPIN;
}

function abrirMenu() { var m = document.getElementById('menuLateral'), o = document.getElementById('menuOverlay'); if (m) m.classList.add('active', 'open'); if (o) o.classList.add('active', 'open'); }
function cerrarMenu() { var m = document.getElementById('menuLateral'), o = document.getElementById('menuOverlay'); if (m) m.classList.remove('active', 'open'); if (o) o.classList.remove('active', 'open'); }
function actualizarBadgeChats() { var b = document.getElementById('badgeTotalChats'), c = Object.keys(mensajesNoLeidos).reduce(function(acc, k){ return acc + (mensajesNoLeidos[k] || 0); }, 0); if (b) { b.style.display = c > 0 ? 'inline-block' : 'none'; b.innerText = String(c); } }
async function copiarPIN() { try { await navigator.clipboard.writeText(miPIN); await customAlert('✅ PIN copiado al portapapeles.'); } catch (e) { await customAlert('No se pudo copiar.'); } }

window.addEventListener('DOMContentLoaded', async function() {
  generarPIN(); cambiarTab('chats'); if (typeof window.inicializarSupabase === 'function') window.inicializarSupabase();
  await asegurarLlavesYRegistro(); if (typeof window.conectarCanalRealtime === 'function') window.conectarCanalRealtime();
});

// Exposición Global Completa
window.abrirMenu = abrirMenu; window.cerrarMenu = cerrarMenu; window.cambiarTab = cambiarTab; window.abrirChat = abrirChat; window.cerrarChat = cerrarChat;
window.mostrarModalAgregar = mostrarModalAgregar; window.cerrarModalAgregar = cerrarModalAgregar; window.agregarContacto = agregarContacto;
window.enviarMensaje = enviarMensaje; window.customAlert = customAlert; window.customConfirm = customConfirm; window.customPrompt = customPrompt;
window.generarPIN = generarPIN; window.copiarPIN = copiarPIN; window.exportarConfiguracion = exportarConfiguracion; window.limpiarChatActual = limpiarChatActual;
window.ejecutarResetEmergencia = ejecutarResetEmergencia; window.renderizarListaChats = renderizarListaChats; window.renderizarContactos = renderizarContactos; window.procesarMensajeEntrante = procesarMensajeEntrante;
