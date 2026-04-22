const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/global', leaderboardController.getGlobalLeaderboard);
router.get('/me', auth, leaderboardController.getMyRankSummary);

module.exports = router;
