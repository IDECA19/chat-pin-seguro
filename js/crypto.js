/**
 * js/crypto.js
 * Motor criptográfico unificado: AES-256-GCM y RSA-OAEP (SHA-256).
 * Saneamiento estricto de estructuras PEM para prevenir OperationError en WebCrypto API.
 */

function base64ToArrayBuffer(base64) {
  var binaryString = window.atob(base64.trim());
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

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
 * Cifra un texto plano utilizando un modelo híbrido: AES-GCM para el contenido,
 * y envuelve la clave AES resultante usando la clave pública RSA del receptor.
 */
async function cifrarMensajeE2EE(textoPlano, clavePublicaPem) {
  try {
    var encoder = new TextEncoder();
    var dataText = encoder.encode(textoPlano);

    // 1. Generar clave simétrica temporal AES-GCM de 256 bits
    var aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. Generar Vector de Inicialización (IV) único de 12 bytes
    var iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 3. Cifrar texto plano con AES-GCM
    var ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      dataText
    );

    // 4. Exportar la clave AES cruda
    var rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 5. Normalizar e Importar clave pública RSA del destinatario
    var pemContents = clavePublicaPem
      .replace(/-----BEGIN PUBLIC KEY-----/, "")
      .replace(/-----END PUBLIC KEY-----/, "")
      .replace(/[\r\n\s]+/g, ""); // Limpieza total de saltos de línea y espacios
    
    var publicKeyBuffer = base64ToArrayBuffer(pemContents);
    var rtcPublicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    // 6. Envolver clave AES con RSA pública
    var encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      rtcPublicKey,
      rawAesKey
    );

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
 * Descifra un payload híbrido utilizando la clave privada RSA local del dispositivo.
 */
async function descifrarMensajeE2EE(payloadCifrado) {
  try {
    if (!payloadCifrado || !payloadCifrado.ciphertext || !payloadCifrado.iv || !payloadCifrado.wrappedKey) {
      return "";
    }

    var miPinActual = typeof miPIN !== 'undefined' && miPIN ? miPIN : localStorage.getItem('kerix_mi_pin');
    var miClavePrivadaPem = localStorage.getItem("clave_privada_" + miPinActual);
    if (!miClavePrivadaPem) {
      throw new Error("Clave privada local ausente en el almacenamiento.");
    }

    // Normalizar e Importar la clave privada local
    var pemContents = miClavePrivadaPem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/[\r\n\s]+/g, ""); // Limpieza total para prevenir OperationError

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

    // Importar la clave AES resultante
    var aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedKeyBuffer,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );

    var ivBuffer = base64ToArrayBuffer(payloadCifrado.iv);
    var ciphertextBuffer = base64ToArrayBuffer(payloadCifrado.ciphertext);

    // Descifrar contenido final
    var decryptedTextBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      ciphertextBuffer
    );

    var decoder = new TextDecoder();
    return decoder.decode(decryptedTextBuffer);
  } catch (err) {
    console.error("❌ Error en el proceso de descifrado simétrico/asimétrico:", err);
    throw err;
  }
}

console.log("🔑 Módulo criptográfico (crypto.js) unificado y acoplado globalmente con blindaje híbrido.");
window.cifrarMensajeE2EE = cifrarMensajeE2EE;
window.descifrarMensajeE2EE = descifrarMensajeE2EE;
