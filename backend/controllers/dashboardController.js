// controllers/dashboardController.js - Dashboard analítico avanzado
const pool = require('../database/connection');

// GET /api/dashboard/stats — Estadísticas principales con filtros
async function getStats(req, res) {
  try {
    const { fecha_desde, fecha_hasta, cliente_id, transporte_id } = req.query;

    let fechaFiltro = '';
    let params = [];

    if (fecha_desde) { fechaFiltro += ' AND t.fecha_creacion >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { fechaFiltro += ' AND t.fecha_creacion <= ?'; params.push(fecha_hasta + ' 23:59:59'); }
    if (cliente_id) { fechaFiltro += ' AND t.cliente_id = ?'; params.push(cliente_id); }

    // Hoy
    const hoy = new Date().toISOString().slice(0, 10);

    // Tickets creados hoy
    const [creadosHoy] = await pool.query(
      `SELECT COUNT(*) as total FROM tickets t WHERE DATE(t.fecha_creacion) = ?`,
      [hoy]
    );

    // Tickets confirmados (todo el período con filtros)
    const [confirmados] = await pool.query(
      `SELECT COUNT(*) as total FROM tickets t WHERE t.estado = 'Confirmado al cliente'${fechaFiltro}`,
      params
    );

    // Tickets pendientes
    const [pendientes] = await pool.query(
      `SELECT COUNT(*) as total FROM tickets t WHERE t.estado IN ('Pendiente de asignación','Asignado - Esperando respuesta','Aceptado - Pendiente datos camión','En proceso de confirmación','Listo para confirmar al cliente')${fechaFiltro}`,
      params
    );

    // Camiones asignados este mes
    const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
    const [camionesEsteMes] = await pool.query(
      `SELECT COALESCE(SUM(t.camiones_confirmados), 0) as total 
       FROM tickets t 
       WHERE DATE_FORMAT(t.fecha_creacion, '%Y-%m') = ?`,
      [mesActual]
    );

    // Camiones solicitados vs confirmados (cumplimiento)
    const [cumplimiento] = await pool.query(
      `SELECT COALESCE(SUM(t.cantidad_camiones), 0) as solicitados, 
              COALESCE(SUM(t.camiones_confirmados), 0) as confirmados
       FROM tickets t 
       WHERE 1=1${fechaFiltro}`,
      params
    );
    const pctCumplimiento = cumplimiento[0].solicitados > 0
      ? Math.round((cumplimiento[0].confirmados / cumplimiento[0].solicitados) * 100)
      : 0;

    // Tiempo promedio ticket → confirmación (en horas)
    const [tiempoPromedio] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, t.fecha_creacion, t.fecha_confirmacion_cliente)) as promedio_horas
       FROM tickets t 
       WHERE t.estado = 'Confirmado al cliente' AND t.fecha_confirmacion_cliente IS NOT NULL${fechaFiltro}`,
      params
    );

    // % de rechazos
    const [totalAsignaciones] = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN a.estado = 'Rechazado' THEN 1 ELSE 0 END) as rechazados
       FROM asignaciones a
       JOIN tickets t ON a.ticket_id = t.id
       WHERE 1=1${fechaFiltro}`,
      params
    );
    const pctRechazos = totalAsignaciones[0].total > 0
      ? Math.round((totalAsignaciones[0].rechazados / totalAsignaciones[0].total) * 100)
      : 0;

    // Camiones por mes (últimos 6 meses)
    const [camionesPorMes] = await pool.query(
      `SELECT DATE_FORMAT(t.fecha_creacion, '%Y-%m') as mes,
              COALESCE(SUM(t.camiones_confirmados), 0) as confirmados
       FROM tickets t
       WHERE t.fecha_creacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY mes
       ORDER BY mes`
    );

    res.json({
      tickets_creados_hoy: creadosHoy[0].total,
      tickets_confirmados: confirmados[0].total,
      tickets_pendientes: pendientes[0].total,
      camiones_este_mes: camionesEsteMes[0].total,
      camiones_solicitados: cumplimiento[0].solicitados,
      camiones_confirmados_total: cumplimiento[0].confirmados,
      pct_cumplimiento: pctCumplimiento,
      tiempo_promedio_confirmacion_horas: tiempoPromedio[0].promedio_horas ? parseFloat(tiempoPromedio[0].promedio_horas).toFixed(1) : null,
      pct_rechazos: pctRechazos,
      camiones_por_mes: camionesPorMes,
    });
  } catch (error) {
    console.error('Error dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
}

// GET /api/dashboard/rendimiento-transportes — Ranking de transportes
async function getRendimientoTransportes(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        tr.id, tr.nombre,
        COUNT(a.id) as total_asignaciones,
        SUM(CASE WHEN a.estado = 'Aceptado' THEN 1 ELSE 0 END) as aceptadas,
        SUM(CASE WHEN a.estado = 'Rechazado' THEN 1 ELSE 0 END) as rechazadas,
        SUM(CASE WHEN a.estado = 'Enviado' THEN 1 ELSE 0 END) as pendientes,
        ROUND(SUM(CASE WHEN a.estado = 'Aceptado' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0) * 100, 1) as tasa_aceptacion,
        ROUND(AVG(CASE WHEN a.fecha_respuesta IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, a.fecha_envio, a.fecha_respuesta) END), 0) as tiempo_respuesta_min
      FROM transportes tr
      LEFT JOIN asignaciones a ON tr.id = a.transporte_id
      GROUP BY tr.id, tr.nombre
      ORDER BY tasa_aceptacion DESC, total_asignaciones DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error rendimiento transportes:', error);
    res.status(500).json({ error: error.message });
  }
}

// GET /api/dashboard/rendimiento-clientes — Stats por cliente/finca
async function getRendimientoClientes(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id, c.nombre, c.origen_default,
        COUNT(t.id) as total_tickets,
        COALESCE(SUM(t.cantidad_camiones), 0) as camiones_solicitados,
        COALESCE(SUM(t.camiones_confirmados), 0) as camiones_confirmados,
        ROUND(AVG(CASE WHEN t.fecha_confirmacion_cliente IS NOT NULL THEN TIMESTAMPDIFF(HOUR, t.fecha_creacion, t.fecha_confirmacion_cliente) END), 1) as tiempo_promedio_horas
      FROM clientes c
      LEFT JOIN tickets t ON c.id = t.cliente_id
      GROUP BY c.id, c.nombre, c.origen_default
      ORDER BY total_tickets DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error rendimiento clientes:', error);
    res.status(500).json({ error: error.message });
  }
}

// Mantener endpoints legacy
async function getCostosRutas(req, res) { res.json([]); }
async function getMejoresClientes(req, res) { res.json([]); }
async function getEstadoChoferes(req, res) { res.json([]); }
async function getSolicitudesRecientes(req, res) { res.json([]); }

module.exports = { getStats, getRendimientoTransportes, getRendimientoClientes, getCostosRutas, getMejoresClientes, getEstadoChoferes, getSolicitudesRecientes };
