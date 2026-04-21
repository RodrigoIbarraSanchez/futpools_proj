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

// ── Pool creation (any authenticated user) ────────────────────────────
router.post('/', auth, quinielaController.createQuiniela);

// ── Owner-or-admin ────────────────────────────────────────────────────
// The `featured` field is additionally guarded inside updateQuiniela so
// owners can't self-promote.
router.put('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.updateQuiniela);
router.delete('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.deleteQuiniela);

module.exports = router;
