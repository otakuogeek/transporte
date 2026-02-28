// controllers/cotizacionesController.js - CRUD de Cotizaciones
const pool = require('../database/connection');

// GET /api/cotizaciones
async function getAll(req, res) {
  try {
    const { solicitud_id } = req.query;
    let query = `
      SELECT cot.*, ch.nombre as chofer_nombre, s.origen, s.destino
      FROM cotizaciones cot
      JOIN choferes ch ON cot.chofer_id = ch.id
      JOIN solicitudes s ON cot.solicitud_id = s.id
    `;
    const params = [];

    if (solicitud_id) {
      query += ' WHERE cot.solicitud_id = ?';
      params.push(solicitud_id);
    }
    query += ' ORDER BY cot.fecha_cotizacion DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/cotizaciones/:id
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT cot.*, ch.nombre as chofer_nombre, s.origen, s.destino
       FROM cotizaciones cot
       JOIN choferes ch ON cot.chofer_id = ch.id
       JOIN solicitudes s ON cot.solicitud_id = s.id
       WHERE cot.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, getById };
