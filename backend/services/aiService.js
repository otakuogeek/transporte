// services/aiService.js - Integración con OpenAI para procesamiento de lenguaje natural
const axios = require('axios');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Extrae datos estructurados del mensaje de un cliente usando IA
 * @param {string} messageText - Texto del mensaje del cliente
 * @returns {Object} { documento, origen, destino, fecha_carga, tipo_vehiculo, es_solicitud }
 */
async function extractTransportRequest(messageText) {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de logística de transporte de carga. Tu tarea es extraer datos de solicitudes de transporte de mensajes de WhatsApp.

Analiza el mensaje del usuario y extrae la siguiente información en formato JSON:
{
  "es_solicitud": true/false,  // ¿El mensaje es una solicitud de transporte?
  "documento": "string o null",  // Número de documento/cédula/RUC del cliente
  "origen": "string o null",      // Ciudad o lugar de origen
  "destino": "string o null",     // Ciudad o lugar de destino
  "fecha_carga": "YYYY-MM-DD o null", // Fecha de carga (si dice "mañana", "lunes", etc., calcula la fecha)
  "tipo_vehiculo": "string o null",   // Tipo de vehículo (Furgón, Tractomula, Camión 350, Camioneta, etc.)
  "datos_faltantes": ["lista de datos que no proporcionó"] // Lista de campos que faltan para completar la solicitud
}

Si el mensaje NO es una solicitud de transporte (ej: saludo, pregunta general), devuelve:
{ "es_solicitud": false, "datos_faltantes": [] }

Hoy es ${new Date().toISOString().split('T')[0]}.
IMPORTANTE: Responde SOLO con el JSON, sin markdown ni explicaciones.`,
          },
          {
            role: 'user',
            content: messageText,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    // Limpiar posible markdown wrapping
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('✗ Error en servicio IA:', error.response?.data || error.message);
    return { es_solicitud: false, datos_faltantes: [], error: true };
  }
}

/**
 * Extrae el precio de la respuesta de un chofer
 * @param {string} messageText - Texto del mensaje del chofer
 * @returns {Object} { tiene_precio, precio, disponible }
 */
async function extractDriverQuote(messageText) {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que interpreta respuestas de choferes de transporte de carga en Colombia.
            
Analiza el mensaje del chofer y extrae la información en JSON:
{
  "tiene_precio": true/false,
  "precio": number o null,     // Precio convertido a número entero
  "solicitud_id": number o null, // ID de la solicitud si lo menciona (ej: #3 o "viaje 3")
  "disponible": true/false    // ¿Indica que puede hacer el viaje?
}

Instrucciones para "precio":
- Interpreta formatos coloquiales: "100k" -> 100000, "1.2M" -> 1200000, "cien mil" -> 100000, "450.000" -> 450000.
- Si menciona varios precios, usa el que parezca la oferta final.
- Si no hay precio claro, pon null.

Instrucciones para "solicitud_id":
- Busca patrones como #123, "para el 123", "el de medellin 123", etc.

IMPORTANTE: Responde SOLO con el JSON, sin markdown.`,
          },
          {
            role: 'user',
            content: messageText,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('✗ Error extrayendo cotización:', error.response?.data || error.message);
    const apiError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    return { tiene_precio: false, precio: null, disponible: false, error: true, error_detail: apiError };
  }
}

/**
 * Usa IA para identificar a qué tipo de vehículo se refiere el usuario.
 * Recibe la lista de tipos disponibles en la BD y el texto del usuario.
 * @param {string} textoUsuario - Lo que escribió el usuario
 * @param {string[]} tiposDisponibles - Lista de tipos de vehículo en la BD
 * @returns {Object} { tipo_vehiculo: string|null, confianza: 'alta'|'media'|'baja' }
 */
async function matchVehicleType(textoUsuario, tiposDisponibles) {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de logística de carga en Colombia. Tu tarea es identificar a qué tipo de vehículo se refiere el usuario.

Los tipos de vehículo disponibles son:
${tiposDisponibles.map(t => `- ${t}`).join('\n')}

Analiza el texto del usuario e identifica cuál de los tipos disponibles coincide mejor, considerando:
- Errores de ortografía o typos (ej: "tractormula" = "Tractomula", "furjon" = "Furgón")
- Sinónimos o descripciones (ej: "camión grande" podría ser "Tractomula", "mula" = "Tractomula")
- Nombres coloquiales colombianos
- Si el usuario describe una necesidad de carga, inferir el vehículo adecuado

Responde SOLO con JSON:
{
  "tipo_vehiculo": "nombre exacto del tipo disponible que coincide, o null si no hay match",
  "confianza": "alta|media|baja"
}

Si no logras identificar el vehículo con ninguno de los disponibles, devuelve tipo_vehiculo: null.
IMPORTANTE: Responde SOLO con el JSON, sin markdown ni explicaciones.`,
          },
          {
            role: 'user',
            content: textoUsuario,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('✗ Error en matchVehicleType IA:', error.response?.data || error.message);
    return { tipo_vehiculo: null, confianza: 'baja' };
  }
}

module.exports = {
  extractTransportRequest,
  extractDriverQuote,
  matchVehicleType,
};
