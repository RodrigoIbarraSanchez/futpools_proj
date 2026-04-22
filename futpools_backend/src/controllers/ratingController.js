const mongoose = require('mongoose');
const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const User = require('../models/User');
const { fetchFixturesByIds } = require('../services/apiFootball');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const RATING_MIN = 500;
const RATING_MAX = 3000;
const RATING_FLOOR_FOR_CELEBRATION = 1000;

// Ordered lowest → highest. `min` inclusive, `max` exclusive for the next.
const TIERS = [
  { code: 'rookie',   min: 500,  max: 1000, name: 'Rookie' },
  { code: 'amateur',  min: 1000, max: 1250, name: 'Amateur' },
  { code: 'pro',      min: 1250, max: 1500, name: 'Pro' },
  { code: 'veteran',  min: 1500, max: 1750, name: 'Veteran' },
  { code: 'legend',   min: 1750, max: 3001, name: 'Legend' },
];

const tierForRating = (r) => {
  const safe = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(r ?? 1000)));
  return TIERS.find((t) => safe >= t.min && safe < t.max) || TIERS[1];
};

const clampRating = (r) => Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(r)));

/**
 * Elo-lite rating delta for a single pool result.
 *   delta = K × (actual - expected) / maxPossible × 100
 * Scaled by 100 so typical deltas land in the ±10-40 range on 5-10 fixture pools.
 * K = 32 for calibration (user's first 20 pools), K = 16 after.
 */
function computeRatingDelta({ score, expected, maxPossible, calibrationPhase }) {
  if (!maxPossible || maxPossible <= 0) return 0;
  const K = calibrationPhase ? 32 : 16;
  const normalized = (score - expected) / maxPossible;
  return Math.round(K * normalized * 100) / 100;
}

// Achievement codes and their unlock conditions. Returns array of codes that
// should be newly unlocked given the user stats AFTER the current pool.
function evaluateAchievements(userStats, poolCtx) {
  const unlocked = new Set((userStats.achievements || []).map((a) => a.code));
  const candidates = [];

  const has = (code) => !unlocked.has(code);

  if (userStats.poolsPlayed >= 1 && has('first_pool')) candidates.push('first_pool');
  if (userStats.poolsWon >= 1 && has('first_win')) candidates.push('first_win');
  if (poolCtx.wasPerfect && has('first_perfect_matchday')) candidates.push('first_perfect_matchday');
  if (userStats.streakBest >= 5 && has('streak_5')) candidates.push('streak_5');
  if (userStats.streakBest >= 10 && has('streak_10')) candidates.push('streak_10');
  if (userStats.streakBest >= 20 && has('streak_20')) candidates.push('streak_20');
  if (userStats.poolsPlayed >= 25 && has('veteran_25_pools')) candidates.push('veteran_25_pools');
  if (userStats.poolsPlayed >= 100 && has('veteran_100_pools')) candidates.push('veteran_100_pools');

  const tier = tierForRating(userStats.rating).code;
  if (tier === 'amateur' && has('tier_amateur_reached')) candidates.push('tier_amateur_reached');
  if (tier === 'pro' && has('tier_pro_reached')) candidates.push('tier_pro_reached');
  if (tier === 'veteran' && has('tier_veteran_reached')) candidates.push('tier_veteran_reached');
  if (tier === 'legend' && has('tier_legend_reached')) candidates.push('tier_legend_reached');

  if (userStats.poolsTop3 >= 10 && has('top3_x10')) candidates.push('top3_x10');

  return candidates;
}

const resultFromScore = (home, away) => {
  if (home == null || away == null) return null;
  const h = Number(home);
  const a = Number(away);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;
  if (h > a) return '1';
  if (h < a) return '2';
  return 'X';
};

function scoreEntryAgainstResults(entry, resultsByFixtureId) {
  let score = 0;
  for (const pick of entry.picks || []) {
    const result = resultsByFixtureId.get(pick.fixtureId);
    if (result != null && result === pick.pick) score += 1;
  }
  return score;
}

/**
 * Idempotently score every unscored entry in a quiniela. Updates per-user
 * rating, streaks, stats, and achievements. Writes back to QuinielaEntry with
 * `scoredAt` so subsequent runs are no-ops.
 *
 * Safe to call on partially-finished pools — only entries whose results are
 * fully known get scored. Returns { scored, skipped } counts.
 */
async function applyScoringToQuiniela(quinielaId) {
  const quiniela = await Quiniela.findById(quinielaId).lean();
  if (!quiniela) return { scored: 0, skipped: 0, reason: 'not_found' };

  const fixtureIds = (quiniela.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
  if (fixtureIds.length === 0) return { scored: 0, skipped: 0, reason: 'no_fixtures' };

  let liveFixtures = [];
  try {
    liveFixtures = await fetchFixturesByIds(fixtureIds);
  } catch (err) {
    console.warn('[rating] fetchFixturesByIds failed:', err.message);
    return { scored: 0, skipped: 0, reason: 'fixture_fetch_failed' };
  }

  const resultsByFixtureId = new Map();
  for (const f of liveFixtures) {
    const short = (f?.status?.short || '').toUpperCase();
    if (!FINISHED_STATUSES.has(short)) continue;
    const result = resultFromScore(f?.score?.home, f?.score?.away);
    if (result != null) resultsByFixtureId.set(f.fixtureId, result);
  }

  // Only score once every fixture has a result — avoids double-scoring the
  // same pool as fixtures trickle in. Matches the user's mental model of
  // "the pool is done when everything is FT".
  if (resultsByFixtureId.size < fixtureIds.length) {
    return { scored: 0, skipped: 0, reason: 'pool_not_finished' };
  }

  const entries = await QuinielaEntry.find({ quiniela: quinielaId });
  const unscored = entries.filter((e) => !e.scoredAt);
  if (unscored.length === 0) return { scored: 0, skipped: entries.length, reason: 'already_scored' };

  const totalPossible = resultsByFixtureId.size;
  const scoreMap = new Map();
  for (const entry of entries) {
    scoreMap.set(String(entry._id), scoreEntryAgainstResults(entry, resultsByFixtureId));
  }
  const scoresArr = Array.from(scoreMap.values());
  const expected = scoresArr.reduce((a, b) => a + b, 0) / Math.max(scoresArr.length, 1);

  // Rank to find pool winners/top3 for per-user stats.
  const ranked = entries
    .map((e) => ({ entry: e, score: scoreMap.get(String(e._id)) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? -1;
  const winnerIds = new Set(ranked.filter((r) => r.score === topScore && topScore > 0).map((r) => String(r.entry.user)));
  const top3Ids = new Set(ranked.slice(0, 3).map((r) => String(r.entry.user)));

  let scored = 0;
  for (const entry of unscored) {
    const userScore = scoreMap.get(String(entry._id)) ?? 0;
    const userId = entry.user;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session);
        if (!user) return;

        const calibrationPhase = (user.poolsPlayed ?? 0) < 20;
        const ratingDelta = computeRatingDelta({
          score: userScore,
          expected,
          maxPossible: totalPossible,
          calibrationPhase,
        });
        const newRating = clampRating((user.rating ?? 1000) + ratingDelta);
        const wasPerfect = userScore === totalPossible && totalPossible > 0;
        const didWin = winnerIds.has(String(userId));
        const didTop3 = top3Ids.has(String(userId));

        user.rating = newRating;
        if (newRating > (user.ratingPeak ?? 1000)) user.ratingPeak = newRating;
        user.poolsPlayed = (user.poolsPlayed ?? 0) + 1;
        if (didWin) user.poolsWon = (user.poolsWon ?? 0) + 1;
        if (didTop3) user.poolsTop3 = (user.poolsTop3 ?? 0) + 1;
        user.picksCorrect = (user.picksCorrect ?? 0) + userScore;
        user.picksTotal = (user.picksTotal ?? 0) + totalPossible;

        if (didWin) {
          user.streakCurrent = (user.streakCurrent ?? 0) + 1;
          if (user.streakCurrent > (user.streakBest ?? 0)) user.streakBest = user.streakCurrent;
        } else {
          user.streakCurrent = 0;
        }

        const newCodes = evaluateAchievements(user.toObject(), { wasPerfect, didWin });
        for (const code of newCodes) {
          user.achievements.push({ code, unlockedAt: new Date() });
        }

        await user.save({ session });

        entry.scoredAt = new Date();
        entry.score = userScore;
        entry.totalPossibleAtScoring = totalPossible;
        entry.ratingDelta = ratingDelta;
        await entry.save({ session });
      });
      scored += 1;
    } catch (err) {
      console.error('[rating] scoring entry failed', String(entry._id), err.message);
    } finally {
      session.endSession();
    }
  }

  // Stamp the quiniela with winners + scored status so the downstream
  // settlement step (below) has everything it needs.
  await Quiniela.findByIdAndUpdate(quinielaId, {
    settlementStatus: 'settled',
    settledAt: new Date(),
    winnerUserIds: Array.from(winnerIds).map((id) => new mongoose.Types.ObjectId(id)),
  });

  // Phase 2 economy: if this pool has a funding model (peer / platform), pay
  // the prize or refund stakes. Safe on 'none' pools — the settlement fn is a
  // no-op then. Lazy-require to break the circular dep (settlement imports
  // this controller's companion model).
  try {
    const { settlePoolPrize } = require('./settlementController');
    await settlePoolPrize(quinielaId);
  } catch (err) {
    console.error('[rating] settlePoolPrize failed', err.message);
  }

  return { scored, skipped: entries.length - unscored.length, totalPossible };
}

module.exports = {
  TIERS,
  tierForRating,
  computeRatingDelta,
  evaluateAchievements,
  applyScoringToQuiniela,
};
