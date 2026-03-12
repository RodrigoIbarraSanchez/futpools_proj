const express = require('express');
const auth = require('../middleware/auth');
const stripeController = require('../controllers/stripeController');

const router = express.Router();

router.get('/recharge-options', stripeController.getRechargeOptions);
router.post('/create-checkout-session', auth, stripeController.createCheckoutSession);

/** Webhook is mounted separately in app.js with express.raw() for the body */
exports.router = router;
exports.webhookHandler = stripeController.handleWebhook;
