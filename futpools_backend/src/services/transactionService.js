const mongoose = require('mongoose');
const User = require('../models/User');
const BalanceTransaction = require('../models/BalanceTransaction');

/**
 * Apply a ledger-backed balance delta. `amount` is signed (+credit, -debit).
 * Writes both the `BalanceTransaction` row and the matching `$inc` on
 * `User.balance` in a transaction. If the idempotency key already exists,
 * returns `{ applied: false, alreadyProcessed: true }` without mutating.
 *
 * For debits, the caller must enforce balance sufficiency BEFORE calling
 * (e.g. via a conditional `findOneAndUpdate({ balance: { $gte: cost } })`).
 * This function will apply the delta unconditionally — it's a ledger writer,
 * not a balance guard.
 */
async function applyDelta({ userId, amount, kind, idempotencyKey, quiniela, entry, note }) {
  if (!userId || typeof amount !== 'number' || !kind || !idempotencyKey) {
    throw new Error('applyDelta: missing required fields');
  }

  const existing = await BalanceTransaction.findOne({ idempotencyKey }).lean();
  if (existing) {
    return { applied: false, alreadyProcessed: true, transactionId: existing._id };
  }

  const session = await mongoose.startSession();
  try {
    let result = { applied: true, alreadyProcessed: false };
    await session.withTransaction(async () => {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { balance: amount } },
        { session }
      );
      const [tx] = await BalanceTransaction.create(
        [{
          user: userId,
          amount,
          kind,
          idempotencyKey,
          quiniela: quiniela || undefined,
          entry: entry || undefined,
          note: note || '',
        }],
        { session }
      );
      result.transactionId = tx?._id;
    });
    return result;
  } catch (err) {
    // Unique-key collision means another request committed first — treat as
    // already-processed rather than bubble the 500 to the caller.
    if (err?.code === 11000) {
      return { applied: false, alreadyProcessed: true };
    }
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Debit with up-front balance sufficiency check. Returns `{ ok: false, reason }`
 * if the user doesn't have enough coins. This is the standard path for entry
 * fees — settlement uses `applyDelta` directly with conditional guard logic
 * of its own.
 */
async function debitOrFail({ userId, amount, kind, idempotencyKey, quiniela, entry, note }) {
  if (amount <= 0) throw new Error('debitOrFail: amount must be positive');

  const existing = await BalanceTransaction.findOne({ idempotencyKey }).lean();
  if (existing) {
    const user = await User.findById(userId).select('balance').lean();
    return { ok: true, alreadyProcessed: true, balance: user?.balance ?? 0 };
  }

  // Atomic conditional decrement: only succeeds if balance >= amount.
  const updated = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!updated) {
    const user = await User.findById(userId).select('balance').lean();
    return { ok: false, reason: 'INSUFFICIENT_BALANCE', balance: user?.balance ?? 0 };
  }

  try {
    await BalanceTransaction.create({
      user: userId,
      amount: -amount,
      kind,
      idempotencyKey,
      quiniela: quiniela || undefined,
      entry: entry || undefined,
      note: note || '',
    });
  } catch (err) {
    if (err?.code !== 11000) {
      // Ledger write failed for a non-duplicate reason — roll the decrement back.
      await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
      throw err;
    }
  }

  return { ok: true, alreadyProcessed: false, balance: updated.balance };
}

module.exports = {
  applyDelta,
  debitOrFail,
};
