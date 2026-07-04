/**
 * js/webrtc.js
 * Señalización WebRTC usando Supabase como canal de señalización (oferta/respuesta/candidatos)
 * Implementa funciones: iniciarLlamada, aceptarLlamada, rechazarLlamada, colgarLlamada
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

// Helpers
function setLlamadaTimer() {
  clearInterval(timerLlamada);
  segundosLlamada = 0;
  var el = document.getElementById('llamadaTimer');
  timerLlamada = setInterval(function(){ segundosLlamada++; if (el) el.innerText = formatearTiempo(segundosLlamada); }, 1000);
}

function limpiarLlamadaState() {
  llamadaActiva = false;
  pinLlamadaActual = '';
  idLlamadaActual = null;
  esIniciador = false;
  candidatosLocalesAcumulados = [];
  if (peerConnection) { try { peerConnection.close(); } catch(e){} peerConnection = null; }
  if (streamLocal) { try { streamLocal.getTracks().forEach(t=>t.stop()); } catch(e){} streamLocal = null; }
  if (streamRemoto) { streamRemoto = null; }
  clearInterval(timerLlamada);
}

async function crearPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = function(event) {
    if (event.candidate) {
      // enviar candidato al backend (append to llamada.candidatos)
      if (idLlamadaActual && typeof SupabaseLlamadas !== 'undefined') {
        SupabaseLlamadas.actualizarLlamada(idLlamadaActual, { candidatos: JSON.stringify([event.candidate]) }).catch(e=>console.warn('No pudo enviar candidato', e));
      }
    }
  };

  peerConnection.ontrack = function(event) {
    streamRemoto = event.streams[0];
    var videoRemoto = document.getElementById('videoRemoto');
    if (videoRemoto) videoRemoto.srcObject = streamRemoto;
  };

  return peerConnection;
}

async function iniciarLlamada(tipo) {
  if (!contactoActual) { await customAlert('Selecciona un contacto para llamar.'); return; }
  tipoLlamadaActual = tipo || 'voz';
  esIniciador = true;

  try {
    await inicializarSupabase();
    streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: tipo === 'video' });
    var videoLocal = document.getElementById('videoLocal');
    if (videoLocal) videoLocal.srcObject = streamLocal;

    var pc = await crearPeerConnection();
    // añadir tracks
    streamLocal.getTracks().forEach(track => pc.addTrack(track, streamLocal));

    // crear oferta
    var oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);

    // crear registro de llamada en Supabase
    var llamada = await SupabaseLlamadas.crearLlamada(miPIN, contactoActual, tipoLlamadaActual, JSON.stringify(oferta));
    if (!llamada) throw new Error('No se pudo crear registro de llamada');
    idLlamadaActual = llamada.id;
    llamadaActiva = true;
    pinLlamadaActual = contactoActual;

    // listen for updates (respuesta, candidatos)
    // Nota: en producción usar realtime subscription; aquí se hace polling sencillo
    var poller = setInterval(async function(){
      try {
        var l = await SupabaseLlamadas.obtenerLlamada(idLlamadaActual);
        if (l && l.respuesta && !pc.remoteDescription) {
          var answer = JSON.parse(l.respuesta);
          await pc.setRemoteDescription(answer);
        }
        if (l && l.candidatos) {
          var candidatos = JSON.parse(l.candidatos || '[]');
          for (var i=0;i<candidatos.length;i++) {
            try { await pc.addIceCandidate(candidatos[i]); } catch(e){}
          }
        }
        if (l && l.estado === 'finalizada') {
          clearInterval(poller);
          limpiarLlamadaState();
        }
      } catch(e){ console.warn('Polling llamada error', e); }
    }, 1500);

    setLlamadaTimer();
  } catch (e) {
    console.error('Error iniciando llamada:', e);
    await customAlert('No se pudo iniciar la llamada: ' + (e.message || e));
    limpiarLlamadaState();
  }
}

async function aceptarLlamada(id) {
  try {
    await inicializarSupabase();
    var llamada = await SupabaseLlamadas.obtenerLlamada(id);
    if (!llamada) throw new Error('Llamada no encontrada');

    pinLlamadaActual = llamada.pin_remitente;
    tipoLlamadaActual = llamada.tipo;
    esIniciador = false;

    streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: tipoLlamadaActual === 'video' });
    var videoLocal = document.getElementById('videoLocal');
    if (videoLocal) videoLocal.srcObject = streamLocal;

    var pc = await crearPeerConnection();
    streamLocal.getTracks().forEach(track => pc.addTrack(track, streamLocal));

    // set remote offer
    var oferta = JSON.parse(llamada.oferta);
    await pc.setRemoteDescription(oferta);
    var respuesta = await pc.createAnswer();
    await pc.setLocalDescription(respuesta);

    // actualizar registro con la respuesta
    await SupabaseLlamadas.actualizarLlamada(id, { respuesta: JSON.stringify(respuesta), estado: 'activa' });
    idLlamadaActual = id;
    llamadaActiva = true;
    setLlamadaTimer();
  } catch (e) {
    console.error('Error aceptando llamada:', e);
    await customAlert('No se pudo aceptar la llamada: ' + (e.message || e));
    limpiarLlamadaState();
  }
}

async function rechazarLlamada(id) {
  try {
    await SupabaseLlamadas.actualizarLlamada(id, { estado: 'rechazada' });
    await customAlert('Llamada rechazada.');
  } catch (e) { console.error('Error rechazando llamada:', e); }
}

async function colgarLlamada() {
  if (idLlamadaActual) {
    try {
      await SupabaseLlamadas.actualizarLlamada(idLlamadaActual, { estado: 'finalizada' });
    } catch (e) { console.warn('Error marcando llamada finalizada:', e); }
  }
  limpiarLlamadaState();
}

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
window.iniciarLlamada = iniciarLlamada;
window.aceptarLlamada = aceptarLlamada;
window.rechazarLlamada = rechazarLlamada;
window.colgarLlamada = colgarLlamada;
window.toggleSilenciar = toggleSilenciar;
window.toggleCamara = toggleCamara;

console.log('📡 Módulo WebRTC (señalización) cargado correctamente.');
