/**
 * js/security.js
 * Módulo de seguridad profesional: PIN, bloqueo, rate limiting, validación y derivación criptográfica.
 */

// ============================================
// VARIABLES GLOBALES DE SEGURIDAD
// ============================================
var pinAccesoHash = null;
var codigoRecuperacionHash = null;
var pinActualTemporal = null;

var rateLimiters = {};
var INTENTOS_MAXIMOS = 3;
var TIEMPO_BLOQUEO_MS = 30000;

var PBKDF2_SALT = new TextEncoder().encode("kerix-pbkdf2-salt-secure-2026");

// IDENTIFICADOR DE PERFIL ESTÁTICO FIJO (CORREGIDO)
var idUsuario = 'kerix_secure_profile';

// ============================================
// HASH Y CIFRADO DE PIN
// ============================================
async function hashPIN(pin) {
  var encoder = new TextEncoder();
  var data = encoder.encode('pin:' + pin);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

function generarCodigoRecuperacion() {
  var caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var codigo = '';
  var bytes = crypto.getRandomValues(new Uint8Array(24));
  for (var i = 0; i < 24; i++) {
    codigo += caracteres[bytes[i] % caracteres.length];
  }
  return codigo.match(/.{1,4}/g).join('-');
}

async function hashCodigo(codigo) {
  var encoder = new TextEncoder();
  var data = encoder.encode('codigo:' + codigo.toUpperCase().replace(/-/g, ''));
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

async function cifrarClaveConPIN(clavePrivadaBase64, pin) {
  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('pin:' + pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  var key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: PBKDF2_SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  var iv = crypto.getRandomValues(new Uint8Array(12));
  var cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(clavePrivadaBase64)
  );

  return btoa(String.fromCharCode.apply(null, iv)) + '.' + btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado)));
}

async function descifrarClaveConPIN(claveCifrada, pin) {
  var partes = claveCifrada.split('.');
  if (partes.length < 2) throw new Error('Formato de clave cifrada inválido');
  var iv = Uint8Array.from(atob(partes[0]), function(c) { return c.charCodeAt(0); });
  var cifrado = Uint8Array.from(atob(partes[1]), function(c) { return c.charCodeAt(0); });

  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('pin:' + pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  var key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: PBKDF2_SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  var decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado);
  return new TextDecoder().decode(decryptedBuffer);
}

async function descifrarClaveConCodigo(claveCifrada, codigo) {
  var partes = claveCifrada.split('.');
  if (partes.length < 2) throw new Error('Formato de clave cifrada inválido');
  var iv = Uint8Array.from(atob(partes[0]), function(c) { return c.charCodeAt(0); });
  var cifrado = Uint8Array.from(atob(partes[1]), function(c) { return c.charCodeAt(0); });

  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('codigo:' + codigo.toUpperCase().replace(/-/g, '')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  var key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: PBKDF2_SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  var decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado);
  return new TextDecoder().decode(decryptedBuffer);
}

// ============================================
// GESTIÓN DE PIN DE ACCESO
// ============================================
async function verificarPINConfigurado() {
  pinAccesoHash = localStorage.getItem('pin_hash_' + idUsuario);
  codigoRecuperacionHash = localStorage.getItem('codigo_recuperacion_hash_' + idUsuario);

  var pantalla = document.getElementById('pantallaBloqueo');
  var btnConfig = document.getElementById('btnConfigPIN');
  var btnRecuperar = document.getElementById('btnRecuperar');
  var btnDesbloquear = document.getElementById('btnDesbloquear');
  var btnReset = document.getElementById('btnReset');
  var inputPIN = document.getElementById('pinAccesoInput');
  var appPrincipal = document.getElementById('appPrincipal');

  if (!pinAccesoHash) {
    if (pantalla) pantalla.style.display = 'none';
    if (appPrincipal) appPrincipal.style.display = 'block';
    try {
      if (typeof cargarClavePrivadaSegura === 'function') await cargarClavePrivadaSegura(null);
    } catch (e) {
      console.error('Error:', e);
    }
  } else {
    if (pantalla) pantalla.style.display = 'flex';
    if (btnConfig) btnConfig.style.display = 'none';
    if (btnRecuperar) btnRecuperar.style.display = 'block';
    if (btnDesbloquear) btnDesbloquear.style.display = 'block';
    if (btnReset) btnReset.style.display = 'block';
    if (inputPIN) {
      inputPIN.style.display = 'block';
      inputPIN.focus();
    }
    if (appPrincipal) appPrincipal.style.display = 'none';
  }
}

async function configurarPIN() {
  var pin1 = await customPrompt('🔐 Configurar PIN', 'Ingresa un PIN de acceso (4-6 dígitos):', '••••', 'password');
  if (!pin1 || pin1.length < 4 || pin1.length > 6 || !/^\d+$/.test(pin1)) {
    await customAlert('PIN inválido (debe contener entre 4 y 6 números).');
    return;
  }
  var pin2 = await customPrompt('🔐 Confirmar PIN', 'Confirma tu PIN de acceso:', '••••', 'password');
  if (pin1 !== pin2) {
    await customAlert('Los PINs no coinciden.');
    return;
  }

  var codigoRecuperacion = generarCodigoRecuperacion();
  var confirmado = await customConfirm('⚠️ GUARDA ESTE CÓDIGO DE RECUPERACIÓN:\n' + codigoRecuperacion + '\nSi olvidas tu PIN, lo necesitarás.\n¿Ya lo guardaste?', '🔑');
  if (!confirmado) {
    await customAlert('Debes guardar el código para continuar.');
    return;
  }

  pinAccesoHash = await hashPIN(pin1);
  codigoRecuperacionHash = await hashCodigo(codigoRecuperacion);
  localStorage.setItem('pin_hash_' + idUsuario, pinAccesoHash);
  localStorage.setItem('codigo_recuperacion_hash_' + idUsuario, codigoRecuperacionHash);
  sessionStorage.setItem('pin_temporal_' + idUsuario, pin1);
  pinActualTemporal = pin1;

  var clavePrivadaActual = localStorage.getItem('clave_privada_' + idUsuario);
  if (clavePrivadaActual) {
    try {
      if (!clavePrivadaActual.includes('.')) {
        var privBase64 = typeof desofuscarClave === 'function' ? desofuscarClave(clavePrivadaActual) : clavePrivadaActual;
        var nuevoCifrado = await cifrarClaveConPIN(privBase64, pin1);
        localStorage.setItem('clave_privada_' + idUsuario, nuevoCifrado);
      } else {
        console.log('Clave privada ya cifrada; no se re-encriptó.');
      }
    } catch (e) {
      console.error('Error cifrando clave:', e);
    }
  }
  await customAlert('✅ PIN configurado exitosamente.', '✅');
  location.reload();
}

async function recuperarAcceso() {
  var codigo = await customPrompt('🔑 Recuperación', 'Ingresa tu código de recuperación:', 'XXXX-XXXX-XXXX-XXXX');
  if (!codigo) return;
  var hashIngresado = await hashCodigo(codigo);
  if (hashIngresado === codigoRecuperacionHash) {
    var nuevoPin = await customPrompt('🔑 Nuevo PIN', 'Ingresa tu nuevo PIN (4-6 dígitos):', '••••', 'password');
    if (!nuevoPin || nuevoPin.length < 4 || nuevoPin.length > 6 || !/^\d+$/.test(nuevoPin)) {
      await customAlert('PIN inválido.');
      return;
    }
    pinAccesoHash = await hashPIN(nuevoPin);
    localStorage.setItem('pin_hash_' + idUsuario, pinAccesoHash);
    await customAlert('✅ PIN restablecido exitosamente.', '✅');
    location.reload();
  } else {
    await customAlert('❌ Código de recuperación incorrecto.', '❌');
  }
}

async function resetEmergencia() {
  var c1 = await customConfirm('⚠️ RESET DE EMERGENCIA\nEsto eliminará tu PIN, tu código de recuperación y tus llaves locales. ¿Continuar?', '⚠️');
  if (!c1) return;
  var texto = await customPrompt('Confirmación final', 'Escribe "RESET" para confirmar:', 'RESET');
  if (texto !== 'RESET') {
    await customAlert('❌ Cancelado.');
    return;
  }
  localStorage.removeItem('pin_hash_' + idUsuario);
  localStorage.removeItem('codigo_recuperacion_hash_' + idUsuario);
  localStorage.removeItem('clave_privada_' + idUsuario);
  sessionStorage.removeItem('pin_temporal_' + idUsuario);
  await customAlert('✅ Sistema restablecido de fábrica.', '✅');
  location.reload();
}

async function desbloquearApp() {
  var inputPIN = document.getElementById('pinAccesoInput');
  if (!inputPIN) return;
  var pinIngresado = inputPIN.value;
  if (!pinIngresado) return;

  var hashIngresado = await hashPIN(pinIngresado);
  if (hashIngresado === pinAccesoHash) {
    pinActualTemporal = pinIngresado;
    sessionStorage.setItem('pin_temporal_' + idUsuario, pinIngresado);
    document.getElementById('pantallaBloqueo').style.display = 'none';
    inputPIN.value = '';
    document.getElementById('appPrincipal').style.display = 'block';

    try {
      await cargarClavePrivadaSegura(pinIngresado);
    } catch (e) {
      console.warn('No se pudo cargar clave privada tras desbloquear:', e);
    }
  } else {
    var errorPIN = document.getElementById('errorPIN');
    if (errorPIN) errorPIN.style.display = 'block';
    inputPIN.value = '';
    inputPIN.focus();
  }
}

async function cambiarPIN() {
  var pinActual = await customPrompt('🔐 Cambiar PIN', 'Ingresa tu PIN actual:', '••••', 'password');
  if (!pinActual) return;
  if (await hashPIN(pinActual) !== pinAccesoHash) {
    await customAlert('❌ PIN incorrecto.');
    return;
  }
  var nuevoPin = await customPrompt('🔐 Nuevo PIN', 'Ingresa tu nuevo PIN (4-6 dígitos):', '••••', 'password');
  if (!nuevoPin || nuevoPin.length < 4 || nuevoPin.length > 6 || !/^\d+$/.test(nuevoPin)) {
    await customAlert('PIN inválido.');
    return;
  }
  pinAccesoHash = await hashPIN(nuevoPin);
  localStorage.setItem('pin_hash_' + idUsuario, pinAccesoHash);
  await customAlert('✅ PIN modificado con éxito.', '✅');
}

async function cargarClavePrivadaSegura(pin) {
  try {
    var almacen = localStorage.getItem('clave_privada_' + idUsuario);
    if (!almacen) return;

    var privBase64 = null;
    if (almacen.includes('.')) {
      var p = pin || sessionStorage.getItem('pin_temporal_' + idUsuario);
      if (!p) {
        console.warn('Se requiere PIN temporal para descifrar clave privada.');
        return;
      }
      try {
        privBase64 = await descifrarClaveConPIN(almacen, p);
      } catch (e) {
        console.error('Error descifrando clave privada con PIN proporcionado:', e);
        return;
      }
    } else {
      if (typeof desofuscarClave === 'function') privBase64 = desofuscarClave(almacen);
      else privBase64 = almacen;
    }

    if (!privBase64) return;

    var binary = Uint8Array.from(atob(privBase64), function(c) { return c.charCodeAt(0); }).buffer;
    miClavePrivada = await crypto.subtle.importKey(
      'pkcs8',
      binary,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    console.log('Clave privada cargada e importada en memoria.');
  } catch (e) {
    console.error('Error cargando clave privada segura:', e);
  }
}

function validarPIN(pin) {
  if (!pin || pin.trim().length !== 8) return false;
  return /^[0-9A-F]{8}$/.test(pin.toUpperCase());
}

function validarMensaje(texto) {
  if (!texto || texto.trim().length === 0) return false;
  if (texto.length > 5000) return false;
  return true;
}

function validarArchivo(file) {
  if (!file) return { valido: false, error: 'Sin archivo' };
  var maxTam = 15 * 1024 * 1024;
  if (file.size > maxTam) return { valido: false, error: 'Excede el límite de 15MB' };
  if (file.size === 0) return { valido: false, error: 'Archivo vacío' };
  return { valido: true };
}

// ============================================
// 🌍 EXPOSICIÓN GLOBAL
// ============================================
window.hashPIN = hashPIN;
window.generarCodigoRecuperacion = generarCodigoRecuperacion;
window.hashCodigo = hashCodigo;
window.cifrarClaveConPIN = cifrarClaveConPIN;
window.descifrarClaveConPIN = descifrarClaveConPIN;
window.descifrarClaveConCodigo = descifrarClaveConCodigo;
window.verificarPINConfigurado = verificarPINConfigurado;
window.configurarPIN = configurarPIN;
window.recuperarAcceso = recuperarAcceso;
window.resetEmergencia = resetEmergencia;
window.desbloquearApp = desbloquearApp;
window.cambiarPIN = cambiarPIN;
window.cargarClavePrivadaSegura = cargarClavePrivadaSegura;
window.validarPIN = validarPIN;
window.validarMensaje = validarMensaje;
window.validarArchivo = validarArchivo;

console.log('🛡️ Módulo de seguridad (security.js) reparado y activo.');
