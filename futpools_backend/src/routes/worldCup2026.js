const express = require('express');
const ctrl = require('../controllers/worldCupCalendarController');

const router = express.Router();

router.get('/teams', ctrl.getTeams);
router.get('/fixtures', ctrl.getFixtures);
router.get('/calendar.ics', ctrl.getCalendar);

module.exports = router;
