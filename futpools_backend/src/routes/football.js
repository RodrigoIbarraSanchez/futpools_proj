const express = require('express');
const footballController = require('../controllers/footballController');

const router = express.Router();

// GET /football/matchday/:id
router.get('/matchday/:id', footballController.getMatchdayFixtures);
// GET /football/fixtures?ids=1,2,3  |  ?teamId=X  |  ?leagueId=X&season=Y
router.get('/fixtures', footballController.getFixturesByIds);
// GET /football/fixtures/feed?date=YYYY-MM-DD&leagues=1,2&teams=33,40
//   simple_version Live Scores tab — aggregates a date's fixtures for
//   the user's favorite leagues + teams, scores included.
router.get('/fixtures/feed', footballController.getFixturesFeed);
// GET /football/teams?league=ID|apiId&code=LIGA_MX|EPL&name=Liga%20MX
router.get('/teams', footballController.getTeamsByLeague);
// GET /football/leagues/search?query=liga  (for mobile "add fixtures" picker)
router.get('/leagues/search', footballController.searchLeagues);
// GET /football/teams/search?query=chivas
router.get('/teams/search', footballController.searchTeamsApi);
// GET /football/teams/lookup?ids=541,529 — resolves api-football team
// IDs to { id, name, logo, country } for the favorites editor's pills.
router.get('/teams/lookup', footballController.lookupTeams);
// GET /football/leagues/lookup?ids=2,140
router.get('/leagues/lookup', footballController.lookupLeagues);
// GET /football/fixtures/:id/events — goals, cards, substitutions (for live match)
router.get('/fixtures/:id/events', footballController.getFixtureEvents);

module.exports = router;
