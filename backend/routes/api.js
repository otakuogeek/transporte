// routes/api.js - Rutas de la API REST para el Panel Admin
const express = require('express');
const router = express.Router();

// Controladores
const authController = require('../controllers/authController');
const clientesController = require('../controllers/clientesController');
const choferesController = require('../controllers/choferesController');
const vehiculosController = require('../controllers/vehiculosController');
const solicitudesController = require('../controllers/solicitudesController');
const cotizacionesController = require('../controllers/cotizacionesController');
const configuracionController = require('../controllers/configuracionController');
const dashboardController = require('../controllers/dashboardController');
const comisionesRoutes = require('./comisionesRoutes');
const transportesController = require('../controllers/transportesController');
const ticketsController = require('../controllers/ticketsController');
const asignacionesController = require('../controllers/asignacionesController');
const tiposVehiculosController = require('../controllers/tiposVehiculosController');
const liquidacionesController = require('../controllers/liquidacionesController');
const usuariosController = require('../controllers/usuariosController');
const validators = require('../middleware/validators');

// ===== Rutas Públicas =====
router.post('/auth/login', validators.validateAuthLogin, authController.login);
router.post('/auth/register', validators.validateAuthRegister, authController.register);

// ===== Middleware de Autenticación (protege rutas debajo) =====
router.use(authController.authMiddleware);

// ===== Info de permisos (para el frontend) =====
router.get('/auth/permisos', authController.getPermisos);

// ===== Usuarios (solo superadmin) =====
const rp = authController.requirePermiso;
router.get('/usuarios', rp('usuarios'), usuariosController.getAll);
router.get('/usuarios/:id', rp('usuarios'), usuariosController.getById);
router.post('/usuarios', rp('usuarios'), validators.validateUsuarioCreate, usuariosController.create);
router.put('/usuarios/:id', rp('usuarios'), validators.validateUsuarioUpdate, usuariosController.update);
router.delete('/usuarios/:id', rp('usuarios'), usuariosController.remove);

// ===== Dashboard =====
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/rendimiento-transportes', dashboardController.getRendimientoTransportes);
router.get('/dashboard/rendimiento-clientes', dashboardController.getRendimientoClientes);
router.get('/dashboard/costos-rutas', dashboardController.getCostosRutas);
router.get('/dashboard/mejores-clientes', dashboardController.getMejoresClientes);
router.get('/dashboard/estado-choferes', dashboardController.getEstadoChoferes);
router.get('/dashboard/solicitudes-recientes', dashboardController.getSolicitudesRecientes);

// ===== Clientes =====
router.get('/clientes', clientesController.getAll);
router.get('/clientes/:id', clientesController.getById);
router.post('/clientes', clientesController.create);
router.put('/clientes/:id', clientesController.update);
router.delete('/clientes/:id', clientesController.remove);

// ===== Choferes =====
router.get('/choferes', choferesController.getAll);
router.get('/choferes/:id', choferesController.getById);
router.post('/choferes', choferesController.create);
router.put('/choferes/:id', choferesController.update);
router.delete('/choferes/:id', choferesController.remove);

// ===== Vehículos =====
router.get('/vehiculos', vehiculosController.getAll);
router.get('/vehiculos/:id', vehiculosController.getById);
router.post('/vehiculos', vehiculosController.create);
router.put('/vehiculos/:id', vehiculosController.update);
router.delete('/vehiculos/:id', vehiculosController.remove);

// ===== Solicitudes =====
router.get('/solicitudes', solicitudesController.getAll);
router.get('/solicitudes/:id', solicitudesController.getById);
router.post('/solicitudes', solicitudesController.create);
router.put('/solicitudes/:id', solicitudesController.update);
router.delete('/solicitudes/:id', solicitudesController.remove);

// ===== Cotizaciones =====
router.get('/cotizaciones', cotizacionesController.getAll);
router.get('/cotizaciones/:id', cotizacionesController.getById);

// ===== Configuración =====
router.get('/configuracion', configuracionController.getAll);
router.put('/configuracion/:nombre_parametro', configuracionController.update);

// ===== Comisiones =====
router.use('/comisiones', comisionesRoutes);

// ===== Transportes =====
router.get('/transportes', transportesController.getAll);
router.get('/transportes/:id', transportesController.getById);
router.post('/transportes', transportesController.create);
router.put('/transportes/:id', transportesController.update);
router.delete('/transportes/:id', transportesController.delete);

// ===== Tipos de Vehículos =====
router.get('/tipos-vehiculos', tiposVehiculosController.getAll);
router.get('/tipos-vehiculos/con-transportes', tiposVehiculosController.conTransportes);
router.get('/tipos-vehiculos/:id', tiposVehiculosController.getById);
router.post('/tipos-vehiculos', tiposVehiculosController.create);
router.put('/tipos-vehiculos/:id', tiposVehiculosController.update);
router.delete('/tipos-vehiculos/:id', tiposVehiculosController.delete);

// ===== Vehículos por Transporte =====
router.get('/transportes/:transporteId/vehiculos', tiposVehiculosController.getByTransporte);
router.post('/transportes-vehiculos', tiposVehiculosController.setTransporteVehiculo);
router.delete('/transportes-vehiculos/:relacionId', tiposVehiculosController.removeTransporteVehiculo);

// ===== Tickets =====
router.get('/tickets', ticketsController.getAll);
router.get('/tickets/:id', ticketsController.getById);
router.post('/tickets', validators.validateTicketCreate, ticketsController.create);
router.put('/tickets/:id/estado', validators.validateTicketEstado, ticketsController.updateEstado);
router.post('/tickets/:id/confirmar', ticketsController.confirmarAlCliente);

// ===== Asignaciones =====
router.post('/asignaciones', asignacionesController.asignar);
router.put('/asignaciones/:id/responder', asignacionesController.responder);
router.put('/asignaciones/:id/datos-camion', asignacionesController.registrarDatosCamion);
router.post('/asignaciones/vehiculo/:vehiculoId/notificar', asignacionesController.notificarClienteVehiculo);
router.get('/asignaciones/ticket/:ticketId', asignacionesController.getByTicket);
router.get('/asignaciones/historial', asignacionesController.historialPorTransporte);

// ===== WhatsApp Config =====
const whatsappConfigController = require('../controllers/whatsappConfigController');

// ===== Liquidaciones (Comisiones y Pagos a Transportistas) =====
router.get('/liquidaciones/resumen', liquidacionesController.getResumen);
router.get('/liquidaciones/totales', liquidacionesController.getTotales);
router.get('/liquidaciones/reporte', liquidacionesController.getReporte);
router.get('/liquidaciones/transporte/:transporteId', liquidacionesController.getDetalleTransporte);
router.put('/liquidaciones/:asignacionId/pagar', liquidacionesController.marcarPagada);
router.put('/liquidaciones/:asignacionId/despagar', liquidacionesController.marcarNoPagada);
router.put('/liquidaciones/transporte/:transporteId/pagar-todo', liquidacionesController.pagarTodoPorTransporte);

router.get('/whatsapp-config', whatsappConfigController.getConfig);
router.put('/whatsapp-config', whatsappConfigController.updateConfig);
router.get('/whatsapp-config/baileys/sessions', whatsappConfigController.listBaileysSessions);
router.post('/whatsapp-config/baileys/sessions', whatsappConfigController.createBaileysSession);
router.delete('/whatsapp-config/baileys/sessions/:sessionId', whatsappConfigController.deleteBaileysSession);
router.post('/whatsapp-config/baileys/connect', whatsappConfigController.baileysConnect);
router.post('/whatsapp-config/baileys/disconnect', whatsappConfigController.baileysDisconnect);
router.get('/whatsapp-config/baileys/status', whatsappConfigController.baileysStatus);
router.get('/whatsapp-config/chats', whatsappConfigController.getChats);
router.get('/whatsapp-config/chats/:phone', whatsappConfigController.getChatMessages);
router.post('/whatsapp-config/chats/:phone/send', whatsappConfigController.sendChatMessage);
router.post('/whatsapp-config/chats/:phone/toggle-agent', whatsappConfigController.toggleAgent);

module.exports = router;
