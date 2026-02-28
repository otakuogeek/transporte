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

// ===== Rutas Públicas =====
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);

// ===== Middleware de Autenticación (protege rutas debajo) =====
router.use(authController.authMiddleware);

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

// ===== Tickets =====
router.get('/tickets', ticketsController.getAll);
router.get('/tickets/:id', ticketsController.getById);
router.post('/tickets', ticketsController.create);
router.put('/tickets/:id/estado', ticketsController.updateEstado);
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
router.get('/whatsapp-config', whatsappConfigController.getConfig);
router.put('/whatsapp-config', whatsappConfigController.updateConfig);
router.post('/whatsapp-config/baileys/connect', whatsappConfigController.baileysConnect);
router.post('/whatsapp-config/baileys/disconnect', whatsappConfigController.baileysDisconnect);
router.get('/whatsapp-config/baileys/status', whatsappConfigController.baileysStatus);
router.get('/whatsapp-config/chats', whatsappConfigController.getChats);
router.get('/whatsapp-config/chats/:phone', whatsappConfigController.getChatMessages);
router.post('/whatsapp-config/chats/:phone/send', whatsappConfigController.sendChatMessage);
router.post('/whatsapp-config/chats/:phone/toggle-agent', whatsappConfigController.toggleAgent);

module.exports = router;
