const express = require('express');
const adsController = require('../controllers/adsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Coins economy (existing)
router.post('/rewarded-watched', auth, adsController.rewardedWatched);
router.get('/rewarded-status', auth, adsController.rewardedStatus);

// Tickets economy (v2.4) — production SSV from AdMob server-to-server.
// NOT authed: Google calls this with a signed callback, signature is the
// auth. Verified inside the handler.
router.get('/admob/ssv-callback', adsController.admobSSVCallback);

// Tickets economy — DEV-only shortcut for simulator/local testing.
// Returns 403 in production via NODE_ENV check inside the handler.
router.post('/ticket-rewarded/dev-credit', auth, adsController.devCreditTicket);

module.exports = router;
