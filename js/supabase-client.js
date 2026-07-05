/**
 * js/supabase-client.js
 * Conexión, inicialización y gestión de canales Realtime/Storage con Supabase.
 */

var clienteSupabase = null;
var canalRealtime = null;

function inicializarSupabase() {
  if (clienteSupabase) return;
  if (typeof supabase === 'undefined') {
    console.error('❌ La librería global de Supabase no está cargada.');
    return;
  }
  
  clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('📡 Cliente Supabase correctamente inicializado.');
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
      if (response.payload && response.payload.pin_destinatario === miPIN) {
        if (typeof window.procesarMensajeEntrante === 'function') {
          window.procesarMensajeEntrante(response.payload);
        }
      }
    })
    .on('broadcast', { event: 'llamada-oferta' }, function(response) {
      if (response.payload && response.payload.para === miPIN) {
        if (typeof window.procesarOfertaLlamada === 'function') {
          window.procesarOfertaLlamada(response.payload);
        }
      }
    })
    .on('broadcast', { event: 'llamada-respuesta' }, function(response) {
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
        console.log('✅ Canal Realtime Kerix suscrito de forma estable.');
      }
    });
}

var SupabaseMensajes = {
  enviarMensajePayload: async function(mensajeObj) {
    if (!clienteSupabase) inicializarSupabase();
    
    // Guardar en base de datos cifrado
    var { data, error } = await clienteSupabase
      .from('mensajes')
      .insert([mensajeObj])
      .select();
      
    if (error) throw error;

    // Emitir ráfaga realtime paralela instantánea
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

window.inicializarSupabase = inicializarSupabase;
window.canalRealtime = canalRealtime;
window.SupabaseMensajes = SupabaseMensajes;
window.SupabaseUsuarios = SupabaseUsuarios;
