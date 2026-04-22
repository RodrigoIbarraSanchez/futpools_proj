const mongoose = require('mongoose');

/**
 * Append-only ledger of every balance change. One row per `$inc` operation.
 * The `idempotencyKey` is the guard rail: any code path that wants to credit
 * or debit a user passes a key (e.g. `settle:<poolId>:<userId>` or
 * `entry:<entryId>`). The unique index makes retries safe — the second write
 * fails with E11000 and the caller short-circuits.
 *
 * Kinds:
 *   iap_credit         — App Store IAP (replaces ProcessedIAPTransaction path)
 *   entry_debit        — user paid coins to join a peer/coin pool
 *   prize_credit       — settlement paid out a winner (peer pot or platform prize)
 *   refund_credit      — pool dissolved below minParticipants; entries refunded
 *   admin_mint         — admin-issued coins (events, promos, correction)
 *   admin_burn         — admin-removed coins (reversal, correction)
 *   ads_credit         — rewarded-video reward
 *   signup_bonus       — v3 — gift to every new account on register
 *   sponsorship_debit  — v3 — creator pays prize×1.1 to sponsor a pool
 */
const balanceTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },  // signed: +credit, -debit
  kind: {
    type: String,
    enum: [
      'iap_credit', 'entry_debit', 'prize_credit', 'refund_credit',
      'admin_mint', 'admin_burn', 'ads_credit',
      'signup_bonus', 'sponsorship_debit',
    ],
    required: true,
    index: true,
  },
  // Unique per logical operation. E.g. `settle:<poolId>:<userId>`, `entry:<entryId>`,
  // `iap:<originalTransactionId>`, `mint:<adminId>:<timestamp>`.
  idempotencyKey: { type: String, required: true, unique: true },
  // Optional backreferences for admin ledger queries.
  quiniela: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiniela', index: true },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'QuinielaEntry' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('BalanceTransaction', balanceTransactionSchema);
