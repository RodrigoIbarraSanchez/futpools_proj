const mongoose = require('mongoose');

/**
 * Daily Pick — the one fixture the platform features each day for the
 * Tickets check-in mechanism. Auto-selected by `dailyPickService.selectForToday`
 * at 00:00 local from a priority list of leagues (Liga MX > Premier League
 * > La Liga > Champions > Brasileirao > MLS).
 *
 * One row per calendar day (`date` is unique). If no priority-league fixture
 * exists for a given day, no document is created and the UI shows "Vuelve
 * mañana".
 *
 * Lifecycle:
 *   created  → users can predict 1/X/2 (up until kickoff)
 *   locked   → kickoff has passed; predictions frozen, awaiting result
 *   settled  → fixture is FT; `finalResult` populated; bonus Tickets awarded
 *               to predictors who got it right (idempotent via DailyPickPrediction)
 */

const dailyPickFixtureSchema = new mongoose.Schema({
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

const dailyPickSchema = new mongoose.Schema({
  // Local-day key formatted YYYY-MM-DD. Unique so we never double-pick a day.
  // We use string instead of Date because date arithmetic across timezones
  // is brittle and the calendar day is the conceptual key, not an instant.
  date: { type: String, required: true, unique: true, index: true },
  fixture: { type: dailyPickFixtureSchema, required: true },
  // Computed at settlement from the FT score: '1' | 'X' | '2'.
  finalResult: { type: String, default: null },
  settledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DailyPick', dailyPickSchema);
