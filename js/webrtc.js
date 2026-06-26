/**
 * js/webrtc.js
 * Sistema de señalización ultraestable de WebRTC para Voz y Video
 */

var peerConnection = null;
var streamLocal = null;
var streamRemoto = null;
var llamadaActiva = false;
var tipoLlamadaActual = 'voz';
var pinLlamadaActual = '';
var esIniciador = false;
var timerLlamada = null;
var segundosLlamada = 0;
var canalLlamada = null;
var sonidoEntranteInterval = null;
var sonidoLlamadaSaliente = null;

var idLlamadaActual = null;
var candidatosLocalesAcumulados = [];

var rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// ============================================
// AUXILIARES
// ============================================
function formatearTiempo(segundos) {
  var m = Math.floor(segundos / 60).toString().padStart(2, '0');
  var s = (segundos % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// ============================================
// GESTIÓN DE AUDIO / MULTIMEDIA EXTERNA
// ============================================
function detenerSonidos() {
  if (sonidoLlamadaSaliente) {
    sonidoLlamadaSaliente.pause();
    sonidoLlamadaSaliente = null;
  }
  if (sonidoEntranteInterval) {
    sonidoEntranteInterval.pause();
    sonidoEntranteInterval = null;
  }
}

// ============================================
// BOTONES INTERACTIVOS DE LLAMADA
// ============================================
function toggleSilenciar() {
  if (!streamLocal) return;
  var audioTrack = streamLocal.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    var btn = document.getElementById('btnSilenciar');
    if (btn) {
      btn.innerText = audioTrack.enabled ? '🎙️' : '🔇';
      btn.style.background = audioTrack.enabled ? '#2a3942' : '#ef4444';
    }
  }
}

function toggleCamara() {
  if (!streamLocal) return;
  var videoTrack = streamLocal.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    var btn = document.getElementById('btnCamara');
    if (btn) {
      btn.innerText = videoTrack.enabled ? '📷' : '🚫';
      btn.style.background = videoTrack.enabled ? '#2a3942' : '#ef4444';
    }
  }
}

// ============================================
// EXPOSICIÓN GLOBAL EXPLÍCITA
// ============================================
window.toggleSilenciar = toggleSilenciar;
window.toggleCamara = toggleCamara;

console.log('📡 Módulo WebRTC redactado y cargado correctamente.');
