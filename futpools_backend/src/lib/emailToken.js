/**
 * Stateless unsubscribe tokens. We don't store a per-user secret — the link in
 * a marketing email carries `?u=<userId>&t=<token>` where token = HMAC(userId).
 * Verifying re-derives the HMAC and timing-safe compares. No DB lookup, no
 * expiry: an unsubscribe link should keep working forever.
 */
const crypto = require('crypto');

const secret = () => process.env.JWT_SECRET || 'dev-secret';

/** 32-hex-char HMAC of the user id. Stable for a given id + secret. */
function sign(userId) {
  return crypto
    .createHmac('sha256', secret())
    .update(`unsub:${String(userId)}`)
    .digest('hex')
    .slice(0, 32);
}

function verify(userId, token) {
  if (!userId || !token) return false;
  const expected = sign(userId);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
