// controllers/solicitudesController.js - CRUD de Solicitudes
const pool = require('../database/connection');

// GET /api/solicitudes
async function getAll(req, res) {
  try {
    const { estado, cliente_id } = req.query;
    let query = `
      SELECT s.*,
        c.nombre as cliente_nombre, c.apellidos as cliente_apellidos, c.telefono_whatsapp as cliente_telefono,
        ch.nombre as chofer_nombre,
        (SELECT COUNT(*) FROM cotizaciones cot WHERE cot.solicitud_id = s.id) as total_cotizaciones
      FROM solicitudes s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN choferes ch ON s.chofer_asignado_id = ch.id
    `;
    const params = [];
    const conditions = [];

    if (estado) {
      conditions.push('s.estado = ?');
      params.push(estado);
    }
    if (cliente_id) {
      conditions.push('s.cliente_id = ?');
      params.push(cliente_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY s.fecha_creacion DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/solicitudes/:id
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*,
        c.nombre as cliente_nombre, c.apellidos as cliente_apellidos,
        ch.nombre as chofer_nombre, ch.telefono_whatsapp as chofer_telefono
       FROM solicitudes s
       LEFT JOIN clientes c ON s.cliente_id = c.id
       LEFT JOIN choferes ch ON s.chofer_asignado_id = ch.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });

    // Obtener cotizaciones de esta solicitud
    const [cotizaciones] = await pool.query(
      `SELECT cot.*, ch.nombre as chofer_nombre
       FROM cotizaciones cot
       JOIN choferes ch ON cot.chofer_id = ch.id
       WHERE cot.solicitud_id = ?
       ORDER BY cot.costo_ofrecido ASC`,
      [req.params.id]
    );

    res.json({ ...rows[0], cotizaciones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/solicitudes (creación manual desde el panel)
async function create(req, res) {
  try {
    const { cliente_id, origen, destino, fecha_carga, tipo_vehiculo_requerido } = req.body;
    if (!cliente_id || !origen || !destino || !fecha_carga || !tipo_vehiculo_requerido) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    const [result] = await pool.query(
      `INSERT INTO solicitudes (cliente_id, origen, destino, fecha_carga, tipo_vehiculo_requerido)
       VALUES (?, ?, ?, ?, ?)`,
      [cliente_id, origen, destino, fecha_carga, tipo_vehiculo_requerido]
    );
    res.status(201).json({ id: result.insertId, cliente_id, origen, destino, fecha_carga, tipo_vehiculo_requerido, estado: 'Pendiente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/solicitudes/:id
async function update(req, res) {
  try {
    const { estado, precio_final_cliente, chofer_asignado_id } = req.body;
    const fields = [];
    const params = [];

    if (estado) { fields.push('estado = ?'); params.push(estado); }
    if (precio_final_cliente !== undefined) { fields.push('precio_final_cliente = ?'); params.push(precio_final_cliente); }
    if (chofer_asignado_id !== undefined) { fields.push('chofer_asignado_id = ?'); params.push(chofer_asignado_id); }

    if (fields.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    params.push(req.params.id);
    const [result] = await pool.query(`UPDATE solicitudes SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ message: 'Solicitud actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/solicitudes/:id
async function remove(req, res) {
  try {
    // Primero eliminar cotizaciones asociadas
    await pool.query('DELETE FROM cotizaciones WHERE solicitud_id = ?', [req.params.id]);
    await pool.query('DELETE FROM mensajes_log WHERE solicitud_id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM solicitudes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ message: 'Solicitud eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove };
