/**
 * js/supabase-client.js
 * Conexión, inicialización y gestión de canales Realtime/Storage con Supabase.
 */

var clienteSupabase = null;
var canalRealtime = null;

function inicializarSupabase() {
  if (clienteSupabase) return;
  if (typeof supabase === 'undefined') {
    console.error('❌ La librería global de Supabase no está cargada en el navegador.');
    return;
  }
  
  // Inicializar cliente con variables globales de app.js
  clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('📡 Cliente Supabase correctamente inicializado.');

  // Configurar Canal Único Realtime Broadcast para Mensajes y Señalización WebRTC (Llamadas)
  conectarCanalRealtime();
}

function conectarCanalRealtime() {
  if (!clienteSupabase) return;
  
  var pinCanal = typeof miPIN !== 'undefined' && miPIN ? miPIN : 'global_room';
  canalRealtime = clienteSupabase.channel('kerix_room_' + pinCanal, {
    config: { broadcast: { self: false } }
  });

  canalRealtime
    .on('broadcast', { event: 'nuevo-mensaje' }, function(response) {
      console.log('✉️ Mensaje recibido via Realtime:', response);
      if (typeof window.procesarMensajeEntrante === 'function') {
        window.procesarMensajeEntrante(response.payload);
      }
    })
    .on('broadcast', { event: 'llamada-oferta' }, function(response) {
      console.log('📞 Oferta de llamada WebRTC entrante:', response);
      if (response.payload && response.payload.para === miPIN) {
        if (typeof window.procesarOfertaLlamada === 'function') {
          window.procesarOfertaLlamada(response.payload);
        }
      }
    })
    .on('broadcast', { event: 'llamada-respuesta' }, function(response) {
      console.log('📱 Respuesta de llamada WebRTC recibida:', response);
      if (response.payload && response.payload.para === miPIN) {
        if (typeof window.procesarRespuestaLlamada === 'function') {
          window.procesarRespuestaLlamada(response.payload);
        }
      }
    })
    .on('broadcast', { event: 'ice-candidate' }, function(response) {
      if (response.payload && response.payload.para === miPIN) {
        if (typeof window.procesarIceCandidate === 'function') {
          window.procesarIceCandidate(response.payload);
        }
      }
    })
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Canal Realtime Kerix suscrito y escuchando eventos.');
      }
    });
}

// Interfaz para interactuar con la Base de Datos desde app.js sin saturación
var SupabaseMensajes = {
  enviarMensajePayload: async function(mensajeObj) {
    if (!clienteSupabase) inicializarSupabase();
    
    // 1. Guardar en BD para el historial asíncrono
    var { data, error } = await clienteSupabase
      .from('mensajes')
      .insert([mensajeObj])
      .select();
      
    if (error) throw error;

    // 2. Transmitir en tiempo real al destinatario de forma paralela si está conectado
    if (canalRealtime) {
      canalRealtime.send({
        type: 'broadcast',
        event: 'nuevo-mensaje',
        payload: mensajeObj
      });
    }
    return data;
  },

  descargarHistorial: async function(miPin, contactoPin) {
    if (!clienteSupabase) inicializarSupabase();
    var { data, error } = await clienteSupabase
      .from('mensajes')
      .select('*')
      .or('and(pin_remitente.eq.' + miPin + ',pin_destinatario.eq.' + contactoPin + '),and(pin_remitente.eq.' + contactoPin + ',pin_destinatario.eq.' + miPin + ')')
      .order('creado_en', { ascending: true });

    if (error) throw error;
    return data;
  }
};

var SupabaseUsuarios = {
  obtenerUsuario: async function(pin) {
    if (!clienteSupabase) inicializarSupabase();
    var { data, error } = await clienteSupabase
      .from('usuarios')
      .select('*')
      .eq('pin', pin)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};

// Exposición Global
window.inicializarSupabase = inicializarSupabase;
window.canalRealtime = canalRealtime;
window.SupabaseMensajes = SupabaseMensajes;
window.SupabaseUsuarios = SupabaseUsuarios;

console.log('📡 Módulo cliente de Supabase (supabase-client.js) saneado y activo.');
