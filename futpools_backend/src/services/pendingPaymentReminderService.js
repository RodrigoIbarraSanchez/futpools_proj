/**
 * Pending-payment reminder DRIP. Runs on the existing 1-minute scheduler
 * (piggy-backed in dailyPickService.dailyPickTick — no extra timer). Finds
 * manual-payment intents the user started but never completed (status still
 * 'pending', never marked paid) and emails an escalating sequence of nudges so
 * they finish paying while the intent is still hot.
 *
 * Cadence (minutes after the intent was created): SPEI_REMINDER_SCHEDULE_MIN,
 * default "5,10,30" → 3 nudges. The sequence STOPS the moment the quiniela
 * starts (pool.startDate <= now): once picks lock, paying is pointless, so we
 * never email past kickoff.
 *
 * Best-effort: a Brevo failure on one step just skips that nudge (the step is
 * still counted, so we move on to the next one rather than retry-storming).
 */
const SpeiPayment = require('../models/SpeiPayment');
const brevoService = require('./brevoService');

// Minutes-after-creation at which each nudge fires. Configurable; falls back to
// a sane drip. Sorted ascending so step N always fires after step N-1.
function schedule() {
  const raw = (process.env.SPEI_REMINDER_SCHEDULE_MIN || '5,10,30')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return (raw.length ? raw : [5, 10, 30]).sort((a, b) => a - b);
}

// Only query recent intents — the whole drip finishes in <1h, so anything
// older has either completed its sequence or seen its pool start already.
const QUERY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function startsAtText(startDate) {
  if (!startDate) return '';
  try {
    // 24h (hour12:false) avoids the trailing "p.m." dot colliding with the
    // sentence period in the email ("19:00." instead of "07:00 p.m..").
    return new Date(startDate).toLocaleString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return ''; }
}

async function remindStalePendingPayments() {
  if (!brevoService.isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };

  const steps = schedule();
  const maxSteps = steps.length;
  const now = Date.now();
  const floor = new Date(now - QUERY_MAX_AGE_MS);

  const payments = await SpeiPayment.find({
    status: 'pending',
    userMarkedPaidAt: null,
    reminderCount: { $lt: maxSteps },
    createdAt: { $gte: floor },
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate('user', 'email displayName username')
    .populate('quiniela', 'name startDate');

  if (payments.length === 0) return { ok: true, sent: 0 };

  const spei = {
    clabe: process.env.SPEI_CLABE || '',
    beneficiary: process.env.SPEI_BENEFICIARY || '',
    bank: process.env.SPEI_BANK || '',
  };

  const stamp = async (p, count) => {
    p.reminderCount = count;
    p.reminderSentAt = new Date();
    try { await p.save(); } catch (err) { console.warn('[PendingPayment] stamp failed:', err.message); }
  };

  let sent = 0;
  for (const p of payments) {
    const pool = p.quiniela;

    // Pool already started → stop the sequence (max out the counter so this
    // intent drops out of future sweeps).
    if (pool?.startDate && new Date(pool.startDate).getTime() <= now) {
      await stamp(p, maxSteps);
      continue;
    }

    const count = p.reminderCount || 0;
    const dueAt = new Date(p.createdAt).getTime() + steps[count] * MIN_MS;
    if (now < dueAt) continue; // next step not due yet — revisit on a later tick

    const u = p.user;
    if (u && u.email) {
      const res = await brevoService.sendPendingPaymentReminder({
        email: u.email,
        displayName: u.displayName || u.username,
        poolName: pool?.name || 'tu quiniela',
        poolId: String(pool?._id || p.quiniela || ''),
        amountMXN: p.amountMXN,
        amountUSD: p.amountUSD,
        reference: p.reference,
        method: p.method,
        clabe: spei.clabe,
        beneficiary: spei.beneficiary,
        bank: spei.bank,
        startsAtText: startsAtText(pool?.startDate),
      });
      if (res.ok) sent += 1;
    }
    // Advance the counter whether or not the send succeeded (one nudge per
    // step, at most one per intent per tick — no retry storm).
    await stamp(p, count + 1);
  }

  console.log(`[PendingPayment] drip sent=${sent}/${payments.length} candidates`);
  return { ok: true, sent, candidates: payments.length };
}

module.exports = { remindStalePendingPayments };
