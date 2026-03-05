// controllers/authController.js - Autenticación del Panel Admin con Roles
const pool = require('../database/connection');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let authSchemaEnsured = false;
const TOKEN_TTL = '24h';

function getJwtSecret() {
  return process.env.AUTH_JWT_SECRET || process.env.AUTH_SALT;
}

async function ensureAuthSchema() {
  if (authSchemaEnsured) return;

  const alterIfMissing = async (sql) => {
    try {
      await pool.query(sql);
    } catch (error) {
      const msg = String(error.message || '');
      if (error.code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column name')) return;
      throw error;
    }
  };

  await alterIfMissing(`ALTER TABLE administradores ADD COLUMN rol ENUM('superadmin','admin','operador','visor') DEFAULT 'operador' AFTER nombre`);
  await alterIfMissing(`ALTER TABLE administradores ADD COLUMN activo TINYINT(1) DEFAULT 1 AFTER rol`);
  await alterIfMissing(`ALTER TABLE administradores ADD COLUMN token_version INT DEFAULT 0 AFTER activo`);

  await pool.query(`UPDATE administradores SET rol = 'operador' WHERE rol IS NULL OR rol = ''`);
  await pool.query(`UPDATE administradores SET activo = 1 WHERE activo IS NULL`);
  await pool.query(`UPDATE administradores SET token_version = 0 WHERE token_version IS NULL`);

  authSchemaEnsured = true;
}

// Mapa de permisos por rol
// Cada clave es una sección/feature; el valor es un array de roles autorizados
const PERMISOS = {
  dashboard:        ['superadmin', 'admin', 'operador', 'visor'],
  tickets:          ['superadmin', 'admin', 'operador'],
  transportes:      ['superadmin', 'admin', 'operador'],
  'tipos-vehiculos':['superadmin', 'admin'],
  clientes:         ['superadmin', 'admin', 'operador'],
  liquidaciones:    ['superadmin', 'admin', 'visor'],
  whatsapp:         ['superadmin', 'admin', 'operador'],
  configuracion:    ['superadmin', 'admin'],
  usuarios:         ['superadmin'],
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.AUTH_SALT).digest('hex');
}

function buildPermisos(rol) {
  return Object.keys(PERMISOS).filter(k => PERMISOS[k].includes(rol));
}

// POST /api/auth/login
async function login(req, res) {
  try {
    await ensureAuthSchema();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const passwordHash = hashPassword(password);
    const [rows] = await pool.query(
      'SELECT id, username, nombre, rol, activo, token_version FROM administradores WHERE username = ? AND password_hash = ?',
      [username, passwordHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const admin = rows[0];

    if (!admin.activo) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    // Calcular permisos para este rol
    const permisos = buildPermisos(admin.rol);

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        rol: admin.rol,
        token_version: admin.token_version || 0,
      },
      getJwtSecret(),
      { expiresIn: TOKEN_TTL }
    );

    res.json({
      token,
      admin: { id: admin.id, username: admin.username, nombre: admin.nombre, rol: admin.rol, permisos }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/auth/register (solo para crear el primer admin, luego se usa /usuarios)
async function register(req, res) {
  try {
    await ensureAuthSchema();
    const { username, password, nombre, rol } = req.body;
    if (!username || !password || !nombre) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const rolesValidos = ['superadmin', 'admin', 'operador', 'visor'];
    if (rol && !rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const passwordHash = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO administradores (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)',
      [username, passwordHash, nombre, rol || 'operador']
    );

    res.status(201).json({ id: result.insertId, username, nombre, rol: rol || 'operador' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
}

// Middleware de autenticación
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    await ensureAuthSchema();

    // JWT actual (persistente)
    try {
      const payload = jwt.verify(token, getJwtSecret());
      const [rows] = await pool.query(
        'SELECT id, username, nombre, rol, activo, token_version FROM administradores WHERE id = ? LIMIT 1',
        [payload.id]
      );

      if (rows.length === 0 || !rows[0].activo) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      const admin = rows[0];
      if ((payload.token_version || 0) !== (admin.token_version || 0)) {
        return res.status(401).json({ error: 'Sesión revocada. Inicia sesión nuevamente' });
      }

      req.admin = {
        id: admin.id,
        username: admin.username,
        nombre: admin.nombre,
        rol: admin.rol,
        permisos: buildPermisos(admin.rol),
      };
      return next();
    } catch (_) {
      // Compatibilidad hacia atrás: tokens en memoria antiguos
      const session = global.authTokens?.[token];
      if (!session || session.expires < Date.now()) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      req.admin = session;
      return next();
    }
  } catch (error) {
    console.error('Error validando token:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

// Middleware-factory para verificar permiso de sección
function requirePermiso(seccion) {
  return (req, res, next) => {
    const rolesPermitidos = PERMISOS[seccion];
    if (!rolesPermitidos || !rolesPermitidos.includes(req.admin?.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta sección' });
    }
    next();
  };
}

// GET /api/auth/permisos — devuelve el mapa de permisos (para el frontend)
async function getPermisos(req, res) {
  await ensureAuthSchema();
  res.json({ permisos: PERMISOS, rolActual: req.admin.rol });
}

module.exports = { login, register, authMiddleware, requirePermiso, getPermisos, hashPassword, PERMISOS };
