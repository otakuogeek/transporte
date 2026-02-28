// routes/webhook.js - Rutas del Webhook de WhatsApp
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Verificación del Webhook (Meta envía GET)
router.get('/', webhookController.verifyWebhook);

// Recibir mensajes (Meta envía POST)
router.post('/', webhookController.handleIncomingMessage);

module.exports = router;
