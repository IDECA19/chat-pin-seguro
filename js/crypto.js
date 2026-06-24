/**
 * js/crypto.js
 * Sistema de cifrado E2EE: AES-256-GCM + RSA-OAEP
 * 
 * Depende de:
 * - security.js (pinActualTemporal, cifrarClaveConPIN, descifrarClaveConPIN)
 * - supabase-client.js (clienteSupabase)
 * - app.js (miPIN, miClavePrivada, miClavePublica, logError)
 */

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function ofuscarClave(clave) { if (!clave) return clave; return btoa(clave.split('').reverse().join('')); }
function desofuscarClave(ofuscada) { if (!ofuscada) return ofuscada; return atob(ofuscada).split('').reverse().join(''); }

// ============================================
// GENERACIÓN Y GESTIÓN DE CLAVES
// ============================================
async function generarClaves() {
  try {
    var parClaves = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    miClavePrivada = parClaves.privateKey;
    miClavePublica = parClaves.publicKey;
    var pubExp = await crypto.subtle.exportKey("spki", miClavePublica);
    var pubBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pubExp)));
    var privExp = await crypto.subtle.exportKey("pkcs8", miClavePrivada);
    var privBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(privExp)));
    var pinTemporal = pinActualTemporal || sessionStorage.getItem('pin_temporal_' + miPIN);
    var aGuardar = (pinAccesoHash && pinTemporal) ? await cifrarClaveConPIN(privBase64, pinTemporal) : ofuscarClave(privBase64);
    localStorage.setItem('clave_privada_' + miPIN, aGuardar);
    await subirClavePublica(pubBase64);
  } catch (error) { logError('Error generating keys:', error); }
}

async function subirClavePublica(pubBase64) {
  if (!clienteSupabase) return;
  await clienteSupabase.from('usuarios').upsert({ pin: miPIN, clave_publica: pubBase64 });
}

async function obtenerClavePublica(pin) {
  try {
    var { data } = await clienteSupabase.from('usuarios').select('clave_publica').eq('pin', pin).single();
    if (!data || !data.clave_publica) return null;
    var buf = Uint8Array.from(atob(data.clave_publica), c => c.charCodeAt(0));
    return await crypto.subtle.importKey("spki", buf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
  } catch (error) { return null; }
}

// ============================================
// CIFRADO AES
// ============================================
async function generarClaveAES() { return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]); }

async function cifrarConAES(texto, claveAES) {
  var encoder = new TextEncoder();
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, claveAES, encoder.encode(texto));
  return { iv: btoa(String.fromCharCode.apply(null, iv)), datos: btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado))) };
}

async function descifrarConAES(ivBase64, datosBase64, claveAES) {
  var iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  var datos = Uint8Array.from(atob(datosBase64), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, claveAES, datos));
}

async function exportarClaveAES(clave) { return btoa(String.fromCharCode.apply(null, new Uint8Array(await crypto.subtle.exportKey("raw", clave)))); }
async function importarClaveAES(base64) { return await crypto.subtle.importKey("raw", Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]); }

// ============================================
// CIFRADO RSA
// ============================================
async function cifrarClaveConRSA(claveAESBase64, clavePublicaRSA) {
  var encoder = new TextEncoder();
  return btoa(String.fromCharCode.apply(null, new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, clavePublicaRSA, encoder.encode(claveAESBase64)))));
}

async function descifrarClaveConRSA(claveCifradaBase64, clavePrivadaRSA) {
  var cifrado = Uint8Array.from(atob(claveCifradaBase64), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, clavePrivadaRSA, cifrado));
}

// ============================================
// CIFRADO DE MENSAJES
// ============================================
async function cifrarMensaje(texto, clavePublicaDestinatario) {
  var claveAES = await generarClaveAES();
  var claveAESBase64 = await exportarClaveAES(claveAES);
  var { iv, datos } = await cifrarConAES(texto, claveAES);
  return iv + '|' + datos + '|' + await cifrarClaveConRSA(claveAESBase64, clavePublicaDestinatario) + '|' + await cifrarClaveConRSA(claveAESBase64, miClavePublica);
}

async function descifrarMensaje(cifradoBase64) {
  if (!cifradoBase64 || cifradoBase64.length === 0) return '';
  if (!cifradoBase64.includes('|')) return cifradoBase64;
  try {
    var partes = cifradoBase64.split('|');
    if (partes.length !== 4) return '[Mensaje corrupto]';
    var claveAESBase64 = null;
    try { claveAESBase64 = await descifrarClaveConRSA(partes[2], miClavePrivada); }
    catch (e) { try { claveAESBase64 = await descifrarClaveConRSA(partes[3], miClavePrivada); } catch (e2) { return '[No se puede descifrar]'; } }
    return await descifrarConAES(partes[0], partes[1], await importarClaveAES(claveAESBase64));
  } catch (error) { return '[Error de descifrado]'; }
}

// ============================================
// CIFRADO DE ARCHIVOS
// ============================================
async function cifrarArchivo(file, clavePublicaDestinatario) {
  var claveAES = await generarClaveAES();
  var arrayBuffer = await file.arrayBuffer();
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, claveAES, arrayBuffer);
  var claveAESBase64 = await exportarClaveAES(claveAES);
  return { blob: new Blob([cifrado], { type: 'application/octet-stream' }), iv: btoa(String.fromCharCode.apply(null, iv)), claveParaDestinatario: await cifrarClaveConRSA(claveAESBase64, clavePublicaDestinatario), claveParaMi: await cifrarClaveConRSA(claveAESBase64, miClavePublica), nombreOriginal: file.name, tipoOriginal: file.type, tamañoOriginal: file.size };
}

async function descifrarArchivo(arrayBufferCifrado, ivBase64, claveCifradaBase64, claveCifradaDestinatario) {
  var claveAESBase64 = null;
  if (claveCifradaBase64) try { claveAESBase64 = await descifrarClaveConRSA(claveCifradaBase64, miClavePrivada); } catch (e) {}
  if (!claveAESBase64 && claveCifradaDestinatario) try { claveAESBase64 = await descifrarClaveConRSA(claveCifradaDestinatario, miClavePrivada); } catch (e) {}
  if (!claveAESBase64) throw new Error('Llave de descifrado fallida');
  var claveAES = await importarClaveAES(claveAESBase64);
  var iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  return await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, claveAES, arrayBufferCifrado);
}

async function subirArchivo(file, pinDestinatario) {
  try {
    var clavePublicaDest = await obtenerClavePublica(pinDestinatario);
    if (!clavePublicaDest) throw new Error('Llave destino no disponible');
    var archivoCifrado = await cifrarArchivo(file, clavePublicaDest);
    var ts = Date.now();
    var ext = file.name.split('.').pop();
    var fileName = miPIN + '_' + pinDestinatario + '_' + ts + '.' + ext + '.enc';
    var { data, error } = await clienteSupabase.storage.from('chat-files').upload(fileName, archivoCifrado.blob, { cacheControl: '3600', upsert: false, contentType: 'application/octet-stream' });
    if (error) throw new Error('Error de subida: ' + error.message);
    var { data: urlData, error: urlError } = await clienteSupabase.storage.from('chat-files').createSignedUrl(fileName, 3600);
    if (urlError) throw new Error('Fallo URL firmada: ' + urlError.message);
    if (!urlData || !urlData.signedUrl) throw new Error('URL firmada nula');
    return { url: urlData.signedUrl, path: data.path, nombre: archivoCifrado.nombreOriginal, tipo: archivoCifrado.tipoOriginal, tipoOriginal: archivoCifrado.tipoOriginal, tamaño: archivoCifrado.tamañoOriginal, iv: archivoCifrado.iv, claveParaDestinatario: archivoCifrado.claveParaDestinatario, claveParaMi: archivoCifrado.claveParaMi, cifrado: true };
  } catch (error) { logError('❌ Error en subirArchivo:', error); throw error; }
}

async function cargarYDescifrarAdjunto(msg) {
  var container = document.getElementById('media-container-' + msg.id);
  if (!container) return;
  if (container.getAttribute('data-loaded') === 'true') return;
  try {
    var path = obtenerPathDesdeUrl(msg.archivo_url) || msg.archivo_url;
    if (!path) { container.innerHTML = '<span style="color: #ef4444; font-size: 11px;">⚠️ Error: Ruta corrupta</span>'; return; }
    var objectUrl = '';
    if (cacheArchivosDescifrados[msg.archivo_url]) {
      objectUrl = cacheArchivosDescifrados[msg.archivo_url];
    } else {
      var { data: blob, error } = await clienteSupabase.storage.from('chat-files').download(path);
      if (error) {
        var { data: signedData, error: signedError } = await clienteSupabase.storage.from('chat-files').createSignedUrl(path, 300);
        if (signedError || !signedData) throw new Error('Descarga bloqueada');
        var resp = await fetch(signedData.signedUrl);
        blob = await resp.blob();
      }
      if (!blob) throw new Error('Archivo vacío');
      var decryptedBlob;
      if (msg.archivo_cifrado) {
        var arrayBuffer = await blob.arrayBuffer();
        var decryptedBuffer = await descifrarArchivo(arrayBuffer, msg.archivo_iv, msg.archivo_clave, msg.archivo_clave_destinatario);
        var tipoMime = msg.tipoOriginal || (msg.tipo_mensaje === 'imagen' ? 'image/*' : msg.tipo_mensaje === 'video' ? 'video/*' : 'application/octet-stream');
        decryptedBlob = new Blob([decryptedBuffer], { type: tipoMime });
      } else { decryptedBlob = blob; }
      objectUrl = URL.createObjectURL(decryptedBlob);
      cacheArchivosDescifrados[msg.archivo_url] = objectUrl;
    }
    container.setAttribute('data-loaded', 'true');
    if (msg.tipo_mensaje === 'imagen') container.innerHTML = '<img src="' + objectUrl + '" style="max-width: 100%; border-radius: 8px;" onclick="window.open(\'' + objectUrl + '\')">';
    else if (msg.tipo_mensaje === 'video') container.innerHTML = '<video controls style="max-width: 100%; border-radius: 8px;"><source src="' + objectUrl + '"></video>';
    else {
      var tamStr = msg.archivo_tamaño ? ' (' + formatBytes(msg.archivo_tamaño) + ')' : '';
      container.innerHTML = '<a href="' + objectUrl + '" download="' + (msg.archivo_nombre || 'archivo') + '" style="color: #00a884;">📎 ' + (msg.archivo_nombre || 'Descargar') + tamStr + '</a>';
    }
  } catch (err) {
    logError('❌ Error descifrando adjunto:', err);
    container.innerHTML = '<span style="color: #ef4444; font-size: 11px;">⚠️ No se pudo descifrar</span>';
  }
}

// ============================================
// BACKUP
// ============================================
async function exportarClave() {
  var password = await customPrompt('🔒 Exportar Llave', 'Contraseña para cifrar el respaldo (mín 4 caracteres):', '', 'password');
  if (!password || password.length < 4) { await customAlert('Mínimo 4 caracteres.'); return; }
  var codigo2FA = '';
  if (prefs.dosfa_backup) {
    codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    await customAlert('🔑 Tu código 2FA:\n' + codigo2FA + '\nGuárdalo.', '🔑');
  }
  try {
    var privBase64 = '';
    var claveGuardada = localStorage.getItem('clave_privada_' + miPIN);
    if (claveGuardada.includes('.')) {
      if (!pinActualTemporal) { await customAlert('Desbloquea primero.'); return; }
      privBase64 = await descifrarClaveConPIN(claveGuardada, pinActualTemporal);
    } else privBase64 = desofuscarClave(claveGuardada);
    var encoder = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoder.encode(privBase64 + '|' + codigo2FA));
    var backup = btoa(String.fromCharCode.apply(null, salt)) + '.' + btoa(String.fromCharCode.apply(null, iv)) + '.' + btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado)));
    await navigator.clipboard.writeText(backup);
    await customAlert('✅ Respaldo copiado.' + (prefs.dosfa_backup ? '\n2FA: ' + codigo2FA : ''), '✅');
    cerrarModalBackup();
  } catch (error) { await customAlert('Error: ' + error.message); }
}

async function importarClave() {
  var backup = await customPrompt('📥 Importar Llave', 'Pega el contenido cifrado del respaldo:');
  if (!backup) return;
  var password = await customPrompt('📥 Contraseña', 'Ingresa la contraseña del respaldo:', '', 'password');
  if (!password) return;
  try {
    var partes = backup.split('.');
    var salt = Uint8Array.from(atob(partes[0]), c => c.charCodeAt(0));
    var iv = Uint8Array.from(atob(partes[1]), c => c.charCodeAt(0));
    var cifrado = Uint8Array.from(atob(partes[2]), c => c.charCodeAt(0));
    var encoder = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var descifrado = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado));
    if (prefs.dosfa_backup) {
      var partesD = descifrado.split('|');
      if (partesD.length !== 2) throw new Error('Formato sin 2FA');
      var codigo = await customPrompt('🔐 2FA', 'Ingresa el código 2FA:');
      if (codigo !== partesD[1]) { await customAlert('❌ 2FA incorrecto.', '❌'); return; }
      descifrado = partesD[0];
    }
    var aGuardar = pinAccesoHash && pinActualTemporal ? await cifrarClaveConPIN(descifrado, pinActualTemporal) : ofuscarClave(descifrado);
    localStorage.setItem('clave_privada_' + miPIN, aGuardar);
    await customAlert('✅ Clave importada.', '✅');
    location.reload();
  } catch (error) { await customAlert('❌ Respaldo corrupto o contraseña incorrecta.', ''); }
}

async function generarBackupMensajes() {
  try {
    var contactos = getContactos();
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Kerix Backup - ' + miPIN + '</title></head><body style="background:#1a1a1a;color:#fff;padding:20px;">';
    html += '<h1>🔒 Backup</h1><p>PIN: <strong>' + miPIN + '</strong></p><p>Fecha: ' + new Date().toLocaleString('es-ES') + '</p><hr>';
    for (var pin of contactos) {
      var nombre = obtenerNombreContacto(pin);
      var { data: mensajes } = await clienteSupabase.from('mensajes').select('*').or('and(pin_remitente.eq.' + miPIN + ',pin_destinatario.eq.' + pin + '),and(pin_remitente.eq.' + pin + ',pin_destinatario.eq.' + miPIN + ')').order('enviado_en', { ascending: true });
      if (!mensajes || mensajes.length === 0) continue;
      html += '<h2>💬 ' + nombre + ' (' + pin + ')</h2>';
      for (var msg of mensajes) {
        var texto = '';
        try { if (msg.mensaje_cifrado) texto = await descifrarMensaje(msg.mensaje_cifrado); } catch (e) { texto = '[Ilegible]'; }
        var esMio = msg.pin_remitente === miPIN;
        html += '<div style="padding:8px;margin:6px 0;border-radius:8px;max-width:80%;background:' + (esMio ? '#00a884;color:#000;margin-left:auto;' : '#2a2a2a;color:#fff;') + '">' + escapeHtml(texto) + '</div>';
      }
    }
    html += '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'backup_kerix_' + miPIN + '_' + Date.now() + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await customAlert('✅ Backup descargado.', '✅');
  } catch (error) { await customAlert('❌ Error: ' + error.message, '❌'); }
}

async function backupClavePrivada() {
  try {
    var privBase64 = '';
    var claveGuardada = localStorage.getItem('clave_privada_' + miPIN);
    if (claveGuardada.includes('.')) {
      if (!pinActualTemporal) { await customAlert('Desbloquea primero.'); return; }
      privBase64 = await descifrarClaveConPIN(claveGuardada, pinActualTemporal);
    } else privBase64 = desofuscarClave(claveGuardada);
    var pubExp = await crypto.subtle.exportKey("spki", miClavePublica);
    var pubBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pubExp)));
    var html = '<!DOCTYPE html><html><body style="background:#1a1a1a;color:#fff;padding:20px;"><h1>🔑 Backup</h1><p style="color:#ef4444;">⚠️ TEXTO PLANO</p><h3>Privada:</h3><textarea readonly style="width:100%;height:200px;">' + privBase64 + '</textarea><h3>Pública:</h3><textarea readonly style="width:100%;height:200px;">' + pubBase64 + '</textarea></body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'claves_kerix_' + miPIN + '_' + Date.now() + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await customAlert('✅ Backup descargado.', '✅');
  } catch (error) { await customAlert('Error: ' + error.message); }
}

async function activarForwardSecrecy() {
  if (prefs.rotacion_claves_dias === 0) { await customAlert('⚠️ Activa primero "Rotación de claves".'); return; }
  var c = await customConfirm('⚠️ ALERTA\nLos mensajes antiguos quedarán ILEGIBLES.\n¿Activar?', '⚠️');
  if (!c) return;
  var b = await customConfirm('¿Hacer backup antes?', '📦');
  if (b) await generarBackupMensajes();
  prefs.forward_secrecy = true;
  await guardarPreferenciaBool('forward_secrecy', true);
  await generarClaves();
  localStorage.setItem('rotacion_claves_' + miPIN, Date.now());
  await customAlert('✅ Forward Secrecy activado.', '✅');
  actualizarStatusPreferencias();
}

async function desactivarForwardSecrecy() {
  var d = await customConfirm('¿Desactivar Forward Secrecy?', '🔐');
  if (!d) return;
  prefs.forward_secrecy = false;
  await guardarPreferenciaBool('forward_secrecy', false);
  await customAlert('✅ Desactivado.', '✅');
  actualizarStatusPreferencias();
}

console.log('🔐 Módulo crypto.js cargado correctamente');
