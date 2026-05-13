const DailyPick = require('../models/DailyPick');
const DailyPickPrediction = require('../models/DailyPickPrediction');
const { applyTicketDelta } = require('./ticketService');
const { fetchFixturesByIds, getFixturesByLeagueAndDate, getFixturesByDate } = require('./apiFootball');

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
//
// Ampliada para cubrir mid-week — sin Europa League/Copa MX/Libertadores
// los jueves quedaban sin Daily Pick (las top-9 leagues solo juegan
// weekends + UCL los martes/miércoles). Cuando ninguna de estas tiene
// partido hoy, el fallback `selectFromAnyLeague` agarra cualquier
// fixture popular del día.
const PRIORITY_LEAGUE_IDS = [
  262,  // Liga MX
  263,  // Liga MX — Liga de Expansión
  39,   // Premier League
  140,  // La Liga
  2,    // UEFA Champions League
  3,    // UEFA Europa League
  848,  // UEFA Conference League
  135,  // Serie A
  78,   // Bundesliga
  61,   // Ligue 1
  71,   // Brasileirao
  13,   // CONMEBOL Libertadores
  11,   // CONMEBOL Sudamericana
  253,  // MLS
  73,   // Brasileirao Serie B
  144,  // Belgian Pro League (mid-week filler)
  88,   // Eredivisie
  94,   // Primeira Liga (Portugal)
];

/**
 * Last-resort fallback when no priority league has a fixture today.
 * Hits API-Football's worldwide /fixtures?date=YYYY-MM-DD and picks the
 * earliest upcoming match. Common scenario: Thursdays in MX — most top
 * leagues don't play, but Liga MX Sub-20, Brasil Série C, Eredivisie
 * Cup or similar usually have something on.
 */
async function selectFromAnyLeague(dateKey) {
  let response;
  try {
    response = await getFixturesByDate(dateKey);
  } catch (err) {
    console.warn('[DailyPick] global fallback fetch failed:', err.message);
    return null;
  }
  const now = Date.now();
  const upcoming = (response || [])
    .filter((f) => {
      const k = f?.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
      return k > now;
    })
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  return upcoming[0] || null;
}

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

  // No priority league has a fixture today — fall back to any worldwide
  // upcoming match so the Daily Pick surface is never empty.
  const fallback = await selectFromAnyLeague(dateKey);
  if (fallback) {
    const dp = await DailyPick.create({
      date: dateKey,
      fixture: {
        fixtureId: fallback.fixture.id,
        leagueId: fallback.league.id,
        leagueName: fallback.league.name,
        homeTeamId: fallback.teams.home.id,
        awayTeamId: fallback.teams.away.id,
        homeTeam: fallback.teams.home.name,
        awayTeam: fallback.teams.away.name,
        homeLogo: fallback.teams.home.logo || '',
        awayLogo: fallback.teams.away.logo || '',
        kickoff: new Date(fallback.fixture.date),
      },
    });
    console.log(`[DailyPick] selected via fallback for ${dateKey}: ${dp.fixture.homeTeam} vs ${dp.fixture.awayTeam} (league ${fallback.league.id} ${fallback.league.name})`);
    return dp;
  }

  console.log(`[DailyPick] no fixtures at all for ${dateKey}`);
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
  // Piggy-back simple_version pool settlement onto the same 1-minute
  // tick. settleEligiblePools is idempotent and skips pools that are
  // already settled or whose fixtures haven't all finished — cheap to
  // call frequently.
  try {
    const { settleEligiblePools } = require('./poolSettlementService');
    await settleEligiblePools();
  } catch (err) { console.warn('[PoolSettlement] tick error:', err.message); }
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
