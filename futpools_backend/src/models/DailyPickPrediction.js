const mongoose = require('mongoose');

/**
 * One row per (DailyPick, user) pair. Stores the user's 1/X/2 prediction
 * + tracks whether the +1 immediate Ticket and the +1 bonus Ticket have
 * been credited.
 *
 * Both credit flags exist as a defensive paper trail — the actual
 * idempotency guarantee comes from `TicketTransaction.idempotencyKey`,
 * but having a local boolean here makes the "did we already pay this user
 * the bonus?" check O(1) without touching the ledger.
 */
const dailyPickPredictionSchema = new mongoose.Schema({
  dailyPick: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPick', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pick: { type: String, required: true, enum: ['1', 'X', '2'] },
  submittedAt: { type: Date, default: Date.now },
  // Immediate +1 Ticket awarded when prediction was submitted (always true
  // after a successful POST — kept as an explicit field for ledger audits).
  immediateAwarded: { type: Boolean, default: true },
  // Bonus +1 Ticket awarded when fixture finished AND prediction matched.
  // Populated by the settlement worker. Stays false if the user predicted
  // wrong or the fixture isn't settled yet.
  bonusAwarded: { type: Boolean, default: false },
  bonusAwardedAt: { type: Date, default: null },
});

// One prediction per user per Daily Pick — enforces the "1 prediction/día"
// cap at the DB level instead of relying solely on controller logic.
dailyPickPredictionSchema.index({ dailyPick: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('DailyPickPrediction', dailyPickPredictionSchema);
