/**
 * "Pool locks in ~10 min — review pending payments" Telegram alert.
 *
 * Registration closes 10 minutes before the first kickoff (see
 * poolPaymentService.JOIN_LOCK_MINUTES). At exactly that moment the admin
 * wants a single Telegram ping so they can manually review the SPEI/PayPal
 * payments still pending and confirm the legit ones before picks freeze.
 *
 * Runs on the existing 1-minute scheduler (piggy-backed in
 * dailyPickService.dailyPickTick — no extra timer). One-shot per pool:
 * `Quiniela.lockAlertSentAt` is stamped with a guarded update so a double
 * tick (or two app instances) can never double-send. Only paid pools
 * (entryFeeMXN > 0) are considered — free pools create entries instantly and
 * never have pending payments. We only actually message when there IS at
 * least one pending payment to review; otherwise we stamp silently to avoid
 * noise.
 */

const Quiniela = require('../models/Quiniela');
const SpeiPayment = require('../models/SpeiPayment');
const { sendTelegramMessage } = require('./telegramService');

// Must match poolPaymentService.JOIN_LOCK_MINUTES and the web POOL_LOCK_MINUTES.
const LOCK_MINUTES = 10;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

const WEB_URL = (process.env.PUBLIC_WEB_URL || 'https://futpools.com').replace(/\/+$/, '');

function earliestKickoff(pool) {
  const ks = (pool.fixtures || [])
    .map((f) => (f.kickoff ? new Date(f.kickoff).getTime() : NaN))
    .filter((n) => Number.isFinite(n));
  if (ks.length) return Math.min(...ks);
  const sd = pool.startDate ? new Date(pool.startDate).getTime() : NaN;
  return Number.isFinite(sd) ? sd : null;
}

function cdmx(ms) {
  try {
    return new Date(ms).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return ''; }
}

async function alertPoolsLockingSoon() {
  const now = Date.now();
  // Candidates: paid, active pools whose first kickoff is within the next
  // (LOCK + 1) minutes — i.e. we're at or about to cross the lock moment.
  // The +1 min buffer absorbs tick jitter; the per-pool check below pins it
  // to "lock already reached".
  const horizon = new Date(now + (LOCK_MINUTES + 1) * 60 * 1000);
  const pools = await Quiniela.find({
    startDate: { $gt: new Date(now), $lte: horizon },
    lockAlertSentAt: null,
    cancelledAt: null,
    entryFeeMXN: { $gt: 0 },
  }).lean();

  let alerted = 0;
  for (const pool of pools) {
    const fk = earliestKickoff(pool);
    if (fk == null) continue;
    const lockAt = fk - LOCK_MS;
    // Only once we've actually reached the lock moment (and kickoff hasn't
    // passed — if it has, we missed the window, just stamp to stop re-checking).
    if (now < lockAt) continue;

    // Guarded stamp: whoever flips lockAlertSentAt from null wins the right to
    // send. A concurrent tick/instance gets modifiedCount 0 and stays quiet.
    const claim = await Quiniela.updateOne(
      { _id: pool._id, lockAlertSentAt: null },
      { $set: { lockAlertSentAt: new Date() } },
    );
    if (!claim.modifiedCount) continue;

    // Missed the window entirely (kickoff already passed) — stamped, no ping.
    if (now >= fk) continue;

    const pending = await SpeiPayment.find({ quiniela: pool._id, status: 'pending' })
      .populate('user', 'displayName username email')
      .sort({ userMarkedPaidAt: -1, createdAt: 1 })
      .lean();

    // Nothing to review → stay silent (already stamped above).
    if (pending.length === 0) continue;

    const lines = [
      '⏰ Cierra en ~10 min — revisa pagos pendientes',
      `🏆 ${pool.name}`,
      `🕑 Primer partido: ${cdmx(fk)} (CDMX)`,
      `💳 ${pending.length} pago(s) pendiente(s) por revisar:`,
    ];
    for (const p of pending) {
      const u = p.user || {};
      const who = u.displayName || u.username || u.email || 'Jugador';
      const marked = p.userMarkedPaidAt ? ' · marcó pagado ✓' : '';
      const channel = p.method === 'paypal' ? 'PayPal' : 'SPEI';
      lines.push(`   • ${who} (${u.email || 'sin email'}) · ${channel} · ref ${p.reference}${marked}`);
    }
    lines.push(`👉 ${WEB_URL}/admin/spei`);

    try {
      await sendTelegramMessage(lines.join('\n'));
      alerted += 1;
    } catch (e) {
      console.warn('[poolLockAlert] telegram send failed:', e.message);
    }
  }

  return { ok: true, alerted };
}

module.exports = { alertPoolsLockingSoon };
