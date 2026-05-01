const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

// All routes here are unauthenticated by design — used by the iOS
// onboarding "App Demo" screen before the user creates an account.
// Keep the surface SMALL: only read-only endpoints with safe data.
router.get('/fixtures/upcoming', publicController.upcomingFixtures);

module.exports = router;
