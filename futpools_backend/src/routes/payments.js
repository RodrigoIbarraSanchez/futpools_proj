const express = require('express');
const paymentsController = require('../controllers/paymentsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /payments/catalog — auth'd read of the pack list.
router.get('/catalog', auth, paymentsController.getCatalog);

// POST /payments/checkout-session — auth'd, creates hosted Checkout session.
router.post('/checkout-session', auth, paymentsController.createCheckoutSession);

// Note: the webhook route is mounted in app.js directly (NOT via this router)
// because it needs raw body parsing that has to sit before the global JSON
// parser. Keeping it out of here avoids accidentally wiring auth too.

module.exports = router;
