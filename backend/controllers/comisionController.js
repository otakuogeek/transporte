const pool = require('../database/connection');

// Obtener el listado general de choferes con su resumen de comisiones
exports.obtenerResumenComisiones = async (req, res) => {
    try {
        const query = `
            SELECT 
                ch.id as chofer_id,
                ch.nombre as chofer_nombre,
                ch.telefono_whatsapp,
                COUNT(CASE WHEN s.comision_cobrada = FALSE THEN s.id END) as viajes_pendientes,
                COALESCE(SUM(CASE WHEN s.comision_cobrada = FALSE THEN (s.precio_final_cliente - c.costo_ofrecido) ELSE 0 END), 0) as comision_pendiente,
                COUNT(CASE WHEN s.comision_cobrada = TRUE THEN s.id END) as viajes_cobrados,
                COALESCE(SUM(CASE WHEN s.comision_cobrada = TRUE THEN (s.precio_final_cliente - c.costo_ofrecido) ELSE 0 END), 0) as comision_historial
            FROM 
                choferes ch
            LEFT JOIN 
                solicitudes s ON ch.id = s.chofer_asignado_id AND s.estado IN ('Adjudicada', 'Completada')
            LEFT JOIN 
                cotizaciones c ON s.id = c.solicitud_id AND c.chofer_id = ch.id AND c.es_ganadora = TRUE
            GROUP BY 
                ch.id, ch.nombre, ch.telefono_whatsapp
            ORDER BY 
                comision_pendiente DESC;
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener resumen de comisiones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener los detalles de los viajes de un chofer específico
exports.obtenerDetalleChofer = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                s.id as solicitud_id,
                s.origen,
                s.destino,
                s.fecha_carga,
                s.estado,
                s.precio_final_cliente,
                c.costo_ofrecido as costo_chofer,
                (s.precio_final_cliente - c.costo_ofrecido) as ganancia,
                s.comision_cobrada,
                cl.nombre as cliente_nombre
            FROM 
                solicitudes s
            JOIN 
                cotizaciones c ON s.id = c.solicitud_id AND c.es_ganadora = TRUE
            JOIN 
                clientes cl ON s.cliente_id = cl.id
            WHERE 
                s.chofer_asignado_id = ? AND s.estado IN ('Adjudicada', 'Completada')
            ORDER BY 
                s.id DESC;
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener el detalle de comisiones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Marcar un solo viaje como cobrado (o revertirlo a no cobrado)
exports.toggleComisionViaje = async (req, res) => {
    try {
        const { solicitudId } = req.params;
        const { cobrada } = req.body; // true o false

        const query = 'UPDATE solicitudes SET comision_cobrada = ? WHERE id = ?';
        await pool.query(query, [cobrada ? 1 : 0, solicitudId]);

        res.json({ success: true, message: 'Estado de comisión actualizado' });
    } catch (error) {
        console.error('Error al actualizar estado de comisión:', error);
        res.status(500).json({ error: 'Error al actualizar' });
    }
};

// Marcar todas las comisiones pendientes de un chofer como cobradas (Pago total)
exports.cobrarTodasComisionesChofer = async (req, res) => {
    try {
        const { choferId } = req.params;

        const query = `
            UPDATE solicitudes 
            SET comision_cobrada = 1 
            WHERE chofer_asignado_id = ? 
              AND estado IN ('Adjudicada', 'Completada') 
              AND comision_cobrada = 0
        `;

        const [result] = await pool.query(query, [choferId]);

        res.json({ success: true, message: `${result.affectedRows} viajes marcados como cobrados.` });
    } catch (error) {
        console.error('Error al cobrar todas las comisiones:', error);
        res.status(500).json({ error: 'Error al procesar el pago masivo' });
    }
};
