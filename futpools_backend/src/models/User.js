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

  // Onboarding answers captured by the iOS skill-driven flow before
  // signup. Persisted to the user record so we can:
  //   - personalize Home / Daily Pick by their preferred leagues
  //   - prefill the first Quiniela create with their demo picks
  //   - segment cohorts by goal/pain for marketing analytics
  // All fields optional — older accounts that signed up before
  // onboarding v2 simply leave this null.
  onboarding: {
    goals:    { type: [String], default: [] },   // OnboardingGoalChoice raws
    pains:    { type: [String], default: [] },   // OnboardingPain raws
    leagues:  { type: [String], default: [] },   // OnboardingLeague raws
    teams:    { type: [String], default: [] },   // OnbTeam raws (e.g. "america")
    demoPicks: {
      type: [{
        fixtureId: Number,
        pick: String,  // "1" | "X" | "2"
        _id: false,
      }],
      default: [],
    },
    completedAt: { type: Date, default: null },
  },

  // ── Push notifications (simple_version Phase 1) ──────────────────────
  // APNs device tokens registered by iOS clients. Multiple per user (one
  // per device they install on). Cap to 5 tokens; evict oldest on
  // overflow inside the registerDevice controller. The bounce path
  // (APNs returns 410 Gone) finds the user by token via the index below.
  deviceTokens: {
    type: [{
      token: { type: String, required: true },
      platform: { type: String, default: 'ios' },
      bundleId: { type: String, default: '' },
      // Locale at registration time, e.g. "en", "es". Backend templeta
      // push copy with this so users get notifications in the language
      // their app is currently set to (which may differ from device
      // locale because of the in-app override).
      locale: { type: String, default: 'en' },
      appVersion: { type: String, default: '' },
      osVersion: { type: String, default: '' },
      // sandbox = TestFlight + DEBUG builds; production = App Store
      // builds. APNs gateway differs, so we have to pick the right one
      // per send.
      environment: { type: String, enum: ['sandbox', 'production'], default: 'production' },
      lastSeenAt: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now },
      _id: false,
    }],
    default: [],
  },
  // User-controlled notification preferences. globalEnabled is the
  // master kill switch; the muted lists are surgical opt-outs. We
  // deliberately keep it coarse — no per-event-type toggles per pool /
  // team because the surface area explodes and the value is low.
  notificationPrefs: {
    globalEnabled: { type: Boolean, default: true },
    // API-Football team ids the user has muted (push-wise; team can
    // still appear in the favorites list for live scores).
    mutedTeams: { type: [Number], default: [] },
    // Quiniela ids the user has muted. Used for the rare case a user
    // joined a pool but doesn't want kickoff/finalized pings about it.
    mutedPools: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },

  passwordResetCode: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Bounce path: APNs returns 410 Gone for an evicted token. We need to
// find which user owns that token to pull it from their array. Without
// this index every bounce is a collection scan.
userSchema.index({ 'deviceTokens.token': 1 });
// Push fan-out by favorite team: pushNotificationService queries
// `User.find({ 'onboarding.teams': { $in: [String(teamId)] } })`. The
// teams array is small per user but the user collection isn't, so the
// index keeps fan-out bounded.
userSchema.index({ 'onboarding.teams': 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
