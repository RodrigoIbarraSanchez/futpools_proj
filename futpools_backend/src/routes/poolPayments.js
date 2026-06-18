const express = require('express');
const poolPaymentsController = require('../controllers/poolPaymentsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Mounted at /pools in app.js (simple_version only). The companion webhook
// handler lives on /payments/webhook (shared with the legacy coin-shop
// flow — dispatch by session.metadata).
router.post('/:id/checkout-session', auth, poolPaymentsController.createCheckoutSession);

// Manual-SPEI replacement for Stripe Checkout (Stripe account closed). The
// user submits picks → gets a CLABE + reference; an admin confirms the
// transfer later, which creates the entry.
router.post('/:id/spei-intent', auth, poolPaymentsController.createSpeiIntent);

// Payer signals "I've transferred" so the organizer knows to verify it.
// `spei` is a literal segment, distinct from the `/:id/...` pool routes above.
router.post('/spei/:paymentId/mark-paid', auth, poolPaymentsController.markSpeiPaid);

module.exports = router;
