const pool = require('../database/connection');

// Obtener todos los tipos de vehículos
exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tipos_vehiculos ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo tipos de vehículos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener un tipo de vehículo por ID
exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tipos_vehiculos WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Tipo de vehículo no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error obteniendo tipo de vehículo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Crear un nuevo tipo de vehículo
exports.create = async (req, res) => {
    try {
        const { nombre, descripcion, capacidad_toneladas } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

        const [result] = await pool.query(
            'INSERT INTO tipos_vehiculos (nombre, descripcion, capacidad_toneladas) VALUES (?, ?, ?)',
            [nombre, descripcion || null, capacidad_toneladas || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Tipo de vehículo creado exitosamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un tipo de vehículo con ese nombre' });
        }
        console.error('Error creando tipo de vehículo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Actualizar un tipo de vehículo
exports.update = async (req, res) => {
    try {
        const { nombre, descripcion, capacidad_toneladas } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

        const [result] = await pool.query(
            'UPDATE tipos_vehiculos SET nombre = ?, descripcion = ?, capacidad_toneladas = ? WHERE id = ?',
            [nombre, descripcion || null, capacidad_toneladas || null, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Tipo de vehículo no encontrado' });
        res.json({ message: 'Tipo de vehículo actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un tipo de vehículo con ese nombre' });
        }
        console.error('Error actualizando tipo de vehículo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Eliminar un tipo de vehículo
exports.delete = async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM tipos_vehiculos WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Tipo de vehículo no encontrado' });
        res.json({ message: 'Tipo de vehículo eliminado' });
    } catch (error) {
        console.error('Error eliminando tipo de vehículo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener tipos de vehículos de un transporte específico
exports.getByTransporte = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT tv.id as tipo_vehiculo_id, tv.nombre, tv.descripcion, tv.capacidad_toneladas,
                    ttv.id as relacion_id, ttv.cantidad
             FROM transportes_tipos_vehiculos ttv
             JOIN tipos_vehiculos tv ON tv.id = ttv.tipo_vehiculo_id
             WHERE ttv.transporte_id = ?
             ORDER BY tv.nombre`,
            [req.params.transporteId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo vehículos del transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Asignar tipo de vehículo a un transporte (o actualizar cantidad)
exports.setTransporteVehiculo = async (req, res) => {
    try {
        const { transporte_id, tipo_vehiculo_id, cantidad } = req.body;
        if (!transporte_id || !tipo_vehiculo_id) {
            return res.status(400).json({ error: 'transporte_id y tipo_vehiculo_id son requeridos' });
        }

        await pool.query(
            `INSERT INTO transportes_tipos_vehiculos (transporte_id, tipo_vehiculo_id, cantidad)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE cantidad = ?`,
            [transporte_id, tipo_vehiculo_id, cantidad || 1, cantidad || 1]
        );

        // Recalcular total de vehículos del transporte
        await pool.query(
            `UPDATE transportes SET cantidad_vehiculos = (
                SELECT COALESCE(SUM(ttv.cantidad), 0) FROM transportes_tipos_vehiculos ttv WHERE ttv.transporte_id = ?
            ) WHERE id = ?`,
            [transporte_id, transporte_id]
        );

        res.status(201).json({ message: 'Vehículo asignado al transporte' });
    } catch (error) {
        console.error('Error asignando vehículo al transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Eliminar tipo de vehículo de un transporte
exports.removeTransporteVehiculo = async (req, res) => {
    try {
        // Obtener transporte_id antes de eliminar para recalcular
        const [rel] = await pool.query('SELECT transporte_id FROM transportes_tipos_vehiculos WHERE id = ?', [req.params.relacionId]);
        const [result] = await pool.query(
            'DELETE FROM transportes_tipos_vehiculos WHERE id = ?',
            [req.params.relacionId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Relación no encontrada' });

        // Recalcular total de vehículos del transporte
        if (rel[0]?.transporte_id) {
            await pool.query(
                `UPDATE transportes SET cantidad_vehiculos = (
                    SELECT COALESCE(SUM(ttv.cantidad), 0) FROM transportes_tipos_vehiculos ttv WHERE ttv.transporte_id = ?
                ) WHERE id = ?`,
                [rel[0].transporte_id, rel[0].transporte_id]
            );
        }

        res.json({ message: 'Vehículo removido del transporte' });
    } catch (error) {
        console.error('Error removiendo vehículo del transporte:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Obtener tipos de vehículos con transportes que los tienen disponibles (para selector de tickets)
exports.conTransportes = async (req, res) => {
    try {
        // Traer todos los tipos que tienen al menos 1 empresa activa con ese vehículo
        const [tipos] = await pool.query(`
            SELECT tv.id, tv.nombre, tv.descripcion, tv.capacidad_toneladas,
                   SUM(ttv.cantidad) AS total_vehiculos,
                   COUNT(DISTINCT ttv.transporte_id) AS cantidad_empresas
            FROM tipos_vehiculos tv
            INNER JOIN transportes_tipos_vehiculos ttv ON tv.id = ttv.tipo_vehiculo_id
            INNER JOIN transportes tr ON ttv.transporte_id = tr.id
            WHERE tr.estado = 'Activo'
            GROUP BY tv.id, tv.nombre, tv.descripcion, tv.capacidad_toneladas
            ORDER BY tv.nombre
        `);

        // Para cada tipo, traer las empresas que lo tienen
        const [relaciones] = await pool.query(`
            SELECT ttv.tipo_vehiculo_id, tr.id AS transporte_id, tr.nombre AS transporte_nombre, ttv.cantidad
            FROM transportes_tipos_vehiculos ttv
            INNER JOIN transportes tr ON ttv.transporte_id = tr.id
            WHERE tr.estado = 'Activo'
            ORDER BY tr.nombre
        `);

        // Armar estructura con transportes anidados
        const resultado = tipos.map(t => ({
            ...t,
            transportes: relaciones
                .filter(r => r.tipo_vehiculo_id === t.id)
                .map(r => ({ id: r.transporte_id, nombre: r.transporte_nombre, cantidad: r.cantidad }))
        }));

        res.json(resultado);
    } catch (error) {
        console.error('Error obteniendo tipos con transportes:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Recalcular cantidad_vehiculos de un transporte según la suma de sus tipos asignados
exports.recalcularTotales = async (transporteId) => {
    try {
        await pool.query(`
            UPDATE transportes t
            SET t.cantidad_vehiculos = (
                SELECT COALESCE(SUM(ttv.cantidad), 0)
                FROM transportes_tipos_vehiculos ttv
                WHERE ttv.transporte_id = t.id
            )
            WHERE t.id = ?
        `, [transporteId]);
    } catch (error) {
        console.error('Error recalculando totales:', error);
    }
};
