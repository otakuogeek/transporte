// controllers/usuariosController.js — CRUD de Usuarios del sistema
const pool = require('../database/connection');
const { hashPassword } = require('./authController');

// GET /api/usuarios — Listar todos
exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, nombre, rol, activo, fecha_creacion FROM administradores ORDER BY id ASC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/usuarios/:id
exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, nombre, rol, activo, fecha_creacion FROM administradores WHERE id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/usuarios — Crear usuario
exports.create = async (req, res) => {
    try {
        const { username, password, nombre, rol } = req.body;
        if (!username || !password || !nombre) {
            return res.status(400).json({ error: 'Username, contraseña y nombre son requeridos' });
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

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id, 'Crear usuario', 'administradores', result.insertId, `Usuario ${username} con rol ${rol || 'operador'}`]
        );

        res.status(201).json({ id: result.insertId, username, nombre, rol: rol || 'operador', message: 'Usuario creado exitosamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/usuarios/:id — Editar usuario
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, nombre, rol, activo, password } = req.body;

        // No se puede desactivar ni cambiar rol del propio usuario superadmin
        if (parseInt(id) === req.admin?.id && activo === false) {
            return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
        }

        // Verificar que existe
        const [existing] = await pool.query('SELECT id, rol, activo FROM administradores WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Proteger: no se puede quitar superadmin al último superadmin
        if (existing[0].rol === 'superadmin' && rol && rol !== 'superadmin') {
            const [supers] = await pool.query("SELECT COUNT(*) as cnt FROM administradores WHERE rol = 'superadmin' AND activo = 1");
            if (supers[0].cnt <= 1) {
                return res.status(400).json({ error: 'Debe existir al menos un superadmin activo' });
            }
        }

        const nuevoActivo = activo !== undefined ? (activo ? 1 : 0) : 1;
        const cambioRol = rol && rol !== existing[0].rol;
        const cambioPassword = !!(password && password.trim());
        const cambioActivo = (activo !== undefined) && (Boolean(activo) !== Boolean(existing[0].activo));
        const bumpTokenVersion = cambioRol || cambioPassword || cambioActivo;

        let sql = 'UPDATE administradores SET username = ?, nombre = ?, rol = ?, activo = ?';
        const params = [username, nombre, rol, nuevoActivo];

        if (password && password.trim()) {
            sql += ', password_hash = ?';
            params.push(hashPassword(password));
        }

        if (bumpTokenVersion) {
            sql += ', token_version = token_version + 1';
        }

        sql += ' WHERE id = ?';
        params.push(id);

        await pool.query(sql, params);

        // Compatibilidad hacia atrás: invalidar también tokens en memoria
        if (activo === false || activo === 0) {
            if (global.authTokens) {
                for (const [token, session] of Object.entries(global.authTokens)) {
                    if (session.id === parseInt(id)) delete global.authTokens[token];
                }
            }
        }

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id, 'Editar usuario', 'administradores', id, `Actualizado: ${username}, rol: ${rol}`]
        );

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// DELETE /api/usuarios/:id — Eliminar usuario
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.admin?.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }

        // Verificar que no sea el último superadmin
        const [existing] = await pool.query('SELECT id, rol, username FROM administradores WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (existing[0].rol === 'superadmin') {
            const [supers] = await pool.query("SELECT COUNT(*) as cnt FROM administradores WHERE rol = 'superadmin' AND activo = 1");
            if (supers[0].cnt <= 1) {
                return res.status(400).json({ error: 'No se puede eliminar el último superadmin' });
            }
        }

        // Revocar sesiones JWT activas del usuario eliminado
        await pool.query('UPDATE administradores SET token_version = token_version + 1 WHERE id = ?', [id]);

        // Compatibilidad hacia atrás: invalidar tokens en memoria
        if (global.authTokens) {
            for (const [token, session] of Object.entries(global.authTokens)) {
                if (session.id === parseInt(id)) delete global.authTokens[token];
            }
        }

        await pool.query('DELETE FROM administradores WHERE id = ?', [id]);

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [req.admin?.id, 'Eliminar usuario', 'administradores', id, `Eliminado: ${existing[0].username}`]
        );

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
