const mongoose = require('mongoose');

const pickSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true },
  pick: { type: String, enum: ['1', 'X', '2'], required: true },
}, { _id: false });

const quinielaEntrySchema = new mongoose.Schema({
  quiniela: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiniela', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  entryNumber: { type: Number },
  picks: { type: [pickSchema], default: [] },
  // Frozen at scoring time so re-running the scorer is idempotent. The tuple
  // (score, ratingDelta) is the authoritative record — re-reading from live
  // fixtures could change slightly if an API-Football event is corrected.
  scoredAt: { type: Date, index: true },
  score: { type: Number },
  totalPossibleAtScoring: { type: Number },
  ratingDelta: { type: Number },
  // ── simple_version (Phase 2) — Stripe per-entry checkout ─────────────
  // Sparse unique on stripeSessionId is the idempotency guard for the
  // webhook: if Stripe re-delivers `checkout.session.completed`, the
  // second insert throws E11000 and we treat it as already-applied.
  // Legacy entries (master) leave these fields unset.
  stripeSessionId: { type: String, index: true, sparse: true, unique: true },
  stripePaymentIntentId: { type: String, default: null },
  paidAt: { type: Date, default: null },
  // Refund tracking — set when admin cancels a pool (Phase 9). Soft
  // delete: refunded entries stay in the collection so the audit trail
  // survives, but scoring + leaderboard queries filter them out.
  refundedAt: { type: Date, default: null },
  refundId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QuinielaEntry', quinielaEntrySchema);
