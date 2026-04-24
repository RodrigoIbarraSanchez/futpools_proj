const express = require('express');
const challengeController = require('../controllers/challengeController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Creation
router.post('/',               auth, challengeController.createChallenge);
// Feed + detail
router.get('/me',              auth, challengeController.listMine);
router.get('/code/:code',      auth, challengeController.getByCode);
router.get('/:id',             auth, challengeController.getById);
// Mutations — role checks live inside each handler (challenger-only for
// cancel, opponent-only for accept/decline).
router.post('/:id/accept',     auth, challengeController.acceptChallenge);
router.post('/:id/decline',    auth, challengeController.declineChallenge);
router.delete('/:id',          auth, challengeController.cancelChallenge);

module.exports = router;
