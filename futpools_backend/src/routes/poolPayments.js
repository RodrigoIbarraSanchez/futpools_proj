const express = require('express');
const poolPaymentsController = require('../controllers/poolPaymentsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Mounted at /pools in app.js (simple_version only). The companion webhook
// handler lives on /payments/webhook (shared with the legacy coin-shop
// flow — dispatch by session.metadata).
router.post('/:id/checkout-session', auth, poolPaymentsController.createCheckoutSession);

module.exports = router;
