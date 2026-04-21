const express = require('express');
const footballController = require('../controllers/footballController');

const router = express.Router();

// GET /football/matchday/:id
router.get('/matchday/:id', footballController.getMatchdayFixtures);
// GET /football/fixtures?ids=1,2,3  |  ?teamId=X  |  ?leagueId=X&season=Y
router.get('/fixtures', footballController.getFixturesByIds);
// GET /football/teams?league=ID|apiId&code=LIGA_MX|EPL&name=Liga%20MX
router.get('/teams', footballController.getTeamsByLeague);
// GET /football/leagues/search?query=liga  (for mobile "add fixtures" picker)
router.get('/leagues/search', footballController.searchLeagues);
// GET /football/teams/search?query=chivas
router.get('/teams/search', footballController.searchTeamsApi);

module.exports = router;
