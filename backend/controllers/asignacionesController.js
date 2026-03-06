const pool = require('../database/connection');

// Asignar transportes a un ticket con cantidad de camiones por cada uno
exports.asignar = async (req, res) => {
    try {
        const { ticket_id, asignaciones } = req.body;
        // asignaciones = [{ transporte_id, cantidad_camiones, precio, comision, comision_porcentaje }]
        const operador_id = req.admin?.id || null;

        if (!ticket_id || !asignaciones || asignaciones.length === 0) {
            return res.status(400).json({ error: 'Faltan datos: ticket_id y asignaciones son requeridos' });
        }

        // Validar que la suma no exceda los camiones del ticket
        const [ticketRows] = await pool.query('SELECT cantidad_camiones, camiones_confirmados FROM tickets WHERE id = ?', [ticket_id]);
        if (ticketRows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

        // Camiones ya asignados (en estado Enviado o Aceptado)
        const [yaAsignados] = await pool.query(
            "SELECT COALESCE(SUM(cantidad_camiones), 0) as total FROM asignaciones WHERE ticket_id = ? AND estado IN ('Enviado', 'Aceptado')",
            [ticket_id]
        );
        const totalYaAsignado = yaAsignados[0].total;
        const nuevosTotal = asignaciones.reduce((s, a) => s + (a.cantidad_camiones || 1), 0);
        const disponibles = ticketRows[0].cantidad_camiones - totalYaAsignado;

        if (nuevosTotal > disponibles) {
            return res.status(400).json({ error: `Solo quedan ${disponibles} camiones por asignar (ya hay ${totalYaAsignado} asignados)` });
        }

        const resultados = [];
        for (const a of asignaciones) {
            const [result] = await pool.query(
                'INSERT INTO asignaciones (ticket_id, transporte_id, cantidad_camiones, precio, comision, comision_porcentaje, operador_asignador_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [ticket_id, a.transporte_id, a.cantidad_camiones || 1, a.precio || null, a.comision || null, a.comision_porcentaje || null, operador_id]
            );
            resultados.push(result.insertId);

            // Enviar mensaje WhatsApp al transporte
            try {
                const [tr] = await pool.query('SELECT nombre, telefono_whatsapp FROM transportes WHERE id = ?', [a.transporte_id]);
                const [tk] = await pool.query(
                    `SELECT t.origen, t.destino, t.fecha_requerida, c.nombre as cliente_nombre
                     FROM tickets t JOIN clientes c ON t.cliente_id = c.id WHERE t.id = ?`, [ticket_id]
                );
                if (tr.length > 0 && tr[0].telefono_whatsapp && tk.length > 0) {
                    const baileysService = require('../services/baileysService');
                    const fecha = new Date(tk[0].fecha_requerida).toLocaleDateString('es-CO');
                    const cantMsg = a.cantidad_camiones;
                    const precioMsg = a.precio ? `\n💲 Precio acordado: *$${parseFloat(a.precio).toLocaleString('es-AR')}*` : '';
                    let msgAceptar;
                    if (cantMsg > 1) {
                        msgAceptar = `¿Cuántos camiones aceptas?\n` +
                            `✅ Escribe *sí* para aceptar los ${cantMsg}\n` +
                            `🔢 O un número si aceptas menos (ej: *${cantMsg - 1}*)\n` +
                            `❌ Escribe *no* para rechazar`;
                    } else {
                        msgAceptar = `¿Aceptas este pedido?\n✅ Escribe *sí* para aceptar\n❌ Escribe *no* para rechazar`;
                    }
                    await baileysService.sendMessage(tr[0].telefono_whatsapp,
                        `¡Hola, *${tr[0].nombre}*! 🚛 Hay un nuevo pedido de carga:\n\n` +
                        `📍 Origen: *${tk[0].origen}*\n` +
                        `📍 Destino: *${tk[0].destino || '—'}*\n` +
                        `📅 Fecha: *${fecha}*\n` +
                        `🚛 Camiones solicitados: *${cantMsg}*\n` +
                        `👤 Cliente: *${tk[0].cliente_nombre}*` +
                        precioMsg +
                        `\n\n` +
                        msgAceptar
                    );
                }
            } catch (msgErr) {
                console.error('Error enviando WA a transporte:', msgErr.message);
            }
        }

        // Actualizar estado del ticket
        await pool.query(
            "UPDATE tickets SET estado = 'Asignado - Esperando respuesta' WHERE id = ? AND estado = 'Pendiente de asignación'",
            [ticket_id]
        );

        const detalle = asignaciones.map(a => `T${a.transporte_id}(${a.cantidad_camiones})`).join(', ');
        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [operador_id, 'Asignar transportes', 'ticket', ticket_id, `Asignaciones: ${detalle}`]
        );

        res.json({ message: `${resultados.length} transporte(s) asignado(s)`, asignacion_ids: resultados });
    } catch (error) {
        console.error('Error asignando transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Responder a una asignación (acepta o rechaza)
exports.responder = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'Aceptado' o 'Rechazado'

        if (!['Aceptado', 'Rechazado'].includes(estado)) {
            return res.status(400).json({ error: 'Estado debe ser Aceptado o Rechazado' });
        }

        await pool.query(
            'UPDATE asignaciones SET estado = ?, fecha_respuesta = NOW() WHERE id = ?',
            [estado, id]
        );

        // Obtener datos de la asignación
        const [asig] = await pool.query(
            'SELECT ticket_id, transporte_id FROM asignaciones WHERE id = ?',
            [id]
        );
        if (asig.length === 0) return res.status(404).json({ error: 'Asignación no encontrada' });

        const ticketId = asig[0].ticket_id;

        if (estado === 'Rechazado') {
            // Verificar si quedan asignaciones pendientes
            const [pendientes] = await pool.query(
                "SELECT COUNT(*) as total FROM asignaciones WHERE ticket_id = ? AND estado = 'Enviado'",
                [ticketId]
            );
            // Si no quedan pendientes, volver a estado inicial
            if (pendientes[0].total === 0) {
                await pool.query(
                    "UPDATE tickets SET estado = 'Pendiente de asignación' WHERE id = ?",
                    [ticketId]
                );
            }
        } else if (estado === 'Aceptado') {
            // Reconteo de camiones aceptados
            const [aceptados] = await pool.query(
                "SELECT COALESCE(SUM(cantidad_camiones), 0) as total FROM asignaciones WHERE ticket_id = ? AND estado = 'Aceptado'",
                [ticketId]
            );
            await pool.query(
                "UPDATE tickets SET camiones_confirmados = ?, estado = 'Aceptado - Pendiente datos camión' WHERE id = ?",
                [aceptados[0].total, ticketId]
            );
        }

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [null, `Transporte ${estado.toLowerCase()}`, 'asignacion', id, `Asignación #${id} para ticket #${ticketId}`]
        );

        res.json({ message: `Asignación marcada como ${estado}` });
    } catch (error) {
        console.error('Error respondiendo asignación:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Registrar datos del camión (después de aceptar) - agrega un vehículo
exports.registrarDatosCamion = async (req, res) => {
    try {
        const { id } = req.params;
        const { placa_camion, conductor_nombre, pagador_flete } = req.body;

        if (!placa_camion || !conductor_nombre) {
            return res.status(400).json({ error: 'Placa y conductor son requeridos' });
        }

        // Verificar asignación existe y está aceptada
        const [asig] = await pool.query('SELECT ticket_id, cantidad_camiones FROM asignaciones WHERE id = ? AND estado = "Aceptado"', [id]);
        if (asig.length === 0) return res.status(404).json({ error: 'Asignación no encontrada o no aceptada' });

        // Verificar que no excedan los camiones de la asignación
        const [yaRegistrados] = await pool.query(
            'SELECT COUNT(*) as total FROM vehiculos_asignados WHERE asignacion_id = ?', [id]
        );
        if (yaRegistrados[0].total >= asig[0].cantidad_camiones) {
            return res.status(400).json({ error: `Ya se registraron ${yaRegistrados[0].total}/${asig[0].cantidad_camiones} vehículos para esta asignación` });
        }

        // Insertar vehículo
        const [result] = await pool.query(
            'INSERT INTO vehiculos_asignados (asignacion_id, placa, conductor_nombre, pagador_flete) VALUES (?, ?, ?, ?)',
            [id, placa_camion.trim().toUpperCase(), conductor_nombre.trim(), pagador_flete ? pagador_flete.trim() : null]
        );

        // Actualizar placa/conductor en asignacion por compatibilidad
        await pool.query(
            'UPDATE asignaciones SET placa_camion = ?, conductor_nombre = ? WHERE id = ?',
            [placa_camion.trim().toUpperCase(), conductor_nombre.trim(), id]
        );

        const ticketId = asig[0].ticket_id;
        const totalVehiculos = yaRegistrados[0].total + 1;

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [null, 'Vehículo registrado', 'asignacion', id, `Placa: ${placa_camion}, Conductor: ${conductor_nombre} (${totalVehiculos}/${asig[0].cantidad_camiones})`]
        );

        res.json({
            message: 'Vehículo registrado',
            vehiculo_id: result.insertId,
            vehiculos_registrados: totalVehiculos,
            vehiculos_requeridos: asig[0].cantidad_camiones
        });
    } catch (error) {
        console.error('Error registrando vehículo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener asignaciones de un ticket
exports.getByTicket = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.*, t.nombre as transporte_nombre, t.telefono_whatsapp as transporte_telefono
             FROM asignaciones a
             JOIN transportes t ON a.transporte_id = t.id
             WHERE a.ticket_id = ?
             ORDER BY a.fecha_envio DESC`,
            [req.params.ticketId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo asignaciones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Notificar al cliente con datos de un vehículo
exports.notificarClienteVehiculo = async (req, res) => {
    try {
        const { vehiculoId } = req.params;
        const operador_id = req.admin?.id || null;

        // Obtener datos del vehículo + asignación + transporte + ticket + cliente
        const [rows] = await pool.query(
            `SELECT v.id as vehiculo_id, v.placa, v.conductor_nombre, v.notificado_cliente,
                    a.id as asignacion_id, a.ticket_id,
                    tr.nombre as transporte_nombre, tr.telefono_whatsapp as transporte_tel, tr.contacto_nombre as transporte_contacto,
                    t.origen, t.destino, t.fecha_requerida,
                    c.nombre as cliente_nombre, c.telefonos as cliente_telefonos, c.telefono_whatsapp as cliente_telefono
             FROM vehiculos_asignados v
             JOIN asignaciones a ON v.asignacion_id = a.id
             JOIN transportes tr ON a.transporte_id = tr.id
             JOIN tickets t ON a.ticket_id = t.id
             JOIN clientes c ON t.cliente_id = c.id
             WHERE v.id = ?`,
            [vehiculoId]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });

        const data = rows[0];

        // Determinar teléfono del cliente
        let telefonoCliente = data.cliente_telefono;
        if (!telefonoCliente && data.cliente_telefonos) {
            try {
                const tels = JSON.parse(data.cliente_telefonos);
                if (Array.isArray(tels) && tels.length > 0) telefonoCliente = tels[0];
            } catch (e) {}
        }

        if (!telefonoCliente) {
            return res.status(400).json({ error: 'El cliente no tiene número de WhatsApp registrado' });
        }

        // Enviar mensaje WhatsApp al cliente
        const baileysService = require('../services/baileysService');
        const fecha = new Date(data.fecha_requerida).toLocaleDateString('es-CO');

        await baileysService.sendMessage(telefonoCliente,
            `¡Hola, *${data.cliente_nombre}*! 👋\n\n` +
            `Te confirmamos los datos del camión asignado para tu pedido:\n\n` +
            `🚛 *Placa:* ${data.placa}\n` +
            `👤 *Conductor:* ${data.conductor_nombre}\n` +
            `🏢 *Empresa:* ${data.transporte_nombre}\n` +
            `📍 *Ruta:* ${data.origen} → ${data.destino || '—'}\n` +
            `📅 *Fecha:* ${fecha}\n\n` +
            `Si tienes dudas, comunícate con nosotros. ¡Gracias! 😊`
        );

        // Marcar como notificado
        await pool.query('UPDATE vehiculos_asignados SET notificado_cliente = 1 WHERE id = ?', [vehiculoId]);

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [operador_id, 'Notificar cliente vehículo', 'vehiculo_asignado', vehiculoId, `Placa: ${data.placa}, Conductor: ${data.conductor_nombre} → Cliente: ${data.cliente_nombre}`]
        );

        res.json({ message: 'Cliente notificado exitosamente' });
    } catch (error) {
        console.error('Error notificando cliente:', error);
        res.status(500).json({ error: 'Error al notificar al cliente' });
    }
};

// Historial de asignaciones por empresa de transporte
exports.historialPorTransporte = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT tr.id, tr.nombre, tr.telefono_whatsapp, tr.cantidad_vehiculos,
                    COUNT(a.id) as total_asignaciones,
                    SUM(a.cantidad_camiones) as total_camiones_solicitados,
                    SUM(CASE WHEN a.estado = 'Aceptado' THEN a.cantidad_camiones ELSE 0 END) as camiones_aceptados,
                    SUM(CASE WHEN a.estado = 'Rechazado' THEN a.cantidad_camiones ELSE 0 END) as camiones_rechazados,
                    SUM(CASE WHEN a.estado = 'Enviado' THEN a.cantidad_camiones ELSE 0 END) as camiones_pendientes,
                    MAX(a.fecha_envio) as ultima_asignacion
             FROM transportes tr
             LEFT JOIN asignaciones a ON tr.id = a.transporte_id
             WHERE tr.estado = 'Activo'
             GROUP BY tr.id
             ORDER BY total_asignaciones DESC, tr.nombre`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
