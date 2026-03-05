const pool = require('../database/connection');

// Obtener todos los tickets con filtros
exports.getAll = async (req, res) => {
    try {
        const { estado, cliente_id, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT t.*, c.nombre as cliente_nombre, c.origen_default as cliente_origen,
                   a.nombre as operador_nombre,
                   tv.nombre as tipo_vehiculo_nombre, tv.capacidad_toneladas as tipo_vehiculo_capacidad
            FROM tickets t
            LEFT JOIN clientes c ON t.cliente_id = c.id
            LEFT JOIN administradores a ON t.operador_creador_id = a.id
            LEFT JOIN tipos_vehiculos tv ON t.tipo_vehiculo_id = tv.id
            WHERE 1=1
        `;
        const params = [];

        if (estado) { query += ' AND t.estado = ?'; params.push(estado); }
        if (cliente_id) { query += ' AND t.cliente_id = ?'; params.push(cliente_id); }
        if (fecha_desde) { query += ' AND t.fecha_creacion >= ?'; params.push(fecha_desde); }
        if (fecha_hasta) { query += ' AND t.fecha_creacion <= ?'; params.push(fecha_hasta + ' 23:59:59'); }

        query += ' ORDER BY t.id DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo tickets:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener un ticket por ID con sus asignaciones
exports.getById = async (req, res) => {
    try {
        const [tickets] = await pool.query(
            `SELECT t.*, c.nombre as cliente_nombre, c.origen_default as cliente_origen,
                    a.nombre as operador_nombre,
                    tv.nombre as tipo_vehiculo_nombre, tv.capacidad_toneladas as tipo_vehiculo_capacidad
             FROM tickets t
             LEFT JOIN clientes c ON t.cliente_id = c.id
             LEFT JOIN administradores a ON t.operador_creador_id = a.id
             LEFT JOIN tipos_vehiculos tv ON t.tipo_vehiculo_id = tv.id
             WHERE t.id = ?`,
            [req.params.id]
        );
        if (tickets.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

        const [asignaciones] = await pool.query(
            `SELECT a.*, tr.nombre as transporte_nombre, tr.telefono_whatsapp as transporte_telefono,
                    adm.nombre as operador_asignador_nombre
             FROM asignaciones a
             JOIN transportes tr ON a.transporte_id = tr.id
             LEFT JOIN administradores adm ON a.operador_asignador_id = adm.id
             WHERE a.ticket_id = ?
             ORDER BY a.fecha_envio DESC`,
            [req.params.id]
        );

        // Calcular camiones ya asignados (Enviado + Aceptado)
        const camionesAsignados = asignaciones
            .filter(a => a.estado === 'Enviado' || a.estado === 'Aceptado')
            .reduce((s, a) => s + (a.cantidad_camiones || 1), 0);

        // Obtener vehículos registrados para cada asignación
        const asigIds = asignaciones.map(a => a.id);
        let vehiculos = [];
        if (asigIds.length > 0) {
            const [vRows] = await pool.query(
                `SELECT * FROM vehiculos_asignados WHERE asignacion_id IN (?) ORDER BY id`,
                [asigIds]
            );
            vehiculos = vRows;
        }

        // Agrupar vehículos por asignacion_id
        const asignacionesConVehiculos = asignaciones.map(a => ({
            ...a,
            vehiculos: vehiculos.filter(v => v.asignacion_id === a.id)
        }));

        res.json({ ...tickets[0], asignaciones: asignacionesConVehiculos, camiones_asignados: camionesAsignados });
    } catch (error) {
        console.error('Error obteniendo ticket:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Crear un ticket manualmente desde el panel
exports.create = async (req, res) => {
    try {
        const { cliente_id, origen, destino, cantidad_camiones, tipo_vehiculo_id, fecha_requerida, observaciones } = req.body;
        const operador_id = req.admin?.id || null;

        const [result] = await pool.query(
            `INSERT INTO tickets (cliente_id, origen, destino, cantidad_camiones, tipo_vehiculo_id, fecha_requerida, observaciones, operador_creador_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cliente_id, origen, destino || null, cantidad_camiones || 1, tipo_vehiculo_id || null, fecha_requerida, observaciones || null, operador_id]
        );

        // Log de acción
        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [operador_id, 'Crear ticket', 'ticket', result.insertId, `Ticket #${result.insertId} creado para cliente #${cliente_id}`]
        );

        res.status(201).json({ id: result.insertId, message: 'Ticket creado exitosamente' });
    } catch (error) {
        console.error('Error creando ticket:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Actualizar estado del ticket
exports.updateEstado = async (req, res) => {
    try {
        const { estado } = req.body;
        const operador_id = req.admin?.id || null;

        await pool.query('UPDATE tickets SET estado = ? WHERE id = ?', [estado, req.params.id]);

        // Si se confirma al cliente, registrar fecha
        if (estado === 'Confirmado al cliente') {
            await pool.query('UPDATE tickets SET fecha_confirmacion_cliente = NOW() WHERE id = ?', [req.params.id]);
        }

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [operador_id, 'Cambiar estado', 'ticket', req.params.id, `Estado cambiado a: ${estado}`]
        );

        res.json({ message: 'Estado actualizado' });
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Confirmar envío al cliente (botón final)
exports.confirmarAlCliente = async (req, res) => {
    try {
        const operador_id = req.admin?.id || null;
        const ticketId = req.params.id;

        const [ticket] = await pool.query('SELECT estado FROM tickets WHERE id = ?', [ticketId]);
        if (ticket.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
        if (ticket[0].estado !== 'Listo para confirmar al cliente') {
            return res.status(400).json({ error: 'El ticket no está listo para confirmar' });
        }

        await pool.query(
            'UPDATE tickets SET estado = ?, fecha_confirmacion_cliente = NOW() WHERE id = ?',
            ['Confirmado al cliente', ticketId]
        );

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [operador_id, 'Confirmar al cliente', 'ticket', ticketId, 'Ticket confirmado y notificado al cliente']
        );

        res.json({ message: 'Ticket confirmado al cliente exitosamente' });
    } catch (error) {
        console.error('Error confirmando ticket:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
