const express = require('express');
const matchdayController = require('../controllers/matchdayController');

const router = express.Router();

router.get('/', matchdayController.getMatchdays);
router.get('/:id', matchdayController.getMatchdayById);

module.exports = router;
