// services/whatsappService.js - Envío de mensajes vía WhatsApp Cloud API
const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

/**
 * Envía un mensaje de texto por WhatsApp
 * @param {string} to - Número de teléfono del destinatario (formato internacional, ej: 573001234567)
 * @param {string} body - Texto del mensaje
 */
async function sendTextMessage(to, body) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✓ Mensaje enviado a ${to}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`✗ Error enviando mensaje a ${to}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envía un mensaje interactivo con botones
 */
async function sendButtonMessage(to, bodyText, buttons) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn, i) => ({
              type: 'reply',
              reply: { id: `btn_${i}`, title: btn },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`✗ Error enviando botones a ${to}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Marca un mensaje como leído
 */
async function markAsRead(messageId) {
  try {
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // No es crítico si falla
    console.warn('No se pudo marcar como leído:', error.message);
  }
}

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  markAsRead,
};
