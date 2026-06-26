/**
 * Payout / banking helpers shared across controllers.
 *
 * simple_version pays winners off-band — manual SPEI (Mexico) or PayPal
 * (international). These helpers normalize the stored shape for API
 * responses and validate incoming edits keyed off the user's country.
 */

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// CLABE interbancaria: exactly 18 digits (Mexico).
const CLABE_RX = /^\d{18}$/;

/**
 * Normalize a payout subdocument to a stable shape for API responses.
 * Legacy accounts predate the field (undefined) — return an empty MX
 * skeleton so clients can render the form without null-checks everywhere.
 */
function serializePayout(p) {
  const pp = p || {};
  return {
    country: pp.country || 'MX',
    accountHolder: pp.accountHolder || '',
    bankName: pp.bankName || '',
    clabe: pp.clabe || '',
    accountNumber: pp.accountNumber || '',
    paypalEmail: pp.paypalEmail || '',
    updatedAt: pp.updatedAt || null,
  };
}

/**
 * Whether a user has enough payout info on file to actually be paid.
 * Mirrors validatePayout's required-field rules per country:
 *   - MX  → a CLABE is enough.
 *   - else → a PayPal email is enough.
 */
function hasPayoutInfo(p) {
  if (!p) return false;
  const country = (p.country || 'MX').toString().toUpperCase();
  if (country === 'MX') return !!(p.clabe && p.clabe.trim());
  return !!(p.paypalEmail && p.paypalEmail.trim());
}

/**
 * Validate + sanitize an incoming payout payload. Returns either
 * { ok: true, payout } with cleaned values, or { ok: false, error }
 * where error is the {message, code, field} shape the API sends back.
 *
 * Rules key off `country`:
 *   - MX  → accountHolder + bankName + CLABE (18 digits) required; PayPal optional.
 *   - else → paypalEmail required (no SPEI abroad); bank fields optional.
 */
function validatePayout(input) {
  const body = input || {};
  const country = (body.country || 'MX').toString().trim().toUpperCase().slice(0, 2) || 'MX';
  const accountHolder = (body.accountHolder || '').toString().trim().slice(0, 120);
  const bankName = (body.bankName || '').toString().trim().slice(0, 120);
  // Strip spaces/dashes from CLABE so "012 345…" pasted from a bank app still validates.
  const clabe = (body.clabe || '').toString().replace(/[\s-]/g, '').slice(0, 18);
  const accountNumber = (body.accountNumber || '').toString().trim().slice(0, 60);
  const paypalEmail = (body.paypalEmail || '').toString().trim().toLowerCase().slice(0, 254);

  if (country === 'MX') {
    if (!accountHolder) {
      return { ok: false, error: { message: 'Enter the account holder name', code: 'PAYOUT_HOLDER_REQUIRED', field: 'payout.accountHolder' } };
    }
    if (!bankName) {
      return { ok: false, error: { message: 'Enter your bank name', code: 'PAYOUT_BANK_REQUIRED', field: 'payout.bankName' } };
    }
    if (!CLABE_RX.test(clabe)) {
      return { ok: false, error: { message: 'Enter a valid 18-digit CLABE', code: 'PAYOUT_CLABE_INVALID', field: 'payout.clabe' } };
    }
  } else {
    // International: bank rails don't reach them, so PayPal is the payout path.
    if (!EMAIL_RX.test(paypalEmail)) {
      return { ok: false, error: { message: 'Enter your PayPal email so we can send your prize', code: 'PAYOUT_PAYPAL_REQUIRED', field: 'payout.paypalEmail' } };
    }
  }

  // PayPal, if provided in any country, must still be a valid email.
  if (paypalEmail && !EMAIL_RX.test(paypalEmail)) {
    return { ok: false, error: { message: 'Enter a valid PayPal email', code: 'PAYOUT_PAYPAL_INVALID', field: 'payout.paypalEmail' } };
  }

  return {
    ok: true,
    payout: { country, accountHolder, bankName, clabe, accountNumber, paypalEmail, updatedAt: new Date() },
  };
}

module.exports = { serializePayout, validatePayout, hasPayoutInfo };
