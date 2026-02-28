// controllers/choferesController.js - CRUD de Choferes
const pool = require('../database/connection');

// GET /api/choferes
async function getAll(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT ch.*,
        GROUP_CONCAT(v.placa SEPARATOR ', ') as vehiculos_placas,
        GROUP_CONCAT(v.tipo_vehiculo SEPARATOR ', ') as vehiculos_tipos
      FROM choferes ch
      LEFT JOIN vehiculos v ON v.chofer_id = ch.id
      GROUP BY ch.id
      ORDER BY ch.fecha_registro DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/choferes/:id
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT ch.*,
        JSON_ARRAYAGG(JSON_OBJECT('id', v.id, 'placa', v.placa, 'tipo', v.tipo_vehiculo, 'capacidad', v.capacidad_toneladas)) as vehiculos
       FROM choferes ch
       LEFT JOIN vehiculos v ON v.chofer_id = ch.id
       WHERE ch.id = ?
       GROUP BY ch.id`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/choferes
async function create(req, res) {
  try {
    const { nombre, telefono_whatsapp, estado } = req.body;
    if (!nombre || !telefono_whatsapp) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO choferes (nombre, telefono_whatsapp, estado) VALUES (?, ?, ?)',
      [nombre, telefono_whatsapp, estado || 'Disponible']
    );
    res.status(201).json({ id: result.insertId, nombre, telefono_whatsapp, estado: estado || 'Disponible' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Teléfono ya registrado' });
    }
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/choferes/:id
async function update(req, res) {
  try {
    const { nombre, telefono_whatsapp, estado } = req.body;
    const [result] = await pool.query(
      'UPDATE choferes SET nombre = ?, telefono_whatsapp = ?, estado = ? WHERE id = ?',
      [nombre, telefono_whatsapp, estado, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json({ id: parseInt(req.params.id), nombre, telefono_whatsapp, estado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/choferes/:id
async function remove(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM choferes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json({ message: 'Chofer eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove };
