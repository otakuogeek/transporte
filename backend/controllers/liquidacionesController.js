// controllers/liquidacionesController.js — Liquidaciones y pagos a transportistas
const pool = require('../database/connection');

/**
 * GET /liquidaciones/resumen
 * Resumen de comisiones/pagos por transportista.
 * Query params: fecha_desde, fecha_hasta, tipo_vehiculo_id, estado_pago (pendiente|pagado|todo)
 */
exports.getResumen = async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, tipo_vehiculo_id, estado_pago } = req.query;

        let where = "WHERE a.estado = 'Aceptado'";
        const params = [];

        if (fecha_desde) { where += ' AND a.fecha_envio >= ?'; params.push(fecha_desde); }
        if (fecha_hasta) { where += ' AND a.fecha_envio <= ?'; params.push(fecha_hasta + ' 23:59:59'); }
        if (tipo_vehiculo_id) { where += ' AND t.tipo_vehiculo_id = ?'; params.push(tipo_vehiculo_id); }
        if (estado_pago === 'pendiente') { where += ' AND a.comision_pagada = 0'; }
        if (estado_pago === 'pagado') { where += ' AND a.comision_pagada = 1'; }

        const sql = `
            SELECT 
                tr.id AS transporte_id,
                tr.nombre AS transporte_nombre,
                tr.telefono_whatsapp,
                COUNT(a.id) AS total_asignaciones,
                SUM(a.precio * a.cantidad_camiones) AS total_precio,
                SUM(a.comision * a.cantidad_camiones) AS total_comision,
                SUM((a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones) AS total_a_pagar,
                SUM(CASE WHEN a.comision_pagada = 1 THEN a.comision * a.cantidad_camiones ELSE 0 END) AS comision_pagada,
                SUM(CASE WHEN a.comision_pagada = 0 THEN a.comision * a.cantidad_camiones ELSE 0 END) AS comision_pendiente,
                SUM(CASE WHEN a.comision_pagada = 1 THEN (a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones ELSE 0 END) AS pagado_a_transporte,
                SUM(CASE WHEN a.comision_pagada = 0 THEN (a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones ELSE 0 END) AS pendiente_a_transporte
            FROM asignaciones a
            JOIN transportes tr ON tr.id = a.transporte_id
            JOIN tickets t ON t.id = a.ticket_id
            ${where}
            GROUP BY tr.id
            ORDER BY pendiente_a_transporte DESC
        `;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo resumen liquidaciones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * GET /liquidaciones/totales
 * KPIs globales de liquidaciones
 */
exports.getTotales = async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, tipo_vehiculo_id, estado_pago } = req.query;

        let where = "WHERE a.estado = 'Aceptado'";
        const params = [];

        if (fecha_desde) { where += ' AND a.fecha_envio >= ?'; params.push(fecha_desde); }
        if (fecha_hasta) { where += ' AND a.fecha_envio <= ?'; params.push(fecha_hasta + ' 23:59:59'); }
        if (tipo_vehiculo_id) { where += ' AND t.tipo_vehiculo_id = ?'; params.push(tipo_vehiculo_id); }
        if (estado_pago === 'pendiente') { where += ' AND a.comision_pagada = 0'; }
        if (estado_pago === 'pagado') { where += ' AND a.comision_pagada = 1'; }

        const sql = `
            SELECT 
                COUNT(a.id) AS total_asignaciones,
                SUM(a.precio * a.cantidad_camiones) AS total_facturado,
                SUM(a.comision * a.cantidad_camiones) AS total_comision,
                SUM((a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones) AS total_a_pagar,
                SUM(CASE WHEN a.comision_pagada = 1 THEN (a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones ELSE 0 END) AS total_pagado,
                SUM(CASE WHEN a.comision_pagada = 0 THEN (a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones ELSE 0 END) AS total_pendiente
            FROM asignaciones a
            JOIN tickets t ON t.id = a.ticket_id
            ${where}
        `;

        const [rows] = await pool.query(sql, params);
        res.json(rows[0] || {});
    } catch (error) {
        console.error('Error obteniendo totales liquidaciones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * GET /liquidaciones/transporte/:transporteId
 * Detalle de asignaciones de un transporte con desglose de comisión y pago
 */
exports.getDetalleTransporte = async (req, res) => {
    try {
        const { transporteId } = req.params;
        const { fecha_desde, fecha_hasta, tipo_vehiculo_id, estado_pago } = req.query;

        let where = "WHERE a.estado = 'Aceptado' AND a.transporte_id = ?";
        const params = [transporteId];

        if (fecha_desde) { where += ' AND a.fecha_envio >= ?'; params.push(fecha_desde); }
        if (fecha_hasta) { where += ' AND a.fecha_envio <= ?'; params.push(fecha_hasta + ' 23:59:59'); }
        if (tipo_vehiculo_id) { where += ' AND t.tipo_vehiculo_id = ?'; params.push(tipo_vehiculo_id); }
        if (estado_pago === 'pendiente') { where += ' AND a.comision_pagada = 0'; }
        if (estado_pago === 'pagado') { where += ' AND a.comision_pagada = 1'; }

        const sql = `
            SELECT 
                a.id,
                a.ticket_id,
                a.cantidad_camiones,
                a.precio,
                a.comision,
                a.comision_porcentaje,
                (a.precio - IFNULL(a.comision, 0)) AS neto_transporte,
                (a.precio * a.cantidad_camiones) AS total_precio,
                (a.comision * a.cantidad_camiones) AS total_comision,
                ((a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones) AS total_neto,
                a.comision_pagada,
                a.fecha_pago,
                a.pago_observaciones,
                a.fecha_envio,
                t.origen,
                t.destino,
                t.fecha_requerida,
                tv.nombre AS tipo_vehiculo,
                c.nombre AS cliente_nombre
            FROM asignaciones a
            JOIN tickets t ON t.id = a.ticket_id
            LEFT JOIN tipos_vehiculos tv ON tv.id = t.tipo_vehiculo_id
            LEFT JOIN clientes c ON c.id = t.cliente_id
            ${where}
            ORDER BY a.fecha_envio DESC
        `;

        const [rows] = await pool.query(sql, params);

        // Info del transporte
        const [transport] = await pool.query('SELECT id, nombre, telefono_whatsapp, contacto_nombre FROM transportes WHERE id = ?', [transporteId]);

        res.json({
            transporte: transport[0] || null,
            asignaciones: rows
        });
    } catch (error) {
        console.error('Error obteniendo detalle transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * PUT /liquidaciones/:asignacionId/pagar
 * Marcar una asignación como pagada
 */
exports.marcarPagada = async (req, res) => {
    try {
        const { asignacionId } = req.params;
        const { observaciones } = req.body;

        const [result] = await pool.query(
            'UPDATE asignaciones SET comision_pagada = 1, fecha_pago = NOW(), pago_observaciones = ? WHERE id = ?',
            [observaciones || null, asignacionId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }

        // Log de acción
        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id || null, 'Marcar pagada', 'asignaciones', asignacionId, observaciones || 'Marcada como pagada']
        );

        res.json({ message: 'Asignación marcada como pagada' });
    } catch (error) {
        console.error('Error marcando pagada:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * PUT /liquidaciones/:asignacionId/despagar
 * Revertir el estado de pago de una asignación
 */
exports.marcarNoPagada = async (req, res) => {
    try {
        const { asignacionId } = req.params;

        const [result] = await pool.query(
            'UPDATE asignaciones SET comision_pagada = 0, fecha_pago = NULL, pago_observaciones = NULL WHERE id = ?',
            [asignacionId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id || null, 'Revertir pago', 'asignaciones', asignacionId, 'Revertida a no pagada']
        );

        res.json({ message: 'Pago revertido exitosamente' });
    } catch (error) {
        console.error('Error revirtiendo pago:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * PUT /liquidaciones/transporte/:transporteId/pagar-todo
 * Marcar todas las asignaciones pendientes de un transporte como pagadas
 */
exports.pagarTodoPorTransporte = async (req, res) => {
    try {
        const { transporteId } = req.params;
        const { observaciones } = req.body;

        const [result] = await pool.query(
            `UPDATE asignaciones SET comision_pagada = 1, fecha_pago = NOW(), pago_observaciones = ?
             WHERE transporte_id = ? AND estado = 'Aceptado' AND comision_pagada = 0`,
            [observaciones || 'Pago masivo', transporteId]
        );

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id || null, 'Pago masivo transporte', 'transportes', transporteId, `${result.affectedRows} asignaciones marcadas como pagadas`]
        );

        res.json({ message: `${result.affectedRows} asignaciones marcadas como pagadas`, affected: result.affectedRows });
    } catch (error) {
        console.error('Error en pago masivo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * GET /liquidaciones/reporte
 * Reporte exportable con todas las asignaciones filtradas
 */
exports.getReporte = async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, tipo_vehiculo_id, estado_pago, transporte_id } = req.query;

        let where = "WHERE a.estado = 'Aceptado'";
        const params = [];

        if (fecha_desde) { where += ' AND a.fecha_envio >= ?'; params.push(fecha_desde); }
        if (fecha_hasta) { where += ' AND a.fecha_envio <= ?'; params.push(fecha_hasta + ' 23:59:59'); }
        if (tipo_vehiculo_id) { where += ' AND t.tipo_vehiculo_id = ?'; params.push(tipo_vehiculo_id); }
        if (estado_pago === 'pendiente') { where += ' AND a.comision_pagada = 0'; }
        if (estado_pago === 'pagado') { where += ' AND a.comision_pagada = 1'; }
        if (transporte_id) { where += ' AND a.transporte_id = ?'; params.push(transporte_id); }

        const sql = `
            SELECT 
                a.id AS asignacion_id,
                tr.nombre AS transporte,
                t.id AS ticket_id,
                c.nombre AS cliente,
                t.origen,
                t.destino,
                tv.nombre AS tipo_vehiculo,
                a.cantidad_camiones,
                a.precio AS precio_unitario,
                (a.precio * a.cantidad_camiones) AS precio_total,
                a.comision_porcentaje,
                a.comision AS comision_unitaria,
                (a.comision * a.cantidad_camiones) AS comision_total,
                ((a.precio - IFNULL(a.comision, 0)) * a.cantidad_camiones) AS neto_transporte,
                IF(a.comision_pagada, 'Pagado', 'Pendiente') AS estado_pago,
                a.fecha_pago,
                a.pago_observaciones,
                a.fecha_envio
            FROM asignaciones a
            JOIN transportes tr ON tr.id = a.transporte_id
            JOIN tickets t ON t.id = a.ticket_id
            LEFT JOIN tipos_vehiculos tv ON tv.id = t.tipo_vehiculo_id
            LEFT JOIN clientes c ON c.id = t.cliente_id
            ${where}
            ORDER BY a.fecha_envio DESC
        `;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
