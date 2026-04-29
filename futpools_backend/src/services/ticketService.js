const mongoose = require('mongoose');
const User = require('../models/User');
const TicketTransaction = require('../models/TicketTransaction');

/**
 * Tickets economy service. Mirrors `transactionService.js` exactly except
 * it operates on `User.tickets` and `TicketTransaction`. Two parallel
 * services that NEVER share state — that's the legal wall.
 *
 * Don't import or reference anything Coins-related from here. Don't add
 * a "convert tickets to coins" or "convert coins to tickets" function.
 * If you ever need that, the legal/regulatory case for Tickets dies.
 */

/**
 * Apply a ledger-backed Tickets delta. `amount` is signed (+credit, -debit).
 * Writes both the `TicketTransaction` row and the matching `$inc` on
 * `User.tickets` in a transaction. If the idempotency key already exists,
 * returns `{ applied: false, alreadyProcessed: true }` without mutating.
 *
 * For debits, the caller must enforce balance sufficiency BEFORE calling
 * (e.g. via `debitTicketsOrFail` below). This function is the ledger
 * writer, not a balance guard.
 */
async function applyTicketDelta({ userId, amount, kind, idempotencyKey, sweepstakes, dailyPick, note }) {
  if (!userId || typeof amount !== 'number' || !kind || !idempotencyKey) {
    throw new Error('applyTicketDelta: missing required fields');
  }

  const existing = await TicketTransaction.findOne({ idempotencyKey }).lean();
  if (existing) {
    return { applied: false, alreadyProcessed: true, transactionId: existing._id };
  }

  const session = await mongoose.startSession();
  try {
    let result = { applied: true, alreadyProcessed: false };
    await session.withTransaction(async () => {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { tickets: amount } },
        { session }
      );
      const [tx] = await TicketTransaction.create(
        [{
          user: userId,
          amount,
          kind,
          idempotencyKey,
          sweepstakes: sweepstakes || undefined,
          dailyPick: dailyPick || undefined,
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
 * Debit Tickets with up-front sufficiency check. Returns `{ ok: false, reason }`
 * if the user doesn't have enough Tickets. This is the standard path for
 * sweepstakes entries.
 */
async function debitTicketsOrFail({ userId, amount, kind, idempotencyKey, sweepstakes, dailyPick, note }) {
  if (amount <= 0) throw new Error('debitTicketsOrFail: amount must be positive');

  const existing = await TicketTransaction.findOne({ idempotencyKey }).lean();
  if (existing) {
    const user = await User.findById(userId).select('tickets').lean();
    return { ok: true, alreadyProcessed: true, tickets: user?.tickets ?? 0 };
  }

  // Atomic conditional decrement: only succeeds if tickets >= amount.
  const updated = await User.findOneAndUpdate(
    { _id: userId, tickets: { $gte: amount } },
    { $inc: { tickets: -amount } },
    { new: true }
  );
  if (!updated) {
    const user = await User.findById(userId).select('tickets').lean();
    return { ok: false, reason: 'INSUFFICIENT_TICKETS', tickets: user?.tickets ?? 0 };
  }

  try {
    await TicketTransaction.create({
      user: userId,
      amount: -amount,
      kind,
      idempotencyKey,
      sweepstakes: sweepstakes || undefined,
      dailyPick: dailyPick || undefined,
      note: note || '',
    });
  } catch (err) {
    if (err?.code !== 11000) {
      // Ledger write failed for a non-duplicate reason — roll the decrement back.
      await User.findByIdAndUpdate(userId, { $inc: { tickets: amount } });
      throw err;
    }
  }

  return { ok: true, alreadyProcessed: false, tickets: updated.tickets };
}

module.exports = {
  applyTicketDelta,
  debitTicketsOrFail,
};
