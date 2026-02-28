// controllers/configuracionController.js - Gestión de Configuración
const pool = require('../database/connection');

// GET /api/configuracion
async function getAll(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM configuracion ORDER BY id');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/configuracion/:nombre_parametro
async function update(req, res) {
  try {
    const { valor } = req.body;
    if (valor === undefined) return res.status(400).json({ error: 'Valor es requerido' });

    const [result] = await pool.query(
      'UPDATE configuracion SET valor = ? WHERE nombre_parametro = ?',
      [valor, req.params.nombre_parametro]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Parámetro no encontrado' });
    res.json({ nombre_parametro: req.params.nombre_parametro, valor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, update };
