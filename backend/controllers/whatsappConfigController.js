// controllers/whatsappConfigController.js - Configuración de WhatsApp (API Oficial Meta)
const crypto = require('crypto');
const pool = require('../database/connection');
const whatsappService = require('../services/whatsappService');
const { resolveWhatsAppConfig } = require('../services/whatsappConfigService');

const SESSION_ID = 'meta_api';
let schemaEnsured = false;

async function ensureSchema() {
    if (schemaEnsured) return;
    try {
        const alterIfMissing = async (sql) => {
            try { await pool.query(sql); } catch (e) {
                const msg = String(e.message || '');
                if (msg.includes('Duplicate column name') || msg.includes('Duplicate key name')) return;
                throw e;
            }
        };

        await alterIfMissing(`ALTER TABLE mensajes_log ADD COLUMN session_id VARCHAR(50) NULL DEFAULT 'default' AFTER wa_message_id`);
        await alterIfMissing(`ALTER TABLE mensajes_log ADD INDEX idx_mensajes_session_fecha (session_id, fecha)`);
        await alterIfMissing(`ALTER TABLE mensajes_log ADD COLUMN operador_id INT NULL AFTER solicitud_id`);
        await alterIfMissing(`ALTER TABLE mensajes_log ADD COLUMN operador_nombre VARCHAR(100) NULL AFTER operador_id`);

        // Tabla de control de chats
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_control (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telefono VARCHAR(20) NOT NULL,
                operador_id INT NOT NULL,
                session_id VARCHAR(50) DEFAULT 'meta_api',
                activo TINYINT(1) DEFAULT 1,
                fecha_toma TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_liberacion TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (operador_id) REFERENCES administradores(id) ON DELETE CASCADE,
                INDEX idx_chat_control_tel_activo (telefono, activo),
                INDEX idx_chat_control_operador (operador_id)
            )
        `);

        schemaEnsured = true;
    } catch (error) {
        console.error('Error asegurando esquema WhatsApp:', error);
    }
}

async function getConfig(req, res) {
    try {
        await ensureSchema();
        const [rows] = await pool.query('SELECT * FROM whatsapp_config WHERE id = 1');
        const config = await resolveWhatsAppConfig();
        const webhookUrl = `${req.protocol}://${req.get('host')}/webhook`;
        const setupStatus = {
            phone_number_id: !!config.phoneNumberId,
            access_token: !!config.accessToken,
            verify_token: !!config.verifyToken,
        };
        const completedSteps = Object.values(setupStatus).filter(Boolean).length;

        if (rows.length === 0) {
            await pool.query("INSERT INTO whatsapp_config (id, modo_conexion) VALUES (1, 'api_oficial')");
            return res.json({
                modo_conexion: 'api_oficial',
                wa_phone_number_id: config.phoneNumberId || '',
                wa_access_token: config.accessToken || '',
                wa_verify_token: config.verifyToken || '',
                meta_api_configurado: false,
                webhook_url: webhookUrl,
                setup_status: setupStatus,
                completed_steps: completedSteps,
                suggested_verify_token: crypto.randomBytes(16).toString('hex'),
                credential_source: config.source,
            });
        }

        res.json({
            modo_conexion: 'api_oficial',
            wa_phone_number_id: config.phoneNumberId || '',
            wa_access_token: config.accessToken || '',
            wa_verify_token: config.verifyToken || '',
            meta_api_configurado: config.configured,
            webhook_url: webhookUrl,
            setup_status: setupStatus,
            completed_steps: completedSteps,
            suggested_verify_token: !config.verifyToken ? crypto.randomBytes(16).toString('hex') : null,
            credential_source: config.source,
        });
    } catch (error) {
        console.error('Error obteniendo config WhatsApp:', error);
        res.status(500).json({ error: 'Error obteniendo configuración' });
    }
}

async function updateConfig(req, res) {
    try {
        const { wa_phone_number_id, wa_access_token, wa_verify_token } = req.body;
        const verifyToken = String(wa_verify_token || '').trim() || crypto.randomBytes(16).toString('hex');

        await pool.query(
            `INSERT INTO whatsapp_config (id, modo_conexion, wa_phone_number_id, wa_access_token, wa_verify_token)
             VALUES (1, 'api_oficial', ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               modo_conexion = 'api_oficial',
               wa_phone_number_id = VALUES(wa_phone_number_id),
               wa_access_token = VALUES(wa_access_token),
               wa_verify_token = VALUES(wa_verify_token)`,
            [wa_phone_number_id || null, wa_access_token || null, verifyToken]
        );

        const validation = await whatsappService.validateConnection();

        res.json({
            message: 'Configuración guardada correctamente',
            wa_verify_token: verifyToken,
            validation,
        });
    } catch (error) {
        console.error('Error guardando config WhatsApp:', error);
        res.status(500).json({ error: 'Error guardando configuración' });
    }
}

async function getConnectionStatus(req, res) {
    try {
        const validation = await whatsappService.validateConnection();
        res.json(validation);
    } catch (error) {
        console.error('Error validando conexión WhatsApp:', error);
        res.status(500).json({ error: 'Error validando conexión' });
    }
}

async function getChats(req, res) {
    try {
        await ensureSchema();
        const baileysBot = require('../services/baileysBot');

        const [rows] = await pool.query(`
            SELECT
                m.telefono,
                MAX(m.fecha) as ultima_fecha,
                (SELECT contenido FROM mensajes_log WHERE telefono = m.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
                (SELECT direccion FROM mensajes_log WHERE telefono = m.telefono ORDER BY fecha DESC LIMIT 1) as ultima_direccion,
                (SELECT MAX(fecha) FROM mensajes_log WHERE telefono = m.telefono AND direccion = 'entrante') as ultimo_mensaje_entrante,
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
            GROUP BY m.telefono
            ORDER BY ultima_fecha DESC
            LIMIT 100
        `);

        // Obtener controles activos de chats
        const [controles] = await pool.query(`
            SELECT cc.telefono, cc.operador_id, a.nombre AS operador_nombre, cc.fecha_toma
            FROM chat_control cc
            JOIN administradores a ON a.id = cc.operador_id
            WHERE cc.activo = 1
        `);
        const controlMap = {};
        for (const c of controles) {
            controlMap[c.telefono] = {
                operador_id: c.operador_id,
                operador_nombre: c.operador_nombre,
                fecha_toma: c.fecha_toma,
            };
        }

        const result = rows.map(r => ({
            ...r,
            session_id: SESSION_ID,
            agente_pausado: baileysBot.esAgentePausado(r.telefono, SESSION_ID),
            control: controlMap[r.telefono] || null,
        }));

        res.json(result);
    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({ error: 'Error obteniendo conversaciones' });
    }
}

async function getChatMessages(req, res) {
    try {
        const { phone } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const [rows] = await pool.query(
            `SELECT m.id, m.session_id, m.telefono, m.direccion, m.contenido, m.tipo_mensaje, m.contexto, m.fecha,
                    m.operador_id, COALESCE(m.operador_nombre, a.nombre) AS operador_nombre
             FROM mensajes_log m
             LEFT JOIN administradores a ON a.id = m.operador_id
             WHERE m.telefono = ?
               AND m.direccion IN ('entrante', 'saliente')
             ORDER BY m.fecha DESC
             LIMIT ?`,
            [phone, limit]
        );
        res.json(rows.reverse());
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error obteniendo mensajes' });
    }
}

async function sendChatMessage(req, res) {
    try {
        const { phone } = req.params;
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

        const operadorId = req.admin?.id || null;
        const operadorNombre = req.admin?.nombre || null;

        const whatsappService = require('../services/whatsappService');
        await whatsappService.sendTextMessage(phone, mensaje.trim());
        await pool.query(
            `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, contexto, operador_id, operador_nombre)
             VALUES ('meta_api', ?, 'saliente', ?, 'manual_admin', ?, ?)`,
            [phone, mensaje.trim(), operadorId, operadorNombre]
        );

        res.json({ success: true, message: 'Mensaje enviado' });
    } catch (error) {
        console.error('Error enviando mensaje manual:', error);
        const status = error.status && Number.isInteger(error.status) ? error.status : 500;
        const isNotRegistered = error.code === 133010;
        const message = isNotRegistered
            ? 'Meta rechazó el envío: el número destino no está registrado en WhatsApp o no es válido en este formato.'
            : (error.message || 'Error enviando mensaje');

        res.status(status).json({
            error: message,
            code: error.code || null,
            meta: error.meta || null,
        });
    }
}

async function toggleAgent(req, res) {
    try {
        await ensureSchema();
        const { phone } = req.params;
        const sessionId = req.query.session_id || req.body?.session_id || SESSION_ID;
        const baileysBot = require('../services/baileysBot');
        const estaPausado = baileysBot.esAgentePausado(phone, sessionId);

        const operadorId = req.admin?.id || null;
        const operadorNombre = req.admin?.nombre || 'Desconocido';

        if (estaPausado) {
            // Reanudar: liberar control
            baileysBot.reanudarAgente(phone, sessionId);
            await pool.query(
                `UPDATE chat_control SET activo = 0, fecha_liberacion = NOW() WHERE telefono = ? AND session_id = ? AND activo = 1`,
                [phone, sessionId]
            );
        } else {
            // Pausar: tomar control
            baileysBot.pausarAgente(phone, sessionId);
            // Liberar cualquier control previo activo sobre este chat
            await pool.query(
                `UPDATE chat_control SET activo = 0, fecha_liberacion = NOW() WHERE telefono = ? AND session_id = ? AND activo = 1`,
                [phone, sessionId]
            );
            // Registrar nuevo control
            await pool.query(
                `INSERT INTO chat_control (telefono, operador_id, session_id, activo) VALUES (?, ?, ?, 1)`,
                [phone, operadorId, sessionId]
            );
        }

        // Obtener info del operador que ahora tiene el control (si quedó pausado)
        let control = null;
        if (!estaPausado) {
            control = { operador_id: operadorId, operador_nombre: operadorNombre, fecha_toma: new Date() };
        }

        res.json({
            agente_pausado: !estaPausado,
            session_id: sessionId,
            message: estaPausado ? 'Agente activado' : `Agente detenido — control tomado por ${operadorNombre}`,
            control,
        });
    } catch (error) {
        console.error('Error toggling agent:', error);
        res.status(500).json({ error: 'Error cambiando estado del agente' });
    }
}

// Restaurar estados de agentes desde BD al iniciar (anti-pérdida por reinicio)
async function restoreAgentStates() {
    try {
        await ensureSchema();
        const baileysBot = require('../services/baileysBot');
        const [rows] = await pool.query(`SELECT telefono, session_id FROM chat_control WHERE activo = 1`);
        for (const row of rows) {
            baileysBot.pausarAgente(row.telefono, row.session_id);
        }
        if (rows.length > 0) {
            console.log(`✓ Restaurados ${rows.length} chats con agente pausado desde BD`);
        }
    } catch (error) {
        console.error('Error restaurando estados de agentes:', error);
    }
}

// Obtener historial de control de un chat
async function getChatControlHistory(req, res) {
    try {
        await ensureSchema();
        const { phone } = req.params;
        const [rows] = await pool.query(
            `SELECT cc.id, cc.operador_id, a.nombre AS operador_nombre, cc.activo, cc.fecha_toma, cc.fecha_liberacion
             FROM chat_control cc
             JOIN administradores a ON a.id = cc.operador_id
             WHERE cc.telefono = ?
             ORDER BY cc.fecha_toma DESC
             LIMIT 20`,
            [phone]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo historial de control:', error);
        res.status(500).json({ error: 'Error obteniendo historial de control' });
    }
}

module.exports = {
    getConfig,
    updateConfig,
    getConnectionStatus,
    getChats,
    getChatMessages,
    sendChatMessage,
    toggleAgent,
    restoreAgentStates,
    getChatControlHistory,
};
