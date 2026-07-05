/**
 * js/supabase-client.js
 * Conexión, inicialización y gestión de canales Realtime con Supabase.
 * Adaptado quirúrgicamente al esquema real de base de datos de producción.
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
  console.log('📡 Cliente Supabase correctamente inicializado con el esquema real.');
}

// SOLUCIÓN: Conexión dinámica y reactiva basada en el miPIN real del dispositivo
function conectarCanalRealtime() {
  if (!clienteSupabase) inicializarSupabase();
  if (canalRealtime) {
    canalRealtime.unsubscribe();
  }
  
  var pinCanal = typeof miPIN !== 'undefined' && miPIN ? miPIN : localStorage.getItem('kerix_mi_pin');
  if (!pinCanal) {
    console.warn('⚠️ No se puede conectar a Realtime: miPIN aún no ha sido calculado.');
    return;
  }

  console.log('📡 Suscribiendo WebSocket seguro a la sala privada: kerix_room_' + pinCanal);
  canalRealtime = clienteSupabase.channel('kerix_room_' + pinCanal, {
    config: { broadcast: { self: false } }
  });

  canalRealtime
    .on('broadcast', { event: 'nuevo-mensaje' }, function(response) {
      console.log('✉️ Mensaje en tiempo real recibido en la sala:', response);
      if (response.payload) {
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
        console.log('✅ Canal Realtime Kerix activo y escuchando la sala: ' + pinCanal);
      }
    });
}

var SupabaseMensajes = {
  enviarMensajePayload: async function(mensajeObj) {
    if (!clienteSupabase) inicializarSupabase();
    
    // 1. Persistencia segura en base de datos
    var { data, error } = await clienteSupabase
      .from('mensajes')
      .insert([mensajeObj])
      .select();
      
    if (error) {
      console.error('❌ Supabase rechazó la transacción. Revisa las directivas RLS:', error.message);
      throw error;
    }

    // 2. Transmisión directa y reactiva al canal del destinatario sin demoras
    if (clienteSupabase && mensajeObj.pin_destinatario) {
      var canalDestino = clienteSupabase.channel('kerix_room_' + mensajeObj.pin_destinatario);
      canalDestino.subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          canalDestino.send({
            type: 'broadcast',
            event: 'nuevo-mensaje',
            payload: mensajeObj
          }).then(function() {
            console.log('🚀 Broadcast enviado con éxito a la sala del receptor:', mensajeObj.pin_destinatario);
          });
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
window.conectarCanalRealtime = conectarCanalRealtime;
window.SupabaseMensajes = SupabaseMensajes;
window.SupabaseUsuarios = SupabaseUsuarios;
