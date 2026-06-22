/**
 * MXN store-credit (simple_version).
 *
 * An admin grants pesos to a user; when that user joins a paid pool the credit
 * covers the entry fee instead of a fresh SPEI/PayPal transfer. The
 * `CreditTransaction` ledger is the single source of truth — a user's balance
 * is always `sum(amountMXN)` over their rows, so there is no cached field to
 * drift.
 *
 * Spending rule (intentionally all-or-nothing): credit only applies when the
 * available balance covers the WHOLE entry fee. We never split a payment
 * (half credit + half SPEI) because the SPEI flow is manual and a partial
 * charge would be confusing to reconcile. A $50 credit on a $50 entry → free
 * entry; a $30 credit on a $50 entry → normal SPEI, credit untouched.
 */

const mongoose = require('mongoose');
const CreditTransaction = require('../models/CreditTransaction');

/** Sum a user's ledger → their current available MXN credit. */
async function getAvailableCredit(userId) {
  const rows = await CreditTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: null, total: { $sum: '$amountMXN' } } },
  ]);
  return rows.length ? Math.round(rows[0].total) : 0;
}

/**
 * Admin adds credit to a user. `amountMXN` must be a positive integer-ish
 * number of pesos. Returns the new balance.
 */
async function grantCredit({ userId, amountMXN, note, adminUser }) {
  const amount = Math.round(Number(amountMXN));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('amountMXN must be a positive number'), { code: 'INVALID_AMOUNT', status: 400 });
  }
  await CreditTransaction.create({
    user: userId,
    amountMXN: amount,
    kind: 'admin_grant',
    // Grants are deliberately NOT deduplicated across calls — issuing two $50
    // grants to the same user is a legitimate operation — so the key carries a
    // timestamp + random suffix to stay unique per click.
    idempotencyKey: `grant:${userId}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`,
    createdBy: adminUser?._id || null,
    note: (note || '').toString().trim().slice(0, 200),
  });
  const balanceMXN = await getAvailableCredit(userId);
  return { balanceMXN };
}

/**
 * Admin removes credit from a user (correction / clawback). Caps the debit at
 * the current balance so the ledger can't go negative. Returns the new balance.
 */
async function revokeCredit({ userId, amountMXN, note, adminUser }) {
  const requested = Math.round(Number(amountMXN));
  if (!Number.isFinite(requested) || requested <= 0) {
    throw Object.assign(new Error('amountMXN must be a positive number'), { code: 'INVALID_AMOUNT', status: 400 });
  }
  const current = await getAvailableCredit(userId);
  const amount = Math.min(requested, current);
  if (amount <= 0) return { balanceMXN: current };
  await CreditTransaction.create({
    user: userId,
    amountMXN: -amount,
    kind: 'admin_revoke',
    idempotencyKey: `revoke:${userId}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`,
    createdBy: adminUser?._id || null,
    note: (note || '').toString().trim().slice(0, 200),
  });
  const balanceMXN = await getAvailableCredit(userId);
  return { balanceMXN };
}

/**
 * Spend credit to cover an entry. Idempotent per entry via
 * `entry-use:<entryId>` — a retried join hits the unique index and the existing
 * debit stands, so the credit is charged exactly once.
 *
 * Returns { applied: true } on the first spend, { applied: false, already: true }
 * if this entry was already charged.
 */
async function useCreditForEntry({ userId, poolId, entryId, amountMXN }) {
  const amount = Math.round(Number(amountMXN));
  try {
    await CreditTransaction.create({
      user: userId,
      amountMXN: -amount,
      kind: 'entry_use',
      idempotencyKey: `entry-use:${entryId}`,
      quiniela: poolId,
      entry: entryId,
      note: 'Pool entry paid with credit',
    });
    return { applied: true };
  } catch (err) {
    if (err && err.code === 11000) return { applied: false, already: true };
    throw err;
  }
}

/**
 * Return credit spent on an entry back to the user (e.g. the pool was
 * cancelled). Idempotent per entry via `entry-refund:<entryId>` so re-running
 * cancelPool never double-credits. No-op if amount is missing/zero.
 */
async function refundCreditForEntry({ userId, poolId, entryId, amountMXN }) {
  const amount = Math.round(Number(amountMXN));
  if (!Number.isFinite(amount) || amount <= 0) return { applied: false };
  try {
    await CreditTransaction.create({
      user: userId,
      amountMXN: amount,
      kind: 'admin_grant',
      idempotencyKey: `entry-refund:${entryId}`,
      quiniela: poolId,
      entry: entryId,
      note: 'Credit returned — pool cancelled',
    });
    return { applied: true };
  } catch (err) {
    if (err && err.code === 11000) return { applied: false, already: true };
    throw err;
  }
}

module.exports = {
  getAvailableCredit,
  grantCredit,
  revokeCredit,
  useCreditForEntry,
  refundCreditForEntry,
};
