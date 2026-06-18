/**
 * Lifecycle / marketing email sweeps, piggy-backed on the 1-minute scheduler
 * (dailyPickService.dailyPickTick) but internally throttled to ~15 min so the
 * queries stay cheap. Four jobs:
 *
 *   #2 remindClosingPools  — "last call" a few hours before a public pool starts
 *   #3 activateIdleSignups — nudge signups who never left a prediction (~1d old)
 *   #5 winBackInactive     — re-engage players who went quiet for a few weeks
 *   #6 sendWeeklyDigest    — once-a-week roundup of open public pools
 *
 * All four are MARKETING: they skip opted-out users and carry the one-click
 * unsubscribe. Each is best-effort and self-throttled by a per-entity stamp
 * (closingReminderSentAt / activationEmailSentAt / winbackEmailSentAt) or, for
 * the digest, a durable EmailJobState row. Master switch: LIFECYCLE_EMAILS_ENABLED.
 */
const User = require('../models/User');
const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const EmailJobState = require('../models/EmailJobState');
const brevoService = require('./brevoService');
const buildPoolClosingSoon = require('../emails/poolClosingSoon');
const buildActivation = require('../emails/activation');
const buildWinback = require('../emails/winback');
const buildWeeklyDigest = require('../emails/weeklyDigest');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const enabled = () => String(process.env.LIFECYCLE_EMAILS_ENABLED || 'true') !== 'false';
const numEnv = (name, def) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};

function formatMx(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return ''; }
}

/** Build + send a marketing email to one user (opt-out already filtered out). */
async function sendMarketing(user, build) {
  const unsub = brevoService.marketingUnsubscribeUrl(user._id);
  const { subject, html } = build(unsub);
  return brevoService.sendEmail({
    to: user.email,
    name: user.displayName || user.username,
    subject,
    html,
    headers: brevoService.listUnsubHeaders(unsub),
  });
}

/** Stream opted-in users (optionally excluding some ids) and send in batches. */
async function blast(query, build) {
  const cursor = User.find(query).select('email displayName username').lean().cursor();
  let sent = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const jobs = batch.map((u) => (u.email
      ? sendMarketing(u, build).then((r) => { if (r.ok) sent += 1; }).catch(() => {})
      : Promise.resolve()));
    await Promise.allSettled(jobs);
    batch = [];
  };
  for await (const u of cursor) {
    if (!u.email) continue;
    batch.push(u);
    if (batch.length >= 25) await flush();
  }
  await flush();
  return sent;
}

// ── #2 Pool closing soon ───────────────────────────────────────────────────
async function remindClosingPools(now) {
  const windowH = numEnv('CLOSING_REMINDER_WINDOW_HOURS', 3);
  const pools = await Quiniela.find({
    visibility: 'public',
    settlementStatus: 'pending',
    closingReminderSentAt: null,
    startDate: { $gt: new Date(now), $lte: new Date(now + windowH * HOUR) },
  }).select('name startDate prizeLabel').limit(20);

  for (const pool of pools) {
    const entrantIds = await QuinielaEntry.distinct('user', { quiniela: pool._id });
    const sent = await blast(
      { emailOptOut: { $ne: true }, _id: { $nin: entrantIds } },
      (unsub) => buildPoolClosingSoon({
        poolName: pool.name,
        poolId: String(pool._id),
        startsAtText: formatMx(pool.startDate),
        prizeLabel: pool.prizeLabel || '',
        unsubscribeUrl: unsub,
      }),
    );
    pool.closingReminderSentAt = new Date();
    try { await pool.save(); } catch (e) { console.warn('[lifecycle] closing stamp failed:', e.message); }
    console.log(`[lifecycle] closing pool=${pool._id} sent=${sent}`);
  }
}

// ── #3 Activation (signed up, never played) ────────────────────────────────
async function activateIdleSignups(now) {
  const afterH = numEnv('ACTIVATION_AFTER_HOURS', 24);
  const lo = new Date(now - 7 * DAY); // only recent signups, not the whole back catalog
  const hi = new Date(now - afterH * HOUR);
  const users = await User.find({
    emailOptOut: { $ne: true },
    activationEmailSentAt: null,
    createdAt: { $gte: lo, $lte: hi },
  }).select('email displayName username').limit(200).lean();

  let sent = 0;
  for (const u of users) {
    const hasEntry = await QuinielaEntry.exists({ user: u._id });
    if (!hasEntry && u.email) {
      const res = await sendMarketing(u, (unsub) => buildActivation({ displayName: u.displayName || u.username, unsubscribeUrl: unsub }));
      if (res.ok) sent += 1;
    }
    // Stamp either way so played-already users drop out of future sweeps.
    await User.updateOne({ _id: u._id }, { $set: { activationEmailSentAt: new Date() } });
  }
  if (sent) console.log(`[lifecycle] activation sent=${sent}/${users.length} candidates`);
}

// ── #5 Win-back (played before, went quiet) ────────────────────────────────
async function winBackInactive(now) {
  const weeks = numEnv('WINBACK_AFTER_WEEKS', 3);
  const cooldownDays = numEnv('WINBACK_COOLDOWN_DAYS', 60);
  const cutoff = new Date(now - weeks * 7 * DAY);
  const cool = new Date(now - cooldownDays * DAY);

  // Latest entry per user; keep those whose newest entry is older than cutoff.
  const rows = await QuinielaEntry.aggregate([
    { $match: { refundedAt: null } },
    { $group: { _id: '$user', lastEntryAt: { $max: '$createdAt' } } },
    { $match: { lastEntryAt: { $lte: cutoff } } },
    { $limit: 1000 },
  ]);
  const userIds = rows.map((r) => r._id);
  if (!userIds.length) return;

  const users = await User.find({
    _id: { $in: userIds },
    emailOptOut: { $ne: true },
    $or: [{ winbackEmailSentAt: null }, { winbackEmailSentAt: { $lte: cool } }],
  }).select('email displayName username').limit(200).lean();

  let sent = 0;
  for (const u of users) {
    if (u.email) {
      const res = await sendMarketing(u, (unsub) => buildWinback({ displayName: u.displayName || u.username, unsubscribeUrl: unsub }));
      if (res.ok) sent += 1;
    }
    await User.updateOne({ _id: u._id }, { $set: { winbackEmailSentAt: new Date() } });
  }
  if (sent) console.log(`[lifecycle] winback sent=${sent}/${users.length} candidates`);
}

// ── #6 Weekly digest of open public pools ──────────────────────────────────
async function sendWeeklyDigest(now) {
  const state = await EmailJobState.findOne({ key: 'weekly_digest' }).lean();
  const last = state?.lastRunAt ? new Date(state.lastRunAt).getTime() : 0;
  if (now - last < 6.5 * DAY) return; // ~weekly cadence

  // Only fire in a reasonable daytime window (UTC 16-19 ≈ 10am-1pm CT) so the
  // digest doesn't land at 3am. Skip until the window comes around.
  const hourUTC = new Date(now).getUTCHours();
  if (hourUTC < 16 || hourUTC > 19) return;

  const pools = await Quiniela.find({
    visibility: 'public',
    settlementStatus: 'pending',
    startDate: { $gt: new Date(now) },
  }).sort({ startDate: 1 }).limit(8).select('name startDate prizeLabel').lean();

  if (pools.length === 0) return; // nothing open → don't send an empty digest

  const items = pools.map((p) => ({
    name: p.name,
    poolId: String(p._id),
    startsAtText: formatMx(p.startDate),
    prizeLabel: p.prizeLabel || '',
  }));

  const sent = await blast(
    { emailOptOut: { $ne: true } },
    (unsub) => buildWeeklyDigest({ items, unsubscribeUrl: unsub }),
  );
  await EmailJobState.updateOne(
    { key: 'weekly_digest' },
    { $set: { lastRunAt: new Date() } },
    { upsert: true },
  );
  console.log(`[lifecycle] weekly digest sent=${sent} pools=${pools.length}`);
}

// ── Orchestrator (throttled) ───────────────────────────────────────────────
let lastRun = 0;
async function runLifecycleSweeps() {
  if (!brevoService.isConfigured() || !enabled()) return;
  const now = Date.now();
  if (now - lastRun < 15 * MIN) return; // ~15-min cadence; entity stamps prevent dupes
  lastRun = now;

  const jobs = [
    ['closing', remindClosingPools],
    ['activation', activateIdleSignups],
    ['winback', winBackInactive],
    ['digest', sendWeeklyDigest],
  ];
  for (const [name, fn] of jobs) {
    try { await fn(now); } catch (err) { console.warn(`[lifecycle] ${name} error:`, err.message); }
  }
}

module.exports = { runLifecycleSweeps };
