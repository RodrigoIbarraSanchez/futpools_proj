const mongoose = require('mongoose');

/**
 * Append-only ledger of every Tickets balance change. Mirrors
 * `BalanceTransaction` exactly except the `kind` enum is Tickets-specific.
 *
 * The legal wall between Coins and Tickets is enforced here: this collection
 * NEVER references coins, and the coins ledger NEVER references tickets.
 * Two parallel economies, never coupled in code or in DB.
 *
 * The `idempotencyKey` is the guard rail: any code path that wants to
 * credit or debit Tickets passes a key (e.g. `ticket:checkin:<userId>:<YYYY-MM-DD>`
 * or `ticket:ad:<userId>:<ssvToken>`). The unique index makes retries safe —
 * the second write fails with E11000 and the caller short-circuits.
 *
 * Kinds:
 *   checkin_credit       — Daily Pick prediction submitted (+1 Ticket immediate)
 *   checkin_bonus        — Daily Pick prediction was correct at FT (+1 Ticket bonus)
 *   ad_credit            — rewarded video viewed + SSV verified (+1 Ticket)
 *   sweepstakes_debit    — user spent 7 Tickets to enter the weekly sweepstakes
 *   admin_mint           — admin-issued tickets (corrections, support tickets)
 *   admin_burn           — admin-removed tickets (reversal, fraud)
 *   refund_credit        — sweepstakes cancelled / minimum not reached / etc.
 */
const ticketTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },  // signed: +credit, -debit
  kind: {
    type: String,
    enum: [
      'checkin_credit', 'checkin_bonus', 'ad_credit',
      'sweepstakes_debit', 'admin_mint', 'admin_burn', 'refund_credit',
    ],
    required: true,
    index: true,
  },
  // Unique per logical operation. Examples:
  //   `ticket:checkin:<userId>:<YYYY-MM-DD>`
  //   `ticket:checkin-bonus:<userId>:<dailyPickId>`
  //   `ticket:ad:<userId>:<ssvToken>`           ← SSV token from AdMob/Unity/AppLovin
  //   `ticket:sweepstakes:<sweepstakesId>:<userId>:<entryNumber>`
  //   `ticket:mint:<adminId>:<userId>:<timestamp>`
  idempotencyKey: { type: String, required: true, unique: true },
  // Optional backreferences for admin ledger queries.
  sweepstakes: { type: mongoose.Schema.Types.ObjectId, ref: 'Sweepstakes', index: true },
  dailyPick: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPick' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('TicketTransaction', ticketTransactionSchema);
