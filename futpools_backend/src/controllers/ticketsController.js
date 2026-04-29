const TicketTransaction = require('../models/TicketTransaction');

/**
 * GET /tickets/me — current Ticket balance for the authenticated user.
 *
 * Mirrors `GET /users/me` (which already includes `tickets`) but is a
 * cheaper, more focused endpoint when the client just wants to refresh
 * the Ticket count after a check-in or ad reward without re-fetching the
 * whole user object.
 */
exports.getMyBalance = async (req, res) => {
  try {
    res.json({
      tickets: req.user.tickets ?? 0,
    });
  } catch (err) {
    console.error('[Tickets] getMyBalance error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /tickets/me/transactions — paginated ledger of the user's Ticket
 * activity. Used by the "Ticket history" surface so users can see exactly
 * how they earned and spent each Ticket.
 *
 * Query params:
 *   limit  (default 25, max 100)
 *   before (optional ISO timestamp — returns rows older than this)
 */
exports.listMyTransactions = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const filter = { user: req.user._id };
    if (before && !isNaN(before.getTime())) {
      filter.createdAt = { $lt: before };
    }

    const txs = await TicketTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      transactions: txs.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        kind: t.kind,
        note: t.note || '',
        createdAt: t.createdAt,
      })),
      // Cursor for next page — caller passes this as `before` to paginate.
      nextBefore: txs.length === limit ? txs[txs.length - 1].createdAt : null,
    });
  } catch (err) {
    console.error('[Tickets] listMyTransactions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
