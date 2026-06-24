/**
 * security.js
 * Módulo de seguridad: SRI, retry logic, rate limiting, validación
 * 
 * Depende de: (ninguna dependencia interna, es módulo base)
 * Cargar antes de: supabase-client.js, app.js
 */

// ============================================
// 🔄 RETRY LOGIC (Reintentos automáticos)
// ============================================
var RETRY_CONFIG = {
    maxRetries: 3,          // Máximo de reintentos
    baseDelay: 1000,        // Delay base en ms (1 segundo)
    maxDelay: 10000,        // Delay máximo en ms (10 segundos)
    backoffFactor: 2        // Factor de incremento exponencial
};

/**
 * Ejecuta una función async con reintentos automáticos
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Configuración de reintentos
 * @returns {Promise} Resultado de la función
 */
async function ejecutarConReintentos(fn, options = {}) {
    var config = {
        maxRetries: options.maxRetries || RETRY_CONFIG.maxRetries,
        baseDelay: options.baseDelay || RETRY_CONFIG.baseDelay,
        maxDelay: options.maxDelay || RETRY_CONFIG.maxDelay,
        backoffFactor: options.backoffFactor || RETRY_CONFIG.backoffFactor,
        onRetry: options.onRetry || null
    };

    var ultimoError = null;

    for (var intento = 0; intento <= config.maxRetries; intento++) {
        try {
            return await fn();
        } catch (error) {
            ultimoError = error;

            // No reintentar si es un error de autenticación o permisos
            if (error && error.status) {
                if (error.status === 401 || error.status === 403) {
                    console.error('❌ Error de autenticación, no se reintenta:', error.message);
                    throw error;
                }
            }

            // Si es el último intento, lanzar error
            if (intento === config.maxRetries) {
                console.error('❌ Todos los reintentos fallaron (' + config.maxRetries + '):', error.message);
                throw error;
            }

            // Calcular delay con backoff exponencial + jitter aleatorio
            var delay = Math.min(
                config.baseDelay * Math.pow(config.backoffFactor, intento),
                config.maxDelay
            );
            var jitter = Math.random() * 500; // 0-500ms aleatorios
            var delayTotal = delay + jitter;

            console.warn('⚠️ Intento ' + (intento + 1) + ' falló. Reintentando en ' + Math.round(delayTotal) + 'ms...', error.message);

            // Callback de notificación de reintento
            if (config.onRetry) {
                config.onRetry(intento + 1, config.maxRetries, delayTotal, error);
            }

            // Esperar antes de reintentar
            await new Promise(function(resolve) { setTimeout(resolve, delayTotal); });
        }
    }

    throw ultimoError;
}


// ============================================
// 🛡️ RATE LIMITING (Limitador de peticiones)
// ============================================
var rateLimiters = {};

/**
 * Crea o verifica un limitador de velocidad
 * @param {string} clave - Identificador del limitador
 * @param {number} maxPeticiones - Máximo de peticiones permitidas
 * @param {number} ventanaMs - Ventana de tiempo en ms
 * @returns {boolean} true si está permitido, false si está limitado
 */
function verificarRateLimit(clave, maxPeticiones, ventanaMs) {
    var ahora = Date.now();

    if (!rateLimiters[clave]) {
        rateLimiters[clave] = { peticiones: [], ventana: ventanaMs };
    }

    var limiter = rateLimiters[clave];

    // Limpiar peticiones fuera de la ventana
    limiter.peticiones = limiter.peticiones.filter(function(t) {
        return ahora - t < ventanaMs;
    });

    // Verificar si excede el límite
    if (limiter.peticiones.length >= maxPeticiones) {
        console.warn('⏱️ Rate limit excedido para: ' + clave);
        return false;
    }

    // Registrar petición
    limiter.peticiones.push(ahora);
    return true;
}

/**
 * Rate limiter para envío de mensajes
 * Máximo: 10 mensajes por minuto
 */
function puedeEnviarMensaje() {
    return verificarRateLimit('mensajes', 10, 60000);
}

/**
 * Rate limiter para búsquedas
 * Máximo: 30 búsquedas por minuto
 */
function puedeBuscar() {
    return verificarRateLimit('busquedas', 30, 60000);
}

/**
 * Rate limiter para llamadas
 * Máximo: 5 llamadas por minuto
 */
function puedeLlamar() {
    return verificarRateLimit('llamadas', 5, 60000);
}


// ============================================
// ✅ VALIDACIÓN DE INPUTS
// ============================================

/**
 * Valida que un PIN tenga formato correcto (8 caracteres hexadecimales)
 * @param {string} pin - PIN a validar
 * @returns {Object} { valido: boolean, error: string }
 */
function validarPIN(pin) {
    if (!pin || typeof pin !== 'string') {
        return { valido: false, error: 'El PIN es requerido' };
    }
    pin = pin.trim().toUpperCase();
    if (pin.length !== 8) {
        return { valido: false, error: 'El PIN debe tener exactamente 8 caracteres' };
    }
    if (!/^[0-9A-F]{8}$/.test(pin)) {
        return { valido: false, error: 'El PIN solo puede contener caracteres hexadecimales (0-9, A-F)' };
    }
    return { valido: true, error: null, valor: pin };
}

/**
 * Valida que un PIN de acceso tenga formato correcto (4-6 dígitos)
 * @param {string} pin - PIN de acceso a validar
 * @returns {Object} { valido: boolean, error: string }
 */
function validarPINAcceso(pin) {
    if (!pin || typeof pin !== 'string') {
        return { valido: false, error: 'El PIN de acceso es requerido' };
    }
    pin = pin.trim();
    if (pin.length < 4 || pin.length > 6) {
        return { valido: false, error: 'El PIN de acceso debe tener entre 4 y 6 dígitos' };
    }
    if (!/^\d+$/.test(pin)) {
        return { valido: false, error: 'El PIN de acceso solo puede contener números' };
    }
    return { valido: true, error: null, valor: pin };
}

/**
 * Valida y sanitiza texto de mensaje
 * @param {string} texto - Texto a validar
 * @param {number} maxLongitud - Longitud máxima permitida
 * @returns {Object} { valido: boolean, error: string, valor: string }
 */
function validarMensaje(texto, maxLongitud) {
    maxLongitud = maxLongitud || 5000;
    if (!texto || typeof texto !== 'string') {
        return { valido: false, error: 'El mensaje es requerido' };
    }
    texto = texto.trim();
    if (texto.length === 0) {
        return { valido: false, error: 'El mensaje no puede estar vacío' };
    }
    if (texto.length > maxLongitud) {
        return { valido: false, error: 'El mensaje excede la longitud máxima de ' + maxLongitud + ' caracteres' };
    }
    return { valido: true, error: null, valor: texto };
}

/**
 * Valida tamaño de archivo
 * @param {File} archivo - Archivo a validar
 * @param {number} maxBytes - Tamaño máximo en bytes
 * @returns {Object} { valido: boolean, error: string }
 */
function validarArchivo(archivo, maxBytes) {
    maxBytes = maxBytes || (50 * 1024 * 1024); // 50MB por defecto
    if (!archivo) {
        return { valido: false, error: 'No se seleccionó ningún archivo' };
    }
    if (archivo.size > maxBytes) {
        var maxMB = Math.round(maxBytes / (1024 * 1024));
        return { valido: false, error: 'El archivo excede el tamaño máximo de ' + maxMB + ' MB' };
    }
    if (archivo.size === 0) {
        return { valido: false, error: 'El archivo está vacío' };
    }
    return { valido: true, error: null };
}

/**
 * Valida que una URL sea segura (no javascript:, data:, etc.)
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
function esURLSegura(url) {
    if (!url || typeof url !== 'string') return false;
    var protocolo = url.split(':')[0].toLowerCase().trim();
    var protocolosPermitidos = ['http', 'https', 'blob'];
    return protocolosPermitidos.indexOf(protocolo) !== -1;
}

/**
 * Sanitiza un nombre de archivo para evitar path traversal
 * @param {string} nombre - Nombre de archivo
 * @returns {string} Nombre sanitizado
 */
function sanitizarNombreArchivo(nombre) {
    if (!nombre || typeof nombre !== 'string') return 'archivo';
    // Eliminar caracteres peligrosos
    return nombre.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F]/g, '_').substring(0, 255);
}


// ============================================
// 🔐 VERIFICACIÓN DE INTEGRIDAD
// ============================================

/**
 * Genera un hash SHA-256 de un texto
 * @param {string} texto - Texto a hashear
 * @returns {Promise<string>} Hash en hex
 */
async function generarHash(texto) {
    var encoder = new TextEncoder();
    var data = encoder.encode(texto);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
}

/**
 * Genera un nonce aleatorio seguro
 * @param {number} longitud - Longitud en bytes
 * @returns {string} Nonce en base64
 */
function generarNonce(longitud) {
    longitud = longitud || 32;
    var bytes = crypto.getRandomValues(new Uint8Array(longitud));
    return btoa(String.fromCharCode.apply(null, bytes));
}

/**
 * Compara dos strings en tiempo constante (previene timing attacks)
 * @param {string} a - Primer string
 * @param {string} b - Segundo string
 * @returns {boolean}
 */
function comparacionSegura(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var resultado = 0;
    for (var i = 0; i < a.length; i++) {
        resultado |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return resultado === 0;
}

console.log('🛡️ Módulo security.js cargado correctamente');
