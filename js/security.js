/**
 * js/security.js
 * Módulo de seguridad profesional: PIN, bloqueo, rate limiting y Reset de Emergencia Nuclear.
 */

var pinAccesoHash = null;
var codigoRecuperacionHash = null;
var pinActualTemporal = null;
var idUsuario = 'kerix_secure_profile';

async function hashPIN(pin) {
  var encoder = new TextEncoder();
  var data = encoder.encode('pin:' + pin);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

// ============================================
// ⚠️ RESET NUCLEAR DE EMERGENCIA (COMPLETO)
// ============================================
async function resetEmergenciaCompleto() {
  var c1 = await customConfirm('⚠️ ADVERTENCIA CRÍTICA (RESET DE EMERGENCIA)\nEsto eliminará de forma irreversible tus claves criptográficas, contactos, historiales de mensajes, configuraciones y perfiles de este dispositivo local.\n¿Deseas continuar?');
  if (!c1) return;

  var confirmacionText = await customPrompt(
    'CONFIRMACIÓN CRÍTICA REQUERIDA', 
    'Para ejecutar la acción nuclear destructiva de datos, escribe exactamente "BORRAR TODO" en el cuadro inferior:', 
    'BORRAR TODO'
  );
  
  if (confirmacionText !== 'BORRAR TODO') {
    await customAlert('❌ Cancelado. La frase de confirmación no coincide.');
    return;
  }

  // Purga absoluta del almacenamiento
  localStorage.clear();
  sessionStorage.clear();

  await customAlert('☢️ Sistema restablecido de fábrica con éxito. Todos los datos han sido destruidos de forma segura.', '⚠️');
  location.reload();
}

async function verificarPINConfigurado() {
  pinAccesoHash = localStorage.getItem('pin_hash_' + idUsuario);
  var pantalla = document.getElementById('pantallaBloqueo');
  var appPrincipal = document.getElementById('appPrincipal');

  if (!pinAccesoHash) {
    if (pantalla) pantalla.style.display = 'none';
    if (appPrincipal) appPrincipal.style.display = 'block';
  } else {
    if (pantalla) pantalla.style.display = 'flex';
    if (appPrincipal) appPrincipal.style.display = 'none';
  }
}

async function configurarPIN() {
  var pin1 = await customPrompt('🔐 Configurar PIN', 'Ingresa un PIN de acceso (4-6 dígitos):', '••••', 'password');
  if (!pin1 || pin1.length < 4 || pin1.length > 6 || !/^\d+$/.test(pin1)) {
    await customAlert('PIN inválido (debe contener entre 4 y 6 números).');
    return;
  }
  pinAccesoHash = await hashPIN(pin1);
  localStorage.setItem('pin_hash_' + idUsuario, pinAccesoHash);
  await customAlert('✅ PIN configurado exitosamente.', '✅');
  location.reload();
}

async function desbloquearApp() {
  var inputPIN = document.getElementById('pinAccesoInput');
  if (!inputPIN) return;
  var pinIngresado = inputPIN.value;

  var hashIngresado = await hashPIN(pinIngresado);
  if (hashIngresado === pinAccesoHash) {
    document.getElementById('pantallaBloqueo').style.display = 'none';
    document.getElementById('appPrincipal').style.display = 'block';
  } else {
    var errorPIN = document.getElementById('errorPIN');
    if (errorPIN) errorPIN.style.display = 'block';
  }
}

function validarPIN(pin) {
  if (!pin || pin.trim().length !== 8) return false;
  return /^[0-9A-F]{8}$/.test(pin.toUpperCase());
}

window.addEventListener('DOMContentLoaded', function() {
  verificarPINConfigurado();
});

// Exposición global
window.verificarPINConfigurado = verificarPINConfigurado;
window.configurarPIN = configurarPIN;
window.desbloquearApp = desbloquearApp;
window.resetEmergenciaCompleto = resetEmergenciaCompleto;
window.validarPIN = validarPIN;
