// controllers/webhookController.js - Webhook WhatsApp Cloud API (Meta)
const pool = require('../database/connection');
const whatsappService = require('../services/whatsappService');
const { resolveWhatsAppConfig } = require('../services/whatsappConfigService');

const SESSION_ID = 'meta_api';

/**
 * GET /webhook - Verificación del Webhook (requerido por Meta)
 */
async function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const config = await resolveWhatsAppConfig();

  if (mode === 'subscribe' && token === config.verifyToken) {
    console.log('✓ Webhook Meta verificado correctamente');
    return res.status(200).send(challenge);
  }

  console.warn('✗ Verificación de Webhook fallida');
  return res.sendStatus(403);
}

/**
 * POST /webhook - Recibe mensajes entrantes de WhatsApp Cloud API
 * Procesa mensajes entrantes a través del bot conversacional.
 */
async function handleIncomingMessage(req, res) {
  // Responder 200 inmediatamente (requisito de Meta, máx 20 segundos)
  res.sendStatus(200);

  try {
    const body = req.body;

    if (
      !body.object ||
      !body.entry?.[0]?.changes?.[0]?.value?.messages
    ) {
      return;
    }

    const change = body.entry[0].changes[0].value;
    const message = change.messages[0];
    const senderPhone = message.from;
    const messageId = message.id;
    const messageType = message.type;
    const timestamp = parseInt(message.timestamp, 10);

    // Ignorar mensajes antiguos (>60 segundos) — anti-history-sync-spam
    const ahoraSegundos = Math.floor(Date.now() / 1000);
    if (ahoraSegundos - timestamp > 60) {
      console.log(`⏭️ [META] Mensaje antiguo de ${senderPhone} (${ahoraSegundos - timestamp}s atrás), ignorado`);
      return;
    }

    // Deduplicar: evitar reprocesar si Meta reenvía el mismo messageId
    const [existing] = await pool.query(
      'SELECT id FROM mensajes_log WHERE wa_message_id = ?',
      [messageId]
    );
    if (existing.length > 0) {
      console.log(`⏭️ [META] Mensaje ${messageId} ya procesado`);
      return;
    }

    // Solo procesamos mensajes de texto por ahora
    if (messageType !== 'text') {
      await whatsappService.sendTextMessage(
        senderPhone,
        '⚠️ Por el momento solo procesamos mensajes de texto. Escríbenos tu consulta 😊'
      );
      return;
    }

    const messageText = message.text.body;

    // Marcar como leído
    await whatsappService.markAsRead(messageId);

    // Registrar mensaje entrante en log
    await pool.query(
      `INSERT INTO mensajes_log (wa_message_id, session_id, telefono, direccion, contenido, tipo_mensaje)
       VALUES (?, ?, ?, 'entrante', ?, ?)`,
      [messageId, SESSION_ID, senderPhone, messageText, messageType]
    );

    // Verificar si el agente está pausado para este teléfono
    const baileysBot = require('../services/baileysBot');
    if (baileysBot.esAgentePausado(senderPhone, SESSION_ID)) {
      console.log(`⏸️ [META] Agente pausado para ${senderPhone}, ignorando`);
      return;
    }

    // Función de envío que usa Meta Cloud API y registra la respuesta en el log
    const enviar = async (jid, text) => {
      const phone = jid.includes('@') ? jid.split('@')[0] : jid;
      try {
        await whatsappService.sendTextMessage(phone, text);
        await pool.query(
          `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, contexto)
           VALUES (?, ?, 'saliente', ?, 'bot')`,
          [SESSION_ID, phone, text]
        );
      } catch (err) {
        console.error(`✗ [META] Error enviando mensaje a ${phone}:`, err.message);
      }
    };

    // Rutear por el bot conversacional
    await baileysBot.procesarMensaje(senderPhone, messageText, senderPhone, enviar, SESSION_ID);

    console.log(`📩 [META] ${senderPhone}: "${messageText.substring(0, 60)}"`);
  } catch (error) {
    console.error('✗ Error procesando mensaje webhook Meta:', error);
  }
}

module.exports = {
  verifyWebhook,
  handleIncomingMessage,
};
