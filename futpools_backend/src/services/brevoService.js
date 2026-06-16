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

const API = 'https://api.brevo.com/v3';

const apiKey = () => process.env.BREVO_API_KEY || '';
const senderEmail = () => process.env.BREVO_SENDER_EMAIL || 'rodrigo@futpools.com';
const senderName = () => process.env.BREVO_SENDER_NAME || 'Rodrigo de FutPools';
const listId = () => {
  const n = Number(process.env.BREVO_LIST_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
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
async function sendEmail({ to, name, subject, html, replyTo }) {
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

module.exports = {
  isConfigured,
  sendEmail,
  upsertContact,
  contactPayload,
  welcomeNewUser,
  sendParticipationConfirmed,
  sendPasswordResetCode,
};
