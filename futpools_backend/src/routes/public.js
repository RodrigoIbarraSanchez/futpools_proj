const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

// All routes here are unauthenticated by design — used by the iOS
// onboarding "App Demo" screen and the web SEO landings before the
// user creates an account.
// Keep the surface SMALL: only read-only endpoints with safe data.
router.get('/fixtures/upcoming', publicController.upcomingFixtures);
// Today's matches (CDMX calendar day) for /pronosticos-futbol-hoy.
router.get('/fixtures/today', publicController.todayFixtures);
// Dynamic CTA for /pronosticos-de-futbol: next public pool still open
// for registration (no match started), or { pool: null }.
router.get('/pools/next-open', publicController.nextOpenPool);
// Which manual payment channels are configured (SPEI / PayPal USD).
router.get('/payment-config', publicController.paymentConfig);

module.exports = router;
