// services/baileysService.js - Conexión WhatsApp vía Baileys (WhatsApp Web)
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '..', 'baileys_auth');

// Estado global del cliente Baileys
let sock = null;
let currentQR = null;
let connectionStatus = 'disconnected'; // disconnected | connecting | connected
let statusMessage = '';
let reconnectAttempts = 0;
let isReady = false; // Solo true después de que la conexión esté totalmente lista
let connectedPhone = null; // Número de teléfono conectado
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Obtener el estado actual de la conexión Baileys
 */
function getStatus() {
    return {
        status: connectionStatus,
        qr: currentQR,
        message: statusMessage,
        phone: connectedPhone,
    };
}

function getSock() {
    return sock;
}

/**
 * Iniciar la conexión Baileys y generar el QR
 */
async function connect() {
    // Si ya está conectado, no hacer nada
    if (connectionStatus === 'connected' && sock) {
        return { status: 'connected', message: 'Ya conectado a WhatsApp' };
    }

    // Desconectar si hay sesión previa
    if (sock) {
        try { sock.end(); } catch (e) { /* ignore */ }
        sock = null;
    }

    connectionStatus = 'connecting';
    currentQR = null;
    statusMessage = 'Iniciando conexión...';

    try {
        // Crear directorio de auth si no existe
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['FALC Logística', 'Chrome', '120.0'],
            defaultQueryTimeoutMs: 60000,
        });

        // Evento: actualización de credenciales
        sock.ev.on('creds.update', saveCreds);

        // Evento: actualización de conexión
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Generar QR como imagen base64
                try {
                    currentQR = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                    connectionStatus = 'connecting';
                    statusMessage = 'Escanea el código QR con WhatsApp';
                    console.log('📱 QR generado para escanear');
                } catch (err) {
                    console.error('Error generando QR:', err);
                }
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                currentQR = null;
                sock = null;
                isReady = false;
                connectedPhone = null;

                if (reason === DisconnectReason.loggedOut) {
                    connectionStatus = 'disconnected';
                    statusMessage =
                        'Sesión cerrada. Escanee el QR nuevamente para reconectar.';
                    console.log('⚠ Baileys desconectado: sesión cerrada (loggedOut)');
                    // Limpiar datos de autenticación
                    const { rmSync } = require('fs');
                    try {
                        rmSync('./baileys_auth', { recursive: true, force: true });
                    } catch (e) {
                        /* ignorar */
                    }
                } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(reconnectAttempts * 2000, 10000);
                    connectionStatus = 'connecting';
                    statusMessage = `Reconectando automáticamente (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
                    console.log(
                        `🔄 Reconectando Baileys (intento ${reconnectAttempts}, razón: ${reason})...`
                    );
                    setTimeout(() => connect(), delay);
                } else {
                    connectionStatus = 'disconnected';
                    statusMessage = `Desconectado tras ${MAX_RECONNECT_ATTEMPTS} intentos. Intente conectar manualmente.`;
                    console.log('✗ Baileys: máximo de reconexiones alcanzado');
                }
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                currentQR = null;
                reconnectAttempts = 0;
                connectedPhone = sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
                statusMessage = `Conectado exitosamente a WhatsApp${connectedPhone ? ` (+${connectedPhone})` : ''}`;
                console.log(`✅ Baileys conectado a WhatsApp${connectedPhone ? ` como +${connectedPhone}` : ''}`);

                // Esperar a que termine el history sync antes de habilitar el bot
                setTimeout(() => {
                    isReady = true;
                    console.log('✅ Bot Baileys listo para recibir mensajes');
                }, 8000);
            }
        });

        // Evento: mensajes entrantes — conectar con el bot conversacional
        sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
            // Solo procesar notificaciones (mensajes nuevos reales)
            if (type !== 'notify') return;

            // No procesar hasta que la conexión esté totalmente lista
            if (!isReady) {
                return;
            }

            for (const msg of msgs) {
                // Ignorar mensajes propios, de status y de grupos
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue;
                if (msg.key.remoteJid?.endsWith('@g.us')) continue;

                // Ignorar mensajes antiguos (más de 60 segundos)
                const msgTimestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : parseInt(msg.messageTimestamp))
                    : 0;
                const ahora = Math.floor(Date.now() / 1000);
                if (msgTimestamp > 0 && (ahora - msgTimestamp) > 60) {
                    console.log(`⏭ Mensaje antiguo ignorado (${ahora - msgTimestamp}s) de ${msg.key.remoteJid}`);
                    continue;
                }

                // Extraer texto del mensaje
                const texto = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || '';

                if (!texto.trim()) continue;

                const remoteJid = msg.key.remoteJid;

                // Extraer teléfono para log (quitar @s.whatsapp.net o @lid)
                const telefonoLid = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');

                // Si es un LID y Baileys nos da el número real en remoteJidAlt, usar ese como identificador principal
                let telefonoReal = telefonoLid;
                if (msg.key.remoteJidAlt) {
                    telefonoReal = msg.key.remoteJidAlt.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
                }

                console.log(`📩 Mensaje de ${telefonoReal} (LID: ${telefonoLid}): ${texto.substring(0, 50)}...`);

                try {
                    const baileysBot = require('./baileysBot');
                    const pool = require('../database/connection');

                    // Registrar mensaje entrante
                    try {
                        await pool.query(
                            `INSERT INTO mensajes_log (telefono, direccion, contenido, tipo_mensaje) VALUES (?, 'entrante', ?, 'text')`,
                            [telefonoReal, texto]
                        );
                    } catch (logErr) { console.error('Error log entrante:', logErr.message); }

                    // Si el agente está pausado para este teléfono, no procesar
                    if (baileysBot.esAgentePausado(telefonoReal)) {
                        console.log(`⏸️ Agente pausado para ${telefonoReal}, mensaje no procesado por bot`);
                        continue;
                    }

                    // Pasar el teléfono real, el texto, el JID remoto y el LID para actualización
                    await baileysBot.procesarMensaje(telefonoReal, texto, remoteJid, async (jid, text) => {
                        if (sock && connectionStatus === 'connected') {
                            try {
                                await sock.sendMessage(jid, { text });
                                // Registrar mensaje saliente del bot
                                try {
                                    await pool.query(
                                        `INSERT INTO mensajes_log (telefono, direccion, contenido, tipo_mensaje, contexto) VALUES (?, 'saliente', ?, 'text', 'bot')`,
                                        [telefonoReal, text]
                                    );
                                } catch (logErr) { console.error('Error log saliente:', logErr.message); }
                            } catch (sendErr) {
                                console.error(`Error enviando mensaje a ${jid}:`, sendErr.message);
                                await new Promise(r => setTimeout(r, 2000));
                                try {
                                    if (sock && connectionStatus === 'connected') {
                                        await sock.sendMessage(jid, { text });
                                        try {
                                            await pool.query(
                                                `INSERT INTO mensajes_log (telefono, direccion, contenido, tipo_mensaje, contexto) VALUES (?, 'saliente', ?, 'text', 'bot')`,
                                                [telefonoReal, text]
                                            );
                                        } catch (logErr) { /* ignore */ }
                                    }
                                } catch (retryErr) {
                                    console.error(`Reintento fallido a ${jid}:`, retryErr.message);
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.error('Error procesando mensaje en bot:', err.message);
                }
            }
        });

        // Esperar un poco para que se genere el QR
        await new Promise((resolve) => setTimeout(resolve, 3000));

        return getStatus();
    } catch (error) {
        connectionStatus = 'disconnected';
        statusMessage = `Error: ${error.message}`;
        console.error('Error conectando Baileys:', error);
        return getStatus();
    }
}

/**
 * Desconectar Baileys
 */
async function disconnect() {
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {
            try { sock.end(); } catch (e2) { /* ignore */ }
        }
        sock = null;
    }

    // Limpiar auth data
    if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }

    connectionStatus = 'disconnected';
    currentQR = null;
    connectedPhone = null;
    statusMessage = 'Desconectado';

    return getStatus();
}

/**
 * Enviar mensaje de texto vía Baileys
 */
async function sendMessage(to, text) {
    if (!sock || connectionStatus !== 'connected') {
        throw new Error('Baileys no está conectado');
    }
    // Formatear número: asegurar que tenga @s.whatsapp.net o @lid
    let jid = to;
    if (!jid.includes('@')) {
        jid = jid.length >= 15 ? `${jid}@lid` : `${jid}@s.whatsapp.net`;
    }
    return await sock.sendMessage(jid, { text });
}

module.exports = {
    getStatus,
    getSock,
    connect,
    disconnect,
    sendMessage,
};

// Auto-conectar si ya existe sesión previa (después de restart de PM2)
if (fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0) {
    console.log('🔄 Auto-conectando Baileys (sesión previa encontrada)...');
    setTimeout(() => {
        connect().catch(err => {
            console.error('Error en auto-conexión Baileys:', err.message);
        });
    }, 3000); // Esperar 3s a que el servidor esté listo
}
