const express = require('express');
const router = express.Router();
const comisionController = require('../controllers/comisionController');

// Obtener resumen de todos los choferes
router.get('/', comisionController.obtenerResumenComisiones);

// Obtener detalle de viajes de un chofer especifico
router.get('/:id/detalles', comisionController.obtenerDetalleChofer);

// Cambiar estado de comisión de una solicitud
router.put('/solicitudes/:solicitudId/toggle', comisionController.toggleComisionViaje);

// Cobrar toda la deuda actual de un chofer
router.put('/chofer/:choferId/cobrar-todas', comisionController.cobrarTodasComisionesChofer);

module.exports = router;
