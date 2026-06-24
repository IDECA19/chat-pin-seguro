/**
 * js/supabase-client.js
 * Cliente de Supabase adaptado para sistema de PIN anónimo
 * 
 * IMPORTANTE: NO usa email/password. Solo PIN anónimo.
 * 
 * Depende de:
 * - security.js (hashPIN, cifrarClaveConPIN)
 * - app.js (miPIN, logError)
 */

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
var SUPABASE_URL = 'https://dksmoteiidjpymextrgj.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_HuXshjcD1Je934lVgBcJtw_5kFSuGzE';

// ============================================
// INICIALIZACIÓN DEL CLIENTE
// ============================================
var clienteSupabase = null;

function inicializarSupabase() {
  if (typeof supabase === 'undefined') {
    console.error('❌ Supabase no está cargado');
    return false;
  }
  try {
    clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Cliente Supabase inicializado');
    return true;
  } catch (error) {
    logError('Error inicializando Supabase:', error);
    return false;
  }
}

// ============================================
// WRAPPERS PARA USUARIOS (SISTEMA PIN)
// ============================================
var SupabaseUsuarios = {
  // Obtener usuario por PIN
  async obtenerUsuario(pin) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .select('*')
        .eq('pin', pin)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error obteniendo usuario:', error);
      return null;
    }
  },

  // Crear nuevo usuario con PIN
  async crearUsuario(pin, clavePublica) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .insert({
          pin: pin,
          clave_publica: clavePublica,
          modo_privado: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error creando usuario:', error);
      return null;
    }
  },

  // Actualizar clave pública
  async actualizarClavePublica(pin, clavePublica) {
    try {
      var { error } = await clienteSupabase.from('usuarios')
        .update({ clave_publica: clavePublica })
        .eq('pin', pin);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error actualizando clave pública:', error);
      return false;
    }
  },

  // Actualizar modo privado
  async actualizarModoPrivado(pin, modoPrivado) {
    try {
      var { error } = await clienteSupabase.from('usuarios')
        .update({ modo_privado: modoPrivado })
        .eq('pin', pin);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error actualizando modo privado:', error);
      return false;
    }
  },

  // Actualizar preferencias de seguridad
  async actualizarPreferencias(pin, preferencias) {
    try {
      var { error } = await clienteSupabase.from('usuarios')
        .update(preferencias)
        .eq('pin', pin);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error actualizando preferencias:', error);
      return false;
    }
  },

  // Verificar estado del servicio
  async verificarEstado(pin) {
    try {
      var { data, error } = await clienteSupabase.from('usuarios')
        .select('fecha_expiracion')
        .eq('pin', pin)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error verificando estado:', error);
      return null;
    }
  },

  // Activar servicio con código
  async activarServicio(pin, codigo) {
    try {
      var resultado = await clienteSupabase.functions.invoke('activar-servicio', {
        body: { pin: pin, codigo: codigo }
      });
      return resultado;
    } catch (error) {
      logError('Error activando servicio:', error);
      return { error: error };
    }
  }
};

// ============================================
// WRAPPERS PARA MENSAJES
// ============================================
var SupabaseMensajes = {
  // Enviar mensaje cifrado
  async enviarMensaje(mensaje) {
    try {
      var { data, error } = await clienteSupabase.from('mensajes')
        .insert(mensaje)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error enviando mensaje:', error);
      return null;
    }
  },

  // Obtener mensajes entre dos PINs
  async obtenerMensajes(pin1, pin2) {
    try {
      var { data, error } = await clienteSupabase.from('mensajes')
        .select('*')
        .or('and(pin_remitente.eq.' + pin1 + ',pin_destinatario.eq.' + pin2 + '),and(pin_remitente.eq.' + pin2 + ',pin_destinatario.eq.' + pin1 + ')')
        .order('enviado_en', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error obteniendo mensajes:', error);
      return [];
    }
  },

  // Marcar mensajes como leídos
  async marcarComoLeidos(pinRemitente, pinDestinatario) {
    try {
      var { error } = await clienteSupabase.from('mensajes')
        .update({ leido: true, leido_en: new Date().toISOString() })
        .eq('pin_remitente', pinRemitente)
        .eq('pin_destinatario', pinDestinatario)
        .eq('leido', false);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error marcando como leídos:', error);
      return false;
    }
  },

  // Obtener mensajes no leídos
  async obtenerNoLeidos(pinDestinatario) {
    try {
      var { data, error } = await clienteSupabase.from('mensajes')
        .select('pin_remitente')
        .eq('pin_destinatario', pinDestinatario)
        .eq('leido', false);
      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error obteniendo no leídos:', error);
      return [];
    }
  },

  // Borrar mensajes
  async borrarMensajes(ids) {
    try {
      var { error } = await clienteSupabase.from('mensajes')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error borrando mensajes:', error);
      return false;
    }
  },

  // Limpiar chat completo
  async limpiarChat(pin1, pin2) {
    try {
      var { error } = await clienteSupabase.from('mensajes')
        .delete()
        .or('and(pin_remitente.eq.' + pin1 + ',pin_destinatario.eq.' + pin2 + '),and(pin_remitente.eq.' + pin2 + ',pin_destinatario.eq.' + pin1 + ')');
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error limpiando chat:', error);
      return false;
    }
  },

  // Suscribirse a mensajes en tiempo real
  suscribirseMensajes(pinDestinatario, callback) {
    if (!clienteSupabase) return null;
    return clienteSupabase.channel('mensajes_' + pinDestinatario)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: 'pin_destinatario=eq.' + pinDestinatario
      }, callback)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mensajes',
        filter: 'pin_remitente=eq.' + pinDestinatario
      }, callback)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'mensajes'
      }, callback)
      .subscribe();
  }
};

// ============================================
// WRAPPERS PARA LLAMADAS (WEBRTC)
// ============================================
var SupabaseLlamadas = {
  // Iniciar llamada (crear registro)
  async iniciarLlamada(llamada) {
    try {
      var { data, error } = await clienteSupabase.from('llamadas')
        .insert(llamada)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error iniciando llamada:', error);
      return null;
    }
  },

  // Actualizar llamada
  async actualizarLlamada(id, datos) {
    try {
      var { error } = await clienteSupabase.from('llamadas')
        .update(datos)
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error actualizando llamada:', error);
      return false;
    }
  },

  // Obtener llamada activa
  async obtenerLlamadaActiva(pinRemitente, pinDestinatario) {
    try {
      var { data, error } = await clienteSupabase.from('llamadas')
        .select('*')
        .eq('pin_remitente', pinRemitente)
        .eq('pin_destinatario', pinDestinatario)
        .eq('estado', 'llamando')
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      logError('Error obteniendo llamada:', error);
      return null;
    }
  },

  // Suscribirse a cambios de llamadas
  suscribirseLlamadas(callback) {
    if (!clienteSupabase) return null;
    return clienteSupabase.channel('llamadas_cambios')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'llamadas'
      }, callback)
      .subscribe();
  },

  // Limpiar llamadas antiguas
  async limpiarLlamadasAntiguas(pin) {
    try {
      var hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      var { error } = await clienteSupabase.from('llamadas')
        .delete()
        .or('pin_remitente.eq.' + pin + ',pin_destinatario.eq.' + pin)
        .lt('inicio', hace24h);
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error limpiando llamadas:', error);
      return false;
    }
  }
};

// ============================================
// WRAPPERS PARA STORAGE
// ============================================
var SupabaseStorage = {
  // Verificar buckets
  async verificarBuckets() {
    try {
      var { data: buckets, error } = await clienteSupabase.storage.listBuckets();
      if (error) throw error;
      return buckets;
    } catch (error) {
      logError('Error listando buckets:', error);
      return [];
    }
  },

  // Test de storage
  async testStorage(pin) {
    try {
      var testBlob = new Blob(['test'], { type: 'text/plain' });
      var testFileName = 'test_' + pin + '_' + Date.now() + '.txt';
      var { data: uploadData, error: uploadError } = await clienteSupabase.storage.from('chat-files').upload(testFileName, testBlob);
      if (uploadError) throw uploadError;
      var { data: urlData, error: urlError } = await clienteSupabase.storage.from('chat-files').createSignedUrl(testFileName, 60);
      if (urlError) throw urlError;
      await clienteSupabase.storage.from('chat-files').remove([testFileName]);
      return true;
    } catch (error) {
      logError('Error en test storage:', error);
      return false;
    }
  }
};

console.log('🔌 Módulo supabase-client.js cargado correctamente');
