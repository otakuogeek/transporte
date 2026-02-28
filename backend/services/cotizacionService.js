// services/cotizacionService.js - Lógica de cotización y selección automática (Baileys)
const pool = require('../database/connection');

/**
 * Busca choferes disponibles con el tipo de vehículo requerido
 * y les envía solicitud de cotización por WhatsApp (Baileys)
 * Guarda la cantidad de choferes contactados en la solicitud.
 */
async function solicitarCotizacionesAChoferesBaileys(solicitudId) {
  const baileysService = require('./baileysService');

  try {
    const [solicitudes] = await pool.query(
      'SELECT s.*, c.nombre as cliente_nombre FROM solicitudes s JOIN clientes c ON s.cliente_id = c.id WHERE s.id = ?',
      [solicitudId]
    );
    if (solicitudes.length === 0) throw new Error(`Solicitud ${solicitudId} no encontrada`);
    const solicitud = solicitudes[0];

    // Buscar choferes disponibles con vehículos del tipo requerido
    const [choferes] = await pool.query(
      `SELECT ch.id, ch.nombre, ch.telefono_whatsapp, v.placa, v.tipo_vehiculo, v.capacidad_toneladas
       FROM choferes ch
       JOIN vehiculos v ON v.chofer_id = ch.id
       WHERE ch.estado = 'Disponible'
         AND LOWER(v.tipo_vehiculo) LIKE LOWER(?)
       ORDER BY ch.nombre`,
      [`%${solicitud.tipo_vehiculo_requerido}%`]
    );

    if (choferes.length === 0) {
      console.log(`⚠ No se encontraron choferes disponibles para: ${solicitud.tipo_vehiculo_requerido}`);
      return { choferes_contactados: 0 };
    }

    // Actualizar estado y guardar cantidad de choferes contactados
    await pool.query(
      'UPDATE solicitudes SET estado = ?, choferes_contactados = ? WHERE id = ?',
      ['Cotizando', choferes.length, solicitudId]
    );

    // Formatear fecha
    const fechaFormateada = solicitud.fecha_carga
      ? new Date(solicitud.fecha_carga).toLocaleDateString('es-CO')
      : 'Por definir';

    // Enviar mensaje a cada chofer (asistente Falc AI)
    let contactados = 0;
    for (const chofer of choferes) {
      const mensaje =
        `¡Hola, *${chofer.nombre}*! 👋 Soy el asistente de Falc AI\n\n` +
        `Te tengo una ruta nueva que te puede interesar 🚛\n\n` +
        `📋 *Solicitud #${solicitudId}*\n` +
        `📍 De: *${solicitud.origen}*\n` +
        `📍 A: *${solicitud.destino}*\n` +
        `📅 Fecha: *${fechaFormateada}*\n` +
        `🚗 Vehículo: *${solicitud.tipo_vehiculo_requerido}*\n\n` +
        `¿Te interesa? Escríbeme tu tarifa directamente (ej: *450.000* o *450k*).\n\n` +
        `¡Quedo atenta! 😊`;

      try {
        await baileysService.sendMessage(chofer.telefono_whatsapp, mensaje);
        await pool.query(
          `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto, solicitud_id)
           VALUES (?, 'saliente', ?, 'solicitud_cotizacion', ?)`,
          [chofer.telefono_whatsapp, mensaje, solicitudId]
        );

        // Registrar contacto para seguimiento
        await pool.query(
          'INSERT INTO solicitudes_contactos (solicitud_id, chofer_id) VALUES (?, ?)',
          [solicitudId, chofer.id]
        );

        contactados++;
        console.log(`✓ Solicitud #${solicitudId} enviada a ${chofer.nombre} (${chofer.telefono_whatsapp})`);
      } catch (err) {
        console.error(`✗ No se pudo contactar al chofer ${chofer.nombre}:`, err.message);
      }
    }

    // Actualizar contactados reales (podría ser menos si falló alguno)
    if (contactados !== choferes.length) {
      await pool.query(
        'UPDATE solicitudes SET choferes_contactados = ? WHERE id = ?',
        [contactados, solicitudId]
      );
    }

    console.log(`✓ Cotización solicitada a ${contactados} chofer(es) para solicitud #${solicitudId}`);
    return { choferes_contactados: contactados, choferes };
  } catch (error) {
    console.error('✗ Error solicitando cotizaciones Baileys:', error.message);
    throw error;
  }
}

/**
 * Verifica si todos los choferes contactados ya respondieron.
 * Si es así, dispara la selección automática inmediata.
 * @returns {boolean} true si se disparó la selección
 */
async function verificarCotizacionesCompletas(solicitudId) {
  try {
    // Obtener solicitud
    const [sol] = await pool.query(
      "SELECT estado, choferes_contactados, tipo_vehiculo_requerido FROM solicitudes WHERE id = ? AND estado = 'Cotizando'",
      [solicitudId]
    );

    if (sol.length === 0) return false;

    const totalContactados = sol[0].choferes_contactados || 0;
    if (totalContactados === 0) return false;

    // Contar cotizaciones recibidas
    const [cotizaciones] = await pool.query(
      'SELECT COUNT(*) as total FROM cotizaciones WHERE solicitud_id = ?',
      [solicitudId]
    );

    const totalCotizaciones = cotizaciones[0].total;

    console.log(`📊 Solicitud #${solicitudId}: ${totalCotizaciones}/${totalContactados} cotizaciones recibidas`);

    if (totalCotizaciones >= totalContactados) {
      console.log(`✅ Todos los choferes contactados respondieron para solicitud #${solicitudId}.`);

      // Contar cuántos vehículos disponibles hay del tipo requerido
      const [vehiculosDisp] = await pool.query(
        `SELECT COUNT(v.id) as total_vehiculos
         FROM vehiculos v
         JOIN choferes ch ON v.chofer_id = ch.id
         WHERE ch.estado = 'Disponible'
           AND LOWER(v.tipo_vehiculo) LIKE LOWER(?)`,
        [`%${sol[0].tipo_vehiculo_requerido}%`]
      );

      const totalVehiculosRequeridos = vehiculosDisp[0].total_vehiculos;

      // Si hay más de un vehículo de este tipo, debe esperar el tiempo de cotización (timeout)
      if (totalVehiculosRequeridos > 1) {
        console.log(`⏳ Solicitud #${solicitudId}: Hay ${totalVehiculosRequeridos} vehículos de tipo '${sol[0].tipo_vehiculo_requerido}'. Esperando el tiempo completo de cotización.`);
        return false;
      }

      console.log(`✅ Solo hay ${totalVehiculosRequeridos} vehículo(s) de tipo '${sol[0].tipo_vehiculo_requerido}'. Seleccionando ganador anticipadamente...`);
      await seleccionarMejorCotizacionBaileys(solicitudId);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ Error verificando cotizaciones para #${solicitudId}:`, error.message);
    return false;
  }
}

/**
 * Selecciona la mejor cotización y notifica al cliente vía Baileys.
 * Menor precio gana. En empate, gana la primera en llegar.
 * Calcula precio_cliente = precio_chofer + margen_ganancia%.
 * Notifica al cliente con el precio y al chofer que ganó.
 */
async function seleccionarMejorCotizacionBaileys(solicitudId) {
  const baileysService = require('./baileysService');

  try {
    // Obtener cotizaciones ordenadas por precio (menor primero)
    const [cotizaciones] = await pool.query(
      `SELECT cot.*, ch.nombre as chofer_nombre, ch.telefono_whatsapp as chofer_telefono
       FROM cotizaciones cot
       JOIN choferes ch ON cot.chofer_id = ch.id
       WHERE cot.solicitud_id = ?
       ORDER BY cot.costo_ofrecido ASC, cot.fecha_cotizacion ASC`,
      [solicitudId]
    );

    if (cotizaciones.length === 0) {
      console.log(`⚠ No hay cotizaciones para solicitud #${solicitudId}`);

      // Notificar al cliente que no hubo cotizaciones
      const [solData] = await pool.query(
        `SELECT c.telefono_whatsapp FROM solicitudes s
         JOIN clientes c ON s.cliente_id = c.id WHERE s.id = ?`,
        [solicitudId]
      );
      if (solData.length > 0) {
        try {
          await baileysService.sendMessage(
            solData[0].telefono_whatsapp,
            `Oye, lamentablemente no recibí cotizaciones de los choferes para tu solicitud #${solicitudId} 😔\n\n` +
            `¿Quieres que volvamos a intentar? Escríbeme *menú* para crear una nueva solicitud 😊`
          );
        } catch (e) { console.error('Error notificando falta de cotizaciones:', e.message); }
        await pool.query("UPDATE solicitudes SET estado = 'Rechazada' WHERE id = ?", [solicitudId]);
      }
      return null;
    }

    // La primera es la ganadora (menor costo)
    const ganadora = cotizaciones[0];

    // Obtener el % de ganancia
    const [config] = await pool.query(
      "SELECT valor FROM configuracion WHERE nombre_parametro = 'margen_ganancia'"
    );
    const margenGanancia = config.length > 0 ? parseFloat(config[0].valor) : 5.0;

    // Calcular precio para el cliente
    const precioChofer = parseFloat(ganadora.costo_ofrecido);
    const precioFinalCliente = precioChofer * (1 + margenGanancia / 100);

    // Marcar cotización ganadora
    await pool.query('UPDATE cotizaciones SET es_ganadora = TRUE WHERE id = ?', [ganadora.id]);

    // Actualizar solicitud
    await pool.query(
      `UPDATE solicitudes
       SET estado = 'Adjudicada',
           precio_final_cliente = ?,
           chofer_asignado_id = ?
       WHERE id = ?`,
      [precioFinalCliente.toFixed(2), ganadora.chofer_id, solicitudId]
    );

    // Obtener datos completos para notificaciones
    const [solicitud] = await pool.query(
      `SELECT s.*, c.telefono_whatsapp as cliente_telefono, c.nombre as cliente_nombre
       FROM solicitudes s
       JOIN clientes c ON s.cliente_id = c.id
       WHERE s.id = ?`,
      [solicitudId]
    );

    if (solicitud.length > 0) {
      const sol = solicitud[0];
      const fechaFormateada = sol.fecha_carga
        ? new Date(sol.fecha_carga).toLocaleDateString('es-CO')
        : 'Por definir';

      const precioFormateado = Number(precioFinalCliente).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });

      // ===== NOTIFICAR AL CLIENTE =====
      const mensajeCliente =
        `¡${sol.cliente_nombre}! Ya tengo tu cotización lista 🎉\n\n` +
        `📋 Solicitud *#${solicitudId}*\n` +
        `📍 ${sol.origen} → ${sol.destino}\n` +
        `📅 ${fechaFormateada}\n` +
        `🚗 ${sol.tipo_vehiculo_requerido}\n\n` +
        `💰 *El costo del traslado es de $${precioFormateado}*\n\n` +
        `¿Lo tomamos? Escríbeme *sí* para contratar o *no* si prefieres dejarlo 😊`;

      try {
        await baileysService.sendMessage(sol.cliente_telefono, mensajeCliente);
        console.log(`✓ Cotización enviada al cliente ${sol.cliente_nombre} para solicitud #${solicitudId}`);

        // Actualizar estado de conversación del cliente para esperar su respuesta
        const baileysBot = require('./baileysBot');
        baileysBot.setConversacionStep(sol.cliente_telefono, 'confirmar_viaje', {
          solicitudConfirmar: solicitudId
        });

      } catch (e) {
        console.error('Error notificando al cliente:', e.message);
      }

      // Log
      await pool.query(
        `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto, solicitud_id)
         VALUES (?, 'saliente', ?, 'cotizacion_lista', ?)`,
        [sol.cliente_telefono, mensajeCliente, solicitudId]
      );
    }

    console.log(`✅ Solicitud #${solicitudId}: Ganador ${ganadora.chofer_nombre} ($${precioChofer}) → Cliente $${precioFinalCliente.toFixed(2)} (margen ${margenGanancia}%)`);

    return {
      cotizacion_ganadora: ganadora,
      precio_chofer: precioChofer,
      margen_ganancia: margenGanancia,
      precio_final_cliente: precioFinalCliente,
    };
  } catch (error) {
    console.error('✗ Error seleccionando mejor cotización:', error.message);
    throw error;
  }
}

/**
 * Programa la selección automática después de X minutos.
 * Si al expirar el timer la solicitud sigue en "Cotizando",
 * selecciona la mejor cotización disponible (aunque no todos hayan respondido).
 */
function programarSeleccionAutomatica(solicitudId, minutosEspera) {
  const ms = (minutosEspera || 30) * 60 * 1000;
  console.log(`⏱ Selección automática para solicitud #${solicitudId} en ${minutosEspera} minutos`);

  setTimeout(async () => {
    try {
      // Verificar que la solicitud siga en estado "Cotizando"
      const [sol] = await pool.query('SELECT estado FROM solicitudes WHERE id = ?', [solicitudId]);
      if (sol.length > 0 && sol[0].estado === 'Cotizando') {
        console.log(`⏱ Timeout alcanzado para solicitud #${solicitudId}. Seleccionando mejor cotización disponible...`);
        await seleccionarMejorCotizacionBaileys(solicitudId);
      } else {
        console.log(`⏱ Solicitud #${solicitudId} ya no está en Cotizando (estado: ${sol[0]?.estado}). Timer ignorado.`);
      }
    } catch (error) {
      console.error(`✗ Error en selección automática para solicitud #${solicitudId}:`, error.message);
    }
  }, ms);
}

module.exports = {
  solicitarCotizacionesAChoferesBaileys,
  verificarCotizacionesCompletas,
  seleccionarMejorCotizacionBaileys,
  programarSeleccionAutomatica,
};
