/**
 * js/webrtc.js
 * Control de streams multimedia P2P directos para llamadas y videollamadas E2EE nativas.
 */

var localStream = null;
var peerConnection = null;
var llamanteActualPin = null;
var llamadaConVideo = false;

var rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ============================================
// EMISIÓN: INICIAR LLAMADA OUTBOUND
// ============================================
async function iniciarLlamadaWebRTC(pinDestinatario, conVideo) {
  try {
    console.log('📞 Preparando llamada P2P hacia: ' + pinDestinatario);
    llamadaConVideo = conVideo;

    var panelLlamada = document.getElementById('pantallaLlamada');
    if (panelLlamada) panelLlamada.style.display = 'flex';
    
    var txtNombre = document.getElementById('llamadaContactoNombre');
    if (txtNombre && typeof window.obtenerNombreContacto === 'function') {
      txtNombre.innerText = window.obtenerNombreContacto(pinDestinatario);
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: conVideo
    });

    var videoLocal = document.getElementById('videoLocal');
    if (videoLocal) {
      videoLocal.srcObject = localStream;
      videoLocal.style.display = conVideo ? 'block' : 'none';
    }

    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(function(track) {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = function(event) {
      var videoRemoto = document.getElementById('videoRemoto');
      if (videoRemoto && event.streams[0]) {
        videoRemoto.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = function(event) {
      if (event.candidate && canalRealtime) {
        canalRealtime.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { de: miPIN, para: pinDestinatario, candidate: event.candidate }
        });
      }
    };

    var offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    if (canalRealtime) {
      canalRealtime.send({
        type: 'broadcast',
        event: 'llamada-oferta',
        payload: { de: miPIN, para: pinDestinatario, sdp: offer, video: conVideo }
      });
    }

  } catch (e) {
    console.error('Error al iniciar WebRTC:', e);
    if (typeof window.customAlert === 'function') window.customAlert('Fallo al acceder al hardware multimedia.');
    colgarLlamada();
  }
}

// ============================================
// RECEPCIÓN: PROCESAR SEÑALIZACIÓN ENTRANTE
// ============================================
async function procesarOfertaLlamada(payload) {
  llamanteActualPin = payload.de;
  llamadaConVideo = payload.video;

  var modal = document.getElementById('modalLlamadaEntrante');
  var txtNombre = document.getElementById('llamadaEntranteNombre');
  var txtTipo = document.getElementById('llamadaEntranteTipo');

  if (modal) {
    if (txtNombre && typeof window.obtenerNombreContacto === 'function') {
      txtNombre.innerText = window.obtenerNombreContacto(payload.de);
    }
    if (txtTipo) {
      txtTipo.innerText = payload.video ? 'Videollamada entrante...' : 'Llamada de voz entrante...';
    }
    modal.classList.add('active');
  }

  peerConnection = new RTCPeerConnection(rtcConfig);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
}

async function aceptarLlamadaEntrante() {
  var modal = document.getElementById('modalLlamadaEntrante');
  if (modal) modal.classList.remove('active');

  try {
    var panelLlamada = document.getElementById('pantallaLlamada');
    if (panelLlamada) panelLlamada.style.display = 'flex';
    var txtNombre = document.getElementById('llamadaContactoNombre');
    if (txtNombre && typeof window.obtenerNombreContacto === 'function') {
      txtNombre.innerText = window.obtenerNombreContacto(llamanteActualPin);
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: llamadaConVideo
    });

    var videoLocal = document.getElementById('videoLocal');
    if (videoLocal) {
      videoLocal.srcObject = localStream;
      videoLocal.style.display = llamadaConVideo ? 'block' : 'none';
    }

    localStream.getTracks().forEach(function(track) {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = function(event) {
      var videoRemoto = document.getElementById('videoRemoto');
      if (videoRemoto && event.streams[0]) {
        videoRemoto.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = function(event) {
      if (event.candidate && canalRealtime) {
        canalRealtime.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { de: miPIN, para: llamanteActualPin, candidate: event.candidate }
        });
      }
    };

    var answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (canalRealtime) {
      canalRealtime.send({
        type: 'broadcast',
        event: 'llamada-respuesta',
        payload: { de: miPIN, para: llamanteActualPin, sdp: answer }
      });
    }

  } catch (e) {
    console.error('Error al aceptar llamada:', e);
    colgarLlamada();
  }
}

function rechazarLlamadaEntrante() {
  var modal = document.getElementById('modalLlamadaEntrante');
  if (modal) modal.classList.remove('active');
  colgarLlamada();
}

async function procesarRespuestaLlamada(payload) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  }
}

async function procesarIceCandidate(payload) {
  if (peerConnection && payload.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (e) { console.warn(e); }
  }
}

function colgarLlamada() {
  if (localStream) {
    localStream.getTracks().forEach(function(track) { track.stop(); });
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  var panelLlamada = document.getElementById('pantallaLlamada');
  if (panelLlamada) panelLlamada.style.display = 'none';
  
  var modal = document.getElementById('modalLlamadaEntrante');
  if (modal) modal.classList.remove('active');
}

window.addEventListener('DOMContentLoaded', function() {
  var btnAceptar = document.getElementById('btnAceptarLlamada');
  if (btnAceptar) btnAceptar.addEventListener('click', aceptarLlamadaEntrante);

  var btnRechazar = document.getElementById('btnRechazarLlamada');
  if (btnRechazar) btnRechazar.addEventListener('click', rechazarLlamadaEntrante);

  var btnColgar = document.getElementById('btnColgar');
  if (btnColgar) btnColgar.addEventListener('click', colgarLlamada);
});

window.iniciarLlamadaWebRTC = iniciarLlamadaWebRTC;
window.procesarOfertaLlamada = procesarOfertaLlamada;
window.procesarRespuestaLlamada = procesarRespuestaLlamada;
window.procesarIceCandidate = procesarIceCandidate;
window.colgarLlamada = colgarLlamada;
