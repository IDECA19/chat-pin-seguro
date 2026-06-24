/**
 * js/webrtc.js
 * Módulo especializado en la gestión del PeerConnection, control de audio/video
 * e intercambio de señalización WebRTC seguro libre de fugas de IP (Auditoría Técnica - Protección ICE).
 */

const WebRTCService = {
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  signalingChannel: null,
  callState: {
    active: false,
    roomId: null,
    callerId: null,
    receiverId: null,
    callType: null, // 'audio' o 'video'
    role: null // 'caller' o 'receiver'
  },
  
  // Configuración segura del PeerConnection
  getIceConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
  },

  // --- MITIGACIÓN DE FUGA DE IP ---
  // Filtra candidatos locales (de tipo host) para proteger la confidencialidad de la IP de red del cliente.
  sanitizeIceCandidate(candidateObj) {
    if (!candidateObj || !candidateObj.candidate) return null;
    const desc = candidateObj.candidate;

    // Si el candidato contiene la cadena 'typ host' (IP LAN/local), se omite para evitar fugas de confidencialidad
    if (desc.includes('typ host')) {
      console.warn('WebRTC Security: Candidato local "host" omitido para prevenir fugas de IP.');
      return null;
    }
    return candidateObj;
  },

  // --- INICIAR LLAMADA (CALLER) ---
  async startCall(myId, peerId, type, myProfile, onTrackCallback, onHangupCallback) {
    this.callState = {
      active: true,
      roomId: `${myId}-${peerId}-${Date.now()}`,
      callerId: myId,
      receiverId: peerId,
      callType: type,
      role: 'caller'
    };

    // 1. Obtener streams de audio/video
    try {
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error('Error al acceder a dispositivos multimedia:', err);
      this.cleanupCall();
      throw new Error('No se pudo acceder a la cámara o micrófono.');
    }

    // 2. Crear RTCPeerConnection
    this.peerConnection = new RTCPeerConnection(this.getIceConfig());

    // Agregar tracks locales
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    // Escuchar tracks remotos
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      onTrackCallback(this.remoteStream, this.localStream);
    };

    // Escuchar candidatos ICE y enviarlos
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const cleanCandidate = this.sanitizeIceCandidate(event.candidate);
        if (cleanCandidate) {
          SupabaseService.sendSignalingMessage(peerId, {
            type: 'candidate',
            candidate: cleanCandidate,
            senderId: myId
          });
        }
      }
    };

    // Crear oferta SDP
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Enviar señalización de oferta
    await SupabaseService.sendSignalingMessage(peerId, {
      type: 'offer',
      offer: offer,
      roomId: this.callState.roomId,
      callerId: myId,
      callerName: myProfile.username,
      callerAvatar: myProfile.avatar_url,
      callType: type
    });
  },

  // --- RECIBIR LLAMADA Y RESPONDER (RECEIVER) ---
  async acceptCall(myId, offerPayload, onTrackCallback, onHangupCallback) {
    this.callState = {
      active: true,
      roomId: offerPayload.roomId,
      callerId: offerPayload.callerId,
      receiverId: myId,
      callType: offerPayload.callType,
      role: 'receiver'
    };

    try {
      const constraints = {
        audio: true,
        video: offerPayload.callType === 'video'
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error('No se pudo acceder a los dispositivos locales:', err);
      this.declineCall(offerPayload.callerId);
      throw new Error('Permisos de micrófono o cámara denegados.');
    }

    this.peerConnection = new RTCPeerConnection(this.getIceConfig());

    // Añadir tracks locales
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    // Escuchar tracks remotos
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      onTrackCallback(this.remoteStream, this.localStream);
    };

    // Enlace de candidatos ICE con sanitización integrada
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const cleanCandidate = this.sanitizeIceCandidate(event.candidate);
        if (cleanCandidate) {
          SupabaseService.sendSignalingMessage(this.callState.callerId, {
            type: 'candidate',
            candidate: cleanCandidate,
            senderId: myId
          });
        }
      }
    };

    // Establecer descripción remota (Oferta recibida)
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerPayload.offer));

    // Crear Respuesta SDP
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Enviar Respuesta SDP
    await SupabaseService.sendSignalingMessage(this.callState.callerId, {
      type: 'answer',
      answer: answer,
      receiverId: myId
    });
  },

  // --- RECHAZAR LLAMADA ---
  async declineCall(callerId) {
    await SupabaseService.sendSignalingMessage(callerId, {
      type: 'hangup',
      senderId: this.callState.receiverId || 'system'
    });
    this.cleanupCall();
  },

  // --- COLGAR LLAMADA ACTIVA ---
  async hangup() {
    const peerId = this.callState.role === 'caller' ? this.callState.receiverId : this.callState.callerId;
    if (peerId) {
      await SupabaseService.sendSignalingMessage(peerId, {
        type: 'hangup',
        senderId: this.callState.role === 'caller' ? this.callState.callerId : this.callState.receiverId
      });
    }
    this.cleanupCall();
  },

  // --- GESTIÓN DE SEÑALES RECIBIDAS ---
  async handleSignalingMessage(payload) {
    if (!this.callState.active && payload.type !== 'offer') return;

    switch (payload.type) {
      case 'answer':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
        break;

      case 'candidate':
        if (this.peerConnection && payload.candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.error('Error al agregar ICE candidate:', e);
          }
        }
        break;

      case 'hangup':
        this.cleanupCall();
        if (window.onWebRTCHangup) {
          window.onWebRTCHangup();
        }
        break;
    }
  },

  // --- LIMPIEZA DE LLAMADAS ---
  cleanupCall() {
    this.callState = { active: false, roomId: null, callerId: null, receiverId: null, callType: null, role: null };
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
  }
};