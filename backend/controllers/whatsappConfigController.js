// controllers/whatsappConfigController.js - Configuración de WhatsApp
const pool = require('../database/connection');
const baileysService = require('../services/baileysService');

/**
 * GET /api/whatsapp-config
 * Obtener la configuración actual de WhatsApp
 */
async function getConfig(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM whatsapp_config WHERE id = 1');

        if (rows.length === 0) {
            // Insertar config por defecto
            await pool.query(
                'INSERT INTO whatsapp_config (id, modo_conexion) VALUES (1, ?)',
                ['api_oficial']
            );
            return res.json({
                modo_conexion: 'api_oficial',
                wa_phone_number_id: '',
                wa_access_token: '',
                wa_verify_token: '',
                baileys_status: 'disconnected',
            });
        }

        const config = rows[0];
        // Si modo es baileys, obtener estado en tiempo real
        if (config.modo_conexion === 'baileys') {
            const baileysStatus = baileysService.getStatus();
            config.baileys_status = baileysStatus.status;
        }

        res.json({
            modo_conexion: config.modo_conexion,
            wa_phone_number_id: config.wa_phone_number_id || '',
            wa_access_token: config.wa_access_token || '',
            wa_verify_token: config.wa_verify_token || '',
            baileys_status: config.baileys_status || 'disconnected',
        });
    } catch (error) {
        console.error('Error obteniendo config WhatsApp:', error);
        res.status(500).json({ error: 'Error obteniendo configuración' });
    }
}

/**
 * PUT /api/whatsapp-config
 * Guardar configuración de WhatsApp (modo y credenciales API)
 */
async function updateConfig(req, res) {
    try {
        const { modo_conexion, wa_phone_number_id, wa_access_token, wa_verify_token } = req.body;

        if (!modo_conexion || !['baileys', 'api_oficial'].includes(modo_conexion)) {
            return res.status(400).json({ error: 'Modo de conexión inválido' });
        }

        // Upsert config
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

        // Si se cambia a api_oficial y hay Baileys activo, desconectar
        if (modo_conexion === 'api_oficial') {
            const baileysStatus = baileysService.getStatus();
            if (baileysStatus.status !== 'disconnected') {
                await baileysService.disconnect();
            }
        }

        res.json({ message: 'Configuración guardada correctamente' });
    } catch (error) {
        console.error('Error guardando config WhatsApp:', error);
        res.status(500).json({ error: 'Error guardando configuración' });
    }
}

/**
 * POST /api/whatsapp-config/baileys/connect
 * Iniciar conexión Baileys y obtener QR
 */
async function baileysConnect(req, res) {
    try {
        const result = await baileysService.connect();

        // Actualizar estado en BD
        await pool.query(
            'UPDATE whatsapp_config SET baileys_status = ?, modo_conexion = ? WHERE id = 1',
            [result.status, 'baileys']
        );

        res.json(result);
    } catch (error) {
        console.error('Error conectando Baileys:', error);
        res.status(500).json({ error: 'Error iniciando conexión Baileys' });
    }
}

/**
 * POST /api/whatsapp-config/baileys/disconnect
 * Desconectar Baileys
 */
async function baileysDisconnect(req, res) {
    try {
        const result = await baileysService.disconnect();

        // Actualizar estado en BD
        await pool.query(
            'UPDATE whatsapp_config SET baileys_status = ? WHERE id = 1',
            ['disconnected']
        );

        res.json(result);
    } catch (error) {
        console.error('Error desconectando Baileys:', error);
        res.status(500).json({ error: 'Error desconectando Baileys' });
    }
}

/**
 * GET /api/whatsapp-config/baileys/status
 * Obtener estado de Baileys + QR si está pendiente + número conectado
 */
async function baileysStatus(req, res) {
    try {
        const status = baileysService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error obteniendo estado Baileys:', error);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
}

/**
 * GET /api/whatsapp-config/chats
 * Lista de conversaciones únicas (agrupadas por teléfono)
 */
async function getChats(req, res) {
    try {
        const baileysBot = require('../services/baileysBot');
        const [rows] = await pool.query(`
            SELECT
                m.telefono,
                MAX(m.fecha) as ultima_fecha,
                (SELECT contenido FROM mensajes_log WHERE telefono = m.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
                (SELECT direccion FROM mensajes_log WHERE telefono = m.telefono ORDER BY fecha DESC LIMIT 1) as ultima_direccion,
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
        // Agregar estado del agente
        const result = rows.map(r => ({
            ...r,
            agente_pausado: baileysBot.esAgentePausado(r.telefono)
        }));
        res.json(result);
    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({ error: 'Error obteniendo conversaciones' });
    }
}

/**
 * GET /api/whatsapp-config/chats/:phone
 * Mensajes de una conversación específica
 */
async function getChatMessages(req, res) {
    try {
        const { phone } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const [rows] = await pool.query(
            `SELECT id, telefono, direccion, contenido, tipo_mensaje, contexto, fecha
             FROM mensajes_log
             WHERE telefono = ? AND direccion IN ('entrante', 'saliente')
             ORDER BY fecha DESC
             LIMIT ?`,
            [phone, limit]
        );
        res.json(rows.reverse());
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error obteniendo mensajes' });
    }
}

/**
 * POST /api/whatsapp-config/chats/:phone/send
 * Enviar mensaje manual a un número vía Baileys
 */
async function sendChatMessage(req, res) {
    try {
        const { phone } = req.params;
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

        const status = baileysService.getStatus();
        if (status.status !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp no está conectado' });
        }

        await baileysService.sendMessage(phone, mensaje.trim());

        // Loguear en BD
        await pool.query(
            `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto) VALUES (?, 'saliente', ?, 'manual_admin')`,
            [phone, mensaje.trim()]
        );

        res.json({ success: true, message: 'Mensaje enviado' });
    } catch (error) {
        console.error('Error enviando mensaje manual:', error);
        res.status(500).json({ error: error.message || 'Error enviando mensaje' });
    }
}

/**
 * POST /api/whatsapp-config/chats/:phone/toggle-agent
 * Pausar o reanudar el agente para una conversación
 */
async function toggleAgent(req, res) {
    try {
        const { phone } = req.params;
        const baileysBot = require('../services/baileysBot');
        const estaPausado = baileysBot.esAgentePausado(phone);
        if (estaPausado) {
            baileysBot.reanudarAgente(phone);
        } else {
            baileysBot.pausarAgente(phone);
        }
        res.json({ agente_pausado: !estaPausado, message: estaPausado ? 'Agente activado' : 'Agente detenido' });
    } catch (error) {
        console.error('Error toggling agent:', error);
        res.status(500).json({ error: 'Error cambiando estado del agente' });
    }
}

module.exports = {
    getConfig,
    updateConfig,
    baileysConnect,
    baileysDisconnect,
    baileysStatus,
    getChats,
    getChatMessages,
    sendChatMessage,
    toggleAgent,
};
