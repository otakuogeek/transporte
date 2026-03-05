// controllers/whatsappConfigController.js - Configuración de WhatsApp (multi-sesión)
const pool = require('../database/connection');
const baileysService = require('../services/baileysService');

let schemaEnsured = false;

async function ensureMultiSessionSchema() {
    if (schemaEnsured) return;

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(50) NOT NULL UNIQUE,
                nombre VARCHAR(100) NOT NULL,
                activo TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Compatibilidad hacia atrás: en algunos despliegues la tabla existe con menos columnas
        const alterIfMissing = async (sql) => {
            try {
                await pool.query(sql);
            } catch (e) {
                const msg = String(e.message || '');
                if (
                    e.code === 'ER_DUP_FIELDNAME' ||
                    msg.includes('Duplicate column name')
                ) return;
                throw e;
            }
        };

        await alterIfMissing(`ALTER TABLE whatsapp_sessions ADD COLUMN nombre VARCHAR(100) NULL AFTER session_id`);
        await alterIfMissing(`ALTER TABLE whatsapp_sessions ADD COLUMN activo TINYINT(1) DEFAULT 1 AFTER nombre`);
        await alterIfMissing(`ALTER TABLE whatsapp_sessions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER activo`);
        await alterIfMissing(`ALTER TABLE whatsapp_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);

        // Normalizar filas viejas que pudieran no tener nombre
        await pool.query(`
            UPDATE whatsapp_sessions
            SET nombre = COALESCE(NULLIF(nombre, ''), session_id)
            WHERE nombre IS NULL OR nombre = ''
        `);

        // Asegurar no nulos para uso de la app
        await pool.query(`ALTER TABLE whatsapp_sessions MODIFY COLUMN nombre VARCHAR(100) NOT NULL`);

        await pool.query(
            `INSERT IGNORE INTO whatsapp_sessions (session_id, nombre, activo)
             VALUES ('default', 'Línea Principal', 1)`
        );

        await pool.query(
            'SELECT session_id, nombre, activo, created_at, updated_at FROM whatsapp_sessions WHERE activo = 1 ORDER BY created_at ASC'
        );

        try {
            await pool.query(`ALTER TABLE mensajes_log ADD COLUMN session_id VARCHAR(50) NULL DEFAULT 'default' AFTER wa_message_id`);
        } catch (e) {
            if (!String(e.message).includes('Duplicate column name')) throw e;
        }

        try {
            await pool.query(`ALTER TABLE mensajes_log ADD INDEX idx_mensajes_session_fecha (session_id, fecha)`);
        } catch (e) {
            if (!String(e.message).includes('Duplicate key name')) throw e;
        }

        try {
            await pool.query(`UPDATE mensajes_log SET session_id = 'default' WHERE session_id IS NULL OR session_id = ''`);
        } catch (e) {
            console.error('Error normalizando session_id en mensajes_log:', e.message);
        }

        schemaEnsured = true;
    } catch (error) {
        console.error('Error asegurando esquema multi-sesión WhatsApp:', error);
        throw error;
    }
}

function getSessionId(req) {
    return req.query.session_id || req.body?.session_id || 'default';
}

async function getConfig(req, res) {
    try {
        await ensureMultiSessionSchema();
        const [rows] = await pool.query('SELECT * FROM whatsapp_config WHERE id = 1');

        if (rows.length === 0) {
            await pool.query('INSERT INTO whatsapp_config (id, modo_conexion) VALUES (1, ?)', ['api_oficial']);
            return res.json({
                modo_conexion: 'api_oficial',
                wa_phone_number_id: '',
                wa_access_token: '',
                wa_verify_token: '',
                baileys_status: 'disconnected',
            });
        }

        const config = rows[0];
        const sessionId = getSessionId(req);
        const sessionStatus = baileysService.getStatus(sessionId);

        res.json({
            modo_conexion: config.modo_conexion,
            wa_phone_number_id: config.wa_phone_number_id || '',
            wa_access_token: config.wa_access_token || '',
            wa_verify_token: config.wa_verify_token || '',
            baileys_status: sessionStatus.status || config.baileys_status || 'disconnected',
            phone: sessionStatus.phone || null,
            session_id: sessionId,
        });
    } catch (error) {
        console.error('Error obteniendo config WhatsApp:', error);
        res.status(500).json({ error: 'Error obteniendo configuración' });
    }
}

async function updateConfig(req, res) {
    try {
        await ensureMultiSessionSchema();
        const { modo_conexion, wa_phone_number_id, wa_access_token, wa_verify_token } = req.body;

        if (!modo_conexion || !['baileys', 'api_oficial'].includes(modo_conexion)) {
            return res.status(400).json({ error: 'Modo de conexión inválido' });
        }

        await pool.query(
            `INSERT INTO whatsapp_config (id, modo_conexion, wa_phone_number_id, wa_access_token, wa_verify_token)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         modo_conexion = VALUES(modo_conexion),
         wa_phone_number_id = VALUES(wa_phone_number_id),
         wa_access_token = VALUES(wa_access_token),
         wa_verify_token = VALUES(wa_verify_token)`,
            [modo_conexion, wa_phone_number_id || null, wa_access_token || null, wa_verify_token || null]
        );

        res.json({ message: 'Configuración guardada correctamente' });
    } catch (error) {
        console.error('Error guardando config WhatsApp:', error);
        res.status(500).json({ error: 'Error guardando configuración' });
    }
}

async function listBaileysSessions(req, res) {
    try {
        await ensureMultiSessionSchema();
        const [rows] = await pool.query(
            'SELECT session_id, nombre, activo, created_at, updated_at FROM whatsapp_sessions WHERE activo = 1 ORDER BY created_at ASC'
        );

        const result = rows.map((r) => {
            const st = baileysService.getStatus(r.session_id);
            return {
                ...r,
                status: st.status,
                qr: st.qr,
                message: st.message,
                phone: st.phone,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Error listando sesiones Baileys:', error);
        res.status(500).json({ error: 'Error listando sesiones' });
    }
}

async function createBaileysSession(req, res) {
    try {
        await ensureMultiSessionSchema();
        const nombre = String(req.body?.nombre || '').trim();
        const sessionIdInput = String(req.body?.session_id || '').trim().toLowerCase();

        if (!nombre) return res.status(400).json({ error: 'El nombre de la sesión es requerido' });

        const sessionId = sessionIdInput
            ? sessionIdInput.replace(/[^a-z0-9_-]/g, '')
            : `linea_${Date.now()}`;

        if (!sessionId) return res.status(400).json({ error: 'session_id inválido' });

        await pool.query(
            `INSERT INTO whatsapp_sessions (session_id, nombre, activo)
             VALUES (?, ?, 1)`,
            [sessionId, nombre]
        );

        res.status(201).json({ session_id: sessionId, nombre, message: 'Sesión creada' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una sesión con ese ID' });
        }
        console.error('Error creando sesión Baileys:', error);
        res.status(500).json({ error: 'Error creando sesión' });
    }
}

async function deleteBaileysSession(req, res) {
    try {
        await ensureMultiSessionSchema();
        const { sessionId } = req.params;

        if (sessionId === 'default') {
            return res.status(400).json({ error: 'No se puede eliminar la sesión default' });
        }

        await baileysService.disconnect(sessionId);
        await pool.query('UPDATE whatsapp_sessions SET activo = 0 WHERE session_id = ?', [sessionId]);

        res.json({ message: 'Sesión eliminada' });
    } catch (error) {
        console.error('Error eliminando sesión Baileys:', error);
        res.status(500).json({ error: 'Error eliminando sesión' });
    }
}

async function baileysConnect(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const result = await baileysService.connect(sessionId);

        await pool.query('UPDATE whatsapp_config SET baileys_status = ?, modo_conexion = ? WHERE id = 1', [result.status, 'baileys']);
        res.json(result);
    } catch (error) {
        console.error('Error conectando Baileys:', error);
        res.status(500).json({ error: 'Error iniciando conexión Baileys' });
    }
}

async function baileysDisconnect(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const result = await baileysService.disconnect(sessionId);
        await pool.query('UPDATE whatsapp_config SET baileys_status = ? WHERE id = 1', ['disconnected']);
        res.json(result);
    } catch (error) {
        console.error('Error desconectando Baileys:', error);
        res.status(500).json({ error: 'Error desconectando Baileys' });
    }
}

async function baileysStatus(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const status = baileysService.getStatus(sessionId);
        res.json(status);
    } catch (error) {
        console.error('Error obteniendo estado Baileys:', error);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
}

async function getChats(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const baileysBot = require('../services/baileysBot');

        const [rows] = await pool.query(`
            SELECT
                m.telefono,
                MAX(m.fecha) as ultima_fecha,
                (SELECT contenido FROM mensajes_log WHERE telefono = m.telefono AND session_id = ? ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
                (SELECT direccion FROM mensajes_log WHERE telefono = m.telefono AND session_id = ? ORDER BY fecha DESC LIMIT 1) as ultima_direccion,
                COUNT(*) as total_mensajes,
                COALESCE(
                    (SELECT CONCAT(nombre, IF(apellidos IS NOT NULL, CONCAT(' ', apellidos), '')) FROM clientes WHERE telefono_whatsapp = m.telefono OR JSON_SEARCH(telefonos, 'one', m.telefono) IS NOT NULL LIMIT 1),
                    (SELECT nombre FROM transportes WHERE telefono_whatsapp = m.telefono LIMIT 1),
                    (SELECT nombre FROM choferes WHERE telefono_whatsapp = m.telefono LIMIT 1),
                    m.telefono
                ) as nombre_contacto,
                COALESCE(
                    (SELECT 'cliente' FROM clientes WHERE telefono_whatsapp = m.telefono OR JSON_SEARCH(telefonos, 'one', m.telefono) IS NOT NULL LIMIT 1),
                    (SELECT 'transporte' FROM transportes WHERE telefono_whatsapp = m.telefono LIMIT 1),
                    (SELECT 'chofer' FROM choferes WHERE telefono_whatsapp = m.telefono LIMIT 1),
                    'desconocido'
                ) as tipo_contacto
            FROM mensajes_log m
            WHERE m.direccion IN ('entrante', 'saliente')
              AND COALESCE(m.session_id, 'default') = ?
            GROUP BY m.telefono
            ORDER BY ultima_fecha DESC
            LIMIT 100
        `, [sessionId, sessionId, sessionId]);

        const result = rows.map(r => ({
            ...r,
            session_id: sessionId,
            agente_pausado: baileysBot.esAgentePausado(r.telefono, sessionId),
        }));

        res.json(result);
    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({ error: 'Error obteniendo conversaciones' });
    }
}

async function getChatMessages(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const { phone } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const [rows] = await pool.query(
            `SELECT id, session_id, telefono, direccion, contenido, tipo_mensaje, contexto, fecha
             FROM mensajes_log
             WHERE telefono = ?
               AND direccion IN ('entrante', 'saliente')
               AND COALESCE(session_id, 'default') = ?
             ORDER BY fecha DESC
             LIMIT ?`,
            [phone, sessionId, limit]
        );
        res.json(rows.reverse());
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error obteniendo mensajes' });
    }
}

async function sendChatMessage(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const { phone } = req.params;
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

        const status = baileysService.getStatus(sessionId);
        if (status.status !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp no está conectado en esta sesión' });
        }

        await baileysService.sendMessage(phone, mensaje.trim(), sessionId);

        await pool.query(
            `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, contexto) VALUES (?, ?, 'saliente', ?, 'manual_admin')`,
            [sessionId, phone, mensaje.trim()]
        );

        res.json({ success: true, message: 'Mensaje enviado' });
    } catch (error) {
        console.error('Error enviando mensaje manual:', error);
        res.status(500).json({ error: error.message || 'Error enviando mensaje' });
    }
}

async function toggleAgent(req, res) {
    try {
        await ensureMultiSessionSchema();
        const sessionId = getSessionId(req);
        const { phone } = req.params;
        const baileysBot = require('../services/baileysBot');
        const estaPausado = baileysBot.esAgentePausado(phone, sessionId);

        if (estaPausado) baileysBot.reanudarAgente(phone, sessionId);
        else baileysBot.pausarAgente(phone, sessionId);

        res.json({
            agente_pausado: !estaPausado,
            session_id: sessionId,
            message: estaPausado ? 'Agente activado' : 'Agente detenido',
        });
    } catch (error) {
        console.error('Error toggling agent:', error);
        res.status(500).json({ error: 'Error cambiando estado del agente' });
    }
}

module.exports = {
    getConfig,
    updateConfig,
    listBaileysSessions,
    createBaileysSession,
    deleteBaileysSession,
    baileysConnect,
    baileysDisconnect,
    baileysStatus,
    getChats,
    getChatMessages,
    sendChatMessage,
    toggleAgent,
};
