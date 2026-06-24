/**
 * js/crypto.js
 * Funciones de cifrado/descifrado E2EE
 */

var miClavePrivada = null;
var miClavePublica = null;

async function obtenerClavePublica(pin) {
  try {
    var { data } = await clienteSupabase.from('usuarios')
      .select('clave_publica')
      .eq('pin', pin)
      .single();
    
    if (!data || !data.clave_publica) return null;
    
    var buf = Uint8Array.from(atob(data.clave_publica), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      "spki", 
      buf, 
      { name: "RSA-OAEP", hash: "SHA-256" }, 
      true, 
      ["encrypt"]
    );
  } catch (error) { 
    console.error('Error obteniendo clave pública:', error);
    return null; 
  }
}

async function generarClaveAES() { 
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, 
    true, 
    ["encrypt", "decrypt"]
  ); 
}

async function cifrarConAES(texto, claveAES) {
  var encoder = new TextEncoder();
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, 
    claveAES, 
    encoder.encode(texto)
  );
  return { 
    iv: btoa(String.fromCharCode.apply(null, iv)), 
    datos: btoa(String.fromCharCode.apply(null, new Uint8Array(cifrado))) 
  };
}

async function descifrarConAES(ivBase64, datosBase64, claveAES) {
  var iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  var datos = Uint8Array.from(atob(datosBase64), c => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, claveAES, datos)
  );
}

async function exportarClaveAES(clave) { 
  return btoa(String.fromCharCode.apply(null, new Uint8Array(
    await crypto.subtle.exportKey("raw", clave)
  ))); 
}

async function importarClaveAES(base64) { 
  return await crypto.subtle.importKey(
    "raw", 
    Uint8Array.from(atob(base64), c => c.charCodeAt(0)), 
    { name: "AES-GCM" }, 
    true, 
    ["encrypt", "decrypt"]
  ); 
}

async function cifrarClaveConRSA(claveAESBase64, clavePublicaRSA) {
  var encoder = new TextEncoder();
  return btoa(String.fromCharCode.apply(null, new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "RSA-OAEP" }, 
      clavePublicaRSA, 
      encoder.encode(claveAESBase64)
    )
  )));
}

async function descifrarClaveConRSA(claveCifradaBase64, clavePrivadaRSA) {
  var cifrado = Uint8Array.from(atob(claveCifradaBase64), c => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "RSA-OAEP" }, clavePrivadaRSA, cifrado)
  );
}

async function cifrarMensaje(texto, clavePublicaDestinatario) {
  var claveAES = await generarClaveAES();
  var claveAESBase64 = await exportarClaveAES(claveAES);
  var { iv, datos } = await cifrarConAES(texto, claveAES);
  
  return iv + '|' + datos + '|' + 
         await cifrarClaveConRSA(claveAESBase64, clavePublicaDestinatario) + '|' + 
         await cifrarClaveConRSA(claveAESBase64, miClavePublica);
}

async function descifrarMensaje(cifradoBase64) {
  if (!cifradoBase64 || cifradoBase64.length === 0) return '';
  if (!cifradoBase64.includes('|')) return cifradoBase64;
  
  try {
    var partes = cifradoBase64.split('|');
    if (partes.length !== 4) return '[Mensaje corrupto]';
    
    var claveAESBase64 = null;
    try { 
      claveAESBase64 = await descifrarClaveConRSA(partes[2], miClavePrivada); 
    } catch (e) { 
      try { 
        claveAESBase64 = await descifrarClaveConRSA(partes[3], miClavePrivada); 
      } catch (e2) { 
        return '[No se puede descifrar]'; 
      } 
    }
    
    return await descifrarConAES(partes[0], partes[1], await importarClaveAES(claveAESBase64));
  } catch (error) { 
    console.error('Error descifrando:', error);
    return '[Error de descifrado]'; 
  }
}
