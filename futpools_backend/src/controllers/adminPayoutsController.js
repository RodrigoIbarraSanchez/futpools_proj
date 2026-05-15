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
      ? await User.find({ _id: { $in: winnerIds } }).select('_id email displayName username').lean()
      : [];
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    // Counts per pool to compute the prize live (entries × fee × 0.65).
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: pools.map((p) => p._id) }, refundedAt: null } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countsByPool = new Map(counts.map((c) => [String(c._id), c.count]));

    const WINNER_SHARE = 0.65;
    const payload = pools.map((pool) => {
      const entries = countsByPool.get(String(pool._id)) ?? 0;
      const fee = pool.entryFeeMXN ?? 0;
      const prize = Math.floor(entries * fee * WINNER_SHARE);
      const winners = (pool.winnerUserIds || [])
        .map((id) => usersById.get(String(id)))
        .filter(Boolean)
        .map((u) => ({
          id: String(u._id),
          email: u.email,
          displayName: u.displayName || u.username || u.email,
          username: u.username || null,
        }));
      return {
        id: String(pool._id),
        name: pool.name,
        startDate: pool.startDate,
        settledAt: pool.settledAt,
        entryFeeMXN: fee,
        entriesCount: entries,
        prizeMXN: prize,
        winners,
      };
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
          // Entry from before Stripe (legacy or seed). Mark refunded
          // anyway so settlement won't try to score it.
          await QuinielaEntry.updateOne(
            { _id: e._id },
            { $set: { refundedAt: new Date(), refundId: 'NO_INTENT' } },
          );
          results.push({ entryId: String(e._id), ok: true, skipped: true });
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
