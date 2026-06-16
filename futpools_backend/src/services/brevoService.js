/**
 * Brevo (ex-Sendinblue) email facade. All emails are HTML built in code
 * (src/emails/*) and sent via Brevo's transactional API with htmlContent — no
 * Brevo dashboard templates. Also keeps contacts synced to a marketing list for
 * campaigns/newsletters.
 *
 * Setup (.env):
 *   BREVO_API_KEY=...              (Brevo → SMTP & API → API Keys)
 *   BREVO_LIST_ID=12              (Brevo → Contacts → Lists → id, for the sync)
 *   BREVO_SENDER_EMAIL=rodrigo@futpools.com   (authenticated domain sender)
 *   BREVO_SENDER_NAME=Rodrigo de FutPools
 *
 * Like telegramService, EVERY call is best-effort: missing config or a Brevo
 * outage logs a warning and never throws into the caller's flow (registration,
 * payment confirmation, etc. must succeed even if email fails). REST API via the
 * global fetch (Node 18+); no SDK.
 */

const buildWelcome = require('../emails/welcome');
const buildParticipationConfirmed = require('../emails/participationConfirmed');
const buildPasswordReset = require('../emails/passwordReset');
const buildPoolResult = require('../emails/poolResult');
const buildNewPool = require('../emails/newPool');
const emailToken = require('../lib/emailToken');
const User = require('../models/User');

const API = 'https://api.brevo.com/v3';

const apiKey = () => process.env.BREVO_API_KEY || '';
const senderEmail = () => process.env.BREVO_SENDER_EMAIL || 'rodrigo@futpools.com';
const senderName = () => process.env.BREVO_SENDER_NAME || 'Rodrigo de FutPools';
const listId = () => {
  const n = Number(process.env.BREVO_LIST_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};
// The backend's own public host — used to build absolute unsubscribe links
// (these land on api.futpools.com/email/unsubscribe, not the web app).
const apiBase = () => (process.env.PUBLIC_API_BASE_URL || 'https://api.futpools.com').replace(/\/+$/, '');
const unsubscribeUrl = (userId) => {
  const id = String(userId);
  return `${apiBase()}/email/unsubscribe?u=${encodeURIComponent(id)}&t=${emailToken.sign(id)}`;
};

function isConfigured() {
  return !!apiKey();
}

/** POST to a Brevo endpoint. Throws on non-2xx so callers can log + swallow. */
async function brevoPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'api-key': apiKey(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${path} → ${res.status} ${data.code || ''} ${data.message || ''}`.trim());
  }
  return res;
}

/**
 * Send one HTML email. Best-effort: returns { ok } and never rejects.
 *   to      — recipient email (string)
 *   name    — recipient display name (optional)
 *   subject, html — from an emails/* builder
 *   replyTo — optional { email, name }
 */
async function sendEmail({ to, name, subject, html, replyTo, headers }) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!to || !subject || !html) return { ok: false, reason: 'MISSING_FIELDS' };
  try {
    const body = {
      sender: { email: senderEmail(), name: senderName() },
      to: [{ email: to, name: name || to }],
      subject,
      htmlContent: html,
    };
    if (replyTo) body.replyTo = replyTo;
    if (headers && Object.keys(headers).length) body.headers = headers;
    await brevoPost('/smtp/email', body);
    return { ok: true };
  } catch (err) {
    console.warn('[brevo] sendEmail failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Create/update the contact (idempotent by email) + add to the marketing list. */
async function upsertContact({ email, displayName, locale }) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!email) return { ok: false, reason: 'NO_EMAIL' };
  try {
    const body = {
      email,
      attributes: { FIRSTNAME: displayName || '', LOCALE: locale || 'es' },
      updateEnabled: true,
    };
    if (listId()) body.listIds = [listId()];
    await brevoPost('/contacts', body);
    return { ok: true };
  } catch (err) {
    console.warn('[brevo] upsertContact failed:', err.message);
    return { ok: false, error: err.message };
  }
}

const contactPayload = (user) => ({
  email: user.email,
  displayName: user.displayName || user.username || '',
  locale: user.locale || 'es',
});

// ── Typed senders (call these from the controllers; all best-effort) ──

/** Signup: sync the contact to the list, then send the welcome email. */
async function welcomeNewUser(user) {
  await upsertContact(contactPayload(user));
  const { subject, html } = buildWelcome({ displayName: user.displayName || user.username });
  return sendEmail({ to: user.email, name: user.displayName || user.username, subject, html });
}

/** Admin confirmed a SPEI payment → "participation confirmed" + re-engage CTA. */
async function sendParticipationConfirmed({ email, displayName, poolName, poolId }) {
  const { subject, html } = buildParticipationConfirmed({ poolName, poolId });
  return sendEmail({ to: email, name: displayName, subject, html });
}

/** Forgot-password → email the reset code. */
async function sendPasswordResetCode({ email, displayName, code, minutes }) {
  const { subject, html } = buildPasswordReset({ code, minutes });
  return sendEmail({ to: email, name: displayName, subject, html });
}

/**
 * Pool settled → email every participant their result (winner vs participant).
 * Aggregates by user (a user with several entries gets ONE email, using their
 * best score + summed ladder prize). Called fire-and-forget from
 * poolSettlementService.settlePool — never blocks settlement.
 */
async function sendPoolResultsForSettlement({ pool, entries }) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!pool || !Array.isArray(entries) || entries.length === 0) return { ok: false, reason: 'NO_ENTRIES' };

  const total = (pool.fixtures || []).filter((f) => f && f.fixtureId).length;
  const winnerSet = new Set((pool.winnerUserIds || []).map((id) => String(id)));

  // Collapse multiple entries per user into one recipient.
  const byUser = new Map();
  for (const e of entries) {
    const u = e.user;
    if (!u || !u._id || !u.email) continue;
    const key = String(u._id);
    const cur = byUser.get(key) || {
      email: u.email,
      displayName: u.displayName || '',
      bestScore: 0,
      prizeMXN: 0,
      isWinner: winnerSet.has(key),
    };
    if ((e.score || 0) > cur.bestScore) cur.bestScore = e.score || 0;
    cur.prizeMXN += e.prizeMXN || 0;
    byUser.set(key, cur);
  }

  const recipients = [...byUser.values()];
  let sent = 0;
  for (const r of recipients) {
    const { subject, html } = buildPoolResult({
      poolName: pool.name,
      poolId: String(pool._id),
      score: r.bestScore,
      total,
      isWinner: r.isWinner,
      prizeMXN: r.prizeMXN,
    });
    const res = await sendEmail({ to: r.email, name: r.displayName, subject, html });
    if (res.ok) sent += 1;
  }
  console.log(`[brevo] pool results pool=${pool._id} sent=${sent}/${recipients.length}`);
  return { ok: true, sent, recipients: recipients.length };
}

/**
 * New PUBLIC pool created → announce to ALL opted-in users. Marketing blast, so
 * each email carries a per-user one-click unsubscribe (footer link + the
 * List-Unsubscribe header so Gmail/Apple Mail show their native button).
 * Streams users via a cursor and sends in small batches. Best-effort; called
 * fire-and-forget from quinielaController.createQuiniela.
 */
async function sendNewPoolAnnouncement(pool) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!pool || !pool._id) return { ok: false, reason: 'NO_POOL' };

  const cursor = User.find({ emailOptOut: { $ne: true } })
    .select('email displayName username')
    .lean()
    .cursor();

  let sent = 0;
  let total = 0;
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    const jobs = batch.map(async (u) => {
      const unsub = unsubscribeUrl(u._id);
      const { subject, html } = buildNewPool({
        poolName: pool.name,
        poolId: String(pool._id),
        prizeLabel: pool.prizeLabel || '',
        unsubscribeUrl: unsub,
      });
      const res = await sendEmail({
        to: u.email,
        name: u.displayName || u.username,
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsub}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (res.ok) sent += 1;
    });
    await Promise.allSettled(jobs);
    batch = [];
  };

  for await (const u of cursor) {
    if (!u.email) continue;
    total += 1;
    batch.push(u);
    if (batch.length >= 25) await flush();
  }
  await flush();

  console.log(`[brevo] new-pool announce pool=${pool._id} sent=${sent}/${total}`);
  return { ok: true, sent, total };
}

module.exports = {
  isConfigured,
  sendEmail,
  upsertContact,
  contactPayload,
  welcomeNewUser,
  sendParticipationConfirmed,
  sendPasswordResetCode,
  sendPoolResultsForSettlement,
  sendNewPoolAnnouncement,
};
