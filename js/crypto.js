/**
 * js/crypto.js
 * Motor criptográfico de alta seguridad: AES-256-GCM y RSA-OAEP (SHA-256).
 * Restaurado al 100% según el modelo asimétrico híbrido original del proyecto unificado.
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
 * Cifra un texto plano usando AES-GCM y genera una doble envoltura RSA:
 * una con la clave pública del receptor y otra con la clave pública del emisor.
 */
async function cifrarMensajeE2EE(textoPlano, clavePublicaReceptorPem, clavePublicaEmisorPem) {
  try {
    var encoder = new TextEncoder();
    var dataText = encoder.encode(textoPlano);

    // 1. Generar la clave simétrica única AES-GCM
    var aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. Generar el Vector de Inicialización (IV)
    var iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 3. Cifrar el contenido del mensaje
    var ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      dataText
    );

    var rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 4. Envoltura para el RECEPTOR
    var cleanRec = clavePublicaReceptorPem.replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/[\r\n\s]+/g, "");
    var recBuffer = base64ToArrayBuffer(cleanRec);
    var rtcRecKey = await window.crypto.subtle.importKey("spki", recBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    var wrappedKeyReceptor = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rtcRecKey, rawAesKey);

    // 5. Envoltura para el EMISOR (Tú mismo)
    var cleanEmi = clavePublicaEmisorPem.replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/[\r\n\s]+/g, "");
    var emiBuffer = base64ToArrayBuffer(cleanEmi);
    var rtcEmiKey = await window.crypto.subtle.importKey("spki", emiBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    var wrappedKeyEmisor = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rtcEmiKey, rawAesKey);

    return {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
      wrappedKeyReceptor: arrayBufferToBase64(wrappedKeyReceptor),
      wrappedKeyEmisor: arrayBufferToBase64(wrappedKeyEmisor)
    };
  } catch (err) {
    console.error("❌ Error en el motor de cifrado híbrido dual:", err);
    throw err;
  }
}

/**
 * Descifra el payload empaquetado utilizando la clave privada local RSA.
 */
async function descifrarMensajeE2EE(payloadCifrado, claveAESEnvueltaB64) {
  try {
    if (!payloadCifrado || !payloadCifrado.ciphertext || !payloadCifrado.iv || !claveAESEnvueltaB64) {
      return "";
    }

    var miPinActual = typeof miPIN !== 'undefined' && miPIN ? miPIN : localStorage.getItem('kerix_mi_pin');
    var miClavePrivadaPem = localStorage.getItem("clave_privada_" + miPinActual);
    if (!miClavePrivadaPem) throw new Error("Clave privada local no encontrada.");

    var pemContents = miClavePrivadaPem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/[\r\n\s]+/g, "");
    var privateKeyBuffer = base64ToArrayBuffer(pemContents);
    var rtcPrivateKey = await window.crypto.subtle.importKey("pkcs8", privateKeyBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);

    var wrappedKeyBuffer = base64ToArrayBuffer(claveAESEnvueltaB64);
    var decryptedKeyBuffer = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, rtcPrivateKey, wrappedKeyBuffer);

    var aesKey = await window.crypto.subtle.importKey("raw", decryptedKeyBuffer, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);

    var ivBuffer = base64ToArrayBuffer(payloadCifrado.iv);
    var ciphertextBuffer = base64ToArrayBuffer(payloadCifrado.ciphertext);

    var decryptedTextBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, aesKey, ciphertextBuffer);

    return new TextDecoder().decode(decryptedTextBuffer);
  } catch (err) {
    throw err;
  }
}

console.log("🔑 Módulo criptográfico (crypto.js) unificado y acoplado con blindaje dual (Remitente/Destinatario).");
window.cifrarMensajeE2EE = cifrarMensajeE2EE;
window.descifrarMensajeE2EE = descifrarMensajeE2EE;
