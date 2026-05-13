/**
 * Pool settlement — picks the winner once every fixture in the pool
 * is final, then flips Quiniela.settlementStatus to 'settled' and
 * stamps winnerUserIds + settledAt. The admin payouts dashboard reads
 * those fields to surface pools that need a manual bank transfer.
 *
 * Runs on the existing 1-minute scheduler (see dailyPickService.js)
 * so we don't add a second timer. Idempotent: pools already in
 * 'settled' or 'refunded' are skipped.
 *
 * Tie-breakers (highest score wins, ties broken by earliest entry):
 *   - First pass: the entry with the most correct picks
 *   - Tiebreak: earliest entryNumber, then earliest createdAt
 *
 * The choice of "earliest entry wins ties" matches the existing
 * leaderboard ordering rule used in getLeaderboard, so the displayed
 * #1 row IS the actual winner.
 */

const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const { fetchFixturesByIds } = require('./apiFootball');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

function resultFromScore(home, away) {
  if (home == null || away == null) return null;
  const h = Number(home);
  const a = Number(away);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;
  if (h > a) return '1';
  if (h < a) return '2';
  return 'X';
}

/**
 * Inspect a pool's fixtures + apply scoring + pick winner.
 * Returns { settled: bool, reason?: string } so callers can log skips.
 */
async function settlePool(pool) {
  // Refunded or already-settled pools never re-settle.
  if (pool.settlementStatus !== 'pending') {
    return { settled: false, reason: 'NOT_PENDING' };
  }
  const fixtureIds = (pool.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
  if (fixtureIds.length === 0) return { settled: false, reason: 'NO_FIXTURES' };

  const liveFixtures = await fetchFixturesByIds(fixtureIds).catch(() => []);
  // Build map fixtureId → '1' | 'X' | '2' for fixtures that have a final
  // result. If ANY fixture is missing a final result, we bail — pool's
  // not ready.
  const finalResults = new Map();
  for (const f of liveFixtures) {
    const short = (f?.status?.short || '').toUpperCase();
    const result = resultFromScore(f?.score?.home, f?.score?.away);
    if (FINISHED_STATUSES.has(short) && result != null) {
      finalResults.set(f.fixtureId, result);
    }
  }
  if (finalResults.size < fixtureIds.length) {
    return { settled: false, reason: 'NOT_ALL_FT' };
  }

  // Compute score for each entry and pick the winner. Ties broken by
  // (entryNumber asc, createdAt asc).
  const entries = await QuinielaEntry.find({
    quiniela: pool._id,
    refundedAt: null,
  }).sort({ entryNumber: 1, createdAt: 1 }).populate('user', 'displayName email');

  if (entries.length === 0) return { settled: false, reason: 'NO_ENTRIES' };

  let bestScore = -1;
  let winnerEntry = null;
  for (const entry of entries) {
    let score = 0;
    for (const pick of entry.picks || []) {
      if (finalResults.get(pick.fixtureId) === pick.pick) score += 1;
    }
    // Persist scoredAt + score so getLeaderboard's settled column
    // stays consistent with our settlement decision.
    entry.scoredAt = new Date();
    entry.score = score;
    entry.totalPossibleAtScoring = fixtureIds.length;
    await entry.save();
    if (score > bestScore) {
      bestScore = score;
      winnerEntry = entry;
    }
  }
  if (!winnerEntry) return { settled: false, reason: 'NO_WINNER' };

  pool.settlementStatus = 'settled';
  pool.settledAt = new Date();
  pool.winnerUserIds = [winnerEntry.user?._id].filter(Boolean);
  await pool.save();

  console.log(`[PoolSettlement] settled pool=${pool._id} winner=${winnerEntry.user?._id} score=${bestScore}/${fixtureIds.length}`);
  return { settled: true, winnerEntryId: String(winnerEntry._id), bestScore };
}

/**
 * Sweep all pools that look settle-able. Heuristic: pool ended within
 * the last 7 days AND status is still 'pending'. The 7-day window
 * keeps us off pools whose fixtures finished long ago and were never
 * picked up by the scheduler (server downtime, late re-deploys).
 */
async function settleEligiblePools() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const candidates = await Quiniela.find({
    settlementStatus: 'pending',
    endDate: { $gte: cutoff, $lte: new Date() },
  });
  for (const pool of candidates) {
    try { await settlePool(pool); }
    catch (err) { console.warn(`[PoolSettlement] error ${pool._id}:`, err.message); }
  }
}

module.exports = {
  settlePool,
  settleEligiblePools,
};
