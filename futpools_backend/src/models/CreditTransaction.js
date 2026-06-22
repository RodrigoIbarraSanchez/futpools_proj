const mongoose = require('mongoose');

/**
 * Append-only ledger of MXN store-credit (simple_version).
 *
 * This is DISTINCT from the legacy coin ledger (`BalanceTransaction`) and from
 * `User.balance` — those are the dropped coins economy. This ledger is plain
 * Mexican pesos that an admin grants to a user so a pool entry can be created
 * without a fresh SPEI/PayPal transfer. Typical case: a player paid for a pool
 * they missed and the organizer rolls that $50 forward as credit.
 *
 * A user's available credit is `sum(amountMXN)` across their rows — there is no
 * cached balance field, so the ledger is the single source of truth and can
 * never drift.
 *
 * Kinds:
 *   admin_grant  — organizer adds credit (+, e.g. rolled-over payment, promo)
 *   entry_use    — credit spent to create a pool entry (−, one per entry)
 *   admin_revoke — organizer removes credit (−, correction / clawback)
 *
 * Idempotency: `idempotencyKey` is unique. The spend path uses
 * `entry-use:<entryId>` so a retried join can never double-charge the credit.
 */
const creditTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amountMXN: { type: Number, required: true }, // signed: +grant, −use/revoke
  kind: {
    type: String,
    enum: ['admin_grant', 'entry_use', 'admin_revoke'],
    required: true,
    index: true,
  },
  idempotencyKey: { type: String, required: true, unique: true },
  // Backreferences for the admin ledger view + the spend audit trail.
  quiniela: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiniela', default: null },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'QuinielaEntry', default: null },
  // Who issued an admin_grant / admin_revoke (null for entry_use).
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
