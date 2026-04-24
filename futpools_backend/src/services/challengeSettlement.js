const Challenge = require('../models/Challenge');
const { fetchFixturesByIds } = require('./apiFootball');
const { applyDelta } = require('./transactionService');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/**
 * Resolve which outcome key won for a given market type given the final score.
 * The key format mirrors the stored picks on the challenge:
 *   1X2:  '1' (home) / 'X' (draw) / '2' (away)
 *   OU25: 'OVER' / 'UNDER' — .5 line means no push possible
 *   BTTS: 'YES' / 'NO'
 */
function resolveOutcome(marketType, score) {
  const h = Number(score?.home);
  const a = Number(score?.away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  switch (marketType) {
    case '1X2':  return h > a ? '1' : h < a ? '2' : 'X';
    case 'OU25': return (h + a) >= 3 ? 'OVER' : 'UNDER';
    case 'BTTS': return (h > 0 && a > 0) ? 'YES' : 'NO';
    default:     return null;
  }
}

/**
 * Opportunistic settlement — called inline whenever a challenge is read.
 * Mirrors the on-read scoring pattern pools already use. Handles two gates:
 *
 *   1. status === 'accepted' AND fixture is FT  → compute winner, pay or refund
 *   2. status === 'pending' AND kickoff has passed  → cancel, refund challenger
 *
 * Idempotency: every balance movement is keyed by `challenge:<action>:<id>(:<who>)`
 * so a retry mid-settlement never double-pays. The state mutation on the doc
 * is the last thing saved, so a partial failure leaves us in a recoverable
 * state: the next call re-attempts the same keys (no-op) and commits the doc.
 *
 * Returns the (possibly mutated) challenge. Safe to call repeatedly.
 */
async function settleChallengeIfEligible(challenge) {
  if (!challenge) return challenge;
  const now = new Date();

  // Expire pending invites once kickoff passed without acceptance.
  if (challenge.status === 'pending' &&
      challenge.fixture?.kickoff &&
      new Date(challenge.fixture.kickoff) <= now) {
    await applyDelta({
      userId: challenge.challenger,
      amount: challenge.stakeCoins,
      kind: 'refund_credit',
      idempotencyKey: `challenge:refund:${challenge._id}:challenger`,
      note: `Challenge ${challenge.code} expired before acceptance`,
    });
    challenge.status = 'cancelled';
    challenge.settledAt = now;
    await challenge.save();
    return challenge;
  }

  if (challenge.status !== 'accepted') return challenge;

  // Need the live score to settle. Single-fixture fetch — cheap and cached
  // upstream at the apiFootball service layer.
  let live = null;
  try {
    const arr = await fetchFixturesByIds([challenge.fixture.fixtureId]);
    live = Array.isArray(arr) ? arr[0] : null;
  } catch (err) {
    console.warn('[challengeSettle] live fetch failed:', err.message);
    return challenge;
  }
  const short = (live?.status?.short || '').toUpperCase();
  if (!FINISHED_STATUSES.has(short)) return challenge;

  const outcomeKey = resolveOutcome(challenge.marketType, live.score);
  if (!outcomeKey) {
    console.warn('[challengeSettle] could not resolve outcome for', challenge._id);
    return challenge;
  }

  let winnerId = null;
  if (challenge.challengerPick === outcomeKey) winnerId = challenge.challenger;
  else if (challenge.opponentPick === outcomeKey) winnerId = challenge.opponent;

  if (winnerId) {
    // Winner takes 2× stake minus 10% rake. Floor to whole coins — we never
    // credit fractional amounts; the rake absorbs the rounding.
    const pot = challenge.stakeCoins * 2;
    const rake = Math.floor(pot * (challenge.rakePercent || 10) / 100);
    const payout = pot - rake;
    await applyDelta({
      userId: winnerId,
      amount: payout,
      kind: 'challenge_payout',
      idempotencyKey: `challenge:settle:${challenge._id}`,
      note: `Challenge ${challenge.code} won · ${challenge.marketType}:${outcomeKey}`,
    });
    challenge.winnerUserId = winnerId;
    challenge.status = 'settled';
  } else {
    // Third-outcome scenario: only happens on 1X2 when neither player picked
    // the actual result. Refund both — no rake, no platform capture. This is
    // the principled behaviour since the platform took no risk.
    await applyDelta({
      userId: challenge.challenger,
      amount: challenge.stakeCoins,
      kind: 'refund_credit',
      idempotencyKey: `challenge:refund:${challenge._id}:challenger`,
      note: `Challenge ${challenge.code} resolved to uncovered outcome`,
    });
    await applyDelta({
      userId: challenge.opponent,
      amount: challenge.stakeCoins,
      kind: 'refund_credit',
      idempotencyKey: `challenge:refund:${challenge._id}:opponent`,
      note: `Challenge ${challenge.code} resolved to uncovered outcome`,
    });
    challenge.status = 'refunded';
  }
  challenge.outcomeKey = outcomeKey;
  challenge.settledAt = now;
  await challenge.save();
  return challenge;
}

/**
 * Bulk settler for the list endpoint. Runs sequentially to avoid hammering
 * API-Football; the service layer caches within 25s so concurrent calls for
 * the same fixtureIds are cheap, but serial is fine for typical list sizes.
 */
async function settleMany(challenges) {
  const out = [];
  for (const c of challenges) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await settleChallengeIfEligible(c));
  }
  return out;
}

module.exports = {
  settleChallengeIfEligible,
  settleMany,
  resolveOutcome,
};
