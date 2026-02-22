const express = require('express');
const footballController = require('../controllers/footballController');

const router = express.Router();

// GET /football/matchday/:id
router.get('/matchday/:id', footballController.getMatchdayFixtures);
// GET /football/fixtures?ids=1,2,3
router.get('/fixtures', footballController.getFixturesByIds);
// GET /football/teams?league=ID|apiId&code=LIGA_MX|EPL&name=Liga%20MX
router.get('/teams', footballController.getTeamsByLeague);

module.exports = router;
