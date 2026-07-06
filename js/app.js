/**
 * js/app.js
 * Orquestador principal: UI, navegación, mensajes, contactos, inicialización e integraciones.
 * E2EE Blindado con Auto-Inscripción Criptográfica adaptada a columnas reales de Supabase.
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
var tabActual = 'chats';

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
    newBtn.addEventListener('click', function() {
      modal.classList.remove('active');
      resolve();
    });
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
    
    var newOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newOk, btnOk);
    var newCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    
    newOk.addEventListener('click', function() {
      modal.classList.add('active');
      resolve(true);
    });
    newCancel.addEventListener('click', function() {
      modal.classList.add('active');
      resolve(false);
    });
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
    
    txt.innerText = titulo + "\n" + texto;
    input.placeholder = placeholder || '';
    input.type = tipo || 'text';
    input.value = '';
    modal.classList.add('active');
    input.focus();
    
    var newOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newOk, btnOk);
    var newCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    
    newOk.addEventListener('click', function() {
      modal.classList.remove('active');
      resolve(input.value);
    });
    newCancel.addEventListener('click', function() {
      modal.classList.remove('active');
      resolve(null);
    });
  });
}

function mostrarModalAgregar() {
  var modal = document.getElementById('modalAgregarContacto');
  if (modal) modal.classList.add('active');
}

function cerrarModalAgregar() {
  var modal = document.getElementById('modalAgregarContacto');
  if (modal) modal.classList.remove('active');
}

function abrirChat(pin) {
  contactoActual = pin;
  if (mensajesNoLeidos[pin]) {
    mensajesNoLeidos[pin] = 0;
    actualizarBadgeChats();
  }
  var panel = document.getElementById('panelDerechoPrincipal');
  if (panel) panel.classList.add('active');
  var nombre = document.getElementById('chatHeaderNombre');
  if (nombre) nombre.innerText = obtenerNombreContacto(pin);
  cargarHistorial(pin);
}

function cerrarChat() {
  contactoActual = '';
  var panel = document.getElementById('panelDerechoPrincipal');
  if (panel) panel.classList.remove('active');
}

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab').forEach(function(el) {
    el.classList.remove('active');
  });
  
  var tabActivo = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (tabActivo) tabActivo.classList.add('active');

  var vChats = document.getElementById('vistaChats');
  var vContactos = document.getElementById('vistaContactos');
  var vAjustes = document.getElementById('vistaAjustes');

  if (vChats) vChats.classList.add('hidden');
  if (vContactos) vContactos.classList.add('hidden');
  if (vAjustes) vAjustes.classList.add('hidden');

  if (tab === 'chats' && vChats) { vChats.classList.remove('hidden'); renderizarListaChats(); }
  if (tab === 'contactos' && vContactos) { vContactos.classList.remove('hidden'); renderizarContactos(); }
  if (tab === 'ajustes' && vAjustes) vAjustes.classList.remove('hidden');
}

// ============================================
// GESTIÓN Y RENDERIZADO DE CONVERSACIONES
// ============================================
function renderizarListaChats() {
  var cont = document.getElementById('contenedorChats');
  var vacio = document.getElementById('chatsVacio');
  if (!cont) return;
  
  cont.innerHTML = '';
  var totalChats = 0;

  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k || !k.startsWith('contacto_')) continue;
    totalChats++;
    
    var pin = k.split('_')[1];
    var alias = obtenerNombreContacto(pin);
    var ultimoMsg = localStorage.getItem('last_msg_' + pin) || 'Sin mensajes históricos';
    var noLeidos = mensajesNoLeidos[pin] || 0;

    var div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = 
      '<div class="chat-avatar">' + alias.charAt(0).toUpperCase() + '</div>' +
      '<div class="chat-info">' +
        '<div class="chat-nombre">' + alias + ' <span style="font-size:10px;color:#8696a0;">(' + pin + ')</span></div>' +
        '<div class="chat-ultimo">' + ultimoMsg + '</div>' +
      '</div>' +
      (noLeidos > 0 ? '<div class="badge-no-leido" style="background:#00a884;color:#fff;border-radius:50%;padding:2px 7px;font-size:12px;margin-left:auto;">' + noLeidos + '</div>' : '');
    
    div.addEventListener('click', (function(p) { return function() { abrirChat(p); }; })(pin));
    cont.appendChild(div);
  }

  if (vacio) {
    vacio.style.display = totalChats === 0 ? 'block' : 'none';
  }
}

function renderizarContactos() {
  var cont = document.getElementById('contenedorContactos');
  if (!cont) return;
  cont.innerHTML = '';
  
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k || !k.startsWith('contacto_')) continue;
    try {
      var obj = JSON.parse(localStorage.getItem(k));
      var div = document.createElement('div');
      div.className = 'chat-item';
      div.style.position = 'relative';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      
      div.innerHTML = 
        '<div class="chat-avatar" style="background:#075e54; flex-shrink: 0;">' + (obj.alias ? obj.alias.charAt(0).toUpperCase() : obj.pin.charAt(0)) + '</div>' +
        '<div class="chat-info" style="flex-grow: 1; margin-left: 10px; padding-right: 80px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">' +
          '<div class="chat-nombre" style="font-weight: bold;">' + (obj.alias || obj.pin) + '</div>' +
          '<div class="chat-ultimo" style="font-family: monospace; color:#8696a0; font-size: 12px;">PIN: ' + obj.pin + '</div>' +
        '</div>' +
        '<div style="position: absolute; right: 12px; display: flex; gap: 10px; align-items: center; justify-content: center;">' +
          '<button style="background:none; border:none; color:#00a884; font-size:16px; cursor:pointer; padding: 4px;" id="edit_'+obj.pin+'" title="Asignar Nombre o Identificación">✏️</button>' +
          '<button style="background:none; border:none; color:#ef4444; font-size:18px; cursor:pointer; padding: 4px;" id="del_'+obj.pin+'" title="Eliminar Contacto">✕</button>' +
        '</div>';
      
      div.querySelector('#edit_' + obj.pin).addEventListener('click', (function(p, currentAlias) {
        return async function(e) {
          e.stopPropagation();
          var nuevoAlias = await customPrompt('👤 Identificación de Contacto', 'Asigna o cambia el nombre para el contacto (' + p + '):', currentAlias);
          if (nuevoAlias !== null) {
            guardarContactoLocal(p, nuevoAlias.trim());
            renderizarContactos();
            renderizarListaChats();
          }
        };
      })(obj.pin, obj.alias || ""));

      div.querySelector('#del_' + obj.pin).addEventListener('click', (function(p) {
        return async function(e) {
          e.stopPropagation();
          var conf = await customConfirm('¿Eliminar de forma permanente al contacto ' + p + '?');
          if (conf) {
            localStorage.removeItem('contacto_' + p);
            localStorage.removeItem('last_msg_' + p);
            localStorage.removeItem('clave_pub_' + p);
            renderizarContactos();
            renderizarListaChats();
          }
        };
      })(obj.pin));

      div.addEventListener('click', (function(p) { return function() { abrirChat(p); }; })(obj.pin));
      cont.appendChild(div);
    } catch (e) { continue; }
  }
}

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

async function agregarContacto() {
  var inputPin = document.getElementById('nuevoContactoPin');
  if (!inputPin) return;
  var pin = inputPin.value.trim().toUpperCase();
  
  if (!window.validarPIN || !window.validarPIN(pin)) {
    customAlert('El PIN debe tener 8 caracteres hexadecimales.');
    return;
  }
  if (pin === miPIN) { customAlert('No puedes agregarte a ti mismo.'); return; }

  var alias = await customPrompt('👤 Nueva Identificación', 'Asigna un nombre o alias para guardar este PIN:', '');
  if (alias === null) return; 

  guardarContactoLocal(pin, alias.trim());

  if (typeof SupabaseUsuarios !== 'undefined') {
    try {
      var u = await SupabaseUsuarios.obtenerUsuario(pin);
      if (u && u.clave_publica) {
        localStorage.setItem('clave_pub_' + pin, u.clave_publica);
      }
    } catch (e) { console.error('Error sincronizando llaves al agregar:', e); }
  }

  renderizarListaChats();
  renderizarContactos();
  inputPin.value = '';
  cerrarModalAgregar();
}

// CORREGIDO: Mapeo exacto basado en las columnas reales de la tabla 'usuarios'
async function asegurarLlavesYRegistro() {
  var priv = localStorage.getItem("clave_privada_" + miPIN);
  var pub = localStorage.getItem("clave_pub_propia_" + miPIN);

  if (!priv || !pub) {
    console.log("🛡️ Generando nuevo juego de llaves criptográficas RSA de producción...");
    try {
      var kp = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
      );

      var exportedPub = await window.crypto.subtle.exportKey("spki", kp.publicKey);
      var exportedPriv = await window.crypto.subtle.exportKey("pkcs8", kp.privateKey);

      function bufToPem(buf, isPriv) {
        var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
        var header = isPriv ? "-----BEGIN PRIVATE KEY-----\n" : "-----BEGIN PUBLIC KEY-----\n";
        var footer = isPriv ? "\n-----END PRIVATE KEY-----" : "\n-----END PUBLIC KEY-----";
        return header + b64 + footer;
      }

      var pubPem = bufToPem(exportedPub, false);
      var privPem = bufToPem(exportedPriv, true);

      localStorage.setItem("clave_privada_" + miPIN, privPem);
      localStorage.setItem("clave_pub_propia_" + miPIN, pubPem);
      pub = pubPem;
    } catch(err) {
      console.error("Error generando llaves locales:", err);
      return;
    }
  }

  // SOLUCIÓN AL ERROR 400: Se envían únicamente campos que existen de forma nativa en la tabla de Supabase
  if (typeof clienteSupabase !== 'undefined' && clienteSupabase) {
    try {
      var { error } = await clienteSupabase.from('usuarios').upsert([{ 
        pin: miPIN, 
        clave_publica: pub
      }]);
      
      if (error) {
        console.error("❌ Falló la sincronización en Supabase:", error.message);
      } else {
        console.log("✅ Llave pública sincronizada con éxito en Supabase para el PIN: " + miPIN);
      }
    } catch(err) {
      console.error("Error registrando credenciales en el servidor:", err);
    }
  }
}

// ============================================
// ENVÍO, RECEPCIÓN Y RENDERING EN TIEMPO REAL
// ============================================
function appendMessageToUI(pinRemitente, texto, enviado) {
  var zona = document.getElementById('zonaMensajes');
  if (!zona) return;
  var m = document.createElement('div');
  m.className = 'mensaje ' + (enviado ? 'mensaje-enviado' : 'mensaje-recibido');
  m.innerHTML = '<div class="mensaje-texto"></div><div class="mensaje-meta">' + (new Date()).toLocaleTimeString() + '</div>';
  m.querySelector('.mensaje-texto').innerText = texto; 
  zona.appendChild(m);
  zona.scrollTop = zona.scrollHeight;
}

async function enviarMensaje() {
  var input = document.getElementById('nuevoMensaje');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto) return;
  if (!contactoActual) { await customAlert('Selecciona un contacto primero.'); return; }

  var clavePub = localStorage.getItem('clave_pub_' + contactoActual);
  
  if (!clavePub && typeof SupabaseUsuarios !== 'undefined') {
    try {
      var u = await SupabaseUsuarios.obtenerUsuario(contactoActual);
      if (u && u.clave_publica) {
        clavePub = u.clave_publica;
        localStorage.setItem('clave_pub_' + contactoActual, clavePub);
      }
    } catch(err) { console.error('Error descargando llave pública:', err); }
  }

  if (!clavePub || typeof window.cifrarMensajeE2EE !== 'function') {
    await customAlert('❌ Error de Seguridad: El contacto destino no posee un par de llaves criptográficas activas. Envío cancelado.', '🛡️');
    return;
  }

  var mensajeCifradoString = "";
  var nonceString = "";

  try {
    var cif = await window.cifrarMensajeE2EE(texto, clavePub);
    mensajeCifradoString = cif.ciphertext;
    nonceString = cif.iv;
  } catch (e) { 
    console.error('Fallo en el cifrado:', e);
    await customAlert('❌ Error interno del motor criptográfico al empaquetar el mensaje.', '🛡️');
    return;
  }

  var mensajeDB = {
    pin_remitente: miPIN,
    pin_destinatario: contactoActual,
    mensaje_cifrado: mensajeCifradoString,
    nonce: nonceString,
    enviado_en: new Date().toISOString(),
    leido: false,
    tipo_mensaje: 'e2ee'
  };

  if (typeof SupabaseMensajes !== 'undefined') {
    try { 
      await SupabaseMensajes.enviarMensajePayload(mensajeDB); 
    } catch (e) { 
      console.error('Error sending message to Supabase:', e);
      return;
    }
  }

  localStorage.setItem('last_msg_' + contactoActual, texto);
  appendMessageToUI(miPIN, texto, true);
  input.value = '';
  renderizarListaChats();
}

async function procesarMensajeEntrante(payload) {
  var de = payload.pin_remitente;
  var para = payload.pin_destinatario;
  
  if (para !== miPIN) return;

  var cipherText = payload.mensaje_cifrado;
  var nonce = payload.nonce;
  var textoClaro = '[Contenido Cifrado E2EE]';

  if (payload.tipo_mensaje === 'e2ee' && typeof window.descifrarMensajeE2EE === 'function') {
    try {
      var fullCif = { ciphertext: cipherText, iv: nonce };
      textoClaro = await window.descifrarMensajeE2EE(fullCif, false);
    } catch (e) { textoClaro = '❌ Mensaje inaccesible (Llaves no emparejadas)'; }
  } else {
    return; 
  }

  localStorage.setItem('last_msg_' + de, textoClaro);

  if (contactoActual === de) {
    appendMessageToUI(de, textoClaro, false);
  } else {
    mensajesNoLeidos[de] = (mensajesNoLeidos[de] || 0) + 1;
    actualizarBadgeChats();
    if (typeof window.dispararNotificacionVisual === 'function') {
      window.dispararNotificacionVisual(de, textoClaro);
    }
  }
  renderizarListaChats();
}

async function cargarHistorial(contactoPin) {
  if (typeof SupabaseMensajes === 'undefined') return;
  try {
    var mensajes = await SupabaseMensajes.descargarHistorial(miPIN, contactoPin);
    var zona = document.getElementById('zonaMensajes');
    if (zona) zona.innerHTML = '';
    
    for (var i = 0; i < mensajes.length; i++) {
      var m = mensajes[i];
      var soyRemitente = (m.pin_remitente === miPIN);
      var textoFinal = '[Contenido Cifrado Corrupto]';

      if (m.tipo_mensaje === 'e2ee' && typeof window.descifrarMensajeE2EE === 'function') {
        try {
          var fullCif = { ciphertext: m.mensaje_cifrado, iv: m.nonce };
          textoFinal = await window.descifrarMensajeE2EE(fullCif, soyRemitente);
        } catch(e) { 
          textoFinal = '🔒 [Mensaje anterior cifrado con llaves anteriores]'; 
        }
      }
      appendMessageToUI(m.pin_remitente, textoFinal, soyRemitente);
    }
  } catch(e) { console.error('Error loading history:', e); }
}

function generarPIN() {
  if (miPIN) return miPIN;
  var localPin = localStorage.getItem('kerix_mi_pin');
  if (localPin) { miPIN = localPin; } else {
    var caracteres = '0123456789ABCDEF';
    var resultado = '';
    var randomBytes = crypto.getRandomValues(new Uint8Array(8));
    for (var i = 0; i < 8; i++) { resultado += caracteres[randomBytes[i] % 16]; }
    miPIN = resultado;
    localStorage.setItem('kerix_mi_pin', miPIN);
  }
  var elPin = document.getElementById('menuMiPin');
  if (elPin) elPin.innerText = miPIN;
  return miPIN;
}

function abrirMenu() {
  var menu = document.getElementById('menuLateral');
  var overlay = document.getElementById('menuOverlay');
  if (menu) menu.classList.add('active', 'open');
  if (overlay) overlay.classList.add('active', 'open');
}

function cerrarMenu() {
  var menu = document.getElementById('menuLateral');
  var overlay = document.getElementById('menuOverlay');
  if (menu) menu.classList.remove('active', 'open');
  if (overlay) overlay.classList.remove('active', 'open');
}

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
  } catch (e) { await customAlert('No se pudo copiar al portapapeles.'); }
}

window.addEventListener('DOMContentLoaded', async function() {
  generarPIN();
  cambiarTab('chats');
  if (typeof window.inicializarSupabase === 'function') window.inicializarSupabase();
  await asegurarLlavesYRegistro();
  if (typeof window.conectarCanalRealtime === 'function') window.conectarCanalRealtime();
});

// Exposición Global
window.abrirMenu = abrirMenu;
window.cerrarMenu = cerrarMenu;
window.cambiarTab = cambiarTab;
window.abrirChat = abrirChat;
window.cerrarChat = cerrarChat;
window.mostrarModalAgregar = mostrarModalAgregar;
window.cerrarModalAgregar = cerrarModalAgregar;
window.agregarContacto = agregarContacto;
window.enviarMensaje = enviarMensaje;
window.customAlert = customAlert;
window.customConfirm = customConfirm;
window.customPrompt = customPrompt;
window.generarPIN = generarPIN;
window.copiarPIN = copiarPIN;
window.renderizarListaChats = renderizarListaChats;
window.renderizarContactos = renderizarContactos;
window.procesarMensajeEntrante = procesarMensajeEntrante;
