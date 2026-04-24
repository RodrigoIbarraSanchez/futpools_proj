const express = require('express');
const quinielaController = require('../controllers/quinielaController');
const Quiniela = require('../models/Quiniela');
const { auth, optionalAuth, requireOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Loader reused by ownership-guarded routes.
const loadQuinielaById = (req) => Quiniela.findById(req.params.id);

// ── Public reads ─────────────────────────────────────────────────────
router.get('/', optionalAuth, quinielaController.getQuinielas);
router.get('/invite/:code', quinielaController.getQuinielaByInvite); // share link resolver
router.get('/entries/me', auth, quinielaController.getMyEntries);
router.get('/mine/created', auth, quinielaController.getMyCreatedQuinielas); // "MY CREATED POOLS"
router.get('/:id', quinielaController.getQuinielaById);
router.get('/:id/leaderboard', optionalAuth, quinielaController.getLeaderboard);
router.post('/:id/entries', auth, quinielaController.submitEntry);
router.get('/:id/entries/me', auth, quinielaController.getMyEntriesForQuiniela);
// Entry-level CRUD: edit picks (owner only) and delete (owner or creator/admin).
// Authorization branches live inside the handlers because the allowed roles
// differ per-action (self for PUT; self OR creator OR admin for DELETE),
// which the single-axis requireOwnerOrAdmin middleware can't express.
router.put('/:id/entries/:entryId', auth, quinielaController.updateEntry);
router.delete('/:id/entries/:entryId', auth, quinielaController.deleteEntry);
// Participant list — creator/admin only.
router.get(
  '/:id/participants',
  auth,
  requireOwnerOrAdmin(loadQuinielaById),
  quinielaController.getParticipants
);

// ── Pool creation (any authenticated user) ────────────────────────────
router.post('/', auth, quinielaController.createQuiniela);

// ── Owner-or-admin ────────────────────────────────────────────────────
// The `featured` field is additionally guarded inside updateQuiniela so
// owners can't self-promote.
router.put('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.updateQuiniela);
router.delete('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.deleteQuiniela);

module.exports = router;
