const mongoose = require('mongoose');

/**
 * One row per (Sweepstakes, user, entryNumber). A user can buy multiple
 * entries to increase their odds — each is a separate row that gets its
 * own shot in the random draw. This is the "ticket stub" abstraction
 * that lets us pick a winner with a uniform random across all entries
 * (not weighted by user).
 *
 * Idempotency between Tickets debit and entry creation is handled in
 * the controller: we debit first (debitTicketsOrFail), then create the
 * entry. If the create fails (rare — unique conflict on entry counter
 * race), we refund. The TicketTransaction key
 * `ticket:sweepstakes:<sweepstakesId>:<userId>:<entryNumber>` is unique
 * per entry, so a retry is safe.
 */
const sweepstakesEntrySchema = new mongoose.Schema({
  sweepstakes: { type: mongoose.Schema.Types.ObjectId, ref: 'Sweepstakes', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // 1-indexed within (sweepstakes, user) — the user's nth entry to this
  // sweepstakes. Increments per buy. Guards against double-credit on
  // retry by being part of the idempotency key.
  entryNumber: { type: Number, required: true },
  ticketsSpent: { type: Number, required: true },
  refunded: { type: Boolean, default: false },
  refundedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

// (sweepstakes, user, entryNumber) is the natural unique key.
sweepstakesEntrySchema.index({ sweepstakes: 1, user: 1, entryNumber: 1 }, { unique: true });

module.exports = mongoose.model('SweepstakesEntry', sweepstakesEntrySchema);
