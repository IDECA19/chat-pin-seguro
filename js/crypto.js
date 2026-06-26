/**
 * js/crypto.js
 * Módulo Criptográfico Avanzado: AES-256-GCM + RSA-OAEP
 * * Correcciones:
 * - Eliminación exhaustiva de caracteres corruptos de escape (\n, \\n, \").
 * - Estructuración limpia de cifrado asimétrico híbrido de doble vía (historial legible para ambos).
 * - Exposición global limpia de métodos para el ciclo de vida de Kerix.
 */

function ofuscarClave(clave) { 
  if (!clave) return clave; 
  return btoa(clave.split('').reverse().join('')); 
}

function desofuscarClave(ofuscada) { 
  if (!ofuscada) return ofuscada; 
  return atob(ofuscada).split('').reverse().join(''); 
}

// Importador genérico de clave pública
async function importarClavePublica(pubBase64) {
  var binary = new Uint8Array(atob(pubBase64).split("").map(function(c) { 
    return c.charCodeAt(0); 
  }));
  return await crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// ============================================
// GENERACIÓN Y GESTIÓN DE CLAVES RSA
// ============================================
async function generarClaves() {
  try {
    var parClaves = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    miClavePrivada = parClaves.privateKey;
    miClavePublica = parClaves.publicKey;
    
    var pubExp = await crypto.subtle.exportKey("spki", miClavePublica);
    var pubBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pubExp)));
    
    var privExp = await crypto.subtle.exportKey("pkcs8", miClavePrivada);
    var privBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(privExp)));
    
    var idUsuario = typeof miPIN !== 'undefined' && miPIN ? miPIN : 'default';
    
    if (typeof pinActualTemporal !== 'undefined' && pinActualTemporal) {
      var privCifrada = await cifrarClaveConPIN(privBase64, pinActualTemporal);
      localStorage.setItem('clave_privada_' + idUsuario, privCifrada);
    } else {
      localStorage.setItem('clave_privada_' + idUsuario, ofuscarClave(privBase64));
    }
    
    if (typeof subirClavePublica === 'function') {
      await subirClavePublica(pubBase64);
    }
    
    console.log("✅ Par de llaves criptográficas generadas y resguardadas localmente.");
  } catch (error) {
    console.error("Error generando llaves:", error);
  }
}

// ============================================
// CIFRADO Y DESCIFRADO DE MENSAJES (E2EE)
// ============================================
async function cifrarMensajeE2EE(textoPlano, clavePublicaReceptorBase64) {
  var encoder = new TextEncoder();
  
  // 1. Generar Clave de Sesión Simétrica Efímera (AES-GCM 256 bits)
  var aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  // 2. Cifrar el texto plano con AES-GCM
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var mensajeCifradoBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encoder.encode(textoPlano)
  );
  
  // Exportar clave simétrica cruda
  var aesRawKey = await crypto.subtle.exportKey("raw", aesKey);
  
  // 3. Cifrar la clave AES para el Receptor con su RSA Pública
  var rsaReceptor = await importarClavePublica(clavePublicaReceptorBase64);
  var claveAesCifradaReceptorBuf = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaReceptor,
    aesRawKey
  );
  
  // 4. Cifrar la clave AES para el Emisor (Tú) con tu propia RSA Pública (Garantiza lectura en tu historial)
  var claveAesCifradaEmisorBuf = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    miClavePublica,
    aesRawKey
  );
  
  // Convertir estructuras buffers a Base64 legibles para transporte en payload
  return {
    iv: btoa(String.fromCharCode.apply(null, iv)),
    ciphertext: btoa(String.fromCharCode.apply(null, new Uint8Array(mensajeCifradoBuf))),
    key_receptor: btoa(String.fromCharCode.apply(null, new Uint8Array(claveAesCifradaReceptorBuf))),
    key_emisor: btoa(String.fromCharCode.apply(null, new Uint8Array(claveAesCifradaEmisorBuf)))
  };
}

async function descifrarMensajeE2EE(payloadCifrado, soyRemitente) {
  try {
    var iv = Uint8Array.from(atob(payloadCifrado.iv), function(c) { return c.charCodeAt(0); });
    var ciphertext = Uint8Array.from(atob(payloadCifrado.ciphertext), function(c) { return c.charCodeAt(0); });
    
    // Elegir el slot de clave AES simétrica empaquetada según quién intente descifrar
    var claveAesClaveBase64 = soyRemitente ? payloadCifrado.key_emisor : payloadCifrado.key_receptor;
    var aesCifradaBuf = Uint8Array.from(atob(claveAesClaveBase64), function(c) { return c.charCodeAt(0); });
    
    // Descifrar la clave de sesión simétrica con tu clave privada RSA
    var aesRawKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      miClavePrivada,
      aesCifradaBuf
    );
    
    // Importar la clave simétrica recuperada
    var aesKey = await crypto.subtle.importKey(
      "raw",
      aesRawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    
    // Descifrar el mensaje crudo final
    var textoPlanoBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      ciphertext
    );
    
    return new TextDecoder().decode(textoPlanoBuf);
  } catch (error) {
    console.error("Fallo crítico descifrando payload E2EE:", error);
    return "🚨 [Error: No se pudo descifrar el mensaje. Clave privada ausente o inválida]";
  }
}

// ============================================
// SISTEMA DE RESPALDO (BACKUP DE LLAVES)
// ============================================
async function generarBackupMensajes() {
  try {
    var idUsuario = typeof miPIN !== 'undefined' && miPIN ? miPIN : 'default';
    var privCifrada = localStorage.getItem('clave_privada_' + idUsuario);
    
    var pubExp = await crypto.subtle.exportKey("spki", miClavePublica);
    var pubBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pubExp)));
    
    var codRec = localStorage.getItem('codigo_recuperacion_hash_' + idUsuario) || '';
    
    var backup = {
      pub: pubBase64,
      priv: privCifrada,
      rec: codRec
    };
    
    var j = JSON.stringify(backup);
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Backup Kerix</title></head>'
      + '<body style="font-family:monospace; background:#0b141a; color:#e9edef; padding:40px;">'
      + '<h2>🔑 COPIA DE SEGURIDAD PRIVADA DE KERIX</h2>'
      + '<p style="color:#8696a0;">Guarda este archivo en un lugar sumamente seguro. Contiene tus claves criptográficas cifradas.</p>'
      + '<textarea style="width:100%; height:150px; background:#111b21; color:#00a884; border:1px solid #222e35; border-radius:8px; padding:15px;" readonly>' 
      + btoa(unescape(encodeURIComponent(j))) + '</textarea></body></html>';
      
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'claves_kerix_' + idUsuario + '_' + Date.now() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("📦 Backup generado de forma exitosa.");
  } catch (error) {
    console.error("Error generando copia de seguridad:", error);
  }
}

// ============================================
// 🌍 EXPOSICIÓN GLOBAL
// ============================================
window.ofuscarClave = ofuscarClave;
window.desofuscarClave = desofuscarClave;
window.importarClavePublica = importarClavePublica;
window.generarClaves = generarClaves;
window.cifrarMensajeE2EE = cifrarMensajeE2EE;
window.descifrarMensajeE2EE = descifrarMensajeE2EE;
window.generarBackupMensajes = generarBackupMensajes;

console.log('🔑 Módulo criptográfico (crypto.js) saneado y acoplado globalmente.');
