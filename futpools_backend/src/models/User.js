const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  balance: { type: Number, default: 0 },
  // Tickets (v2.4) — second virtual currency, completely decoupled from
  // `balance`. Tickets are EARN-ONLY (Daily Pick check-in + rewarded ads),
  // never sold via IAP/Stripe. Spent only on entries to premium sweepstakes
  // pools that pay out real-world prizes. The legal wall between the two
  // economies is enforced at the service layer: `transactionService` only
  // touches `balance`, `ticketService` only touches `tickets`. Never both.
  tickets: { type: Number, default: 0 },
  // Age gate + country (v2.4 Fase 5) — required for sweepstakes
  // eligibility. Backend enforces 18+ on register; sweepstakes endpoint
  // filters by allowedCountries vs `countryCode`. Both nullable so older
  // accounts pre-Fase 5 keep working until the user updates their profile.
  dob: { type: Date, default: null },
  countryCode: { type: String, default: null, uppercase: true, trim: true, maxlength: 2 },

  // ── FutPools Rank (skill track record) ────────────────────────────────
  // Elo-lite rating: each scored pool adjusts by K × (actual - expected) / max.
  // Starts at 1000 (Amateur tier floor), capped to [500, 3000].
  rating: { type: Number, default: 1000, index: true },
  ratingPeak: { type: Number, default: 1000 },
  // Consecutive pool-level wins. "Current" resets on a non-win; "best" never
  // decreases. Matchday-level streaks live in achievements, not here.
  streakCurrent: { type: Number, default: 0 },
  streakBest: { type: Number, default: 0 },
  poolsPlayed: { type: Number, default: 0 },
  poolsWon: { type: Number, default: 0 },
  poolsTop3: { type: Number, default: 0 },
  picksCorrect: { type: Number, default: 0 },
  picksTotal: { type: Number, default: 0 },
  // Append-only unlock log. Duplicate codes prevented in checkAchievements.
  achievements: {
    type: [{
      code: { type: String, required: true },
      unlockedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },

  passwordResetCode: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
