// controllers/clientesController.js - CRUD de Clientes
const pool = require('../database/connection');

// Parsear y normalizar la lista de teléfonos
function parseTelefonos(telefonos) {
  if (!telefonos) return [];
  if (Array.isArray(telefonos)) return telefonos.map(t => String(t).trim()).filter(Boolean);
  try { return JSON.parse(telefonos); } catch { return [String(telefonos).trim()]; }
}

// GET /api/clientes
async function getAll(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM solicitudes s WHERE s.cliente_id = c.id) as total_solicitudes
      FROM clientes c
      ORDER BY c.fecha_registro DESC
    `);
    // Parsear telefonos JSON para cada cliente
    rows.forEach(r => {
      r.telefonos = r.telefonos ? JSON.parse(r.telefonos) : (r.telefono_whatsapp ? [r.telefono_whatsapp] : []);
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// GET /api/clientes/:id
async function getById(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    const r = rows[0];
    r.telefonos = r.telefonos ? JSON.parse(r.telefonos) : (r.telefono_whatsapp ? [r.telefono_whatsapp] : []);
    res.json(r);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/clientes
async function create(req, res) {
  try {
    const { nombre, apellidos, telefonos: telefonosRaw, origen_default, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const telefonos = parseTelefonos(telefonosRaw);
    if (telefonos.length === 0) return res.status(400).json({ error: 'Al menos un número de WhatsApp es requerido' });

    const telefonosJson = JSON.stringify(telefonos);
    const telefonoPrimario = telefonos[0];

    const [result] = await pool.query(
      'INSERT INTO clientes (nombre, apellidos, telefono_whatsapp, telefonos, origen_default, email) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, apellidos || null, telefonoPrimario, telefonosJson, origen_default || null, email || null]
    );
    res.status(201).json({ id: result.insertId, nombre, apellidos, telefonos, origen_default, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/clientes/:id
async function update(req, res) {
  try {
    const { nombre, apellidos, telefonos: telefonosRaw, origen_default, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const telefonos = parseTelefonos(telefonosRaw);
    if (telefonos.length === 0) return res.status(400).json({ error: 'Al menos un número de WhatsApp es requerido' });

    const telefonosJson = JSON.stringify(telefonos);
    const telefonoPrimario = telefonos[0];

    const [result] = await pool.query(
      'UPDATE clientes SET nombre = ?, apellidos = ?, telefono_whatsapp = ?, telefonos = ?, origen_default = ?, email = ? WHERE id = ?',
      [nombre, apellidos || null, telefonoPrimario, telefonosJson, origen_default || null, email || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ id: parseInt(req.params.id), nombre, apellidos, telefonos, origen_default, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/clientes/:id
async function remove(req, res) {
  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM solicitudes WHERE cliente_id = ?',
      [req.params.id]
    );
    if (total > 0) {
      return res.status(409).json({
        error: `No se puede eliminar el cliente porque tiene ${total} solicitud(es) asociada(s). Elimine primero las solicitudes o reasígnelas a otro cliente.`
      });
    }
    const [result] = await pool.query('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove };
