/**
 * Brevo (ex-Sendinblue) email integration. Two jobs:
 *   1. upsertContact()    — add/update the user as a contact in a list, so the
 *                           marketing CAMPAIGN (sent from the Brevo dashboard)
 *                           and future newsletters have an up-to-date audience.
 *   2. sendWelcomeEmail() — send the transactional "welcome" email via a Brevo
 *                           template when a user registers.
 * welcomeNewUser() orchestrates both for the signup hook.
 *
 * Setup (.env):
 *   BREVO_API_KEY=...                  (Brevo → SMTP & API → API Keys)
 *   BREVO_LIST_ID=12                   (Brevo → Contacts → Lists → the list id)
 *   BREVO_WELCOME_TEMPLATE_ID=3        (Brevo → Transactional → Templates → id)
 *     NB: this must be a TRANSACTIONAL template (not a marketing Campaign) —
 *     the transactional API references it by numeric id.
 *   Sender + DKIM/DMARC are configured on the Brevo side (authenticated
 *   domain futpools.com); the template carries the sender.
 *
 * Like telegramService, every call is BEST-EFFORT: missing config or a Brevo
 * outage logs a warning and never throws into the caller's flow (a registration
 * must succeed even if the email/contact sync fails). Uses the REST API via the
 * global fetch (Node 18+); no SDK dependency.
 */

const API = 'https://api.brevo.com/v3';

const apiKey = () => process.env.BREVO_API_KEY || '';
const listId = () => {
  const n = Number(process.env.BREVO_LIST_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const welcomeTemplateId = () => {
  const n = Number(process.env.BREVO_WELCOME_TEMPLATE_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function isConfigured() {
  return !!apiKey();
}

/** POST to a Brevo endpoint. Throws on a non-2xx so callers can log + swallow. */
async function brevoPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'api-key': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${path} → ${res.status} ${data.code || ''} ${data.message || ''}`.trim());
  }
  return res;
}

/** Map a user doc to the contact attributes Brevo stores. */
function contactPayload(user) {
  return {
    email: user.email,
    displayName: user.displayName || user.username || '',
    locale: user.locale || 'es',
  };
}

/**
 * Create or update the contact (idempotent by email) and add it to the
 * marketing list. Returns { ok } and never rejects.
 */
async function upsertContact({ email, displayName, locale }) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!email) return { ok: false, reason: 'NO_EMAIL' };
  try {
    const body = {
      email,
      attributes: { FIRSTNAME: displayName || '', LOCALE: locale || 'es' },
      updateEnabled: true, // upsert: update if the contact already exists
    };
    if (listId()) body.listIds = [listId()];
    await brevoPost('/contacts', body);
    return { ok: true };
  } catch (err) {
    console.warn('[brevo] upsertContact failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send the transactional welcome email from the configured Brevo template.
 * Passes FIRSTNAME both as a template param and (via the prior upsert) as a
 * contact attribute, so the template renders the name whether it uses
 * {{ params.FIRSTNAME }} or {{ contact.FIRSTNAME }}. Never rejects.
 */
async function sendWelcomeEmail({ email, displayName, locale }) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!email) return { ok: false, reason: 'NO_EMAIL' };
  if (!welcomeTemplateId()) {
    console.warn('[brevo] BREVO_WELCOME_TEMPLATE_ID not set — skipping welcome email');
    return { ok: false, reason: 'NO_TEMPLATE' };
  }
  try {
    await brevoPost('/smtp/email', {
      templateId: welcomeTemplateId(),
      to: [{ email, name: displayName || email }],
      params: { FIRSTNAME: displayName || '', LOCALE: locale || 'es' },
    });
    return { ok: true };
  } catch (err) {
    console.warn('[brevo] sendWelcomeEmail failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Signup side-effects: register the contact (so they land in the marketing
 * list AND contact.FIRSTNAME resolves in the template) THEN send the welcome.
 * Best-effort; never throws. Call fire-and-forget from the register handler.
 */
async function welcomeNewUser(user) {
  const payload = contactPayload(user);
  await upsertContact(payload);
  await sendWelcomeEmail(payload);
}

module.exports = { isConfigured, upsertContact, sendWelcomeEmail, welcomeNewUser, contactPayload };
