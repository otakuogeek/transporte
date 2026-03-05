// services/baileysService.js - Conexión WhatsApp vía Baileys (multi-sesión)
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '..', 'baileys_auth');
const AUTH_SESSIONS_DIR = path.join(AUTH_DIR, 'sessions');
const MAX_RECONNECT_ATTEMPTS = 5;

const sessions = new Map();

function createSessionState(sessionId) {
    return {
        sessionId,
        sock: null,
        currentQR: null,
        connectionStatus: 'disconnected',
        statusMessage: '',
        reconnectAttempts: 0,
        isReady: false,
        connectedPhone: null,
    };
}

function ensureSessionState(sessionId = 'default') {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, createSessionState(sessionId));
    }
    return sessions.get(sessionId);
}

function getLegacyDefaultAuthDir() {
    const hasLegacyFiles = fs.existsSync(AUTH_DIR)
        && fs.readdirSync(AUTH_DIR).some((f) => f !== 'sessions');
    return hasLegacyFiles ? AUTH_DIR : null;
}

function getAuthDir(sessionId = 'default') {
    if (sessionId === 'default') {
        const legacyDir = getLegacyDefaultAuthDir();
        if (legacyDir) return legacyDir;
    }
    return path.join(AUTH_SESSIONS_DIR, sessionId);
}

function ensureAuthDir(sessionId = 'default') {
    const authDir = getAuthDir(sessionId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    return authDir;
}

function clearAuthDir(sessionId = 'default') {
    const authDir = getAuthDir(sessionId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }
}

function getStatus(sessionId = 'default') {
    const state = ensureSessionState(sessionId);
    return {
        session_id: sessionId,
        status: state.connectionStatus,
        qr: state.currentQR,
        message: state.statusMessage,
        phone: state.connectedPhone,
    };
}

function getAllStatuses() {
    return Array.from(sessions.keys()).map((sessionId) => getStatus(sessionId));
}

function getSock(sessionId = 'default') {
    return ensureSessionState(sessionId).sock;
}

async function connect(sessionId = 'default') {
    const state = ensureSessionState(sessionId);

    if (state.connectionStatus === 'connected' && state.sock) {
        return { ...getStatus(sessionId), message: 'Ya conectado a WhatsApp' };
    }

    if (state.sock) {
        try { state.sock.end(); } catch (e) { /* ignore */ }
        state.sock = null;
    }

    state.connectionStatus = 'connecting';
    state.currentQR = null;
    state.statusMessage = 'Iniciando conexión...';
    state.isReady = false;

    try {
        ensureAuthDir(sessionId);

        const authDir = getAuthDir(sessionId);
        const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: authState,
            printQRInTerminal: false,
            browser: ['FALC Logística', 'Chrome', '120.0'],
            defaultQueryTimeoutMs: 60000,
        });

        state.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const currentState = ensureSessionState(sessionId);

            if (qr) {
                try {
                    currentState.currentQR = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                    currentState.connectionStatus = 'connecting';
                    currentState.statusMessage = 'Escanea el código QR con WhatsApp';
                    console.log(`📱 QR generado para sesión ${sessionId}`);
                } catch (err) {
                    console.error('Error generando QR:', err);
                }
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                currentState.currentQR = null;
                currentState.sock = null;
                currentState.isReady = false;
                currentState.connectedPhone = null;

                if (reason === DisconnectReason.loggedOut) {
                    currentState.connectionStatus = 'disconnected';
                    currentState.statusMessage = 'Sesión cerrada. Escanee el QR nuevamente para reconectar.';
                    console.log(`⚠ Baileys sesión ${sessionId}: loggedOut`);
                    clearAuthDir(sessionId);
                } else if (reason === 440 || reason === DisconnectReason.connectionReplaced) {
                    currentState.connectionStatus = 'disconnected';
                    currentState.reconnectAttempts = 0;
                    currentState.statusMessage = 'Sesión reemplazada por otro dispositivo. Reconecte manualmente desde el panel.';
                    console.log(`⚠ Baileys sesión ${sessionId}: session replaced`);
                } else if (currentState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    currentState.reconnectAttempts += 1;
                    const delay = Math.min(currentState.reconnectAttempts * 2000, 10000);
                    currentState.connectionStatus = 'connecting';
                    currentState.statusMessage = `Reconectando automáticamente (intento ${currentState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
                    console.log(`🔄 Reconectando sesión ${sessionId} (intento ${currentState.reconnectAttempts}, razón: ${reason})`);
                    setTimeout(() => connect(sessionId), delay);
                } else {
                    currentState.connectionStatus = 'disconnected';
                    currentState.statusMessage = `Desconectado tras ${MAX_RECONNECT_ATTEMPTS} intentos. Intente conectar manualmente.`;
                    console.log(`✗ Baileys sesión ${sessionId}: máximo de reconexiones alcanzado`);
                }
            }

            if (connection === 'open') {
                currentState.connectionStatus = 'connected';
                currentState.currentQR = null;
                currentState.reconnectAttempts = 0;
                currentState.connectedPhone = sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
                currentState.statusMessage = `Conectado exitosamente a WhatsApp${currentState.connectedPhone ? ` (+${currentState.connectedPhone})` : ''}`;
                console.log(`✅ Baileys conectado [${sessionId}]${currentState.connectedPhone ? ` +${currentState.connectedPhone}` : ''}`);

                setTimeout(() => {
                    const readyState = ensureSessionState(sessionId);
                    readyState.isReady = true;
                    console.log(`✅ Bot Baileys listo [${sessionId}]`);
                }, 8000);
            }
        });

        sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
            if (type !== 'notify') return;

            const currentState = ensureSessionState(sessionId);
            if (!currentState.isReady) return;

            for (const msg of msgs) {
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue;
                if (msg.key.remoteJid?.endsWith('@g.us')) continue;

                const msgTimestamp = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : parseInt(msg.messageTimestamp))
                    : 0;
                const ahora = Math.floor(Date.now() / 1000);
                if (msgTimestamp > 0 && (ahora - msgTimestamp) > 60) continue;

                const texto = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || '';
                if (!texto.trim()) continue;

                const remoteJid = msg.key.remoteJid;
                const telefonoLid = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
                let telefonoReal = telefonoLid;
                if (msg.key.remoteJidAlt) {
                    telefonoReal = msg.key.remoteJidAlt.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
                }

                try {
                    const baileysBot = require('./baileysBot');
                    const pool = require('../database/connection');

                    try {
                        await pool.query(
                            `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, tipo_mensaje) VALUES (?, ?, 'entrante', ?, 'text')`,
                            [sessionId, telefonoReal, texto]
                        );
                    } catch (logErr) {
                        console.error('Error log entrante:', logErr.message);
                    }

                    if (baileysBot.esAgentePausado(telefonoReal, sessionId)) {
                        continue;
                    }

                    await baileysBot.procesarMensaje(telefonoReal, texto, remoteJid, async (jid, text) => {
                        const liveState = ensureSessionState(sessionId);
                        if (liveState.sock && liveState.connectionStatus === 'connected') {
                            try {
                                await liveState.sock.sendMessage(jid, { text });
                                try {
                                    await pool.query(
                                        `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, tipo_mensaje, contexto) VALUES (?, ?, 'saliente', ?, 'text', 'bot')`,
                                        [sessionId, telefonoReal, text]
                                    );
                                } catch (logErr) {
                                    console.error('Error log saliente:', logErr.message);
                                }
                            } catch (sendErr) {
                                console.error(`Error enviando mensaje a ${jid}:`, sendErr.message);
                            }
                        }
                    }, sessionId);
                } catch (err) {
                    console.error('Error procesando mensaje en bot:', err.message);
                }
            }
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));
        return getStatus(sessionId);
    } catch (error) {
        state.connectionStatus = 'disconnected';
        state.statusMessage = `Error: ${error.message}`;
        console.error(`Error conectando Baileys [${sessionId}]:`, error);
        return getStatus(sessionId);
    }
}

async function disconnect(sessionId = 'default') {
    const state = ensureSessionState(sessionId);

    if (state.sock) {
        try {
            await state.sock.logout();
        } catch (e) {
            try { state.sock.end(); } catch (e2) { /* ignore */ }
        }
        state.sock = null;
    }

    clearAuthDir(sessionId);

    state.connectionStatus = 'disconnected';
    state.currentQR = null;
    state.connectedPhone = null;
    state.isReady = false;
    state.statusMessage = 'Desconectado';

    return getStatus(sessionId);
}

async function sendMessage(to, text, sessionId = 'default') {
    const state = ensureSessionState(sessionId);
    if (!state.sock || state.connectionStatus !== 'connected') {
        throw new Error(`Baileys no está conectado en la sesión ${sessionId}`);
    }

    let numero = to.replace(/@.+$/, '').replace(/[^0-9]/g, '');
    if (!numero) throw new Error(`Número de teléfono inválido: ${to}`);
    const jid = numero.length >= 15 ? `${numero}@lid` : `${numero}@s.whatsapp.net`;
    return await state.sock.sendMessage(jid, { text });
}

function hasSessionAuth(sessionId = 'default') {
    const authDir = getAuthDir(sessionId);
    return fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0;
}

module.exports = {
    getStatus,
    getAllStatuses,
    getSock,
    connect,
    disconnect,
    sendMessage,
    hasSessionAuth,
};

function discoverStoredSessions() {
    const ids = new Set(['default']);

    if (fs.existsSync(AUTH_SESSIONS_DIR)) {
        for (const entry of fs.readdirSync(AUTH_SESSIONS_DIR, { withFileTypes: true })) {
            if (entry.isDirectory()) ids.add(entry.name);
        }
    }

    if (getLegacyDefaultAuthDir()) ids.add('default');
    return Array.from(ids);
}

setTimeout(() => {
    const sessionIds = discoverStoredSessions();
    for (const sessionId of sessionIds) {
        if (hasSessionAuth(sessionId)) {
            console.log(`🔄 Auto-conectando Baileys [${sessionId}]...`);
            connect(sessionId).catch((err) => {
                console.error(`Error auto-conexión [${sessionId}]:`, err.message);
            });
        }
    }
}, 3000);
