const express = require('express');
const dailyPickController = require('../controllers/dailyPickController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/today', auth, dailyPickController.getToday);
router.post('/today/predict', auth, dailyPickController.predictToday);

module.exports = router;
