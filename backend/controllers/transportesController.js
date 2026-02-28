const pool = require('../database/connection');

// Obtener todos los transportes
exports.getAll = async (req, res) => {
    try {
        const { fecha } = req.query;
        let query, params = [];

        if (fecha) {
            // Solo contar como "en uso" los vehículos asignados a tickets de la misma fecha
            query = `SELECT t.*,
                        COALESCE(SUM(CASE WHEN a.estado IN ('Enviado', 'Aceptado') THEN a.cantidad_camiones ELSE 0 END), 0) as camiones_en_uso
                     FROM transportes t
                     LEFT JOIN asignaciones a ON t.id = a.transporte_id
                        AND a.estado IN ('Enviado', 'Aceptado')
                        AND a.ticket_id IN (SELECT id FROM tickets WHERE DATE(fecha_requerida) = DATE(?))
                     GROUP BY t.id
                     ORDER BY t.nombre`;
            params = [fecha];
        } else {
            query = `SELECT t.*,
                        COALESCE(SUM(CASE WHEN a.estado IN ('Enviado', 'Aceptado') THEN a.cantidad_camiones ELSE 0 END), 0) as camiones_en_uso
                     FROM transportes t
                     LEFT JOIN asignaciones a ON t.id = a.transporte_id
                     GROUP BY t.id
                     ORDER BY t.nombre`;
        }

        const [transportes] = await pool.query(query, params);
        res.json(transportes);
    } catch (error) {
        console.error('Error obteniendo transportes:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener un transporte por ID
exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM transportes WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Transporte no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error obteniendo transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Crear un nuevo transporte
exports.create = async (req, res) => {
    try {
        const { nombre, contacto_nombre, telefono_whatsapp, email, cantidad_vehiculos } = req.body;
        const [result] = await pool.query(
            'INSERT INTO transportes (nombre, contacto_nombre, telefono_whatsapp, email, cantidad_vehiculos) VALUES (?, ?, ?, ?, ?)',
            [nombre, contacto_nombre || null, telefono_whatsapp || null, email || null, cantidad_vehiculos || 0]
        );
        res.status(201).json({ id: result.insertId, message: 'Transporte creado exitosamente' });
    } catch (error) {
        console.error('Error creando transporte:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un transporte con ese teléfono' });
        }
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Actualizar un transporte
exports.update = async (req, res) => {
    try {
        const { nombre, contacto_nombre, telefono_whatsapp, email, estado, cantidad_vehiculos } = req.body;
        await pool.query(
            'UPDATE transportes SET nombre = ?, contacto_nombre = ?, telefono_whatsapp = ?, email = ?, estado = ?, cantidad_vehiculos = ? WHERE id = ?',
            [nombre, contacto_nombre, telefono_whatsapp, email, estado || 'Activo', cantidad_vehiculos || 0, req.params.id]
        );
        res.json({ message: 'Transporte actualizado' });
    } catch (error) {
        console.error('Error actualizando transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Eliminar un transporte
exports.delete = async (req, res) => {
    try {
        await pool.query('DELETE FROM transportes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Transporte eliminado' });
    } catch (error) {
        console.error('Error eliminando transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
