const mongoose = require('mongoose');

const pickSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true },
  pick: { type: String, enum: ['1', 'X', '2'], required: true },
}, { _id: false });

/**
 * A pending manual-SPEI payment for a pool entry. Replaces the Stripe
 * Checkout flow (Stripe account closed): the user composes their picks,
 * we stash them here with a unique numeric `reference`, and show the user
 * the destination CLABE + reference. An admin verifies the incoming
 * transfer in their bank and confirms — only THEN do we create the real
 * QuinielaEntry (so unpaid intents never leak into the leaderboard /
 * settlement). Mirrors the "entry is created on payment confirmation"
 * shape the Stripe webhook used.
 */
const speiPaymentSchema = new mongoose.Schema({
  quiniela: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiniela', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  picks: { type: [pickSchema], default: [] },
  amountMXN: { type: Number, required: true },
  // Manual payment channel. 'spei' = MXN bank transfer (Mexico);
  // 'paypal' = PayPal.me in USD for players outside Mexico. Same
  // pending → user-marks-paid → admin-confirms lifecycle for both.
  method: { type: String, enum: ['spei', 'paypal'], default: 'spei', index: true },
  // Set only for method 'paypal' (the fixed international entry price).
  amountUSD: { type: Number, default: null },
  // Human-friendly numeric code the payer puts in the SPEI "concepto" /
  // "referencia numérica" so the admin can match the transfer. Unique so
  // two intents never collide on the same reference.
  reference: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
    index: true,
  },
  // Set when the PAYER taps "I've transferred" — a signal to the organizer
  // that this pending payment is worth verifying in the bank now (vs an
  // abandoned intent). `userNote` optionally carries the payer's SPEI
  // tracking key ("clave de rastreo") to make reconciliation easier.
  userMarkedPaidAt: { type: Date, default: null, index: true },
  userNote: { type: String, default: '' },
  // "Finish your payment" nudge sequence (see pendingPaymentReminderService).
  // The payer gets an escalating drip (e.g. +5 / +10 / +30 min) WHILE the pool
  // hasn't started. reminderCount = how many steps already sent (drives which
  // step is due next); reminderSentAt = when the last one went out.
  reminderCount: { type: Number, default: 0, index: true },
  reminderSentAt: { type: Date, default: null },
  // Set once an admin confirms the transfer arrived. `entry` links to the
  // QuinielaEntry created at confirmation (idempotency: a confirmed
  // payment already has an entry, so re-confirming is a no-op).
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'QuinielaEntry', default: null },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmedAt: { type: Date, default: null },
  rejectedReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SpeiPayment', speiPaymentSchema);
