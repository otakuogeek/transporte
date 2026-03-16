const pool = require('../database/connection');

function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

async function getStoredConfig() {
  try {
    const [rows] = await pool.query(
      'SELECT wa_phone_number_id, wa_access_token, wa_verify_token FROM whatsapp_config WHERE id = 1 LIMIT 1'
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo configuración WhatsApp desde BD:', error.message);
    return null;
  }
}

async function resolveWhatsAppConfig() {
  const stored = await getStoredConfig();

  const phoneNumberId = normalizeValue(stored?.wa_phone_number_id) || normalizeValue(process.env.WA_PHONE_NUMBER_ID);
  const accessToken = normalizeValue(stored?.wa_access_token) || normalizeValue(process.env.WA_ACCESS_TOKEN);
  const verifyToken = normalizeValue(stored?.wa_verify_token) || normalizeValue(process.env.WA_VERIFY_TOKEN);

  return {
    phoneNumberId,
    accessToken,
    verifyToken,
    configured: !!(phoneNumberId && accessToken && verifyToken),
    source: {
      phoneNumberId: normalizeValue(stored?.wa_phone_number_id) ? 'database' : (normalizeValue(process.env.WA_PHONE_NUMBER_ID) ? 'env' : 'missing'),
      accessToken: normalizeValue(stored?.wa_access_token) ? 'database' : (normalizeValue(process.env.WA_ACCESS_TOKEN) ? 'env' : 'missing'),
      verifyToken: normalizeValue(stored?.wa_verify_token) ? 'database' : (normalizeValue(process.env.WA_VERIFY_TOKEN) ? 'env' : 'missing'),
    },
  };
}

module.exports = {
  getStoredConfig,
  resolveWhatsAppConfig,
};