// controllers/webhookController.js - Controlador del Webhook de WhatsApp
const pool = require('../database/connection');
const whatsappService = require('../services/whatsappService');
const aiService = require('../services/aiService');
const cotizacionService = require('../services/cotizacionService');

/**
 * GET /webhook - Verificación del Webhook (requerido por Meta)
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('✓ Webhook verificado correctamente');
    return res.status(200).send(challenge);
  }

  console.warn('✗ Verificación de Webhook fallida');
  return res.sendStatus(403);
}

/**
 * POST /webhook - Recibe mensajes entrantes de WhatsApp
 */
async function handleIncomingMessage(req, res) {
  // Responder 200 inmediatamente (requisito de Meta, si no se responde rápido, re-envían)
  res.sendStatus(200);

  try {
    const body = req.body;

    // Validar que sea un mensaje de WhatsApp
    if (
      !body.object ||
      !body.entry ||
      !body.entry[0]?.changes ||
      !body.entry[0]?.changes[0]?.value?.messages
    ) {
      return;
    }

    const change = body.entry[0].changes[0].value;
    const message = change.messages[0];
    const senderPhone = message.from; // Número del remitente
    const messageId = message.id;
    const messageType = message.type;

    // Solo procesamos mensajes de texto por ahora
    if (messageType !== 'text') {
      await whatsappService.sendTextMessage(
        senderPhone,
        '⚠️ Por el momento solo procesamos mensajes de texto. Por favor, escríba su solicitud.'
      );
      return;
    }

    const messageText = message.text.body;

    // Marcar como leído
    await whatsappService.markAsRead(messageId);

    // Registrar mensaje entrante en log
    await pool.query(
      `INSERT INTO mensajes_log (wa_message_id, telefono, direccion, contenido, tipo_mensaje)
       VALUES (?, ?, 'entrante', ?, ?)`,
      [messageId, senderPhone, messageText, messageType]
    );

    // ===== DETERMINAR SI ES CLIENTE O CHOFER =====
    const esChofer = await identificarChofer(senderPhone);
    if (esChofer) {
      await procesarMensajeChofer(senderPhone, messageText, esChofer);
      return;
    }

    // Si no es chofer, procesamos como cliente
    await procesarMensajeCliente(senderPhone, messageText);
  } catch (error) {
    console.error('✗ Error procesando mensaje webhook:', error);
  }
}

/**
 * Identifica si el remitente es un chofer registrado
 */
async function identificarChofer(telefono) {
  const [rows] = await pool.query(
    'SELECT id, nombre, estado FROM choferes WHERE telefono_whatsapp = ?',
    [telefono]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Procesa mensajes de choferes (cotizaciones / disponibilidad)
 */
async function procesarMensajeChofer(telefono, texto, chofer) {
  try {
    // Buscar si hay solicitudes en estado "Cotizando" pendientes para este chofer
    const [solicitudesPendientes] = await pool.query(
      `SELECT s.id, s.origen, s.destino, s.tipo_vehiculo_requerido
       FROM solicitudes s
       JOIN vehiculos v ON LOWER(v.tipo_vehiculo) LIKE CONCAT('%', LOWER(s.tipo_vehiculo_requerido), '%')
       WHERE v.chofer_id = ?
         AND s.estado = 'Cotizando'
         AND s.id NOT IN (
           SELECT solicitud_id FROM cotizaciones WHERE chofer_id = ?
         )
       ORDER BY s.fecha_creacion DESC
       LIMIT 1`,
      [chofer.id, chofer.id]
    );

    if (solicitudesPendientes.length === 0) {
      await whatsappService.sendTextMessage(
        telefono,
        `Hola ${chofer.nombre}, no tienes solicitudes de cotización pendientes en este momento. Te notificaremos cuando haya una nueva ruta disponible. 🚛`
      );
      return;
    }

    const solicitud = solicitudesPendientes[0];

    // Usar IA para extraer el precio del mensaje del chofer
    const resultado = await aiService.extractDriverQuote(texto);

    if (resultado.mensaje_no_claro || !resultado.tiene_precio) {
      if (!resultado.disponible) {
        await whatsappService.sendTextMessage(
          telefono,
          `Entendido ${chofer.nombre}, gracias por responder. Quedarás pendiente para futuras rutas. 👍`
        );
      } else {
        await whatsappService.sendTextMessage(
          telefono,
          `${chofer.nombre}, por favor indica tu tarifa como un número. Ejemplo: "Mi tarifa es 350" 💰`
        );
      }
      return;
    }

    // Guardar la cotización en la base de datos
    await pool.query(
      `INSERT INTO cotizaciones (solicitud_id, chofer_id, costo_ofrecido)
       VALUES (?, ?, ?)`,
      [solicitud.id, chofer.id, resultado.precio]
    );

    // Registrar en log
    await pool.query(
      `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto, solicitud_id)
       VALUES (?, 'entrante', ?, 'cotizacion_chofer', ?)`,
      [telefono, texto, solicitud.id]
    );

    await whatsappService.sendTextMessage(
      telefono,
      `✅ Cotización recibida: ${resultado.precio} para la ruta ${solicitud.origen} → ${solicitud.destino}. ¡Gracias ${chofer.nombre}!`
    );

    console.log(`✓ Cotización registrada: Chofer ${chofer.nombre} → ${resultado.precio} para solicitud #${solicitud.id}`);
  } catch (error) {
    console.error('✗ Error procesando mensaje de chofer:', error);
    await whatsappService.sendTextMessage(
      telefono,
      'Hubo un error procesando tu respuesta. Por favor intenta de nuevo.'
    );
  }
}

/**
 * Procesa mensajes de clientes (nuevas solicitudes)
 */
async function procesarMensajeCliente(telefono, texto) {
  try {
    // Verificar si el cliente ya está registrado
    const [clientes] = await pool.query(
      `SELECT id, nombre, documento FROM clientes
       WHERE telefono_whatsapp = ? OR JSON_SEARCH(telefonos, 'one', ?) IS NOT NULL
       LIMIT 1`,
      [telefono, telefono]
    );

    // Verificar si el texto es una confirmación (SÍ/NO) para una solicitud adjudicada
    const textoLower = texto.toLowerCase().trim();
    if (clientes.length > 0 && (textoLower === 'sí' || textoLower === 'si' || textoLower === 'no')) {
      await procesarConfirmacionCliente(telefono, textoLower, clientes[0]);
      return;
    }

    // Usar IA para analizar el mensaje
    const datos = await aiService.extractTransportRequest(texto);

    if (!datos.es_solicitud) {
      // Mensaje general - responder con menú de ayuda
      const nombre = clientes.length > 0 ? clientes[0].nombre : '';
      await whatsappService.sendTextMessage(
        telefono,
        `¡Hola${nombre ? ' ' + nombre : ''}! 👋\n\n` +
        `Soy el asistente de *FALC Logística*. Para solicitar un transporte, envíame un mensaje con:\n\n` +
        `📋 Tu documento (cédula/RUC)\n` +
        `📍 Ciudad de origen\n` +
        `📍 Ciudad de destino\n` +
        `📅 Fecha de carga\n` +
        `🚗 Tipo de vehículo\n\n` +
        `*Ejemplo:* "Necesito un furgón para el 15 de marzo, de Lima a Arequipa. Mi documento es 12345678"`
      );
      return;
    }

    // Verificar si faltan datos
    if (datos.datos_faltantes && datos.datos_faltantes.length > 0) {
      const faltantes = datos.datos_faltantes.join(', ');
      await whatsappService.sendTextMessage(
        telefono,
        `📝 Recibimos tu solicitud, pero nos faltan algunos datos:\n*${faltantes}*\n\nPor favor, envía la información completa.`
      );
      return;
    }

    // Buscar cliente por documento
    let clienteId = null;
    if (datos.documento) {
      const [clienteDoc] = await pool.query(
        'SELECT id, nombre FROM clientes WHERE documento = ?',
        [datos.documento]
      );

      if (clienteDoc.length > 0) {
        clienteId = clienteDoc[0].id;
      } else if (clientes.length > 0) {
        // Cliente registrado por teléfono pero con otro documento
        clienteId = clientes[0].id;
      } else {
        // Cliente no registrado - pedir registro
        await whatsappService.sendTextMessage(
          telefono,
          `⚠️ No encontramos tu documento *${datos.documento}* en nuestro sistema.\n\n` +
          `Para registrarte, envía tu nombre completo y te registraremos automáticamente.`
        );

        // Guardar datos temporales en el log para cuando se registre
        await pool.query(
          `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto)
           VALUES (?, 'sistema', ?, 'pendiente_registro')`,
          [telefono, JSON.stringify(datos)]
        );
        return;
      }
    } else if (clientes.length > 0) {
      clienteId = clientes[0].id;
    } else {
      await whatsappService.sendTextMessage(
        telefono,
        `⚠️ Necesitamos tu número de documento para procesar la solicitud. Por favor inclúyelo en tu mensaje.`
      );
      return;
    }

    // ===== CREAR LA SOLICITUD =====
    const [result] = await pool.query(
      `INSERT INTO solicitudes (cliente_id, origen, destino, fecha_carga, tipo_vehiculo_requerido, estado)
       VALUES (?, ?, ?, ?, ?, 'Pendiente')`,
      [clienteId, datos.origen, datos.destino, datos.fecha_carga, datos.tipo_vehiculo]
    );

    const solicitudId = result.insertId;

    // Notificar al cliente que se está procesando
    await whatsappService.sendTextMessage(
      telefono,
      `✅ *Solicitud #${solicitudId} creada exitosamente*\n\n` +
      `📍 ${datos.origen} → ${datos.destino}\n` +
      `📅 ${datos.fecha_carga}\n` +
      `🚗 ${datos.tipo_vehiculo}\n\n` +
      `🔄 *Su cotización se está procesando.* Estamos contactando a los choferes disponibles. Le notificaremos pronto con el mejor precio.`
    );

    // Registrar log
    await pool.query(
      `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto, solicitud_id)
       VALUES (?, 'sistema', ?, 'solicitud_creada', ?)`,
      [telefono, JSON.stringify(datos), solicitudId]
    );

    // ===== INICIAR PROCESO DE COTIZACIÓN =====
    const resultado = await cotizacionService.solicitarCotizacionesAChoferes(solicitudId);

    if (resultado.choferes_contactados === 0) {
      await whatsappService.sendTextMessage(
        telefono,
        `⚠️ En este momento no tenemos choferes disponibles con vehículo tipo *${datos.tipo_vehiculo}*. Un operador se pondrá en contacto contigo pronto.`
      );
      return;
    }

    // Obtener tiempo de espera de la configuración
    const [configTiempo] = await pool.query(
      "SELECT valor FROM configuracion WHERE nombre_parametro = 'tiempo_espera_cotizacion'"
    );
    const minutosEspera = configTiempo.length > 0 ? parseFloat(configTiempo[0].valor) : 30;

    // Programar selección automática
    cotizacionService.programarSeleccionAutomatica(solicitudId, minutosEspera);

    console.log(`✓ Solicitud #${solicitudId} creada. ${resultado.choferes_contactados} chofer(es) contactados. Selección en ${minutosEspera} min.`);
  } catch (error) {
    console.error('✗ Error procesando mensaje de cliente:', error);
    await whatsappService.sendTextMessage(
      telefono,
      'Disculpa, hubo un error procesando tu solicitud. Por favor intenta de nuevo en unos minutos.'
    );
  }
}

/**
 * Procesa confirmación del cliente (SÍ/NO) para solicitud adjudicada
 */
async function procesarConfirmacionCliente(telefono, respuesta, cliente) {
  try {
    const [solicitudes] = await pool.query(
      `SELECT id, origen, destino, precio_final_cliente, chofer_asignado_id
       FROM solicitudes
       WHERE cliente_id = ? AND estado = 'Adjudicada'
       ORDER BY fecha_creacion DESC LIMIT 1`,
      [cliente.id]
    );

    if (solicitudes.length === 0) return;

    const solicitud = solicitudes[0];

    if (respuesta === 'sí' || respuesta === 'si') {
      await pool.query("UPDATE solicitudes SET estado = 'Completada' WHERE id = ?", [solicitud.id]);

      await whatsappService.sendTextMessage(
        telefono,
        `🎉 *¡Transporte confirmado!*\n\nSolicitud #${solicitud.id} confirmada por ${solicitud.precio_final_cliente}.\nPronto te compartiremos los datos del chofer asignado. ¡Gracias por confiar en FALC Logística!`
      );

      // Notificar al chofer
      if (solicitud.chofer_asignado_id) {
        const [chofer] = await pool.query(
          'SELECT telefono_whatsapp, nombre FROM choferes WHERE id = ?',
          [solicitud.chofer_asignado_id]
        );
        if (chofer.length > 0) {
          await whatsappService.sendTextMessage(
            chofer[0].telefono_whatsapp,
            `🎉 *¡Ruta confirmada!* El cliente ha aceptado la solicitud #${solicitud.id}.\n\n📍 ${solicitud.origen} → ${solicitud.destino}\n\nTe contactaremos con los detalles de coordinación.`
          );
          // Actualizar estado del chofer
          await pool.query("UPDATE choferes SET estado = 'En Viaje' WHERE id = ?", [solicitud.chofer_asignado_id]);
        }
      }
    } else {
      await pool.query("UPDATE solicitudes SET estado = 'Rechazada' WHERE id = ?", [solicitud.id]);
      await whatsappService.sendTextMessage(
        telefono,
        `❌ Solicitud #${solicitud.id} rechazada. Puedes crear una nueva solicitud cuando gustes. ¡Estamos para ayudarte!`
      );
    }
  } catch (error) {
    console.error('✗ Error procesando confirmación:', error);
  }
}

module.exports = {
  verifyWebhook,
  handleIncomingMessage,
};
