require('dotenv').config();
const mysql = require('mysql2/promise');
const pool = mysql.createPool({ host: 'localhost', user: 'admin', password: 'Admin@2026!', database: 'indielab_pro' });
const aiService = require('./services/aiService');

async function test() {
  const telefono = '109221270032466';
  const texto = '560000';
  
  const [rows] = await pool.query('SELECT id, nombre, estado FROM choferes WHERE telefono_whatsapp = ?', [telefono]);
  const chofer = rows[0];
  console.log('Chofer:', chofer);
  
  const [solicitudesPendientes] = await pool.query(
    `SELECT s.id, s.origen, s.destino, s.tipo_vehiculo_requerido
     FROM solicitudes s
     JOIN vehiculos v ON LOWER(v.tipo_vehiculo) LIKE CONCAT('%', LOWER(s.tipo_vehiculo_requerido), '%')
     WHERE v.chofer_id = ?
       AND s.estado = 'Cotizando'
       AND s.id NOT IN (
         SELECT solicitud_id FROM cotizaciones WHERE chofer_id = ?
       )
     ORDER BY s.fecha_creacion DESC
     LIMIT 1`,
    [chofer.id, chofer.id]
  );
  console.log('Solicitudes:', solicitudesPendientes);
  
  const resultado = await aiService.extractDriverQuote(texto);
  console.log('AI Result:', resultado);
  
  // Guardar en DB simulation
  // pool.query("INSERT...");
  
  process.exit(0);
}
test().catch(console.error);
