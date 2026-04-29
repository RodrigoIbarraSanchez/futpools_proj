const DailyPick = require('../models/DailyPick');
const DailyPickPrediction = require('../models/DailyPickPrediction');
const { applyTicketDelta } = require('./ticketService');
const { fetchFixturesByIds, getFixturesByLeagueAndDate } = require('./apiFootball');

/**
 * Daily Pick service. Two responsibilities:
 *   1. Select today's featured fixture from a priority list of leagues.
 *   2. Settle yesterday's (or earlier) Daily Picks: detect FT, compute
 *      the result, and award +1 bonus Ticket to predictors who got it
 *      right.
 *
 * Both run on a single setInterval tick from server.js (every minute);
 * the work is idempotent so a missed minute or a double-fire is safe.
 */

// Priority order — most popular MX/global leagues first. If today's
// fixtures from a higher-priority league exist, we pick from there. Falls
// through to the next league only when the current one has no fixtures
// today. Uses API-Football league ids.
const PRIORITY_LEAGUE_IDS = [
  262,  // Liga MX
  39,   // Premier League
  140,  // La Liga
  2,    // UEFA Champions League
  135,  // Serie A
  78,   // Bundesliga
  61,   // Ligue 1
  71,   // Brasileirao
  253,  // MLS
];

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/**
 * Local YYYY-MM-DD for a Date. We deliberately use the server's local TZ
 * (which should be set to America/Mexico_City via TZ env var on Render) —
 * the calendar day is the conceptual key, not an instant.
 */
function localDateKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compute 1/X/2 from a final score. Returns null if scores are missing.
 */
function resultFromScore(home, away) {
  if (home == null || away == null) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
}

/**
 * Pick today's featured fixture from API-Football. Strategy:
 *   1. For each priority league (in order), query fixtures for today.
 *   2. Pick the first fixture that hasn't started yet (kickoff in future).
 *   3. If none in that league, try the next priority league.
 *   4. If no priority league has a future fixture today, return null and
 *      log — UI will show "Vuelve mañana".
 *
 * The fixture is then snapshotted into a `DailyPick` doc. Idempotent: if
 * today already has a Daily Pick, return that existing doc.
 */
async function selectForToday() {
  const dateKey = localDateKey();
  const existing = await DailyPick.findOne({ date: dateKey });
  if (existing) return existing;

  const season = process.env.API_FOOTBALL_SEASON || String(new Date().getFullYear());
  const now = Date.now();

  for (const leagueId of PRIORITY_LEAGUE_IDS) {
    let response;
    try {
      response = await getFixturesByLeagueAndDate(leagueId, dateKey, season);
    } catch (err) {
      console.warn(`[DailyPick] league ${leagueId} fetch failed:`, err.message);
      continue;
    }

    const fixtures = (response || [])
      .filter((f) => {
        const kickoff = f?.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
        return kickoff > now;
      })
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    if (fixtures.length === 0) continue;
    const f = fixtures[0];

    const dp = await DailyPick.create({
      date: dateKey,
      fixture: {
        fixtureId: f.fixture.id,
        leagueId: f.league.id,
        leagueName: f.league.name,
        homeTeamId: f.teams.home.id,
        awayTeamId: f.teams.away.id,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeLogo: f.teams.home.logo || '',
        awayLogo: f.teams.away.logo || '',
        kickoff: new Date(f.fixture.date),
      },
    });
    console.log(`[DailyPick] selected for ${dateKey}: ${dp.fixture.homeTeam} vs ${dp.fixture.awayTeam} (league ${leagueId})`);
    return dp;
  }

  console.log(`[DailyPick] no priority-league fixtures for ${dateKey}`);
  return null;
}

/**
 * Settle one Daily Pick. Pulls the fixture from API-Football, checks for
 * FT, computes the result, and awards +1 bonus Ticket to every predictor
 * who got it right. Idempotent at multiple levels:
 *   - DailyPick.settledAt set once → subsequent calls short-circuit.
 *   - Per-prediction `bonusAwarded` flag.
 *   - TicketTransaction.idempotencyKey unique index.
 */
async function settleDailyPick(dp) {
  if (!dp || dp.settledAt) return dp;

  let live;
  try {
    const arr = await fetchFixturesByIds([dp.fixture.fixtureId]);
    live = Array.isArray(arr) ? arr[0] : null;
  } catch (err) {
    console.warn(`[DailyPick] settle fetch failed for ${dp._id}:`, err.message);
    return dp;
  }

  const short = (live?.status?.short || '').toUpperCase();
  if (!FINISHED_STATUSES.has(short)) return dp;  // not finished yet

  const result = resultFromScore(live?.score?.home, live?.score?.away);
  if (!result) {
    console.warn(`[DailyPick] FT but missing score for ${dp._id}`);
    return dp;
  }

  dp.finalResult = result;
  dp.settledAt = new Date();
  await dp.save();

  // Award bonuses to every correct predictor that hasn't been credited.
  const correct = await DailyPickPrediction.find({
    dailyPick: dp._id,
    pick: result,
    bonusAwarded: false,
  }).lean();

  for (const pred of correct) {
    const idempotencyKey = `ticket:checkin-bonus:${dp._id}:${pred.user}`;
    const res = await applyTicketDelta({
      userId: pred.user,
      amount: 1,
      kind: 'checkin_bonus',
      idempotencyKey,
      dailyPick: dp._id,
      note: `Daily Pick bonus ${dp.date}`,
    });
    if (res.applied || res.alreadyProcessed) {
      await DailyPickPrediction.updateOne(
        { _id: pred._id },
        { $set: { bonusAwarded: true, bonusAwardedAt: new Date() } }
      );
    }
  }

  console.log(`[DailyPick] settled ${dp._id} (${dp.date}, ${result}); awarded ${correct.length} bonuses`);
  return dp;
}

/**
 * Settle all Daily Picks that have finished but haven't been settled yet.
 * Called from the cron tick. We look back 3 days to handle PEN matches
 * that may have ended late, server downtime, etc.
 */
async function settleOpenPicks() {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const open = await DailyPick.find({
    settledAt: null,
    'fixture.kickoff': { $gte: cutoff, $lte: new Date() },
  });
  for (const dp of open) {
    try { await settleDailyPick(dp); }
    catch (err) { console.warn(`[DailyPick] settle error ${dp._id}:`, err.message); }
  }
}

/**
 * Cron tick — runs every minute from server.js.
 * - Tries to ensure today's Daily Pick exists (idempotent).
 * - Tries to settle any finished Daily Picks (idempotent).
 *
 * Errors are caught and logged so a transient API-Football outage doesn't
 * kill the timer.
 */
async function dailyPickTick() {
  try { await selectForToday(); }
  catch (err) { console.warn('[DailyPick] selectForToday error:', err.message); }
  try { await settleOpenPicks(); }
  catch (err) { console.warn('[DailyPick] settleOpenPicks error:', err.message); }
}

function startDailyPickScheduler() {
  // Fire once immediately so a cold start doesn't wait until the top of
  // the next minute.
  dailyPickTick();
  setInterval(dailyPickTick, 60 * 1000);
  console.log('[DailyPick] scheduler started (1-minute tick)');
}

module.exports = {
  selectForToday,
  settleDailyPick,
  settleOpenPicks,
  dailyPickTick,
  startDailyPickScheduler,
  // Exported for tests + the controller's read endpoint.
  localDateKey,
  resultFromScore,
};
