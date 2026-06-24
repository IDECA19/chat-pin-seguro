/**
 * js/app.js
 * Orquestador de la UI del DOM, manejo de eventos de clic/teclado integrados de forma segura,
 * grabaciones de notas de voz, validación PWA y renderizado libre de vulnerabilidades XSS.
 */

// --- ESTADOS Y VARIABLES GLOBALES DE LA APP ---
let myProfile = null;
let activeContactId = null;
let activeChannel = null;
let chatMessagesList = [];
let allProfiles = [];
let mediaRecorder = null;
let audioChunks = [];
let callTimerInterval = null;
let incomingOfferData = null;

// Ringtones de la UI
const ringtone = document.getElementById('ringtoneAudio');
const dialback = document.getElementById('dialbackAudio');

// --- INTEGRACIÓN RESILIENTE DE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.warn('Fallo al registrar Service Worker:', err));
  });
}

// --- DETECCIÓN DE CONEXIÓN DE RED (Robustez PWA) ---
function updateNetworkStatus() {
  const toast = document.getElementById('connection-toast');
  toast.className = 'toast'; // reset clases
  
  if (navigator.onLine) {
    toast.textContent = 'Conexión recuperada. Sincronizando datos...';
    toast.classList.add('online');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  } else {
    toast.textContent = 'Sin conexión a internet. Modo fuera de línea activo.';
    toast.classList.add('offline');
    toast.classList.remove('hidden');
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// --- UTILIDADES DE SEGURIDAD (Evitar Inyecciones XSS) ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// --- CONEXIÓN DE EVENTOS DINÁMICOS DEL DOM (Mitigación CSP) ---
document.addEventListener('DOMContentLoaded', () => {
  // Estado inicial de red
  updateNetworkStatus();

  // Suscribirse a cambios de autenticación
  SupabaseService.onAuthStateChange((event, session) => {
    if (session) {
      initializeUserSession(session.user);
    } else {
      showAuthScreen();
    }
  });

  // Eventos de Autenticación
  document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
  document.getElementById('btnToggleAuth').addEventListener('click', toggleAuthMode);
  document.getElementById('avatarInput').addEventListener('change', handleRegisterAvatarChange);

  // Botones de Barra Lateral
  document.getElementById('btnNewChat').addEventListener('click', () => showPanel('contactsPanel'));
  document.getElementById('btnShowProfile').addEventListener('click', openProfilePanel);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
  document.getElementById('searchChatsInput').addEventListener('input', handleFilterChats);

  // Cerrar Paneles
  document.getElementById('btnCloseProfile').addEventListener('click', () => hidePanel('profilePanel'));
  document.getElementById('btnCloseContacts').addEventListener('click', () => hidePanel('contactsPanel'));

  // Guardar Perfil
  document.getElementById('btnSaveProfile').addEventListener('click', handleSaveProfile);
  document.getElementById('profileAvatarFileInput').addEventListener('change', handleProfileAvatarChange);

  // Buscar Contactos en Panel
  document.getElementById('searchContactsInput').addEventListener('input', handleFilterContacts);

  // Chat Activo - Controles de Entrada
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  document.getElementById('messageInput').addEventListener('input', handleMessageInputToggle);
  document.getElementById('btnSendMessage').addEventListener('click', handleSendMessage);
  document.getElementById('btnAttach').addEventListener('click', () => document.getElementById('attachmentInput').click());
  document.getElementById('attachmentInput').addEventListener('change', handleAttachmentSend);

  // Grabador de voz
  document.getElementById('btnVoiceRecord').addEventListener('mousedown', startVoiceRecording);
  document.getElementById('btnVoiceRecord').addEventListener('mouseup', stopVoiceRecording);
  document.getElementById('btnVoiceRecord').addEventListener('touchstart', (e) => {
    e.preventDefault();
    startVoiceRecording();
  });
  document.getElementById('btnVoiceRecord').addEventListener('touchend', (e) => {
    e.preventDefault();
    stopVoiceRecording();
  });

  // Botones de Llamada (Voz / Video)
  document.getElementById('btnAudioCall').addEventListener('click', () => makeCall('audio'));
  document.getElementById('btnVideoCall').addEventListener('click', () => makeCall('video'));

  // Botones de gestión de llamadas activa/entrante
  document.getElementById('btnHangup').addEventListener('click', handleHangupClick);
  document.getElementById('btnDeclineCall').addEventListener('click', handleDeclineIncomingCall);
  document.getElementById('btnAcceptCall').addEventListener('click', handleAcceptIncomingCall);

  // Controles de llamada activa
  document.getElementById('btnToggleMute').addEventListener('click', handleToggleMute);
  document.getElementById('btnToggleVideo').addEventListener('click', handleToggleVideoTrack);
});

// --- AUTENTICACIÓN Y ENRUTAMIENTO DE PANTALLAS ---
function showAuthScreen() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function showAppScreen() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function toggleAuthMode(e) {
  e.preventDefault();
  const usernameGroup = document.getElementById('usernameGroup');
  const avatarGroup = document.getElementById('avatarSelectorContainer');
  const submitBtn = document.getElementById('btnSubmitAuth');
  const toggleBtn = document.getElementById('btnToggleAuth');
  const toggleText = document.getElementById('toggleText');

  if (usernameGroup.classList.contains('hidden')) {
    usernameGroup.classList.remove('hidden');
    avatarGroup.classList.remove('hidden');
    submitBtn.textContent = 'Registrarse';
    toggleText.textContent = '¿Ya tienes cuenta?';
    toggleBtn.textContent = 'Inicia Sesión';
  } else {
    usernameGroup.classList.add('hidden');
    avatarGroup.classList.add('hidden');
    submitBtn.textContent = 'Iniciar Sesión';
    toggleText.textContent = '¿No tienes cuenta?';
    toggleBtn.textContent = 'Regístrate';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const usernameGroup = document.getElementById('usernameGroup');
  const isRegister = !usernameGroup.classList.contains('hidden');

  try {
    if (isRegister) {
      const username = document.getElementById('usernameInput').value.trim() || email.split('@')[0];
      const avatarFile = document.getElementById('avatarInput').files[0];
      
      const user = await SupabaseService.register(email, password);
      if (user) {
        let avatarUrl = '';
        if (avatarFile) {
          avatarUrl = await SupabaseService.uploadFile('avatars', `user_${user.id}_${Date.now()}`, avatarFile);
        }
        await SupabaseService.saveProfile(user.id, username, avatarUrl, 'Disponible');
        showToast('Cuenta registrada con éxito. Iniciando...');
      }
    } else {
      await SupabaseService.login(email, password);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

function handleRegisterAvatarChange(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const preview = document.getElementById('avatarPreview');
      preview.textContent = '';
      const img = document.createElement('img');
      img.src = evt.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
}

async function handleLogout() {
  try {
    await SupabaseService.logout();
    window.location.reload();
  } catch (err) {
    showToast('Error al cerrar sesión', true);
  }
}

// --- SESIÓN DE USUARIO E INICIALIZACIÓN DE CANALES ---
async function initializeUserSession(user) {
  try {
    myProfile = await SupabaseService.fetchProfile(user.id);
    if (!myProfile) {
      // Perfil de respaldo si no existe en BD de perfiles
      const username = user.email.split('@')[0];
      await SupabaseService.saveProfile(user.id, username, '', 'Disponible');
      myProfile = await SupabaseService.fetchProfile(user.id);
    }
    
    // Configurar perfil en UI (Modificación segura del DOM)
    updateHeaderProfileUI();
    showAppScreen();

    // Cargar listas iniciales
    await loadContacts();
    await loadChats();

    // Inicializar canales en Tiempo Real
    SupabaseService.subscribeToMessages(onNewMessageReceived);
    
    // Canal de llamadas WebRTC
    activeChannel = SupabaseService.createSignalingChannel(user.id, handleIncomingSignals);
    window.onWebRTCHangup = resetCallUI;

  } catch (err) {
    console.error('Error al iniciar sesión de usuario:', err);
    showToast('Fallo al obtener datos de usuario.', true);
  }
}

function updateHeaderProfileUI() {
  const myAvatar = document.getElementById('myAvatar');
  myAvatar.textContent = '';
  if (myProfile.avatar_url) {
    const img = document.createElement('img');
    img.src = myProfile.avatar_url;
    myAvatar.appendChild(img);
  } else {
    myAvatar.textContent = (myProfile.username || '?').substring(0, 2).toUpperCase();
  }
  document.getElementById('myUsername').textContent = escapeHTML(myProfile.username);
  document.getElementById('myStatus').textContent = escapeHTML(myProfile.status || 'En línea');
}

// --- PANELES LATERALES ---
function showPanel(panelId) {
  document.getElementById(panelId).classList.remove('hidden');
}

function hidePanel(panelId) {
  document.getElementById(panelId).classList.add('hidden');
}

async function openProfilePanel() {
  document.getElementById('profileUsernameInput').value = myProfile.username;
  document.getElementById('profileStatusInput').value = myProfile.status || '';
  
  const preview = document.getElementById('profileAvatarPreview');
  preview.textContent = '';
  if (myProfile.avatar_url) {
    const img = document.createElement('img');
    img.src = myProfile.avatar_url;
    preview.appendChild(img);
  } else {
    preview.textContent = (myProfile.username || '?').substring(0, 2).toUpperCase();
  }
  showPanel('profilePanel');
}

async function handleSaveProfile() {
  const newName = document.getElementById('profileUsernameInput').value.trim();
  const newStatus = document.getElementById('profileStatusInput').value.trim();
  const avatarFile = document.getElementById('profileAvatarFileInput').files[0];

  if (!newName) return showToast('El nombre no puede estar vacío.', true);

  try {
    let avatarUrl = myProfile.avatar_url;
    if (avatarFile) {
      avatarUrl = await SupabaseService.uploadFile('avatars', `user_${myProfile.id}_${Date.now()}`, avatarFile);
    }

    await SupabaseService.saveProfile(myProfile.id, newName, avatarUrl, newStatus);
    myProfile = { ...myProfile, username: newName, avatar_url: avatarUrl, status: newStatus };
    updateHeaderProfileUI();
    hidePanel('profilePanel');
    showToast('Perfil actualizado correctamente.');
    await loadContacts();
  } catch (err) {
    showToast('Error al actualizar perfil.', true);
  }
}

function handleProfileAvatarChange(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const preview = document.getElementById('profileAvatarPreview');
      preview.textContent = '';
      const img = document.createElement('img');
      img.src = evt.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
}

// --- FILTRADOS Y BÚSQUEDAS ---
function handleFilterChats(e) {
  const q = e.target.value.toLowerCase();
  const items = document.querySelectorAll('#chatList .chat-item');
  items.forEach(item => {
    const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
    if (name.includes(q)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

function handleFilterContacts(e) {
  const q = e.target.value.toLowerCase();
  const items = document.querySelectorAll('#contactsList .contact-item');
  items.forEach(item => {
    const name = item.querySelector('.contact-name-meta span').textContent.toLowerCase();
    if (name.includes(q)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

// --- LOGICA DE CONTACTOS Y CHATS ---
async function loadContacts() {
  try {
    allProfiles = await SupabaseService.fetchAllProfiles();
    const container = document.getElementById('contactsList');
    container.textContent = ''; // Limpieza segura

    allProfiles.forEach(profile => {
      if (profile.id === myProfile.id) return;

      const item = document.createElement('div');
      item.className = 'contact-item';
      
      const avatarNode = document.createElement('div');
      avatarNode.className = 'avatar';
      if (profile.avatar_url) {
        const img = document.createElement('img');
        img.src = profile.avatar_url;
        avatarNode.appendChild(img);
      } else {
        avatarNode.textContent = (profile.username || '?').substring(0, 2).toUpperCase();
      }

      const meta = document.createElement('div');
      meta.className = 'contact-name-meta';
      
      const name = document.createElement('span');
      name.textContent = profile.username;
      name.style.fontWeight = '600';
      
      const status = document.createElement('small');
      status.textContent = profile.status || 'Disponible';
      status.style.color = 'var(--text-secondary)';

      meta.appendChild(name);
      meta.appendChild(status);

      item.appendChild(avatarNode);
      item.appendChild(meta);

      item.addEventListener('click', () => {
        hidePanel('contactsPanel');
        startOrOpenChat(profile);
      });

      container.appendChild(item);
    });
  } catch (err) {
    console.error('Error al cargar contactos:', err);
  }
}

async function loadChats() {
  try {
    // Almacena chats en función de los perfiles conocidos
    const container = document.getElementById('chatList');
    container.textContent = ''; // Limpieza segura

    allProfiles.forEach(profile => {
      if (profile.id === myProfile.id) return;

      const item = document.createElement('div');
      item.className = 'chat-item';
      item.setAttribute('data-id', profile.id);
      if (activeContactId === profile.id) item.classList.add('active');

      const avatarNode = document.createElement('div');
      avatarNode.className = 'avatar';
      if (profile.avatar_url) {
        const img = document.createElement('img');
        img.src = profile.avatar_url;
        avatarNode.appendChild(img);
      } else {
        avatarNode.textContent = (profile.username || '?').substring(0, 2).toUpperCase();
      }

      const details = document.createElement('div');
      details.className = 'chat-item-details';

      const header = document.createElement('div');
      header.className = 'chat-item-header';
      const name = document.createElement('span');
      name.className = 'chat-item-name';
      name.textContent = profile.username;
      
      const time = document.createElement('span');
      time.className = 'chat-item-time';
      header.appendChild(name);
      header.appendChild(time);

      const body = document.createElement('div');
      body.className = 'chat-item-body';
      const preview = document.createElement('span');
      preview.className = 'chat-item-preview';
      preview.textContent = 'Empezar conversación...';
      body.appendChild(preview);

      details.appendChild(header);
      details.appendChild(body);

      item.appendChild(avatarNode);
      item.appendChild(details);

      item.addEventListener('click', () => startOrOpenChat(profile));
      container.appendChild(item);
    });
  } catch (err) {
    console.error('Error al cargar conversaciones:', err);
  }
}

function startOrOpenChat(profile) {
  activeContactId = profile.id;
  
  // Actualizar lista de selección activa en UI
  document.querySelectorAll('#chatList .chat-item').forEach(el => {
    el.classList.remove('active');
    if (el.getAttribute('data-id') === profile.id) el.classList.add('active');
  });

  // Mostrar contenedor de Chat Activo
  document.getElementById('noChatPlaceholder').classList.add('hidden');
  document.getElementById('activeChat').classList.remove('hidden');

  // Configurar Encabezado del Chat
  const headAvatar = document.getElementById('chatContactAvatar');
  headAvatar.textContent = '';
  if (profile.avatar_url) {
    const img = document.createElement('img');
    img.src = profile.avatar_url;
    headAvatar.appendChild(img);
  } else {
    headAvatar.textContent = (profile.username || '?').substring(0, 2).toUpperCase();
  }
  document.getElementById('chatContactName').textContent = escapeHTML(profile.username);
  document.getElementById('chatContactStatus').textContent = escapeHTML(profile.status || 'En línea');

  // Cargar Mensajes
  fetchAndRenderMessages();
}

// --- CARGA Y RENDERIZADO DE MENSAJES (Seguro contra XSS) ---
async function fetchAndRenderMessages() {
  if (!activeContactId) return;
  try {
    chatMessagesList = await SupabaseService.fetchMessages(myProfile.id, activeContactId);
    renderMessagesUI();
  } catch (err) {
    console.error('Error al obtener mensajes:', err);
  }
}

function renderMessagesUI() {
  const container = document.getElementById('messagesContainer');
  container.textContent = ''; // Limpieza segura para evitar fugas de memoria y XSS

  chatMessagesList.forEach(msg => {
    const isOutgoing = msg.sender_id === myProfile.id;
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Contenido condicional seguro
    if (msg.type === 'text') {
      const textNode = document.createElement('p');
      textNode.textContent = msg.content; // textContent sanitiza entradas
      bubble.appendChild(textNode);
    } else if (msg.type === 'image') {
      const img = document.createElement('img');
      img.className = 'message-image';
      img.src = msg.content;
      img.alt = 'Imagen compartida';
      bubble.appendChild(img);
    } else if (msg.type === 'audio') {
      const audio = document.createElement('audio');
      audio.className = 'message-audio';
      audio.controls = true;
      audio.src = msg.content;
      bubble.appendChild(audio);
    }

    // Hora de envío
    const timeMeta = document.createElement('span');
    timeMeta.className = 'message-time-meta';
    timeMeta.textContent = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(timeMeta);

    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
  });

  // Auto-scroll al fondo
  container.scrollTop = container.scrollHeight;
}

// --- ENVÍO DE MENSAJES ---
function handleMessageInputToggle() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('btnSendMessage');
  const recordBtn = document.getElementById('btnVoiceRecord');

  if (input.value.trim().length > 0) {
    sendBtn.classList.remove('hidden');
    recordBtn.classList.add('hidden');
  } else {
    sendBtn.classList.add('hidden');
    recordBtn.classList.remove('hidden');
  }
}

async function handleSendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !activeContactId) return;

  try {
    const msg = await SupabaseService.insertMessage(myProfile.id, activeContactId, text, 'text');
    chatMessagesList.push(msg);
    renderMessagesUI();
    input.value = '';
    handleMessageInputToggle();
  } catch (err) {
    showToast('Fallo al enviar mensaje.', true);
  }
}

async function handleAttachmentSend(e) {
  const file = e.target.files[0];
  if (!file || !activeContactId) return;

  try {
    showToast('Subiendo imagen...');
    const publicUrl = await SupabaseService.uploadFile('attachments', `img_${myProfile.id}_${Date.now()}`, file);
    const msg = await SupabaseService.insertMessage(myProfile.id, activeContactId, publicUrl, 'image');
    chatMessagesList.push(msg);
    renderMessagesUI();
  } catch (err) {
    showToast('Fallo al cargar imagen.', true);
  }
}

// --- GRABACIÓN DE AUDIO (NOTAS DE VOZ) ---
async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      showToast('Enviando audio...');
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      
      try {
        const publicUrl = await SupabaseService.uploadFile('attachments', `voice_${myProfile.id}_${Date.now()}`, file);
        const msg = await SupabaseService.insertMessage(myProfile.id, activeContactId, publicUrl, 'audio');
        chatMessagesList.push(msg);
        renderMessagesUI();
      } catch (err) {
        showToast('Fallo al enviar audio.', true);
      }
    };

    mediaRecorder.start();
    document.getElementById('btnVoiceRecord').className = 'icon-btn mic-recording';
    showToast('Grabando...');
  } catch (err) {
    showToast('Permiso de micrófono denegado.', true);
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    // Apagar micrófono de manera segura
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    document.getElementById('btnVoiceRecord').className = 'icon-btn mic-idle';
  }
}

// --- EVENTOS REALTIME RECIBIDOS ---
function onNewMessageReceived(newMsg) {
  // Solo agregar si pertenece a la conversación actual
  if (activeContactId && 
     ((newMsg.sender_id === activeContactId && newMsg.receiver_id === myProfile.id) ||
      (newMsg.sender_id === myProfile.id && newMsg.receiver_id === activeContactId))) {
    chatMessagesList.push(newMsg);
    renderMessagesUI();
  }
  
  // Actualizar previsualización del listado lateral de chats
  const chatItem = document.querySelector(`#chatList .chat-item[data-id="${newMsg.sender_id === myProfile.id ? newMsg.receiver_id : newMsg.sender_id}"]`);
  if (chatItem) {
    const preview = chatItem.querySelector('.chat-item-preview');
    const time = chatItem.querySelector('.chat-item-time');
    
    preview.textContent = newMsg.type === 'text' ? newMsg.content : `[${newMsg.type}]`;
    time.textContent = new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// --- SEÑALIZACIÓN WEBRTC Y RECEPCIÓN DE LLAMADAS ---
function handleIncomingSignals(payload) {
  if (payload.type === 'offer') {
    // Recibiendo Oferta - Disparar Ringtone e Interfaz de llamada entrante
    incomingOfferData = payload;
    ringtone.play().catch(e => console.log('El navegador restringió el auto-play del audio'));
    
    document.getElementById('llamadaEntranteNombre').textContent = escapeHTML(payload.callerName);
    const incomingAvatar = document.getElementById('llamadaEntranteAvatar');
    incomingAvatar.textContent = '';
    if (payload.callerAvatar) {
      const img = document.createElement('img');
      img.src = payload.callerAvatar;
      incomingAvatar.appendChild(img);
    } else {
      incomingAvatar.textContent = (payload.callerName || '?').substring(0, 2).toUpperCase();
    }
    document.getElementById('llamadaEntranteTipo').textContent = payload.callType === 'video' ? 'Videollamada entrante...' : 'Llamada de voz entrante...';
    
    document.getElementById('modalLlamadaEntrante').classList.remove('hidden');
  } else {
    // Pasar resto de señalizaciones al Service WebRTC
    WebRTCService.handleSignalingMessage(payload);
  }
}

// --- EMPEZAR LLAMADA DESDE LA UI ---
async function makeCall(type) {
  if (!activeContactId) return;
  const peer = allProfiles.find(p => p.id === activeContactId);
  if (!peer) return;

  // Actualizar UI llamada activa
  document.getElementById('callContactNameLabel').textContent = escapeHTML(peer.username);
  const callAvatar = document.getElementById('callContactAvatar');
  callAvatar.textContent = '';
  if (peer.avatar_url) {
    const img = document.createElement('img');
    img.src = peer.avatar_url;
    callAvatar.appendChild(img);
  } else {
    callAvatar.textContent = (peer.username || '?').substring(0, 2).toUpperCase();
  }

  document.getElementById('callStatusLabel').textContent = 'Llamando...';
  document.getElementById('callOverlay').classList.remove('hidden');
  
  if (type === 'video') {
    document.getElementById('btnToggleVideo').classList.remove('hidden');
  } else {
    document.getElementById('btnToggleVideo').classList.add('hidden');
  }

  dialback.play().catch(e => {});

  try {
    await WebRTCService.startCall(myProfile.id, activeContactId, type, myProfile, handleOnTrack, handleOnCallHangup);
  } catch (err) {
    showToast(err.message, true);
    resetCallUI();
  }
}

// --- RESPUESTA DE VIDEO/AUDIO WEBRTC ON TRACK ---
function handleOnTrack(remoteStream, localStream) {
  // Parar tonos
  dialback.pause();
  dialback.currentTime = 0;
  ringtone.pause();
  ringtone.currentTime = 0;

  document.getElementById('callStatusLabel').textContent = 'Conectado';
  
  const timerLabel = document.getElementById('callTimer');
  timerLabel.classList.remove('timer-hidden');
  startCallDurationTimer();

  // Mapear streams a video si es videollamada
  if (WebRTCService.callState.callType === 'video') {
    document.getElementById('videoContainer').classList.remove('hidden');
    document.getElementById('remoteVideo').srcObject = remoteStream;
    document.getElementById('localVideo').srcObject = localStream;
  }
}

function handleOnCallHangup() {
  resetCallUI();
}

// --- ACCIONES DE ENTRADA DE LLAMADAS ---
async function handleAcceptIncomingCall() {
  document.getElementById('modalLlamadaEntrante').classList.add('hidden');
  ringtone.pause();
  ringtone.currentTime = 0;

  if (!incomingOfferData) return;

  // Actualizar UI llamada activa
  document.getElementById('callContactNameLabel').textContent = escapeHTML(incomingOfferData.callerName);
  const callAvatar = document.getElementById('callContactAvatar');
  callAvatar.textContent = '';
  if (incomingOfferData.callerAvatar) {
    const img = document.createElement('img');
    img.src = incomingOfferData.callerAvatar;
    callAvatar.appendChild(img);
  } else {
    callAvatar.textContent = (incomingOfferData.callerName || '?').substring(0, 2).toUpperCase();
  }
  document.getElementById('callStatusLabel').textContent = 'Conectando...';
  document.getElementById('callOverlay').classList.remove('hidden');

  if (incomingOfferData.callType === 'video') {
    document.getElementById('btnToggleVideo').classList.remove('hidden');
  } else {
    document.getElementById('btnToggleVideo').classList.add('hidden');
  }

  try {
    await WebRTCService.acceptCall(myProfile.id, incomingOfferData, handleOnTrack, handleOnCallHangup);
  } catch (err) {
    showToast(err.message, true);
    resetCallUI();
  }
}

async function handleDeclineIncomingCall() {
  document.getElementById('modalLlamadaEntrante').classList.add('hidden');
  ringtone.pause();
  ringtone.currentTime = 0;
  if (incomingOfferData) {
    await WebRTCService.declineCall(incomingOfferData.callerId);
  }
  incomingOfferData = null;
}

async function handleHangupClick() {
  await WebRTCService.hangup();
  resetCallUI();
}

// --- SILENCIAR AUDIO/DESACTIVAR VIDEO ---
function handleToggleMute() {
  if (WebRTCService.localStream) {
    const audioTrack = WebRTCService.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById('btnToggleMute').textContent = audioTrack.enabled ? '🎙️' : '🔇';
    }
  }
}

function handleToggleVideoTrack() {
  if (WebRTCService.localStream) {
    const videoTrack = WebRTCService.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      document.getElementById('btnToggleVideo').textContent = videoTrack.enabled ? '📹' : '📵';
    }
  }
}

// --- LIMPIEZA DE INTERFAZ DE LLAMADA ---
function resetCallUI() {
  dialback.pause();
  dialback.currentTime = 0;
  ringtone.pause();
  ringtone.currentTime = 0;

  document.getElementById('callOverlay').classList.add('hidden');
  document.getElementById('modalLlamadaEntrante').classList.add('hidden');
  document.getElementById('videoContainer').classList.add('hidden');
  document.getElementById('callTimer').classList.add('timer-hidden');
  
  // Limpiar timers
  clearInterval(callTimerInterval);
  document.getElementById('callTimer').textContent = '00:00';
  
  // Limpiar videos
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('localVideo').srcObject = null;

  // Restaurar botones de mute/video a sus iconos por defecto
  document.getElementById('btnToggleMute').textContent = '🎙️';
  document.getElementById('btnToggleVideo').textContent = '📹';

  incomingOfferData = null;
  WebRTCService.cleanupCall();
}

// --- REPRODUCTOR DE DURACIÓN DE LLAMADAS ---
function startCallDurationTimer() {
  let seconds = 0;
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    seconds++;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('callTimer').textContent = `${m}:${s}`;
  }, 1000);
}

// --- ELEMENTO TOAST NO INVASIVO (Evitar alert()) ---
function showToast(msg, isError = false) {
  const container = document.getElementById('connection-toast');
  container.textContent = msg;
  container.className = `toast ${isError ? 'offline' : 'online'}`;
  container.classList.remove('hidden');

  setTimeout(() => {
    container.classList.add('hidden');
  }, 4000);
}