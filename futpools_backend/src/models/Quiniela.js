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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Quiniela', quinielaSchema);
