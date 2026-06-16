/**
 * Pending-payment reminder sweep. Runs on the existing 1-minute scheduler
 * (piggy-backed in dailyPickService.dailyPickTick — no extra timer). Finds
 * manual-payment intents the user started but never completed (status still
 * 'pending', never marked paid) and emails them a one-time nudge with the
 * destination account + reference so they can finish paying.
 *
 * One-shot per intent (reminderSentAt flag). Best-effort: a Brevo outage at the
 * reminder moment loses that single nudge rather than risking a retry storm on
 * every tick — the user still sees the pending payment in-app.
 */
const SpeiPayment = require('../models/SpeiPayment');
const brevoService = require('./brevoService');

// Wait this long after the intent was created before nudging (gives the user
// time to pay on their own). Overridable via env.
const afterHours = () => {
  const n = Number(process.env.SPEI_REMINDER_AFTER_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 6;
};
// Never pester intents older than this — they're abandoned, not forgotten.
const MAX_AGE_HOURS = 7 * 24;
const HOUR_MS = 60 * 60 * 1000;

async function remindStalePendingPayments() {
  if (!brevoService.isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };

  const now = Date.now();
  const cutoff = new Date(now - afterHours() * HOUR_MS);
  const floor = new Date(now - MAX_AGE_HOURS * HOUR_MS);

  const payments = await SpeiPayment.find({
    status: 'pending',
    userMarkedPaidAt: null,
    reminderSentAt: null,
    createdAt: { $lte: cutoff, $gte: floor },
  })
    .sort({ createdAt: 1 })
    .limit(50)
    .populate('user', 'email displayName username')
    .populate('quiniela', 'name');

  if (payments.length === 0) return { ok: true, sent: 0 };

  const spei = {
    clabe: process.env.SPEI_CLABE || '',
    beneficiary: process.env.SPEI_BENEFICIARY || '',
    bank: process.env.SPEI_BANK || '',
  };

  let sent = 0;
  for (const p of payments) {
    const u = p.user;
    if (u && u.email) {
      const res = await brevoService.sendPendingPaymentReminder({
        email: u.email,
        displayName: u.displayName || u.username,
        poolName: p.quiniela?.name || 'tu quiniela',
        poolId: String(p.quiniela?._id || p.quiniela || ''),
        amountMXN: p.amountMXN,
        amountUSD: p.amountUSD,
        reference: p.reference,
        method: p.method,
        clabe: spei.clabe,
        beneficiary: spei.beneficiary,
        bank: spei.bank,
      });
      if (res.ok) sent += 1;
    }
    // One-shot: stamp regardless of send outcome so we never re-sweep this
    // intent (avoids retry storms / spamming the payer every minute).
    p.reminderSentAt = new Date();
    try { await p.save(); } catch (err) { console.warn('[PendingPayment] stamp failed:', err.message); }
  }

  console.log(`[PendingPayment] reminders sent=${sent}/${payments.length}`);
  return { ok: true, sent, candidates: payments.length };
}

module.exports = { remindStalePendingPayments };
