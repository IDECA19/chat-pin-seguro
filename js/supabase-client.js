/**
 * js/supabase-client.js
 * Conexión, inicialización y gestión de canales Realtime con Supabase.
 * Alineado estrictamente con tus esquemas de producción reales.
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
  console.log('📡 Cliente Supabase sincronizado con el esquema de producción.');
}

function conectarCanalRealtime() {
  if (!clienteSupabase) inicializarSupabase();
  if (canalRealtime) canalRealtime.unsubscribe();
  
  var pinCanal = typeof miPIN !== 'undefined' && miPIN ? miPIN : localStorage.getItem('kerix_mi_pin');
  if (!pinCanal) return;

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
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Canal Realtime Kerix blindado escuchando la sala: ' + pinCanal);
      }
    });
}

var SupabaseMensajes = {
  enviarMensajePayload: async function(mensajeObj) {
    if (!clienteSupabase) inicializarSupabase();
    var { data, error } = await clienteSupabase.from('mensajes').insert([mensajeObj]).select();
    if (error) throw error;

    if (clienteSupabase && mensajeObj.pin_destinatario) {
      var canalDestino = clienteSupabase.channel('kerix_room_' + mensajeObj.pin_destinatario);
      canalDestino.subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          canalDestino.send({ type: 'broadcast', event: 'nuevo-mensaje', payload: mensajeObj });
        }
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
      .order('enviado_en', { ascending: true });

    if (error) throw error;
    return data;
  }
};

var SupabaseUsuarios = {
  obtenerUsuario: async function(pin) {
    if (!clienteSupabase) inicializarSupabase();
    var { data, error } = await clienteSupabase.from('usuarios').select('*').eq('pin', pin).maybeSingle();
    if (error) throw error;
    return data;
  }
};

window.inicializarSupabase = inicializarSupabase;
window.conectarCanalRealtime = conectarCanalRealtime;
window.SupabaseMensajes = SupabaseMensajes;
window.SupabaseUsuarios = SupabaseUsuarios;
