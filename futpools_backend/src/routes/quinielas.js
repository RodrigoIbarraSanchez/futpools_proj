const express = require('express');
const quinielaController = require('../controllers/quinielaController');
const Quiniela = require('../models/Quiniela');
const { auth, optionalAuth, requireAdmin, requireOwnerOrAdmin } = require('../middleware/auth');
const { isSimpleMode } = require('../config/mode');

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

// In simple_version the entry submission path is owned by Stripe — picks
// flow through `POST /pools/:id/checkout-session` and the webhook creates
// the QuinielaEntry. Exposing the legacy direct-submit route here would
// let users bypass payment entirely, so it stays mounted only on master.
if (!isSimpleMode()) {
  router.post('/:id/entries', auth, quinielaController.submitEntry);
  // Entry-level CRUD: edit picks (owner only) and delete (owner or creator/admin).
  // Authorization branches live inside the handlers because the allowed roles
  // differ per-action (self for PUT; self OR creator OR admin for DELETE),
  // which the single-axis requireOwnerOrAdmin middleware can't express.
  router.put('/:id/entries/:entryId', auth, quinielaController.updateEntry);
  router.delete('/:id/entries/:entryId', auth, quinielaController.deleteEntry);
}
router.get('/:id/entries/me', auth, quinielaController.getMyEntriesForQuiniela);
// Participant list — creator/admin only.
router.get(
  '/:id/participants',
  auth,
  requireOwnerOrAdmin(loadQuinielaById),
  quinielaController.getParticipants
);

// ── Pool creation ─────────────────────────────────────────────────────
// master: any authenticated user (free + peer + sponsored pools).
// simple: admin-only — the simple_version product spec has zero user-
// facing creation surface; pools are curated by FutPools staff and paid
// via Stripe at $50 MXN per entry.
router.post(
  '/',
  isSimpleMode() ? requireAdmin : auth,
  quinielaController.createQuiniela
);

// ── Owner-or-admin ────────────────────────────────────────────────────
// The `featured` field is additionally guarded inside updateQuiniela so
// owners can't self-promote.
router.put('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.updateQuiniela);
router.delete('/:id', auth, requireOwnerOrAdmin(loadQuinielaById), quinielaController.deleteQuiniela);

module.exports = router;
