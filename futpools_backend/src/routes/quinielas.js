const express = require('express');
const quinielaController = require('../controllers/quinielaController');
const { auth, optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', quinielaController.getQuinielas);
router.get('/entries/me', auth, quinielaController.getMyEntries);
router.get('/:id', quinielaController.getQuinielaById);
router.get('/:id/leaderboard', optionalAuth, quinielaController.getLeaderboard);
router.post('/:id/entries', auth, quinielaController.submitEntry);
router.get('/:id/entries/me', auth, quinielaController.getMyEntriesForQuiniela);

router.put('/:id', auth, requireAdmin, quinielaController.updateQuiniela);
router.delete('/:id', auth, requireAdmin, quinielaController.deleteQuiniela);

module.exports = router;
