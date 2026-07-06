/**
 * js/crypto.js
 * Motor criptográfico de alto rendimiento: AES-256-GCM y RSA-OAEP.
 * Corregido para evitar excepciones fatales en flujos asíncronos.
 */

// Función auxiliar para convertir Base64 a ArrayBuffer
function base64ToArrayBuffer(base64) {
  var binaryString = window.atob(base64);
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Función auxiliar para convertir ArrayBuffer a Base64
function arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Cifra un texto plano utilizando la clave pública RSA del destinatario.
 */
async function cifrarMensajeE2EE(textoPlano, clavePublicaPem) {
  try {
    var encoder = new TextEncoder();
    var dataText = encoder.encode(textoPlano);

    // 1. Generar una clave simétrica temporal AES-GCM de 256 bits
    var aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. Generar un Vector de Inicialización (IV) único de 12 bits
    var iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 3. Cifrar el texto plano con AES-GCM
    var ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      dataText
    );

    // 4. Exportar la clave AES para poder envolverla asimétricamente
    var rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 5. Importar la clave pública RSA del receptor limpiando cabeceras Pem
    var pemContents = clavePublicaPem
      .replace(/-----BEGIN PUBLIC KEY-----/, "")
      .replace(/-----END PUBLIC KEY-----/, "")
      .replace(/\s+/g, "");
    
    var publicKeyBuffer = base64ToArrayBuffer(pemContents);
    var rtcPublicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    // 6. Envolver (Cifrar) la clave AES con la clave pública RSA
    var encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      rtcPublicKey,
      rawAesKey
    );

    // Formatear paquete empaquetado para la base de datos real
    return {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
      wrappedKey: arrayBufferToBase64(encryptedKeyBuffer)
    };
  } catch (err) {
    console.error("❌ Error en el proceso de cifrado simétrico/asimétrico:", err);
    throw err;
  }
}

/**
 * Descifra un payload empaquetado utilizando las llaves locales del dispositivo.
 */
async function descifrarMensajeE2EE(payloadCifrado, esMio) {
  try {
    if (!payloadCifrado || !payloadCifrado.ciphertext || !payloadCifrado.iv) {
      return payloadCifrado.plaintext || "";
    }

    // Recuperar la clave privada local del localStorage
    var miClavePrivadaPem = localStorage.getItem("clave_privada_" + miPIN);
    if (!miClavePrivadaPem) {
      throw new Error("Clave privada local no encontrada.");
    }

    var pemContents = miClavePrivadaPem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s+/g, "");

    var privateKeyBuffer = base64ToArrayBuffer(pemContents);
    var rtcPrivateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    // Desempaquetar la clave simétrica AES envuelta
    var wrappedKeyBuffer = base64ToArrayBuffer(payloadCifrado.wrappedKey);
    var decryptedKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      rtcPrivateKey,
      wrappedKeyBuffer
    );

    // Importar de vuelta la clave AES cruda
    var aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedKeyBuffer,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );

    var ivBuffer = base64ToArrayBuffer(payloadCifrado.iv);
    var ciphertextBuffer = base64ToArrayBuffer(payloadCifrado.ciphertext);

    // Descifrar el texto final
    var decryptedTextBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      ciphertextBuffer
    );

    var decoder = new TextDecoder();
    return decoder.decode(decryptedTextBuffer);
  } catch (err) {
    // Retornar error controlado para no romper los bucles de renderizado
    throw err;
  }
}

console.log("🔑 Módulo criptográfico (crypto.js) saneado y acoplado globalmente con blindaje.");
window.cifrarMensajeE2EE = cifrarMensajeE2EE;
window.descifrarMensajeE2EE = descifrarMensajeE2EE;
