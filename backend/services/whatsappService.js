// services/whatsappService.js - Envío de mensajes vía WhatsApp Cloud API
const axios = require('axios');
const { resolveWhatsAppConfig } = require('./whatsappConfigService');

async function getResolvedConfig() {
  const config = await resolveWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    throw new Error('WhatsApp Cloud API no está configurada');
  }

  return {
    ...config,
    apiUrl: `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
  };
}

/**
 * Envía un mensaje de texto por WhatsApp
 * @param {string} to - Número de teléfono del destinatario (formato internacional, ej: 573001234567)
 * @param {string} body - Texto del mensaje
 */
async function sendTextMessage(to, body) {
  try {
    const config = await getResolvedConfig();
    const response = await axios.post(
      config.apiUrl,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✓ Mensaje enviado a ${to}:`, response.data);
    return response.data;
  } catch (error) {
    const metaMessage = error.response?.data?.error?.message;
    const normalizedError = new Error(metaMessage || error.message || 'Error enviando mensaje por WhatsApp');
    normalizedError.status = error.response?.status || 500;
    normalizedError.code = error.response?.data?.error?.code || null;
    normalizedError.meta = error.response?.data?.error || null;
    console.error(`✗ Error enviando mensaje a ${to}:`, error.response?.data || error.message);
    throw normalizedError;
  }
}

/**
 * Envía un mensaje interactivo con botones
 */
async function sendButtonMessage(to, bodyText, buttons) {
  try {
    const config = await getResolvedConfig();
    const response = await axios.post(
      config.apiUrl,
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
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    const metaMessage = error.response?.data?.error?.message;
    const normalizedError = new Error(metaMessage || error.message || 'Error enviando botones por WhatsApp');
    normalizedError.status = error.response?.status || 500;
    normalizedError.code = error.response?.data?.error?.code || null;
    normalizedError.meta = error.response?.data?.error || null;
    console.error(`✗ Error enviando botones a ${to}:`, error.response?.data || error.message);
    throw normalizedError;
  }
}

/**
 * Marca un mensaje como leído
 */
async function markAsRead(messageId) {
  try {
    const config = await getResolvedConfig();
    await axios.post(
      config.apiUrl,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // No es crítico si falla
    console.warn('No se pudo marcar como leído:', error.message);
  }
}

async function validateConnection() {
  const config = await resolveWhatsAppConfig();

  if (!config.phoneNumberId || !config.accessToken) {
    return {
      ok: false,
      error: 'Faltan credenciales para validar la conexión',
      config,
    };
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}`,
      {
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,status,name_status,account_mode',
        },
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    const data = response.data;
    const needsRegister = data.status === 'PENDING';

    // Auto-registrar si el número está en PENDING
    if (needsRegister) {
      try {
        await axios.post(
          `https://graph.facebook.com/v21.0/${config.phoneNumberId}/register`,
          { messaging_product: 'whatsapp', pin: '123456' },
          { headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' } }
        );
        console.log('✓ Número registrado automáticamente en Cloud API');
        data.status = 'CONNECTED';
        data._autoRegistered = true;
      } catch (regErr) {
        console.error('✗ Error auto-registrando número:', regErr.response?.data?.error?.message || regErr.message);
      }
    }

    return {
      ok: true,
      config,
      phoneNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      qualityRating: data.quality_rating || null,
      phoneStatus: data.status || null,
      nameStatus: data.name_status || null,
      accountMode: data.account_mode || null,
      autoRegistered: data._autoRegistered || false,
    };
  } catch (error) {
    return {
      ok: false,
      config,
      error: error.response?.data?.error?.message || error.message || 'No se pudo validar la conexión',
    };
  }
}

/**
 * Envía un mensaje usando una plantilla aprobada de Meta
 * @param {string} to - Número destino en formato internacional (ej: 573001234567)
 * @param {string} templateName - Nombre exacto de la plantilla en Meta
 * @param {string} languageCode - Código de idioma (ej: 'es_AR', 'es', 'en_US')
 * @param {Array<string>} bodyParams - Valores para los parámetros {{1}}, {{2}}, ... del cuerpo
 */
async function sendTemplateMessage(to, templateName, languageCode, bodyParams = []) {
  try {
    const config = await getResolvedConfig();
    const components = bodyParams.length > 0
      ? [{
          type: 'body',
          parameters: bodyParams.map(value => ({ type: 'text', text: String(value) })),
        }]
      : [];

    const response = await axios.post(
      config.apiUrl,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✓ Plantilla '${templateName}' enviada a ${to}:`, response.data);
    return response.data;
  } catch (error) {
    const metaMessage = error.response?.data?.error?.message;
    const normalizedError = new Error(metaMessage || error.message || 'Error enviando plantilla por WhatsApp');
    normalizedError.status = error.response?.status || 500;
    normalizedError.code = error.response?.data?.error?.code || null;
    normalizedError.meta = error.response?.data?.error || null;
    console.error(`✗ Error enviando plantilla '${templateName}' a ${to}:`, error.response?.data || error.message);
    throw normalizedError;
  }
}

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  sendTemplateMessage,
  markAsRead,
  validateConnection,
};
