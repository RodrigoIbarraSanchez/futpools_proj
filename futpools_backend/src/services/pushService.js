const http2 = require('http2');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── APNs sender (token-based auth, zero extra dependencies) ──────────────
// We talk to Apple's HTTP/2 gateway directly instead of pulling in a push
// library. Auth is a short-lived ES256 JWT signed with the .p8 key from
// the Apple Developer Portal (APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID).
//
// IMPORTANT (two-team setup): the App Store build ships under bundle
// `com.crypto-price-alert.crypto-price-alert` which belongs to Apple team
// 5UXBMT84FP. APNs auth keys are team-scoped, so APNS_TEAM_ID + APNS_KEY_*
// must come from THAT team. The `apns-topic` per push is taken from the
// token's stored `bundleId`, so the same backend can also serve the
// `com.futpools.futpoolsapp` build if you ever add a second key.

let cachedJwt = null;
let cachedJwtAt = 0;
// APNs rejects provider tokens older than 60 min and throttles if you mint
// a fresh one per request, so we cache and refresh comfortably under the cap.
const JWT_TTL_MS = 50 * 60 * 1000;

// Render and most secret stores collapse the .p8 newlines into the literal
// two characters "\n". jsonwebtoken needs real newlines in the PEM body.
function normalizeKey(raw) {
  return (raw || '').replace(/\\n/g, '\n').trim();
}

function isConfigured() {
  return !!normalizeKey(process.env.APNS_KEY_P8) &&
    !!process.env.APNS_KEY_ID &&
    !!process.env.APNS_TEAM_ID;
}

function providerToken() {
  const now = Date.now();
  if (cachedJwt && now - cachedJwtAt < JWT_TTL_MS) return cachedJwt;
  const key = normalizeKey(process.env.APNS_KEY_P8);
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) {
    throw new Error('APNs not configured (APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID)');
  }
  cachedJwt = jwt.sign(
    { iss: teamId, iat: Math.floor(now / 1000) },
    key,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId } }
  );
  cachedJwtAt = now;
  return cachedJwt;
}

function gatewayHost(environment) {
  // sandbox = Xcode dev build + TestFlight; production = App Store build.
  return environment === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
}

// Build the standard alert payload. Extra `data` keys ride alongside `aps`
// so the app can route a tap (e.g. { type: 'pool', poolId: '...' }).
function buildPayload({ title, body, badge, sound = 'default', data = {} }) {
  const aps = { alert: { title, body }, sound };
  if (typeof badge === 'number') aps.badge = badge;
  return { aps, ...data };
}

// Send one notification to one device token. Resolves with
// { ok, status, reason } — APNs-level rejections (bad token, etc.) resolve
// rather than throw; only transport failures reject.
function sendToToken({ token, bundleId, environment }, payload) {
  return new Promise((resolve, reject) => {
    let authToken;
    try {
      authToken = providerToken();
    } catch (e) {
      return reject(e);
    }
    const client = http2.connect(gatewayHost(environment));
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { client.close(); } catch (_) {}
      reject(err);
    };
    client.on('error', fail);

    const body = Buffer.from(JSON.stringify(payload));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${authToken}`,
      'apns-topic': bundleId || process.env.APNS_BUNDLE_ID || '',
      'apns-push-type': 'alert',
      'content-type': 'application/json',
      'content-length': body.length,
    });

    let status = 0;
    let data = '';
    req.on('response', (headers) => { status = headers[':status']; });
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { client.close(); } catch (_) {}
      let reason = '';
      if (data) {
        try { reason = JSON.parse(data).reason || ''; } catch (_) {}
      }
      resolve({ ok: status === 200, status, reason });
    });
    req.on('error', fail);
    req.write(body);
    req.end();
  });
}

// Fan a notification out to every device a user has registered. Honors the
// user's global push kill switch and prunes tokens APNs reports as dead
// (400 BadDeviceToken / 410 Unregistered) so the array self-heals.
async function sendToUser(userId, notification) {
  const user = await User.findById(userId).select('deviceTokens notificationPrefs');
  if (!user) return { sent: 0, pruned: 0, reason: 'user_not_found' };
  if (user.notificationPrefs && user.notificationPrefs.globalEnabled === false) {
    return { sent: 0, pruned: 0, reason: 'muted' };
  }
  const tokens = user.deviceTokens || [];
  if (!tokens.length) return { sent: 0, pruned: 0, reason: 'no_tokens' };

  const payload = buildPayload(notification);
  const dead = [];
  let sent = 0;
  for (const t of tokens) {
    try {
      const res = await sendToToken(
        { token: t.token, bundleId: t.bundleId, environment: t.environment },
        payload
      );
      if (res.ok) {
        sent += 1;
      } else if (res.status === 410 || res.reason === 'BadDeviceToken' || res.reason === 'Unregistered') {
        dead.push(t.token);
      } else {
        console.warn(`[push] ${String(t.token).slice(0, 8)}… rejected: ${res.status} ${res.reason}`);
      }
    } catch (e) {
      console.warn(`[push] transport error for ${String(t.token).slice(0, 8)}…: ${e.message}`);
    }
  }
  if (dead.length) {
    await User.updateOne(
      { _id: userId },
      { $pull: { deviceTokens: { token: { $in: dead } } } }
    );
  }
  return { sent, pruned: dead.length };
}

module.exports = { sendToUser, sendToToken, buildPayload, isConfigured };
