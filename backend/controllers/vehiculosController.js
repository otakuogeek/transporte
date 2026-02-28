// controllers/vehiculosController.js - CRUD de Vehículos
const pool = require('../database/connection');

// GET /api/vehiculos
async function getAll(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT v.*, ch.nombre as chofer_nombre, ch.telefono_whatsapp as chofer_telefono, ch.estado as chofer_estado
      FROM vehiculos v
      LEFT JOIN choferes ch ON v.chofer_id = ch.id
      ORDER BY v.id DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/vehiculos/:id
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT v.*, ch.nombre as chofer_nombre FROM vehiculos v
       LEFT JOIN choferes ch ON v.chofer_id = ch.id WHERE v.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/vehiculos
async function create(req, res) {
  try {
    const { chofer_id, placa, tipo_vehiculo, capacidad_toneladas } = req.body;
    if (!placa || !tipo_vehiculo) {
      return res.status(400).json({ error: 'Placa y tipo de vehículo son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO vehiculos (chofer_id, placa, tipo_vehiculo, capacidad_toneladas) VALUES (?, ?, ?, ?)',
      [chofer_id || null, placa, tipo_vehiculo, capacidad_toneladas || null]
    );
    res.status(201).json({ id: result.insertId, chofer_id, placa, tipo_vehiculo, capacidad_toneladas });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Placa ya registrada' });
    }
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/vehiculos/:id
async function update(req, res) {
  try {
    const { chofer_id, placa, tipo_vehiculo, capacidad_toneladas } = req.body;
    const [result] = await pool.query(
      'UPDATE vehiculos SET chofer_id = ?, placa = ?, tipo_vehiculo = ?, capacidad_toneladas = ? WHERE id = ?',
      [chofer_id, placa, tipo_vehiculo, capacidad_toneladas, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ id: parseInt(req.params.id), chofer_id, placa, tipo_vehiculo, capacidad_toneladas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/vehiculos/:id
async function remove(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM vehiculos WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove };
