/**
 * js/security.js
 * Módulo de validación de integridad de entorno y control de seguridad en panel lateral.
 */

function verificarSeguridadEntorno() {
  var miPinActual = localStorage.getItem('kerix_mi_pin');
  if (!miPinActual) return;

  var priv = localStorage.getItem("clave_privada_" + miPinActual);
  var pub = localStorage.getItem("clave_pub_propia_" + miPinActual);

  var indicador = document.getElementById('estadoSeguridadPanel');
  if (indicador) {
    if (priv && pub) {
      indicador.innerText = "E2EE Activo (RSA-2048 / AES-GCM)";
      indicador.style.color = "#00a884";
    } else {
      indicador.innerText = "Llaves Criptográficas No Inicializadas";
      indicador.style.color = "#ef4444";
    }
  }
}

// Iniciar verificación una vez cargado el DOM
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(verificarSeguridadEntorno, 800);
});

window.verificarSeguridadEntorno = verificarSeguridadEntorno;
