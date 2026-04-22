const express = require('express');
const adsController = require('../controllers/adsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/rewarded-watched', auth, adsController.rewardedWatched);
router.get('/rewarded-status', auth, adsController.rewardedStatus);

module.exports = router;
