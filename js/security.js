/**
 * js/security.js
 * Módulo de seguridad: PIN, bloqueo, rate limiting, validación
 * 
 * Depende de: (ninguna dependencia interna, es módulo base)
 * Cargar antes de: crypto.js, supabase-client.js, app.js
 */

// ============================================
// VARIABLES GLOBALES DE SEGURIDAD
// ============================================
var pinAccesoHash = null;
var codigoRecuperacionHash = null;
var pinActualTemporal = null;

// Rate limiting
var rateLimiters = {};
var RETRY_CONFIG = { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, backoffFactor: 2 };

// ============================================
// HASH Y CIFRADO DE PIN
// ============================================
async function hashPIN(pin) {
  var encoder = new TextEncoder();
  var data = encoder.encode('pin:' + pin);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generarCodigoRecuperacion() {
  var caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var codigo = '';
  var bytes = crypto.getRandomValues(new Uint8Array(24));
  for (var i = 0; i < 24; i++) codigo += caracteres[bytes[i] % caracteres.length];
  return codigo.match(/.{1,4}/g).join('-');
}

async function hashCodigo(codigo) {
  var encoder = new TextEncoder();
  var data = encoder.encode('codigo:' + codigo.toUpperCase().replace(/-/g, ''));
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function cifrarClaveConPIN(clavePrivadaBase64, pin) {
  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode('pin:' + pin), 'PBKDF2', false, ['deriveKey']);
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoder.encode(clavePrivadaBase64));
  return btoa(String.fromCharCode.apply(null, salt)) + '.' + btoa(String.fromCharCode.apply(null, iv)) + '.' + btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado)));
}

async function descifrarClaveConPIN(claveCifrada, pin) {
  var partes = claveCifrada.split('.');
  var salt = Uint8Array.from(atob(partes[0]), c => c.charCodeAt(0));
  var iv = Uint8Array.from(atob(partes[1]), c => c.charCodeAt(0));
  var cifrado = Uint8Array.from(atob(partes[2]), c => c.charCodeAt(0));
  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode('pin:' + pin), 'PBKDF2', false, ['deriveKey']);
  var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado));
}

async function descifrarClaveConCodigo(claveCifrada, codigo) {
  var partes = claveCifrada.split('.');
  var salt = Uint8Array.from(atob(partes[0]), c => c.charCodeAt(0));
  var iv = Uint8Array.from(atob(partes[1]), c => c.charCodeAt(0));
  var cifrado = Uint8Array.from(atob(partes[2]), c => c.charCodeAt(0));
  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode('codigo:' + codigo.toUpperCase().replace(/-/g, '')), 'PBKDF2', false, ['deriveKey']);
  var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado));
}

// ============================================
// GESTIÓN DE PIN DE ACCESO
// ============================================
async function verificarPINConfigurado() {
  pinAccesoHash = localStorage.getItem('pin_hash_' + miPIN);
  codigoRecuperacionHash = localStorage.getItem('codigo_recuperacion_hash_' + miPIN);
  var pantalla = document.getElementById('pantallaBloqueo');
  var btnConfig = document.getElementById('btnConfigPIN');
  var btnRecuperar = document.getElementById('btnRecuperar');
  var btnDesbloquear = document.getElementById('btnDesbloquear');
  var btnReset = document.getElementById('btnReset');
  var inputPIN = document.getElementById('pinAccesoInput');
  
  if (!pinAccesoHash) {
    pantalla.style.display = 'none';
    document.getElementById('appPrincipal').style.display = 'block';
    try { await cargarClavePrivadaSegura(null); } catch (e) { logError('Error:', e); }
    await verificarEstado();
    await cargarMensajesNoLeidos();
    cambiarTab('chats');
  } else {
    pantalla.style.display = 'flex';
    btnConfig.style.display = 'none';
    btnRecuperar.style.display = 'block';
    btnDesbloquear.style.display = 'block';
    btnReset.style.display = 'block';
    inputPIN.style.display = 'block';
    inputPIN.focus();
    document.getElementById('appPrincipal').style.display = 'none';
  }
}

async function configurarPIN() {
  var pin1 = await customPrompt('🔐 Configurar PIN', 'Ingresa un PIN de acceso (4-6 dígitos):', '••••', 'password');
  if (!pin1 || pin1.length < 4 || pin1.length > 6 || !/^\d+$/.test(pin1)) { await customAlert('PIN inválido (debe contener entre 4 y 6 números).'); return; }
  var pin2 = await customPrompt('🔐 Confirmar PIN', 'Confirma tu PIN de acceso:', '••••', 'password');
  if (pin1 !== pin2) { await customAlert('Los PINs no coinciden.'); return; }
  var codigoRecuperacion = generarCodigoRecuperacion();
  var confirmado = await customConfirm('⚠️ GUARDA ESTE CÓDIGO DE RECUPERACIÓN:\n' + codigoRecuperacion + '\nSi olvidas tu PIN, lo necesitarás.\n¿Ya lo guardaste?', '🔑');
  if (!confirmado) { await customAlert('Debes guardar el código.'); return; }
  pinAccesoHash = await hashPIN(pin1);
  codigoRecuperacionHash = await hashCodigo(codigoRecuperacion);
  localStorage.setItem('pin_hash_' + miPIN, pinAccesoHash);
  localStorage.setItem('codigo_recuperacion_hash_' + miPIN, codigoRecuperacionHash);
  sessionStorage.setItem('pin_temporal_' + miPIN, pin1);
  pinActualTemporal = pin1;
  var clavePrivadaActual = localStorage.getItem('clave_privada_' + miPIN);
  if (clavePrivadaActual) {
    try {
      var privBase64 = clavePrivadaActual.includes('.') ? await descifrarClaveConPIN(clavePrivadaActual, pin1) : desofuscarClave(clavePrivadaActual);
      localStorage.setItem('clave_privada_' + miPIN, await cifrarClaveConPIN(privBase64, pin1));
    } catch (e) { logError('Error cifrando:', e); }
  }
  await customAlert('✅ PIN configurado.', '✅');
  location.reload();
}

async function recuperarAcceso() {
  var codigo = await customPrompt('🔑 Recuperación', 'Ingresa tu código de recuperación:', 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX');
  if (!codigo) return;
  var hashIngresado = await hashCodigo(codigo);
  if (hashIngresado === codigoRecuperacionHash) {
    var nuevoPin = await customPrompt('🔑 Nuevo PIN', 'Ingresa tu nuevo PIN (4-6 dígitos):', '••••', 'password');
    if (!nuevoPin || nuevoPin.length < 4 || nuevoPin.length > 6 || !/^\d+$/.test(nuevoPin)) { await customAlert('PIN inválido.'); return; }
    var nuevoPin2 = await customPrompt('🔑 Confirmar PIN', 'Confirma tu nuevo PIN:', '••••', 'password');
    if (nuevoPin !== nuevoPin2) { await customAlert('No coinciden.'); return; }
    pinAccesoHash = await hashPIN(nuevoPin);
    localStorage.setItem('pin_hash_' + miPIN, pinAccesoHash);
    var claveCifrada = localStorage.getItem('clave_privada_' + miPIN);
    if (claveCifrada && claveCifrada.includes('.')) {
      try {
        var privBase64 = await descifrarClaveConCodigo(claveCifrada, codigo);
        localStorage.setItem('clave_privada_' + miPIN, await cifrarClaveConPIN(privBase64, nuevoPin));
      } catch (e) { logError('Error:', e); }
    }
    pinActualTemporal = nuevoPin;
    sessionStorage.setItem('pin_temporal_' + miPIN, nuevoPin);
    await customAlert('✅ PIN restablecido.', '✅');
    location.reload();
  } else { await customAlert('❌ Código incorrecto.', '❌'); }
}

async function resetEmergencia() {
  var c1 = await customConfirm('⚠️ RESET DE EMERGENCIA\n• Eliminará tu PIN\n• Eliminará tu código de recuperación\n• Eliminará tu clave privada local\n• ¡NO podrás descifrar mensajes antiguos!\n¿Continuar?', '⚠️');
  if (!c1) return;
  var c2 = await customConfirm('ÚLTIMA ADVERTENCIA\n¿Estás absolutamente seguro?', '⚠️');
  if (!c2) return;
  var texto = await customPrompt('Confirmación final', 'Escribe "RESET" para confirmar:', 'RESET');
  if (texto !== 'RESET') { await customAlert('❌ Cancelado.', '❌'); return; }
  localStorage.removeItem('pin_hash_' + miPIN);
  localStorage.removeItem('codigo_recuperacion_hash_' + miPIN);
  localStorage.removeItem('clave_privada_' + miPIN);
  sessionStorage.removeItem('pin_temporal_' + miPIN);
  await customAlert('✅ Reset completado.', '✅');
  location.reload();
}

async function desbloquearApp() {
  var pinIngresado = document.getElementById('pinAccesoInput').value;
  if (!pinIngresado) return;
  var hashIngresado = await hashPIN(pinIngresado);
  if (hashIngresado === pinAccesoHash) {
    pinActualTemporal = pinIngresado;
    sessionStorage.setItem('pin_temporal_' + miPIN, pinIngresado);
    document.getElementById('pantallaBloqueo').style.display = 'none';
    document.getElementById('pinAccesoInput').value = '';
    document.getElementById('errorPIN').style.display = 'none';
    try { await cargarClavePrivadaSegura(pinIngresado); } catch (error) { logError('Error:', error); await customAlert('⚠️ No se pudieron cargar las llaves.'); return; }
    document.getElementById('appPrincipal').style.display = 'block';
    try { await verificarEstado(); } catch (error) { logError('Error:', error); }
    await cargarMensajesNoLeidos();
    cambiarTab('chats');
  } else {
    document.getElementById('errorPIN').style.display = 'block';
    document.getElementById('pinAccesoInput').value = '';
    document.getElementById('pinAccesoInput').focus();
  }
}

async function cambiarPIN() {
  if (!pinAccesoHash) {
    var confirmar = await customConfirm('No tienes PIN configurado.\n¿Configurar uno ahora?', '🔐');
    if (confirmar) await configurarPIN();
    return;
  }
  var pinActual = await customPrompt('🔐 Cambiar PIN', 'Ingresa tu PIN actual:', '••••', 'password');
  if (!pinActual) return;
  if (await hashPIN(pinActual) !== pinAccesoHash) { await customAlert('❌ PIN incorrecto.', '❌'); return; }
  var nuevoPin = await customPrompt('🔐 Nuevo PIN', 'Ingresa tu nuevo PIN (4-6 dígitos):', '••••', 'password');
  if (!nuevoPin || nuevoPin.length < 4 || nuevoPin.length > 6 || !/^\d+$/.test(nuevoPin)) { await customAlert('PIN inválido.'); return; }
  var nuevoPin2 = await customPrompt('🔐 Confirmar PIN', 'Confirma tu nuevo PIN:', '••••', 'password');
 
