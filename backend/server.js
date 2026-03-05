const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Cargar variables de entorno
dotenv.config();

// ===== PREVENIR CRASHES POR EXCEPCIONES NO CAPTURADAS (ej: Baileys) =====
process.on('uncaughtException', (err) => {
  console.error('⚠ Excepción no capturada (el servidor continúa):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠ Promesa rechazada no capturada (el servidor continúa):', reason?.message || reason);
});

// Importar módulos propios
const pool = require('./database/connection');
const initializeDatabase = require('./database/initDb');
const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intenta nuevamente más tarde.' },
});

// ===== MIDDLEWARE =====
app.use(cors({
  origin: [
    'http://falc.indielab.pro',
    'https://falc.indielab.pro',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend (build de React)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// ===== HEALTH CHECK =====
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1 as status');
    res.json({
      status: 'ok',
      service: 'falc-logistica-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error.message,
    });
  }
});

// ===== API INFO =====
app.get('/api', (req, res) => {
  res.json({
    name: 'FALC Logística API',
    version: '1.0.0',
    description: 'Sistema de Logística de Carga - Backend API',
    endpoints: {
      health: 'GET /api/health',
      webhook: 'GET|POST /webhook',
      auth: 'POST /api/auth/login | /api/auth/register',
      dashboard: 'GET /api/dashboard/*',
      clientes: 'CRUD /api/clientes',
      choferes: 'CRUD /api/choferes',
      vehiculos: 'CRUD /api/vehiculos',
      solicitudes: 'CRUD /api/solicitudes',
      cotizaciones: 'GET /api/cotizaciones',
      configuracion: 'GET|PUT /api/configuracion',
    },
  });
});

// ===== RUTAS =====
// Webhook de WhatsApp (fuera de /api para que Meta lo reconozca)
app.use('/webhook', webhookRoutes);

// API REST del panel de administración
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/api', apiRoutes);

// ===== SERVIR FRONTEND (SPA fallback) =====
app.get(/^\/(?!api|webhook).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// ===== MANEJO DE ERRORES =====
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== INICIAR SERVIDOR =====
async function startServer() {
  try {
    // Inicializar base de datos (crear tablas si no existen)
    await initializeDatabase();

    // Inicializar almacén global de tokens
    if (!global.authTokens) global.authTokens = {};

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`🚀 FALC Logística Backend corriendo en http://127.0.0.1:${PORT}`);
      console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Webhook URL: http://127.0.0.1:${PORT}/webhook`);
      console.log(`   API URL: http://127.0.0.1:${PORT}/api`);
    });
  } catch (error) {
    console.error('✗ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
