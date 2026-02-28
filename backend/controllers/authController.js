// controllers/authController.js - Autenticación del Panel Admin
const pool = require('../database/connection');
const crypto = require('crypto');

// Función de hash simple (en producción, usar bcrypt)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.AUTH_SALT).digest('hex');
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const passwordHash = hashPassword(password);
    const [rows] = await pool.query(
      'SELECT id, username, nombre FROM administradores WHERE username = ? AND password_hash = ?',
      [username, passwordHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token simple (en producción usar JWT)
    const token = crypto.randomBytes(32).toString('hex');
    const admin = rows[0];

    // Almacenar token en memoria (en producción usar Redis o JWT)
    if (!global.authTokens) global.authTokens = {};
    global.authTokens[token] = { id: admin.id, username: admin.username, expires: Date.now() + 24 * 60 * 60 * 1000 };

    res.json({ token, admin: { id: admin.id, username: admin.username, nombre: admin.nombre } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/auth/register (solo desde el servidor para crear el primer admin)
async function register(req, res) {
  try {
    const { username, password, nombre } = req.body;
    if (!username || !password || !nombre) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const passwordHash = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO administradores (username, password_hash, nombre) VALUES (?, ?, ?)',
      [username, passwordHash, nombre]
    );

    res.status(201).json({ id: result.insertId, username, nombre });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
}

// Middleware de autenticación
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  const session = global.authTokens?.[token];
  if (!session || session.expires < Date.now()) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.admin = session;
  next();
}

module.exports = { login, register, authMiddleware };
