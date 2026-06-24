/**
 * js/supabase-client.js
 * Configuración centralizada, conexión de base de datos y autenticación con Supabase.
 */

// Inicialización de constantes utilizando los datos originales de la app Kerix
const supabaseUrl = 'https://dksmoteiidjpymextrgj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc21vdGVpaWRqcHltZXh0cmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTMyNDY5ODcsImV4cCI6MjAyODgyMjk4N30.Z_0p-nZ-fXvOa1C-KxYV6WjLh09z7Zp9f4h-mYJzS9I';

// Cliente global de Supabase
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Wrappers modulares para base de datos y Storage (Asegurando modularidad del código)
const SupabaseService = {
  // --- AUTENTICACIÓN ---
  async getSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return session;
  },

  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async register(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  },

  async logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  // --- PERFILES ---
  async fetchProfile(userId) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 es "no rows"
    return data;
  },

  async saveProfile(userId, username, avatarUrl, status) {
    const { error } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        username,
        avatar_url: avatarUrl,
        status: status || 'Disponible',
        updated_at: new Date()
      });
    if (error) throw error;
  },

  async fetchAllProfiles() {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });
    if (error) throw error;
    return data;
  },

  // --- STORAGE ---
  async uploadFile(bucket, path, file) {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(path, file, { cacheControl: '3600', upsert: true });
    
    if (error) throw error;
    
    // Obtener URL Pública
    const { data: { publicUrl } } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(path);
      
    return publicUrl;
  },

  // --- MENSAJES Y CHATS ---
  async fetchMessages(myId, peerId) {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async insertMessage(senderId, receiverId, content, type = 'text') {
    const { data, error } = await supabaseClient
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        type,
        created_at: new Date()
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  // Suscribirse a mensajes nuevos
  subscribeToMessages(callback) {
    return supabaseClient
      .channel('schema-messages-db')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        callback(payload.new);
      })
      .subscribe();
  },

  // --- SEÑALIZACIÓN EN TIEMPO REAL (WEBRTC) ---
  createSignalingChannel(userId, onSignalReceived) {
    // Canal bidireccional usando broadcast
    return supabaseClient.channel(`room-call:${userId}`, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'signaling' }, ({ payload }) => {
      onSignalReceived(payload);
    })
    .subscribe();
  },

  async sendSignalingMessage(receiverId, payload) {
    const channel = supabaseClient.channel(`room-call:${receiverId}`);
    await channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload
    });
  }
};

// DESPUÉS (con retry logic)
async function obtenerClavePublica(pin) {
    try {
        var { data } = await ejecutarConReintentos(async function() {
            var resultado = await clienteSupabase.from('usuarios')
                .select('clave_publica')
                .eq('pin', pin)
                .single();
            if (resultado.error) throw resultado.error;
            return resultado;
        }, {
            maxRetries: 2,
            baseDelay: 500,
            onRetry: function(intento, max, delay, error) {
                console.warn('⚠️ Reintentando obtener clave pública (intento ' + intento + '/' + max + ')');
            }
        });
        
        if (!data || !data.clave_publica) return null;
        var buf = Uint8Array.from(atob(data.clave_publica), c => c.charCodeAt(0));
        return await crypto.subtle.importKey("spki", buf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    } catch (error) {
        console.error('❌ Error obteniendo clave pública tras reintentos:', error);
        return null;
    }
}
