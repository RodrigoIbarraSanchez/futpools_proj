const express = require('express');
const sweepstakesController = require('../controllers/sweepstakesController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, sweepstakesController.list);
router.get('/:id', auth, sweepstakesController.getById);
router.post('/:id/enter', auth, sweepstakesController.enter);

// Admin-only
router.post('/', auth, sweepstakesController.create);
router.post('/:id/settle', auth, sweepstakesController.settle);

module.exports = router;
