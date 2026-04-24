const mongoose = require('mongoose');

/**
 * Head-to-head challenge between two users on a single fixture.
 *
 * Lifecycle:
 *   pending  → challenger created, coins debited, waiting for opponent
 *   accepted → opponent accepted + debited; waiting for fixture FT
 *   settled  → fixture over, winner paid
 *   refunded → fixture over but neither pick matched the outcome (1X2 with
 *              third-outcome result); both refunded minus nothing
 *   declined → opponent rejected before kickoff; challenger refunded
 *   cancelled → challenger cancelled before accept OR kickoff passed with no
 *              accept; challenger refunded
 *
 * Fixture is embedded (not referenced) because challenges can target fixtures
 * that aren't in any pool — the snapshot makes settlement self-contained.
 * The actual outcome is fetched from API-Football at settlement time via
 * `fetchFixturesByIds([fixture.fixtureId])`.
 */

const challengeFixtureSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true, index: true },
  leagueId: { type: Number },
  leagueName: { type: String, default: '' },
  homeTeamId: { type: Number },
  awayTeamId: { type: Number },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeLogo: { type: String, default: '' },
  awayLogo: { type: String, default: '' },
  kickoff: { type: Date, required: true },
}, { _id: false });

// Stake presets mirror the Coins pool entry amounts so users don't need to
// relearn denominations across features.
const ALLOWED_STAKES = [10, 25, 50, 100, 250, 500];
const MARKET_TYPES = ['1X2', 'OU25', 'BTTS'];

// Per-market valid picks. Enforced both at schema (implicit via validator)
// and in the controller (explicit 400 with message).
const VALID_PICKS = {
  '1X2':  ['1', 'X', '2'],
  'OU25': ['OVER', 'UNDER'],
  'BTTS': ['YES', 'NO'],
};

const challengeSchema = new mongoose.Schema({
  // Short alphanumeric (8 chars, no confusables) for deep-link shares:
  // futpools.com/c/ABC23456 / futpools://c/ABC23456
  code: { type: String, required: true, unique: true, uppercase: true, index: true },
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Two modes:
  //   directed (opponent set at create) — only that user can accept.
  //   open (opponent null at create)    — first non-challenger to claim via
  //                                       /accept becomes the opponent.
  // Open mode lets the challenger share a link without knowing anyone's
  // username. Atomic claim happens in acceptChallenge via findOneAndUpdate
  // with `opponent: null` filter so two concurrent accepts can't both win.
  opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  stakeCoins: { type: Number, required: true, enum: ALLOWED_STAKES },
  marketType: { type: String, required: true, enum: MARKET_TYPES },
  challengerPick: { type: String, required: true },
  opponentPick: { type: String, default: null },
  fixture: { type: challengeFixtureSchema, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'settled', 'refunded', 'declined', 'cancelled'],
    default: 'pending',
    index: true,
  },
  winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Resolved match outcome (e.g. '1'/'X'/'2' for 1X2) — set at settlement.
  // Null while pending/accepted/cancelled/declined.
  outcomeKey: { type: String, default: null },
  rakePercent: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now, index: true },
  acceptedAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
});

// Compound index for the common "my challenges" feed query.
challengeSchema.index({ challenger: 1, createdAt: -1 });
challengeSchema.index({ opponent: 1, createdAt: -1 });

// Enforce that challenger/opponent are different (when opponent is set) and
// picks are valid for the chosen market. Runs on every save so hand-crafted
// docs don't slip through. Open challenges (opponent: null) skip the
// challenger==opponent check by definition — the controller still blocks
// self-accept at claim time.
challengeSchema.pre('validate', function enforceInvariants(next) {
  if (this.opponent && String(this.challenger) === String(this.opponent)) {
    return next(new Error('challenger and opponent must be different users'));
  }
  const allowed = VALID_PICKS[this.marketType];
  if (!allowed || !allowed.includes(this.challengerPick)) {
    return next(new Error(`invalid challengerPick "${this.challengerPick}" for market ${this.marketType}`));
  }
  if (this.opponentPick != null) {
    if (!allowed.includes(this.opponentPick)) {
      return next(new Error(`invalid opponentPick "${this.opponentPick}" for market ${this.marketType}`));
    }
    if (this.opponentPick === this.challengerPick) {
      return next(new Error('opponentPick must differ from challengerPick'));
    }
  }
  next();
});

module.exports = mongoose.model('Challenge', challengeSchema);
module.exports.ALLOWED_STAKES = ALLOWED_STAKES;
module.exports.MARKET_TYPES = MARKET_TYPES;
module.exports.VALID_PICKS = VALID_PICKS;
