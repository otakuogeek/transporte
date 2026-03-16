// controllers/contactInfoController.js - Info lateral de contactos WhatsApp
const pool = require('../database/connection');

let tablesEnsured = false;
async function ensureTables() {
    if (tablesEnsured) return;
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS contacto_etiquetas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telefono VARCHAR(20) NOT NULL,
            etiqueta VARCHAR(50) NOT NULL,
            color VARCHAR(7) DEFAULT '#6c757d',
            creado_por INT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tel_etiqueta (telefono, etiqueta)
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS contacto_notas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telefono VARCHAR(20) NOT NULL,
            contenido TEXT NOT NULL,
            creado_por INT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS contacto_seguimientos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telefono VARCHAR(20) NOT NULL,
            descripcion VARCHAR(255) NOT NULL,
            fecha_programada DATETIME NOT NULL,
            completado TINYINT(1) DEFAULT 0,
            fecha_completado TIMESTAMP NULL DEFAULT NULL,
            creado_por INT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        tablesEnsured = true;
    } catch (error) {
        console.error('Error creando tablas contacto_info:', error);
    }
}

// ===== INFO DEL CONTACTO (datos + tickets recientes) =====
exports.getContactInfo = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;

        // Buscar en clientes, transportes, choferes
        let contacto = null;

        const [clientes] = await pool.query(
            `SELECT id, nombre, COALESCE(apellidos,'') as apellidos, documento, telefono_whatsapp, fecha_registro, 'cliente' as tipo
             FROM clientes WHERE telefono_whatsapp = ? OR JSON_SEARCH(telefonos, 'one', ?) IS NOT NULL LIMIT 1`,
            [phone, phone]
        );
        if (clientes.length) {
            contacto = clientes[0];
        } else {
            const [transportes] = await pool.query(
                `SELECT id, nombre, contacto_nombre, telefono_whatsapp, estado, fecha_registro, 'transporte' as tipo
                 FROM transportes WHERE telefono_whatsapp = ? LIMIT 1`,
                [phone]
            );
            if (transportes.length) {
                contacto = transportes[0];
            } else {
                const [choferes] = await pool.query(
                    `SELECT id, nombre, telefono_whatsapp, estado, fecha_registro, 'chofer' as tipo
                     FROM choferes WHERE telefono_whatsapp = ? LIMIT 1`,
                    [phone]
                );
                if (choferes.length) contacto = choferes[0];
            }
        }

        // Tickets recientes (si es cliente)
        let tickets = [];
        if (contacto?.tipo === 'cliente') {
            const [rows] = await pool.query(
                `SELECT t.id, t.origen, t.destino, t.estado, t.cantidad_camiones, t.fecha_creacion
                 FROM tickets t WHERE t.cliente_id = ? ORDER BY t.fecha_creacion DESC LIMIT 5`,
                [contacto.id]
            );
            tickets = rows;
        } else if (contacto?.tipo === 'transporte') {
            const [rows] = await pool.query(
                `SELECT t.id, t.origen, t.destino, t.estado, a.estado as estado_asignacion, t.fecha_creacion
                 FROM asignaciones a JOIN tickets t ON a.ticket_id = t.id
                 WHERE a.transporte_id = ? ORDER BY a.fecha_envio DESC LIMIT 5`,
                [contacto.id]
            );
            tickets = rows;
        }

        res.json({ contacto, tickets });
    } catch (error) {
        console.error('Error obteniendo info contacto:', error);
        res.status(500).json({ error: 'Error obteniendo información del contacto' });
    }
};

// ===== ETIQUETAS =====
exports.getEtiquetas = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const [rows] = await pool.query(
            'SELECT id, etiqueta, color, fecha_creacion FROM contacto_etiquetas WHERE telefono = ? ORDER BY fecha_creacion',
            [phone]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo etiquetas:', error);
        res.status(500).json({ error: 'Error obteniendo etiquetas' });
    }
};

exports.addEtiqueta = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const { etiqueta, color } = req.body;
        if (!etiqueta?.trim()) return res.status(400).json({ error: 'La etiqueta es requerida' });

        const [result] = await pool.query(
            'INSERT INTO contacto_etiquetas (telefono, etiqueta, color, creado_por) VALUES (?, ?, ?, ?)',
            [phone, etiqueta.trim().substring(0, 50), (color || '#6c757d').substring(0, 7), req.user?.id || null]
        );
        res.status(201).json({ id: result.insertId, etiqueta: etiqueta.trim(), color: color || '#6c757d' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Etiqueta ya existe para este contacto' });
        console.error('Error agregando etiqueta:', error);
        res.status(500).json({ error: 'Error agregando etiqueta' });
    }
};

exports.removeEtiqueta = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM contacto_etiquetas WHERE id = ?', [id]);
        res.json({ message: 'Etiqueta eliminada' });
    } catch (error) {
        console.error('Error eliminando etiqueta:', error);
        res.status(500).json({ error: 'Error eliminando etiqueta' });
    }
};

// ===== NOTAS INTERNAS =====
exports.getNotas = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const [rows] = await pool.query(
            `SELECT n.id, n.contenido, n.fecha_creacion, a.nombre as autor
             FROM contacto_notas n LEFT JOIN administradores a ON n.creado_por = a.id
             WHERE n.telefono = ? ORDER BY n.fecha_creacion DESC`,
            [phone]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo notas:', error);
        res.status(500).json({ error: 'Error obteniendo notas' });
    }
};

exports.addNota = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const { contenido } = req.body;
        if (!contenido?.trim()) return res.status(400).json({ error: 'El contenido es requerido' });

        const [result] = await pool.query(
            'INSERT INTO contacto_notas (telefono, contenido, creado_por) VALUES (?, ?, ?)',
            [phone, contenido.trim().substring(0, 2000), req.user?.id || null]
        );
        res.status(201).json({ id: result.insertId, contenido: contenido.trim(), fecha_creacion: new Date() });
    } catch (error) {
        console.error('Error agregando nota:', error);
        res.status(500).json({ error: 'Error agregando nota' });
    }
};

exports.removeNota = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM contacto_notas WHERE id = ?', [id]);
        res.json({ message: 'Nota eliminada' });
    } catch (error) {
        console.error('Error eliminando nota:', error);
        res.status(500).json({ error: 'Error eliminando nota' });
    }
};

// ===== SEGUIMIENTOS =====
exports.getSeguimientos = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const [rows] = await pool.query(
            `SELECT s.id, s.descripcion, s.fecha_programada, s.completado, s.fecha_completado, s.fecha_creacion, a.nombre as autor
             FROM contacto_seguimientos s LEFT JOIN administradores a ON s.creado_por = a.id
             WHERE s.telefono = ? ORDER BY s.completado ASC, s.fecha_programada ASC`,
            [phone]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo seguimientos:', error);
        res.status(500).json({ error: 'Error obteniendo seguimientos' });
    }
};

exports.addSeguimiento = async (req, res) => {
    try {
        await ensureTables();
        const { phone } = req.params;
        const { descripcion, fecha_programada } = req.body;
        if (!descripcion?.trim()) return res.status(400).json({ error: 'La descripción es requerida' });
        if (!fecha_programada) return res.status(400).json({ error: 'La fecha programada es requerida' });

        const [result] = await pool.query(
            'INSERT INTO contacto_seguimientos (telefono, descripcion, fecha_programada, creado_por) VALUES (?, ?, ?, ?)',
            [phone, descripcion.trim().substring(0, 255), fecha_programada, req.user?.id || null]
        );
        res.status(201).json({ id: result.insertId, descripcion: descripcion.trim(), fecha_programada, completado: 0 });
    } catch (error) {
        console.error('Error agregando seguimiento:', error);
        res.status(500).json({ error: 'Error agregando seguimiento' });
    }
};

exports.toggleSeguimiento = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT completado FROM contacto_seguimientos WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Seguimiento no encontrado' });

        const nuevoEstado = rows[0].completado ? 0 : 1;
        await pool.query(
            'UPDATE contacto_seguimientos SET completado = ?, fecha_completado = ? WHERE id = ?',
            [nuevoEstado, nuevoEstado ? new Date() : null, id]
        );
        res.json({ completado: nuevoEstado });
    } catch (error) {
        console.error('Error actualizando seguimiento:', error);
        res.status(500).json({ error: 'Error actualizando seguimiento' });
    }
};

exports.removeSeguimiento = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM contacto_seguimientos WHERE id = ?', [id]);
        res.json({ message: 'Seguimiento eliminado' });
    } catch (error) {
        console.error('Error eliminando seguimiento:', error);
        res.status(500).json({ error: 'Error eliminando seguimiento' });
    }
};
