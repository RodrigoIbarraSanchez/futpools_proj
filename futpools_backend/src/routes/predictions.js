const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const predictionController = require('../controllers/predictionController');

const router = express.Router();

const createPredictionValidation = [
  body('matchday').isMongoId().withMessage('Valid matchday ID is required'),
  body('matches').isArray({ min: 1 }).withMessage('At least one match pick is required'),
  body('matches.*.matchId').isMongoId().withMessage('Valid match ID is required'),
  body('matches.*.pick').isIn(['1', 'X', '2']).withMessage('Pick must be 1, X, or 2'),
];

router.post('/', auth, createPredictionValidation, predictionController.createPrediction);
router.get('/', auth, predictionController.getMyPredictions);

module.exports = router;
