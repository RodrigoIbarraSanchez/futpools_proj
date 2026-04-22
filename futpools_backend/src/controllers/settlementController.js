const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const { applyDelta } = require('../services/transactionService');

/**
 * Resolve the prize pool once scoring is complete. Called from
 * `applyScoringToQuiniela` after entries have been scored and `winnerUserIds`
 * have been attached to the quiniela.
 *
 * Funding models (v3):
 *   none       — no money movement (legacy social pool). No-op.
 *   peer       — pot = entryCostCoins × entries.count; winner gets pot × (1 - rake).
 *                Dissolve → refund each coin entry.
 *   platform   — admin-funded Platform Event; pot = platformPrizeCoins.
 *                Winner receives pot (no settlement-time rake — admin picks the number).
 *                Dissolve → no refund (entries were free); status marked dissolved.
 *   sponsored  — creator-funded (v3): pot = platformPrizeCoins (creator already paid × 1.1).
 *                Winner receives pot exact (rake already taken on create).
 *                Dissolve → refund creator the full prize × 1.1 via prizeFunderUserId.
 *
 * Idempotent via per-action keys (settle:, refund:entry:, refund:sponsor:).
 */
async function settlePoolPrize(quinielaId) {
  const pool = await Quiniela.findById(quinielaId);
  if (!pool) return { ok: false, reason: 'pool_not_found' };
  if (pool.fundingModel === 'none') {
    return { ok: true, skipped: true, reason: 'funding_model_none' };
  }
  if (pool.prizeLockStatus === 'paid' || pool.prizeLockStatus === 'dissolved') {
    return { ok: true, skipped: true, reason: 'already_' + pool.prizeLockStatus };
  }

  const entries = await QuinielaEntry.find({ quiniela: quinielaId }).lean();
  const entriesCount = entries.length;
  const winnerIds = (pool.winnerUserIds || []).map(String);

  const minReached = entriesCount >= (pool.minParticipants || 1);
  const entryCost = Number(pool.entryCostCoins) || 0;
  const rakePct = Number(pool.rakePercent) || 10;

  // netPrize differs per funding model. Peer takes rake off the pot at
  // settlement time. Platform + sponsored took rake upfront (or none at all),
  // so at settlement the winner gets the declared prize exactly.
  let pot = 0;
  let netPrize = 0;
  if (pool.fundingModel === 'peer') {
    pot = entryCost * entriesCount;
    netPrize = Math.floor(pot * (100 - rakePct) / 100);
  } else if (pool.fundingModel === 'platform' || pool.fundingModel === 'sponsored') {
    pot = Number(pool.platformPrizeCoins) || 0;
    netPrize = pot;
  }

  // Dissolve path: either min participants not met, or a peer pool with no
  // non-zero-score winner (tied-zero games refund rather than pay 0).
  const shouldDissolve =
    !minReached ||
    (pool.fundingModel === 'peer' && (winnerIds.length === 0 || netPrize <= 0));

  if (shouldDissolve) {
    if (pool.fundingModel === 'peer') {
      // Refund every coin entry exactly once.
      for (const e of entries) {
        if (entryCost > 0) {
          await applyDelta({
            userId: e.user,
            amount: entryCost,
            kind: 'refund_credit',
            idempotencyKey: `refund:entry:${quinielaId}:${e._id}`,
            quiniela: quinielaId,
            entry: e._id,
            note: 'Refund: pool below minParticipants',
          });
        }
      }
    } else if (pool.fundingModel === 'sponsored' && pool.prizeFunderUserId) {
      // Creator paid prize × 1.1 upfront; refund the exact amount back so they
      // don't lose the 10% fee when the pool fails to fill.
      const refundAmount = Math.ceil(pot * 1.1);
      await applyDelta({
        userId: pool.prizeFunderUserId,
        amount: refundAmount,
        kind: 'refund_credit',
        idempotencyKey: `refund:sponsor:${quinielaId}`,
        quiniela: quinielaId,
        note: 'Sponsor refund: pool below minParticipants',
      });
    }
    // Platform-event dissolve: no refund — admin mint already happened
    // off-ledger (no cost per event), entries were free. Just mark status.
    await Quiniela.findByIdAndUpdate(quinielaId, {
      prizeLockStatus: 'dissolved',
      settlementStatus: 'refunded',
    });
    return { ok: true, action: 'dissolved', refunded: entriesCount };
  }

  // Pay path — split netPrize evenly across tied winners.
  const perWinner = winnerIds.length > 0 ? Math.floor(netPrize / winnerIds.length) : 0;
  let paidTotal = 0;
  for (const userId of winnerIds) {
    if (perWinner > 0) {
      const res = await applyDelta({
        userId,
        amount: perWinner,
        kind: 'prize_credit',
        idempotencyKey: `settle:${quinielaId}:${userId}`,
        quiniela: quinielaId,
        note: `Prize for pool ${pool.name}`,
      });
      if (res.applied) paidTotal += perWinner;
    }
  }

  await Quiniela.findByIdAndUpdate(quinielaId, {
    prizeLockStatus: 'paid',
    settlementStatus: 'settled',
    prizeUnlockedAt: new Date(),
  });
  return { ok: true, action: 'paid', perWinner, winners: winnerIds.length, paidTotal };
}

module.exports = {
  settlePoolPrize,
};
