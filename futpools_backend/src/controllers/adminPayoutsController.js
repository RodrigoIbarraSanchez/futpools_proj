/**
 * Admin payouts dashboard — surfaces settled pools waiting for the
 * admin to send the winner's bank transfer manually. simple_version
 * does not use Stripe Connect; payout is off-band.
 *
 * Two endpoints:
 *   GET  /admin/payouts                — list pending payouts
 *   POST /admin/pools/:id/mark-paid    — mark one as paid + free-text note
 *
 * Both gated by requireAdmin (mounted as middleware on /admin in
 * routes/admin.js).
 */

const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const User = require('../models/User');
const { refundEntry } = require('../services/poolPaymentService');
const creditService = require('../services/creditService');
const { prizeForCorrect } = require('../lib/prizeLadder');
const brevoService = require('../services/brevoService');

/**
 * Normalize a winner's payout/banking info for the admin dashboard. Legacy
 * winners predate the field — return an empty MX skeleton so the UI can
 * render "no banking info on file" instead of crashing on null.
 */
function payoutFor(u) {
  const p = (u && u.payout) || {};
  return {
    country: p.country || 'MX',
    accountHolder: p.accountHolder || '',
    bankName: p.bankName || '',
    clabe: p.clabe || '',
    accountNumber: p.accountNumber || '',
    paypalEmail: p.paypalEmail || '',
  };
}

/**
 * GET /admin/payouts — pools whose settlementStatus = 'settled' AND
 * winnerPaidAt = null. Includes winner contact info (email, displayName)
 * + computed prize amount so the admin sees everything they need on
 * one screen, no second round-trip.
 */
exports.getPendingPayouts = async (req, res) => {
  try {
    // Only simple_version paid pools — entryFeeMXN > 0. Legacy
    // master-mode pools (coin economy) settle through different rails
    // and would clutter this view; filtering them out keeps the
    // dashboard focused on actual MXN bank transfers.
    const pools = await Quiniela.find({
      settlementStatus: 'settled',
      winnerPaidAt: null,
      entryFeeMXN: { $gt: 0 },
    }).sort({ settledAt: -1 }).lean();

    if (pools.length === 0) return res.json([]);

    // Hydrate winner user(s) + entry counts in parallel. Every settled
    // pool has at least one winnerUserId (set by poolSettlementService);
    // we populate name + email so the admin can copy/paste into the
    // bank transfer.
    const winnerIds = [...new Set(pools.flatMap((p) => p.winnerUserIds || []).map(String))];
    const users = winnerIds.length > 0
      ? await User.find({ _id: { $in: winnerIds } }).select('_id email displayName username payout').lean()
      : [];
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    // Counts per pool to compute the standard prize live (entries × fee × 0.65).
    const poolIds = pools.map((p) => p._id);
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: poolIds }, refundedAt: null } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countsByPool = new Map(counts.map((c) => [String(c._id), c.count]));

    // prize_ladder pools pay each entry individually. Pull every non-refunded
    // entry (with its persisted prizeMXN + winnerPaidAt) so we can group the
    // payouts BY USER — a player with several winning entries is paid once.
    const ladderPoolIds = pools.filter((p) => p.poolType === 'prize_ladder').map((p) => p._id);
    const ladderByPool = new Map();
    if (ladderPoolIds.length > 0) {
      const ladderEntries = await QuinielaEntry.find({
        quiniela: { $in: ladderPoolIds },
        refundedAt: null,
      }).populate('user', '_id email displayName username payout').lean();
      for (const e of ladderEntries) {
        const key = String(e.quiniela);
        if (!ladderByPool.has(key)) ladderByPool.set(key, []);
        ladderByPool.get(key).push(e);
      }
    }

    // Standard pools: pull the winners' entries so we know which winners are
    // already paid (per-entry winnerPaidAt). Keyed `${poolId}:${userId}`.
    const standardPoolIds = pools.filter((p) => p.poolType !== 'prize_ladder').map((p) => p._id);
    const standardPaidByKey = new Map();
    if (standardPoolIds.length > 0 && winnerIds.length > 0) {
      const stdEntries = await QuinielaEntry.find({
        quiniela: { $in: standardPoolIds },
        refundedAt: null,
        user: { $in: winnerIds },
      }).select('quiniela user winnerPaidAt').lean();
      for (const e of stdEntries) {
        const key = `${String(e.quiniela)}:${String(e.user)}`;
        // A user is "paid" if any of their entries is stamped.
        if (e.winnerPaidAt && !standardPaidByKey.get(key)) standardPaidByKey.set(key, e.winnerPaidAt);
      }
    }

    const WINNER_SHARE = 0.65;
    const payload = pools.map((pool) => {
      const id = String(pool._id);
      const entries = countsByPool.get(id) ?? 0;
      const fee = pool.entryFeeMXN ?? 0;
      const base = {
        id,
        name: pool.name,
        poolType: pool.poolType || 'standard',
        startDate: pool.startDate,
        settledAt: pool.settledAt,
        entryFeeMXN: fee,
        entriesCount: entries,
      };

      if (pool.poolType === 'prize_ladder') {
        // Group winning entries BY USER → one payout row per winner (summed
        // prize, best score, entry count, all-paid status).
        const byUser = new Map();
        for (const e of ladderByPool.get(id) || []) {
          const prize = e.prizeMXN != null ? e.prizeMXN : prizeForCorrect(pool.prizeLadder, e.score || 0);
          if (!(prize > 0)) continue;
          const u = e.user || {};
          const uid = u._id ? String(u._id) : `anon:${e._id}`;
          const g = byUser.get(uid) || {
            userId: u._id ? String(u._id) : null,
            email: u.email || null,
            displayName: u.displayName || u.username || u.email || 'Participant',
            username: u.username || null,
            payout: payoutFor(u),
            prizeMXN: 0, score: 0, entriesCount: 0, allPaid: true, paidAt: null,
          };
          g.prizeMXN += prize;
          g.score = Math.max(g.score, e.score || 0);
          g.entriesCount += 1;
          if (e.winnerPaidAt) g.paidAt = e.winnerPaidAt;
          else g.allPaid = false;
          byUser.set(uid, g);
        }
        const winners = [...byUser.values()]
          .map((g) => ({
            userId: g.userId, email: g.email, displayName: g.displayName, username: g.username,
            payout: g.payout, prizeMXN: g.prizeMXN, score: g.score, entriesCount: g.entriesCount,
            paidAt: g.allPaid ? g.paidAt : null,
          }))
          .sort((a, b) => b.prizeMXN - a.prizeMXN || b.score - a.score);
        const totalPrizeMXN = winners.reduce((s, w) => s + w.prizeMXN, 0);
        return { ...base, prizeMXN: totalPrizeMXN, winners };
      }

      // standard: single winner takes 65% of the pot (each tied winner shown).
      const prize = Math.floor(entries * fee * WINNER_SHARE);
      const winners = (pool.winnerUserIds || [])
        .map((wid) => usersById.get(String(wid)))
        .filter(Boolean)
        .map((u) => ({
          userId: String(u._id),
          email: u.email,
          displayName: u.displayName || u.username || u.email,
          username: u.username || null,
          payout: payoutFor(u),
          prizeMXN: prize,
          paidAt: standardPaidByKey.get(`${id}:${String(u._id)}`) || null,
        }));
      return { ...base, prizeMXN: prize, winners };
    });
    res.json(payload);
  } catch (err) {
    console.error('[admin/payouts] list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /admin/pools/:id/mark-paid
 * Body: { note?: string }   — free-text record (e.g. "SPEI ref ABC123").
 *
 * Idempotent: re-marking an already-paid pool returns 200 with a flag
 * so the admin UI can reflect "already done" without throwing.
 */
/**
 * POST /admin/pools/:id/cancel
 *
 * Cancel a pool and refund every active entry via Stripe. Used when the
 * underlying league cancels/postpones fixtures, an admin error needs
 * undoing, etc. Destructive — flips the pool to settlementStatus
 * 'cancelled' and stamps cancelledAt/cancelledReason; the discovery list
 * filters cancelled pools out.
 *
 * Idempotent at the entry level — refundEntry skips already-refunded
 * entries — so re-running this on a partially-refunded pool finishes
 * the rest. Returns a per-entry result array so the admin UI can show
 * which refunds succeeded vs failed.
 */
exports.cancelPool = async (req, res) => {
  try {
    const pool = await Quiniela.findById(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found' });
    const reason = (req.body?.reason || '').toString().trim().slice(0, 500);

    const entries = await QuinielaEntry.find({ quiniela: pool._id }).lean();
    const results = [];
    for (const e of entries) {
      try {
        if (!e.stripePaymentIntentId) {
          // No Stripe intent to refund — credit entry, admin free entry, or a
          // legacy/seed entry. Return store-credit to the user if this entry
          // was paid with credit (idempotent), then mark refunded so
          // settlement won't try to score it.
          if (e.creditEntry && e.creditAmountMXN) {
            await creditService.refundCreditForEntry({
              userId: e.user, poolId: pool._id, entryId: e._id, amountMXN: e.creditAmountMXN,
            });
          }
          await QuinielaEntry.updateOne(
            { _id: e._id },
            { $set: { refundedAt: new Date(), refundId: e.creditEntry ? 'CREDIT_RETURNED' : 'NO_INTENT' } },
          );
          results.push({ entryId: String(e._id), ok: true, skipped: true, creditReturned: !!e.creditEntry });
          continue;
        }
        const out = await refundEntry(e._id, 'requested_by_customer');
        results.push({ entryId: String(e._id), ok: true, ...out });
      } catch (err) {
        console.warn(`[admin/cancel] refund failed entry=${e._id}:`, err.message);
        results.push({ entryId: String(e._id), ok: false, error: err.message });
      }
    }

    pool.settlementStatus = 'cancelled';
    pool.cancelledAt = new Date();
    pool.cancelledReason = reason;
    await pool.save();
    console.log(`[admin/cancel] pool=${pool._id} cancelled by ${req.user.email} — ${results.length} entries processed, reason="${reason}"`);

    res.json({
      ok: true,
      cancelledAt: pool.cancelledAt,
      entriesProcessed: results.length,
      results,
    });
  } catch (err) {
    console.error('[admin/cancel] error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Whether every winner of a pool has been paid (per-entry winnerPaidAt set).
 *   - prize_ladder: every non-refunded entry that won money (prizeMXN > 0).
 *   - standard: every winnerUserId has at least one paid entry.
 * Returns true for a pool with no one to pay (e.g. ladder where nobody hit a
 * rung) so it can be cleared off the dashboard.
 */
async function areAllWinnersPaid(pool) {
  if (pool.poolType === 'prize_ladder') {
    const owed = await QuinielaEntry.find({
      quiniela: pool._id, refundedAt: null, prizeMXN: { $gt: 0 },
    }).select('winnerPaidAt').lean();
    return owed.every((e) => e.winnerPaidAt);
  }
  const winnerIds = (pool.winnerUserIds || []).map(String);
  if (winnerIds.length === 0) return true;
  const paid = await QuinielaEntry.find({
    quiniela: pool._id, refundedAt: null,
    user: { $in: pool.winnerUserIds }, winnerPaidAt: { $ne: null },
  }).select('user').lean();
  const paidUsers = new Set(paid.map((e) => String(e.user)));
  return winnerIds.every((id) => paidUsers.has(id));
}

/**
 * POST /admin/pools/:id/winners/:userId/mark-paid
 * Body: { note?: string }
 *
 * Mark a SINGLE winner (grouped by user) as paid — the per-winner replacement
 * for the all-or-nothing pool-level button. Stamps that user's winning
 * entry/entries, emails just them, and (only once EVERY winner is paid) flips
 * the pool's winnerPaidAt so it drops off the dashboard. Idempotent.
 */
exports.markWinnerPaid = async (req, res) => {
  try {
    const { id: poolId, userId } = req.params;
    const pool = await Quiniela.findById(poolId);
    if (!pool) return res.status(404).json({ message: 'Pool not found' });
    if (pool.settlementStatus !== 'settled') {
      return res.status(400).json({ message: 'Pool is not settled yet — cannot mark as paid', code: 'NOT_SETTLED' });
    }
    const note = (req.body?.note || '').toString().trim().slice(0, 500);

    // The user's entries owed money in this pool.
    const filter = { quiniela: poolId, user: userId, refundedAt: null };
    if (pool.poolType === 'prize_ladder') {
      filter.prizeMXN = { $gt: 0 };
    } else if (!(pool.winnerUserIds || []).map(String).includes(String(userId))) {
      return res.status(400).json({ message: 'That user is not a winner of this pool', code: 'NOT_A_WINNER' });
    }
    const entries = await QuinielaEntry.find(filter).select('_id prizeMXN winnerPaidAt').lean();
    if (entries.length === 0) {
      return res.status(404).json({ message: 'No winning entries for this user', code: 'NO_WINNING_ENTRIES' });
    }

    const alreadyPaid = entries.every((e) => e.winnerPaidAt);
    if (!alreadyPaid) {
      const now = new Date();
      await QuinielaEntry.updateMany(
        { _id: { $in: entries.map((e) => e._id) }, winnerPaidAt: null },
        { $set: { winnerPaidAt: now, winnerPaidNote: note } },
      );
      console.log(`[admin/payouts] winner paid — pool=${poolId} user=${userId} by ${req.user.email}`);
      // Email just this winner their receipt. Best-effort.
      const prizeMXN = pool.poolType === 'prize_ladder'
        ? entries.reduce((s, e) => s + (e.prizeMXN || 0), 0)
        : 0;
      brevoService.sendPrizePaidToUser({ pool, userId, prizeMXN, note })
        .catch((e) => console.warn('[admin/payouts] brevo prize-paid (single) failed:', e.message));
    }

    // Once everyone is paid, stamp the pool so it leaves the dashboard.
    const allPaid = await areAllWinnersPaid(pool);
    if (allPaid && !pool.winnerPaidAt) {
      pool.winnerPaidAt = new Date();
      if (note) pool.winnerPaidNote = note;
      await pool.save();
    }

    res.json({ ok: true, userId, alreadyPaid, allWinnersPaid: allPaid });
  } catch (err) {
    console.error('[admin/payouts] markWinnerPaid error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markPoolPaid = async (req, res) => {
  try {
    const pool = await Quiniela.findById(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found' });
    if (pool.settlementStatus !== 'settled') {
      return res.status(400).json({
        message: 'Pool is not settled yet — cannot mark as paid',
        code: 'NOT_SETTLED',
      });
    }
    if (pool.winnerPaidAt) {
      return res.json({ ok: true, alreadyPaid: true, winnerPaidAt: pool.winnerPaidAt });
    }
    pool.winnerPaidAt = new Date();
    pool.winnerPaidNote = (req.body?.note || '').toString().trim().slice(0, 500);
    await pool.save();
    console.log(`[admin/payouts] pool=${pool._id} marked paid by ${req.user.email}`);

    // Best-effort: email each winner their payout receipt. Never blocks the
    // admin action.
    brevoService.sendPrizePaidForPool({ pool })
      .catch((e) => console.warn('[admin/payouts] brevo prize-paid email failed:', e.message));

    res.json({
      ok: true,
      winnerPaidAt: pool.winnerPaidAt,
      winnerPaidNote: pool.winnerPaidNote,
    });
  } catch (err) {
    console.error('[admin/payouts] markPaid error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
