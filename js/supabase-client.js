/**
 * js/supabase-client.js
 * Cliente de comunicación con Supabase
 * * Correcciones:
 * - Remoción absoluta de caracteres de escape corruptos (\\n).
 * - Prevención de re-declaración destructiva de la variable global 'clienteSupabase'.
 * - Robustez en consultas asíncronas para chats anónimos basados en PIN.
 */

// Se inicializa como nulo únicamente si no existe previamente
if (typeof clienteSupabase === 'undefined') {
  var clienteSupabase = null;
}

function inicializarSupabase() {
  if (typeof supabase === 'undefined') {
    console.error('❌ Módulo principal de Supabase no cargado en index.html');
    return false;
  }
  try {
    if (!clienteSupabase) {
      clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Cliente Supabase correctamente inicializado.');
    }
    return true;
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
    return false;
  }
}

// ============================================
// WRAPPERS PARA BASE DE DATOS (SISTEMA PIN)
// ============================================
var SupabaseUsuarios = {
  async obtenerUsuario(pin) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .select('*')
        .eq('pin', pin)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al buscar usuario:', error);
      return null;
    }
  },

  async registrarUsuario(pin, clavePublica) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .insert([{ pin: pin, clave_publica: clavePublica }])
        .select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error registrando usuario:', error);
      return null;
    }
  },

  async actualizarClavePublica(pin, nuevaClavePublica) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .update({ clave_publica: nuevaClavePublica })
        .eq('pin', pin)
        .select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error actualizando clave pública:', error);
      return null;
    }
  }
};

// ============================================
// WRAPPERS PARA MENSAJERÍA E2EE
// ============================================
var SupabaseMensajes = {
  async enviarMensajePayload(payload) {
    try {
      var { data, error } = await clienteSupabase.from('mensajes')
        .insert([payload])
        .select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error insertando mensaje payload:', error);
      return null;
    }
  },

  async descargarHistorial(miPin, contactoPin) {
    try {
      var { data, error } = await clienteSupabase.from('mensajes')
        .select('*')
        .or(`and(pin_remitente.eq.${miPin},pin_destinatario.eq.${contactoPin}),and(pin_remitente.eq.${contactoPin},pin_destinatario.eq.${miPin})`)
        .order('creado_en', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error descargando historial:', error);
      return [];
    }
  }
};

// ============================================
// WRAPPERS PARA CONTROL DE LLAMADAS WEBRTC
// ============================================
var SupabaseLlamadas = {
  async crearLlamada(pinRemitente, pinDestinatario, tipo, oferta) {
    try {
      var { data, error } = await clienteSupabase.from('llamadas')
        .insert([{
          pin_remitente: pinRemitente,
          pin_destinatario: pinDestinatario,
          tipo: tipo,
          oferta: oferta,
          estado: 'pendiente'
        }])
        .select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error creando llamada:', error);
      return null;
    }
  },

  async actualizarLlamada(id, campos) {
    try {
      var { data, error } = await clienteSupabase.from('llamadas')
        .update(campos)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error actualizando llamada:', error);
      return null;
    }
  },

  async obtenerLlamada(id) {
    try {
      var { data, error } = await clienteSupabase.from('llamadas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error cargando llamada:', error);
      return null;
    }
  }
};

// ============================================
// 🌍 EXPOSICIÓN GLOBAL
// ============================================
window.inicializarSupabase = inicializarSupabase;
window.SupabaseUsuarios = SupabaseUsuarios;
window.SupabaseMensajes = SupabaseMensajes;
window.SupabaseLlamadas = SupabaseLlamadas;

console.log('📡 Módulo cliente de Supabase (supabase-client.js) saneado y activo.');
