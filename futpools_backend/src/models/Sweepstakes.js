const mongoose = require('mongoose');

/**
 * Sweepstakes — the v2.4 weekly raffle that pays a real-world prize
 * (e.g. Amazon $250 MXN gift card). Entries cost 7 Tickets each.
 *
 * Lifecycle:
 *   open      → users can buy entries (via /sweepstakes/:id/enter); each
 *               entry debits 7 Tickets via debitTicketsOrFail.
 *   drawing   → admin closed entries; we're picking a winner. Soft state,
 *               usually a few seconds.
 *   settled   → winner picked, prize delivered (manual or via API).
 *               Stores winnerUserId, settledAt, and a free-text
 *               `prizeDeliveryNote` for the admin trail.
 *   cancelled → admin cancelled before settling. All entries get a
 *               Tickets refund via applyTicketDelta.
 *
 * The min-participants rule (e.g. 20 entries) is enforced at settlement
 * time, not at entry time — so users can keep buying entries while we
 * wait to hit the floor. If we don't, status flips to `cancelled` and
 * everyone gets refunded (the sweepstakes "rolls over" conceptually,
 * though admin recreates next week's row).
 */
const sweepstakesSchema = new mongoose.Schema({
  // Human-friendly title shown in the UI list/detail.
  title: { type: String, required: true },
  description: { type: String, default: '' },
  // The real-world prize. Free-text — could be "Amazon $250 MXN gift
  // card" or "Camiseta del Real Madrid talla M". Operations decide.
  prizeLabel: { type: String, required: true },
  // USD-equivalent for telemetry / margin calculations. Optional.
  prizeUSD: { type: Number, default: 0 },

  // v2.4 fixed entry cost. Keeps mental model simple.
  entryCostTickets: { type: Number, default: 7 },
  // Floor below which the sweepstakes auto-cancels with refunds.
  minEntries: { type: Number, default: 20 },

  // ISO timestamps for the entry window. The drawing happens at
  // `entryClosesAt` + a small grace period.
  entryOpensAt: { type: Date, required: true },
  entryClosesAt: { type: Date, required: true, index: true },

  status: {
    type: String,
    enum: ['open', 'drawing', 'settled', 'cancelled'],
    default: 'open',
    index: true,
  },

  // Geo-restriction for v2.4 launch — Mexico only. Country code is
  // checked against the user's `countryCode` (Fase 5 adds this field).
  // Null/empty = no restriction.
  allowedCountries: { type: [String], default: ['MX'] },

  // Set at settlement time.
  winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  winnerEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SweepstakesEntry', default: null },
  settledAt: { type: Date, default: null },
  // Admin paper trail for delivery (e.g. "Sent Amazon code via email
  // 2026-05-01"). Free text, not parsed by code.
  prizeDeliveryNote: { type: String, default: '' },

  // Admin who created the sweepstakes (audit trail).
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Sweepstakes', sweepstakesSchema);
