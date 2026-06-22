/**
 * Admin dashboard for MXN store-credit. The organizer grants pesos to a user
 * (by email) so their next pool entry is covered without a fresh SPEI/PayPal
 * transfer — e.g. a player who paid for a pool they missed and wants the $50
 * rolled forward.
 *
 * Endpoints (all gated by auth + requireAdmin in routes/admin.js):
 *   GET  /admin/credits?email=...   → recent ledger + (optional) one user's balance
 *   POST /admin/credits/grant       { email, amountMXN, note? }
 *   POST /admin/credits/revoke      { email, amountMXN, note? }
 */

const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const creditService = require('../services/creditService');

/** Find a user by exact (case-insensitive) email. Throws a 404-shaped error. */
async function findUserByEmail(email) {
  const normalized = (email || '').toString().trim().toLowerCase();
  if (!normalized) {
    throw Object.assign(new Error('Email is required'), { code: 'EMAIL_REQUIRED', status: 400 });
  }
  const user = await User.findOne({ email: normalized }).select('email displayName username');
  if (!user) {
    throw Object.assign(new Error(`No user with email ${normalized}`), { code: 'USER_NOT_FOUND', status: 404 });
  }
  return user;
}

function publicUser(u, balanceMXN) {
  return {
    id: String(u._id),
    email: u.email,
    displayName: u.displayName || u.username || u.email,
    balanceMXN,
  };
}

/**
 * GET /admin/credits?email=...
 * Always returns the last 50 ledger rows for visibility. If `email` is passed,
 * also resolves that user + their current balance so the UI can show it before
 * a grant. A missing/unknown email is NOT an error here — `user` is just null.
 */
exports.getCredits = async (req, res) => {
  try {
    const ledger = await CreditTransaction.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'email displayName username')
      .populate('quiniela', 'name')
      .lean();

    const recent = ledger.map((tx) => ({
      id: String(tx._id),
      amountMXN: tx.amountMXN,
      kind: tx.kind,
      note: tx.note || '',
      createdAt: tx.createdAt,
      pool: tx.quiniela ? { id: String(tx.quiniela._id), name: tx.quiniela.name } : null,
      user: tx.user
        ? { id: String(tx.user._id), email: tx.user.email, displayName: tx.user.displayName || tx.user.username || tx.user.email }
        : null,
    }));

    let user = null;
    const email = (req.query.email || '').toString().trim().toLowerCase();
    if (email) {
      const u = await User.findOne({ email }).select('email displayName username');
      if (u) user = publicUser(u, await creditService.getAvailableCredit(u._id));
    }

    res.json({ recent, user });
  } catch (err) {
    console.error('[admin/credits] list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.grantCredit = async (req, res) => {
  try {
    const user = await findUserByEmail(req.body?.email);
    const { balanceMXN } = await creditService.grantCredit({
      userId: user._id,
      amountMXN: req.body?.amountMXN,
      note: req.body?.note,
      adminUser: req.user,
    });
    console.log(`[admin/credits] grant $${req.body?.amountMXN} MXN → ${user.email} by ${req.user.email} (bal $${balanceMXN})`);
    res.json({ ok: true, user: publicUser(user, balanceMXN) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[admin/credits] grant error:', err);
    res.status(status).json({ message: err.message || 'Server error', code: err.code || undefined });
  }
};

exports.revokeCredit = async (req, res) => {
  try {
    const user = await findUserByEmail(req.body?.email);
    const { balanceMXN } = await creditService.revokeCredit({
      userId: user._id,
      amountMXN: req.body?.amountMXN,
      note: req.body?.note,
      adminUser: req.user,
    });
    console.log(`[admin/credits] revoke $${req.body?.amountMXN} MXN ← ${user.email} by ${req.user.email} (bal $${balanceMXN})`);
    res.json({ ok: true, user: publicUser(user, balanceMXN) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[admin/credits] revoke error:', err);
    res.status(status).json({ message: err.message || 'Server error', code: err.code || undefined });
  }
};
