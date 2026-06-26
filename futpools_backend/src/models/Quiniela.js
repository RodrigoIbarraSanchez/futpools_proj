const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true },
  leagueId: { type: Number },
  leagueName: { type: String, default: '' },
  homeTeamId: { type: Number },
  awayTeamId: { type: Number },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeLogo: { type: String, default: '' },
  awayLogo: { type: String, default: '' },
  kickoff: { type: Date, required: true },
  status: { type: String, default: '' },
}, { _id: false });

/**
 * Real-world prize attached to a normal pool. Distinct from the
 * `prize` / `prizeLabel` cash-display fields — this carries the
 * structured payload the iOS/web client needs to render the prize
 * hero (image asset key) plus admin operational data
 * (USD value for telemetry, free-text delivery note for fulfillment).
 *
 * Only set on admin-curated pools. Presence triggers AMOE + Apple
 * Guideline 5.3 disclaimers in the detail view client-side.
 */
const realPrizeSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  prizeUSD: { type: Number, default: 0 },
  // Bundled-asset key the iOS app maps to an image catalog entry,
  // e.g. "PrizeAmazonGift". Future flexibility: when prizes vary,
  // we'll add a `prizeImageURL` for remote-hosted images.
  imageKey: { type: String, default: '' },
  // Admin paper trail for delivery (e.g. "Sent Amazon code via email
  // 2026-05-08 to user X"). Free text, not parsed by code.
  deliveryNote: { type: String, default: '' },
}, { _id: false });

/**
 * One rung of a prize_ladder pool. "If your correct-pick count is in
 * [min, max], you win prizeMXN pesos." Ranges let the spec's
 * "1–7 aciertos → $0" collapse into one tier, and ranges are
 * deliberately NOT assumed monotonic — the "0 aciertos → $100"
 * consolation sits below the dead zone. See src/lib/prizeLadder.js
 * for the lookup + validation helpers.
 */
const prizeTierSchema = new mongoose.Schema({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  prizeMXN: { type: Number, required: true, default: 0 },
  // Optional admin-set display label; clients otherwise build their own
  // localized label from min/max + prizeMXN.
  label: { type: String, default: '' },
}, { _id: false });

const quinielaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // Legacy cash-prize label used by admin-curated pools (e.g. "$5,000 MXN").
  // User-created MVP pools leave this empty — they use `prizeLabel` instead.
  prize: { type: String, default: '' },
  // Legacy entry-cost string (e.g. "$15"). User-created MVP pools are free ("0").
  cost: { type: String, default: '0' },
  currency: { type: String, default: 'MXN' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  fixtures: { type: [fixtureSchema], default: [] },
  // Admin-controlled flag. When true the pool is pinned to the client's
  // QUICK PLAY hero / featured carousel. Only toggleable by admins
  // (field-level guard in controller), not by the creator.
  featured: { type: Boolean, default: false, index: true },
  // User who created the pool. Legacy admin pools may leave this null.
  // Points at User (previously pointed at a non-existent 'Admin' model).
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  // 'public' → discoverable in Home. 'private' → only reachable via inviteCode / link.
  // Admin-created pools default to 'public'; user-created default to 'private'.
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  // Short alphanum code used in share links (e.g. futpools://p/ABC23456).
  // 8 chars, uppercase, no confusables (0/O/1/I). Generated at create time.
  inviteCode: { type: String, unique: true, sparse: true, index: true },
  // Free-text label for MVP user-pools ("the loser buys pizza"). Not money.
  // Legacy `prize` field is still used for admin-curated pools with cash prizes.
  prizeLabel: { type: String, default: '' },

  // ── Pool format (competition type) ────────────────────────────────────
  // Orthogonal to `fundingModel` (which describes WHO funds the prize).
  // `poolType` describes the SCORING/PAYOUT format:
  //   standard     — one winner takes the pot (existing behavior).
  //   prize_ladder — every player wins a fixed prize based on their
  //                  number of correct picks ("aciertos"), per `prizeLadder`.
  //                  Platform-funded: prizes are paid regardless of pot size.
  // Absent/empty on legacy pools → treated as 'standard'.
  poolType: {
    type: String,
    enum: ['standard', 'prize_ladder'],
    default: 'standard',
    index: true,
  },
  // The tiered payout table for prize_ladder pools (empty for standard).
  // Stored desc by `min` for top-to-bottom thermometer display.
  prizeLadder: { type: [prizeTierSchema], default: [] },

  // ── Economy / prize pool (Phase 2) ────────────────────────────────────
  // How the prize is funded:
  //   none       — free social pool, no prize mechanics (default)
  //   peer       — players stake coins; winner gets pot × (1 - rakePercent)
  //   platform   — FutPools funds the prize, locked only if min participants met
  //   sponsored  — user-funded prize (v3): creator pays prize×1.1, friends play free
  //   brand      — brand-funded prize (Fase 3)
  fundingModel: {
    type: String,
    enum: ['none', 'peer', 'platform', 'sponsored', 'brand'],
    default: 'none',
    index: true,
  },
  // Coins the prize pool holds. Funded by platform (admin Platform Event) or
  // by the creator (v3 Sponsored pools). Released to winner only if
  // entries.count >= minParticipants at first fixture kickoff.
  platformPrizeCoins: { type: Number, default: 0 },
  // Who paid for the prize. For Sponsored → the creator. For Platform Event →
  // the admin. Settlement uses this to route refunds when a pool dissolves.
  prizeFunderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  // Floor for the prize to unlock. Below this, prize dissolves and any coin
  // entries are refunded.
  minParticipants: { type: Number, default: 1 },
  // Virtual-currency entry cost for 'peer' pools. 0 for free/platform pools.
  entryCostCoins: { type: Number, default: 0 },
  // House cut on settlement. simple_version splits 65/35: winner gets
  // 65% of the gross pot, the remaining 35% absorbs Stripe processing
  // (~3.6% + $3 MXN) and the FutPools platform fee. Default raised
  // from the legacy 10% so newly-created pools settle on the new
  // economics without a per-pool override.
  rakePercent: { type: Number, default: 35 },
  // Lifecycle of the pledged prize. See plan file for transitions.
  prizeLockStatus: {
    type: String,
    enum: ['pledged', 'locked', 'dissolved', 'paid'],
    default: 'pledged',
    index: true,
  },
  prizeUnlockedAt: { type: Date },
  // Settlement tracking for the cron.
  settlementStatus: {
    type: String,
    enum: ['pending', 'settled', 'refunded', 'cancelled'],
    default: 'pending',
    index: true,
  },
  settledAt: { type: Date },
  winnerUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  // Set once the "last call" reminder has gone out (a few hours before
  // startDate, to opted-in non-entrants). One-shot per pool, see
  // lifecycleEmailService.remindClosingPools.
  closingReminderSentAt: { type: Date, default: null },

  // Admin-only. When set, the pool is rendered as a "real prize pool"
  // with the bundled asset image, AMOE + Apple disclaimers in the
  // detail view, and surfaced in the Home WEEKLY POOL · REAL PRIZE
  // teaser. Listed via GET /quinielas?realPrize=1.
  realPrize: { type: realPrizeSchema, default: null },

  // ── simple_version (Phase 1) ──────────────────────────────────────────
  // Stripe Checkout entry fee in **MXN pesos** (NOT cents — converted to
  // centavos at the Stripe API call site by ×100). Default 50 = $50 MXN
  // per the simple_version product spec. Stored even on master pools
  // (unused there) so a single QuinielaEntry schema can carry stripe
  // metadata regardless of branch. Admin can override per pool.
  entryFeeMXN: { type: Number, default: 50 },
  // Set when the admin marks a settled pool as paid out to the winner
  // (manual SPEI / bank transfer happens off-band). The presence of
  // this date is what removes the pool from the AdminPayouts list.
  winnerPaidAt: { type: Date, default: null },
  // Free-text record of the payout (e.g. "SPEI ref ABC123, 2026-05-15").
  // Not parsed by code — operational paper trail only.
  winnerPaidNote: { type: String, default: null },
  // Set when admin cancels the pool via /admin/pools/:id/cancel. Refunds
  // are dispatched per-entry; this field marks the pool as no longer
  // active. cancelledReason carries the admin's free-text justification.
  cancelledAt: { type: Date, default: null },
  cancelledReason: { type: String, default: null },

  // Set when the "pool locks in 10 min — review pending payments" Telegram
  // alert has been sent (see poolLockAlertService). One-shot per pool so the
  // 1-minute scheduler doesn't re-alert every tick during the lock window.
  lockAlertSentAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Quiniela', quinielaSchema);
