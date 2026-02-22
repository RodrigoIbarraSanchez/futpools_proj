const express = require('express');
const leagueController = require('../controllers/leagueController');

const router = express.Router();

router.get('/', leagueController.getLeagues);

module.exports = router;
