/**
 * js/webrtc.js
 * Sistema completo de llamadas WebRTC: voz y video
 * 
 * Depende de:
 * - app.js (miPIN, clienteSupabase, contactoActual, obtenerNombreContacto, 
 *           customAlert, customConfirm, logError)
 * - notifications.js (opcional, para notificaciones de llamada entrante)
 */

// ============================================
// 📞 VARIABLES GLOBALES WEBRTC
// ============================================
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

var rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// ============================================
// ⏱️ TIMER DE LLAMADA
// ============================================
function formatearTiempo(segundos) {
  var m = Math.floor(segundos / 60).toString().padStart(2, '0');
  var s = (segundos % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

function iniciarTimerLlamada() {
  segundosLlamada = 0;
  document.getElementById('llamadaTimer').innerText = '00:00';
  timerLlamada = setInterval(function() {
    segundosLlamada++;
    document.getElementById('llamadaTimer').innerText = formatearTiempo(segundosLlamada);
  }, 1000);
}

function detenerTimerLlamada() {
  if (timerLlamada) { 
    clearInterval(timerLlamada); 
    timerLlamada = null; 
  }
}

// ============================================
// 🎤 MEDIA STREAM
// ============================================
async function obtenerStreamMedia(esVideo) {
  try {
    var constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: esVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    logError('Error obteniendo media:', error);
    await customAlert('❌ No se pudo acceder al ' + (esVideo ? 'micrófono y cámara' : 'micrófono') + '.\nVerifica los permisos del navegador.', '❌');
    return null;
  }
}

// ============================================
// 📞 INICIAR LLAMADA
// ============================================
async function iniciarLlamada(tipo) {
  if (!contactoActual) { 
    await customAlert('❌ Debes estar en un chat para llamar.', '❌'); 
    return; 
  }
  if (llamadaActiva) { 
    await customAlert('⚠️ Ya tienes una llamada activa.', '⚠️'); 
    return; 
  }
  
  tipoLlamadaActual = tipo;
  pinLlamadaActual = contactoActual;
  esIniciador = true;
  
  var tipoTexto = tipo === 'video' ? 'videollamada' : 'llamada de voz';
  var confirmado = await customConfirm(
    '📞 ¿Iniciar ' + tipoTexto + ' con ' + obtenerNombreContacto(contactoActual) + '?', 
    tipo === 'video' ? '📹' : ''
  );
  if (!confirmado) return;
  
  streamLocal = await obtenerStreamMedia(tipo === 'video');
  if (!streamLocal) return;
  
  mostrarPantallaLlamada(pinLlamadaActual, '📞 Llamando...', tipo);
  reproducirSonidoLlamadaSaliente();
  
  peerConnection = new RTCPeerConnection(rtcConfig);
  
  streamLocal.getTracks().forEach(function(track) {
    peerConnection.addTrack(track, streamLocal);
  });
  
  peerConnection.onicecandidate = function(event) {
    if (event.candidate) enviarICECandidate(event.candidate);
  };
  
  peerConnection.ontrack = function(event) {
    if (!streamRemoto) streamRemoto = new MediaStream();
    streamRemoto.addTrack(event.track);
    
    if (tipo === 'video') {
      document.getElementById('videoRemoto').srcObject = streamRemoto;
      document.getElementById('videoContainer').style.display = 'block';
      document.getElementById('audioContainer').style.display = 'none';
      document.getElementById('btnCamara').style.display = 'flex';
    } else {
      document.getElementById('audioRemoto').srcObject = streamRemoto;
    }
    
    actualizarEstadoLlamada('✅ Conectado');
    detenerSonidoLlamadaSaliente();
    iniciarTimerLlamada();
  };
  
  peerConnection.onconnectionstatechange = function() {
    if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      actualizarEstadoLlamada('❌ Desconectado');
      setTimeout(colgarLlamada, 2000);
    }
  };
  
  try {
    var offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: tipo === 'video'
    });
    await peerConnection.setLocalDescription(offer);
    await enviarOfertaLlamada(offer);
    suscribirseALlamadas();
  } catch (error) {
    logError('Error creando oferta:', error);
    await customAlert('❌ Error al iniciar la llamada.', '❌');
    colgarLlamada();
  }
}

async function enviarOfertaLlamada(offer) {
  try {
    await clienteSupabase.from('llamadas').insert({
      pin_remitente: miPIN,
      pin_destinatario: pinLlamadaActual,
      tipo: tipoLlamadaActual,
      estado: 'llamando',
      oferta: JSON.stringify(offer)
    });
  } catch (error) {
    logError('Error enviando oferta:', error);
  }
}

async function enviarICECandidate(candidate) {
  try {
    await clienteSupabase.from('llamadas').update({
      candidatos_ice: JSON.stringify(candidate)
    }).eq('pin_remitente', pinLlamadaActual)
      .eq('pin_destinatario', miPIN)
      .eq('estado', 'conectando');
  } catch (error) { 
    logError('Error enviando ICE:', error); 
  }
}

// ============================================
// 📞 RECIBIR LLAMADA
// ============================================
async function recibirLlamada(pinRemitente, oferta, tipo) {
  if (llamadaActiva) {
    try {
      await clienteSupabase.from('llamadas').update({ 
        estado: 'rechazada', 
        fin: new Date().toISOString() 
      }).eq('pin_remitente', pinRemitente)
        .eq('pin_destinatario', miPIN)
        .eq('estado', 'llamando');
    } catch (e) {}
    return;
  }
  
  tipoLlamadaActual = tipo || 'voz';
  pinLlamadaActual = pinRemitente;
  esIniciador = false;
  
  var tipoTexto = tipoLlamadaActual === 'video' ? '📹 Videollamada entrante' : '📞 Llamada de voz entrante';
  document.getElementById('llamadaEntranteNombre').innerText = obtenerNombreContacto(pinRemitente);
  document.getElementById('llamadaEntranteTipo').innerText = tipoTexto;
  document.getElementById('llamadaEntranteAvatar').innerText = obtenerNombreContacto(pinRemitente).substring(0, 2).toUpperCase();
  document.getElementById('modalLlamadaEntrante').classList.add('active');
  
  reproducirSonidoLlamadaEntrante();
  
  if (Notification.permission === 'granted') {
    var notif = new Notification(tipoTexto, {
      body: obtenerNombreContacto(pinRemitente) + ' te está llamando',
      tag: 'llamada-' + pinRemitente,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500]
    });
    notif.onclick = function() { 
      window.focus(); 
      aceptarLlamada(); 
      notif.close(); 
    };
  }
}

// ============================================
// 🔔 SONIDOS DE LLAMADA
// ============================================
function reproducirSonidoLlamadaEntrante() {
  detenerSonidoLlamadaEntrante();
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function tocarTono() {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain); 
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.start(audioCtx.currentTime); 
      osc.stop(audioCtx.currentTime + 0.8);
    }
    tocarTono();
    sonidoEntranteInterval = setInterval(tocarTono, 1500);
  } catch (error) { 
    logError('Error sonido entrante:', error); 
  }
}

function detenerSonidoLlamadaEntrante() {
  if (sonidoEntranteInterval) { 
    clearInterval(sonidoEntranteInterval); 
    sonidoEntranteInterval = null; 
  }
}

function reproducirSonidoLlamadaSaliente() {
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 2.5);
    osc.start(audioCtx.currentTime); 
    osc.stop(audioCtx.currentTime + 3);
    sonidoLlamadaSaliente = osc;
  } catch (e) {}
}

function detenerSonidoLlamadaSaliente() {
  try { 
    if (sonidoLlamadaSaliente) { 
      sonidoLlamadaSaliente.stop(); 
      sonidoLlamadaSaliente = null; 
    } 
  } catch (e) {}
}

// ============================================
// ✅ ACEPTAR LLAMADA
// ============================================
async function aceptarLlamada() {
  document.getElementById('modalLlamadaEntrante').classList.remove('active');
  detenerSonidoLlamadaEntrante();
  
  streamLocal = await obtenerStreamMedia(tipoLlamadaActual === 'video');
  if (!streamLocal) { 
    rechazarLlamada(); 
    return; 
  }
  
  mostrarPantallaLlamada(pinLlamadaActual, ' Conectando...', tipoLlamadaActual);
  
  peerConnection = new RTCPeerConnection(rtcConfig);
  streamLocal.getTracks().forEach(function(track) { 
    peerConnection.addTrack(track, streamLocal); 
  });
  
  peerConnection.onicecandidate = function(event) {
    if (event.candidate) enviarICECandidate(event.candidate);
  };
  
  peerConnection.ontrack = function(event) {
    if (!streamRemoto) streamRemoto = new MediaStream();
    streamRemoto.addTrack(event.track);
    
    if (tipoLlamadaActual === 'video') {
      document.getElementById('videoRemoto').srcObject = streamRemoto;
      document.getElementById('videoContainer').style.display = 'block';
      document.getElementById('audioContainer').style.display = 'none';
      document.getElementById('btnCamara').style.display = 'flex';
    } else {
      document.getElementById('audioRemoto').srcObject = streamRemoto;
    }
    
    actualizarEstadoLlamada('✅ Conectado');
    iniciarTimerLlamada();
  };
  
  peerConnection.onconnectionstatechange = function() {
    if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      actualizarEstadoLlamada('❌ Desconectado');
      setTimeout(colgarLlamada, 2000);
    }
  };
  
  try {
    var { data } = await clienteSupabase.from('llamadas').select('oferta')
      .eq('pin_remitente', pinLlamadaActual)
      .eq('pin_destinatario', miPIN)
      .eq('estado', 'llamando')
      .order('inicio', { ascending: false })
      .limit(1)
      .single();
    
    if (!data || !data.oferta) { 
      await customAlert('❌ No se encontró la oferta.', '❌'); 
      colgarLlamada(); 
      return; 
    }
    
    var offer = JSON.parse(data.oferta);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    var answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    await clienteSupabase.from('llamadas').update({ 
      respuesta: JSON.stringify(answer), 
      estado: 'conectando' 
    }).eq('pin_remitente', pinLlamadaActual)
      .eq('pin_destinatario', miPIN)
      .eq('estado', 'llamando');
    
    suscribirseALlamadas();
  } catch (error) {
    logError('Error aceptando llamada:', error);
    colgarLlamada();
  }
}

// ============================================
// ❌ RECHAZAR Y COLGAR
// ============================================
async function rechazarLlamada() {
  document.getElementById('modalLlamadaEntrante').classList.remove('active');
  detenerSonidoLlamadaEntrante();
  
  try {
    await clienteSupabase.from('llamadas').update({ 
      estado: 'rechazada', 
      fin: new Date().toISOString() 
    }).eq('pin_remitente', pinLlamadaActual)
      .eq('pin_destinatario', miPIN)
      .eq('estado', 'llamando');
  } catch (e) {}
  
  pinLlamadaActual = '';
}

async function colgarLlamada() {
  detenerTimerLlamada();
  detenerSonidoLlamadaSaliente();
  detenerSonidoLlamadaEntrante();
  
  if (streamLocal) { 
    streamLocal.getTracks().forEach(function(t) { t.stop(); }); 
    streamLocal = null; 
  }
  if (streamRemoto) { 
    streamRemoto.getTracks().forEach(function(t) { t.stop(); }); 
    streamRemoto = null; 
  }
  if (peerConnection) { 
    peerConnection.close(); 
    peerConnection = null; 
  }
  
  document.getElementById('videoRemoto').srcObject = null;
  document.getElementById('audioRemoto').srcObject = null;
  document.getElementById('pantallaLlamada').style.display = 'none';
  document.getElementById('modalLlamadaEntrante').classList.remove('active');
  
  if (pinLlamadaActual) {
    try {
      await clienteSupabase.from('llamadas').update({ 
        estado: 'finalizada', 
        fin: new Date().toISOString(), 
        duracion: segundosLlamada 
      }).eq('pin_remitente', esIniciador ? miPIN : pinLlamadaActual)
        .eq('pin_destinatario', esIniciador ? pinLlamadaActual : miPIN)
        .in('estado', ['llamando', 'conectando', 'activa']);
    } catch (e) {}
  }
  
  llamadaActiva = false;
  pinLlamadaActual = '';
  segundosLlamada = 0;
}

// ============================================
// 🖥️ UI DE LLAMADA
// ============================================
function mostrarPantallaLlamada(pin, estado, tipo) {
  llamadaActiva = true;
  var nombre = obtenerNombreContacto(pin);
  
  document.getElementById('llamadaNombre').innerText = nombre;
  document.getElementById('llamadaNombreGrande').innerText = nombre;
  document.getElementById('llamadaEstado').innerText = estado;
  document.getElementById('llamadaEstadoGrande').innerText = estado;
  document.getElementById('llamadaAvatar').innerText = nombre.substring(0, 2).toUpperCase();
  
  if (tipo === 'video') {
    document.getElementById('videoContainer').style.display = 'block';
    document.getElementById('audioContainer').style.display = 'none';
    document.getElementById('btnCamara').style.display = 'flex';
    if (streamLocal) document.getElementById('videoLocal').srcObject = streamLocal;
  } else {
    document.getElementById('videoContainer').style.display = 'none';
    document.getElementById('audioContainer').style.display = 'flex';
    document.getElementById('btnCamara').style.display = 'none';
  }
  
  document.getElementById('pantallaLlamada').style.display = 'flex';
}

function actualizarEstadoLlamada(estado) {
  document.getElementById('llamadaEstado').innerText = estado;
  document.getElementById('llamadaEstadoGrande').innerText = estado;
}

// ============================================
// 📡 SUSCRIPCIÓN WEBRTC
// ============================================
function suscribirseALlamadas() {
  if (canalLlamada) { 
    clienteSupabase.removeChannel(canalLlamada); 
    canalLlamada = null; 
  }
  
  canalLlamada = clienteSupabase.channel('llamadas_cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, async function(payload) {
      var nuevo = payload.new;
      if (!nuevo) return;
      
      // Filtrado dinámico en frontend de los roles de emisor/receptor
      if (nuevo.pin_remitente !== miPIN && nuevo.pin_destinatario !== miPIN) return;
      
      // Actualizaciones para el iniciador de la llamada
      if (nuevo.pin_remitente === miPIN) {
        if (nuevo.respuesta && nuevo.estado === 'conectando' && esIniciador) {
          try {
            var answer = JSON.parse(nuevo.respuesta);
            if (peerConnection && peerConnection.signalingState !== 'stable') {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              actualizarEstadoLlamada('🔄 Conectando...');
            }
          } catch (error) { 
            logError('Error procesando respuesta:', error); 
          }
        }
        if (nuevo.estado === 'rechazada') {
          await customAlert('📞 La llamada fue rechazada.', '📞');
          colgarLlamada();
        }
      }
      
      // Actualizaciones para el receptor
      if (nuevo.pin_destinatario === miPIN) {
        if (nuevo.estado === 'llamando' && nuevo.oferta && !llamadaActiva) {
          await recibirLlamada(nuevo.pin_remitente, nuevo.oferta, nuevo.tipo);
        }
      }
      
      // Sincronización mutua para colgar llamadas activas
      if (nuevo.estado === 'finalizada' && llamadaActiva) {
        await customAlert('📞 La llamada ha finalizado.', '📞');
        colgarLlamada();
      }
    })
    .subscribe();
}

// ============================================
// ️ CONTROLES DE LLAMADA
// ============================================
function toggleSilenciar() {
  if (!streamLocal) return;
  var audioTrack = streamLocal.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    var btn = document.getElementById('btnSilenciar');
    btn.innerText = audioTrack.enabled ? '🎤' : '🔇';
    btn.style.background = audioTrack.enabled ? '#2a3942' : '#ef4444';
  }
}

function toggleCamara() {
  if (!streamLocal) return;
  var videoTrack = streamLocal.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    var btn = document.getElementById('btnCamara');
    btn.innerText = videoTrack.enabled ? '📷' : '🚫';
    btn.style.background = videoTrack.enabled ? '#2a3942' : '#ef4444';
  }
}

function toggleAltavoz() {
  var audioRemoto = document.getElementById('audioRemoto');
  var btn = document.getElementById('btnAltavoz');
  if (audioRemoto) {
    if (audioRemoto.volume === 1) {
      audioRemoto.volume = 0.5;
      btn.innerText = '🔉';
    } else {
      audioRemoto.volume = 1;
      btn.innerText = '🔊';
    }
  }
}

async function limpiarLlamadasAntiguas() {
  try {
    var hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await clienteSupabase.from('llamadas').delete()
      .or('pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + miPIN)
      .lt('inicio', hace24h);
  } catch (error) { 
    logError('Error limpiando llamadas:', error); 
  }
}

// ============================================
//  EVENTOS DE VISIBILIDAD
// ============================================
document.addEventListener('visibilitychange', function() {
  if (!llamadaActiva) return;
  if (document.hidden) actualizarEstadoLlamada('🌙 En segundo plano');
  else actualizarEstadoLlamada('✅ Conectado');
});

window.addEventListener('beforeunload', function() {
  if (llamadaActiva) colgarLlamada();
});

console.log(' Módulo webrtc.js cargado correctamente');
