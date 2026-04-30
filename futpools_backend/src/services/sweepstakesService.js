const crypto = require('crypto');
const Sweepstakes = require('../models/Sweepstakes');
const SweepstakesEntry = require('../models/SweepstakesEntry');
const { debitTicketsOrFail, applyTicketDelta } = require('./ticketService');

/**
 * Sweepstakes service. Handles entry purchase (debit Tickets + create
 * entry row), settlement (pick a winner uniformly across all entries),
 * and cancellation (refund all entries).
 */

/**
 * Buy one entry for the authenticated user. Atomic flow:
 *   1. Compute the user's next entryNumber for this sweepstakes.
 *   2. Debit `entryCostTickets` via debitTicketsOrFail with idempotency
 *      key tied to (sweepstakesId, userId, entryNumber).
 *   3. Create the SweepstakesEntry row.
 *   4. If the entry create fails, refund the Tickets via applyTicketDelta.
 *
 * Returns `{ ok: true, entry, tickets }` on success, or
 * `{ ok: false, code, ... }` on user-facing failures.
 */
async function buyEntry(userId, sweepstakesId) {
  const sweepstakes = await Sweepstakes.findById(sweepstakesId);
  if (!sweepstakes) return { ok: false, code: 'NOT_FOUND' };
  if (sweepstakes.status !== 'open') {
    return { ok: false, code: 'NOT_OPEN', status: sweepstakes.status };
  }
  const now = Date.now();
  if (sweepstakes.entryClosesAt && sweepstakes.entryClosesAt.getTime() <= now) {
    return { ok: false, code: 'ENTRY_CLOSED' };
  }
  if (sweepstakes.entryOpensAt && sweepstakes.entryOpensAt.getTime() > now) {
    return { ok: false, code: 'NOT_OPEN_YET' };
  }

  // Next entryNumber for this user — count + 1. Race-safe enough for our
  // scale; the unique compound index on (sweepstakes, user, entryNumber)
  // catches simultaneous double-tap by failing the second insert.
  const existingCount = await SweepstakesEntry.countDocuments({
    sweepstakes: sweepstakes._id,
    user: userId,
  });
  const entryNumber = existingCount + 1;

  const cost = sweepstakes.entryCostTickets;
  const idempotencyKey = `ticket:sweepstakes:${sweepstakes._id}:${userId}:${entryNumber}`;

  const debit = await debitTicketsOrFail({
    userId,
    amount: cost,
    kind: 'sweepstakes_debit',
    idempotencyKey,
    sweepstakes: sweepstakes._id,
    note: `Sweepstakes entry #${entryNumber}`,
  });
  if (!debit.ok) {
    return { ok: false, code: debit.reason || 'DEBIT_FAILED', tickets: debit.tickets };
  }

  let entry;
  try {
    entry = await SweepstakesEntry.create({
      sweepstakes: sweepstakes._id,
      user: userId,
      entryNumber,
      ticketsSpent: cost,
    });
  } catch (err) {
    // Compound-unique race — someone got in first. Refund the debit so
    // the user doesn't lose Tickets to a phantom entry.
    if (err?.code === 11000) {
      await applyTicketDelta({
        userId,
        amount: cost,
        kind: 'refund_credit',
        idempotencyKey: `ticket:sweepstakes-refund:${sweepstakes._id}:${userId}:${entryNumber}`,
        sweepstakes: sweepstakes._id,
        note: 'Sweepstakes entry race refund',
      });
      return { ok: false, code: 'ENTRY_RACE' };
    }
    throw err;
  }

  return { ok: true, entry, tickets: debit.tickets };
}

/**
 * Settle a sweepstakes. Picks a uniform-random winner from all entries.
 * Enforces the min-participants rule — if entries < minEntries, status
 * flips to `cancelled` and every entry gets refunded.
 *
 * Idempotent: if status is already `settled` or `cancelled`, returns
 * the doc unchanged.
 */
async function settleSweepstakes(sweepstakesId) {
  const s = await Sweepstakes.findById(sweepstakesId);
  if (!s) return null;
  if (s.status === 'settled' || s.status === 'cancelled') return s;

  s.status = 'drawing';
  await s.save();

  const entries = await SweepstakesEntry.find({ sweepstakes: s._id });

  if (entries.length < s.minEntries) {
    // Below floor — refund everyone, mark cancelled.
    for (const e of entries) {
      if (e.refunded) continue;
      const refundKey = `ticket:sweepstakes-refund:${s._id}:${e.user}:${e.entryNumber}`;
      await applyTicketDelta({
        userId: e.user,
        amount: e.ticketsSpent,
        kind: 'refund_credit',
        idempotencyKey: refundKey,
        sweepstakes: s._id,
        note: 'Sweepstakes cancelled — below min participants',
      });
      e.refunded = true;
      e.refundedAt = new Date();
      await e.save();
    }
    s.status = 'cancelled';
    s.settledAt = new Date();
    await s.save();
    return s;
  }

  // Uniform random across all entries — crypto.randomInt for cryptographic
  // fairness. Each "ticket stub" has equal odds, so a user with N entries
  // has N×base odds (correct under the rules).
  const winnerIdx = crypto.randomInt(0, entries.length);
  const winningEntry = entries[winnerIdx];
  s.winnerUserId = winningEntry.user;
  s.winnerEntryId = winningEntry._id;
  s.status = 'settled';
  s.settledAt = new Date();
  await s.save();
  return s;
}

/**
 * Admin-only cancellation. Refunds every paid entry, marks the
 * sweepstakes `cancelled`. Idempotent — if it's already cancelled or
 * settled, returns the doc unchanged.
 */
async function cancelSweepstakes(sweepstakesId, { note } = {}) {
  const s = await Sweepstakes.findById(sweepstakesId);
  if (!s) return null;
  if (s.status === 'settled' || s.status === 'cancelled') return s;

  const entries = await SweepstakesEntry.find({ sweepstakes: s._id });
  for (const e of entries) {
    if (e.refunded) continue;
    const refundKey = `ticket:sweepstakes-cancel:${s._id}:${e.user}:${e.entryNumber}`;
    await applyTicketDelta({
      userId: e.user,
      amount: e.ticketsSpent,
      kind: 'refund_credit',
      idempotencyKey: refundKey,
      sweepstakes: s._id,
      note: note || 'Sweepstakes cancelled by admin',
    });
    e.refunded = true;
    e.refundedAt = new Date();
    await e.save();
  }
  s.status = 'cancelled';
  s.settledAt = new Date();
  await s.save();
  return s;
}

module.exports = {
  buyEntry,
  settleSweepstakes,
  cancelSweepstakes,
};
