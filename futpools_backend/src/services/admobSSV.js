const crypto = require('crypto');

/**
 * Google AdMob Server-Side Verification (SSV) helper.
 *
 * When a user watches a rewarded ad in the iOS app, AdMob's server hits
 * our SSV callback URL with these query params:
 *   ad_network, ad_unit, reward_amount, reward_item, timestamp,
 *   transaction_id, user_id (our custom_data), signature, key_id
 *
 * We verify the signature against Google's public keys (rotated; fetched
 * from a stable JSON endpoint) before crediting the user. The signature
 * covers everything in the URL up to (but not including) `signature`,
 * `key_id`. If verification passes, the SSV is genuine and the user
 * actually watched the ad — no spoofing.
 *
 * Reference: https://developers.google.com/admob/android/ssv
 */

const KEYS_URL = process.env.ADMOB_SSV_KEYS_URL
  || 'https://www.gstatic.com/admob/reward/verifier-keys.json';

// Cache the fetched keys for an hour. They rotate, but rarely.
let keysCache = { fetchedAt: 0, keys: null };
const KEYS_TTL_MS = 60 * 60 * 1000;

async function fetchVerifierKeys() {
  const now = Date.now();
  if (keysCache.keys && now - keysCache.fetchedAt < KEYS_TTL_MS) {
    return keysCache.keys;
  }
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error(`AdMob keys fetch failed: ${res.status}`);
  const json = await res.json();
  // Shape: { keys: [{ keyId, pem, base64 }, ...] }
  keysCache = { fetchedAt: now, keys: json.keys || [] };
  return keysCache.keys;
}

/**
 * Verify an AdMob SSV callback. Returns `true` if the signature is valid.
 *
 * `query` is the parsed query-string object from the GET request. The
 * signature is base64url-encoded, the message is the URL string with
 * everything stripped from `&signature=` onward.
 */
async function verifyAdMobSSV(query, rawQueryString) {
  if (!query.signature || !query.key_id) return false;

  // The signed content is the query-string portion BEFORE `&signature=...`.
  // AdMob signs the literal bytes the client received, so we can't
  // reconstruct from the parsed object — we need the raw string.
  const idx = rawQueryString.indexOf('&signature=');
  if (idx < 0) return false;
  const message = rawQueryString.slice(0, idx);

  let keys;
  try {
    keys = await fetchVerifierKeys();
  } catch (err) {
    console.warn('[admobSSV] could not fetch verifier keys:', err.message);
    return false;
  }

  const key = keys.find((k) => String(k.keyId) === String(query.key_id));
  if (!key || !key.pem) {
    console.warn(`[admobSSV] no matching key for key_id=${query.key_id}`);
    return false;
  }

  // AdMob signature is base64url (URL-safe alphabet, no padding). Convert
  // to standard base64 before passing to crypto.verify.
  const signature = Buffer.from(
    String(query.signature).replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  );

  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(message);
    verifier.end();
    return verifier.verify(key.pem, signature);
  } catch (err) {
    console.warn('[admobSSV] verify exception:', err.message);
    return false;
  }
}

module.exports = {
  verifyAdMobSSV,
  fetchVerifierKeys,
};
