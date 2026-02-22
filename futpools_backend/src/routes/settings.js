const express = require('express');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

router.get('/', settingsController.getSettings);

const settingsApiKey = process.env.SETTINGS_API_KEY;
if (settingsApiKey) {
  router.put('/', (req, res, next) => {
    const key = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (key !== settingsApiKey) {
      return res.status(401).json({ message: 'Invalid or missing API key' });
    }
    next();
  }, settingsController.updateSettings);
} else {
  router.put('/', (req, res) => {
    res.status(503).json({ message: 'Settings API key not configured' });
  });
}

module.exports = router;
