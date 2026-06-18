const User = require('../models/User');
const ProcessedIAPTransaction = require('../models/ProcessedIAPTransaction');
const QuinielaEntry = require('../models/QuinielaEntry');
const BalanceTransaction = require('../models/BalanceTransaction');
const TicketTransaction = require('../models/TicketTransaction');
const Prediction = require('../models/Prediction');
const SweepstakesEntry = require('../models/SweepstakesEntry');
const DailyPickPrediction = require('../models/DailyPickPrediction');
const { decodeJWSPayload, getTransactionIds, getAmountForProductId } = require('../services/iapService');
const { applyDelta } = require('../services/transactionService');
const pushService = require('../services/pushService');
const { ADMIN_EMAILS } = require('../middleware/auth');
const { isSimpleMode } = require('../config/mode');

// Cap device tokens per user; one per device they install on. On overflow
// we evict the least-recently-seen so a user who reinstalls repeatedly
// can't grow the array unbounded.
const MAX_DEVICE_TOKENS = 5;

exports.getMe = async (req, res) => {
  try {
    const isAdmin = ADMIN_EMAILS.has((req.user.email || '').toLowerCase());
    const payload = {
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      isAdmin,
    };
    // simple_version drops the dual-currency UI entirely. The schema still
    // carries balance/tickets so legacy data stays intact (rollback-safe),
    // but exposing them would cause iOS/web clients in simple mode to
    // render dormant data they can't act on.
    if (!isSimpleMode()) {
      payload.balance = req.user.balance ?? 0;
      // Tickets v2.4 — exposed alongside balance so clients can render the
      // dual currency header in one round-trip.
      payload.tickets = req.user.tickets ?? 0;
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /users/me/onboarding — persist the answers captured during the
 * iOS pre-signup onboarding flow. Body shape:
 *   { goals: [string], pains: [string], leagues: [string],
 *     teams: [string], demoPicks: [{fixtureId, pick}] }
 *
 * Idempotent: re-posting overwrites the previous payload. Stamps
 * `completedAt` only the first time. Field-level: fields missing
 * from the body keep their previous value.
 */
exports.updateOnboarding = async (req, res) => {
  try {
    const { goals, pains, leagues, teams, demoPicks } = req.body || {};
    req.user.onboarding = req.user.onboarding || {};
    if (Array.isArray(goals))     req.user.onboarding.goals    = goals.map(String);
    if (Array.isArray(pains))     req.user.onboarding.pains    = pains.map(String);
    if (Array.isArray(leagues))   req.user.onboarding.leagues  = leagues.map(String);
    if (Array.isArray(teams))     req.user.onboarding.teams    = teams.map(String);
    if (Array.isArray(demoPicks)) {
      req.user.onboarding.demoPicks = demoPicks
        .filter((p) => p && Number.isFinite(Number(p.fixtureId)) && ['1', 'X', '2'].includes(String(p.pick)))
        .map((p) => ({ fixtureId: Number(p.fixtureId), pick: String(p.pick) }));
    }
    if (!req.user.onboarding.completedAt) {
      req.user.onboarding.completedAt = new Date();
    }
    req.user.markModified('onboarding');
    await req.user.save();
    res.json({ ok: true, onboarding: req.user.onboarding });
  } catch (err) {
    console.error('[Users] updateOnboarding error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { displayName } = req.body;
    if (displayName !== undefined) {
      req.user.displayName = (displayName ?? '').toString().trim();
    }
    await req.user.save();
    res.json({
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      balance: req.user.balance ?? 0,
      tickets: req.user.tickets ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /users/me/devices — register (or refresh) an APNs device token for
 * the authenticated user. Idempotent: re-posting the same token just bumps
 * `lastSeenAt` and updates the metadata. Body:
 *   { token, platform?, bundleId?, locale?, appVersion?, osVersion?, environment? }
 */
exports.registerDevice = async (req, res) => {
  try {
    const { token, platform, bundleId, locale, appVersion, osVersion, environment } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ message: 'token is required' });
    }
    const env = environment === 'sandbox' ? 'sandbox' : 'production';
    const now = new Date();
    req.user.deviceTokens = req.user.deviceTokens || [];
    const existing = req.user.deviceTokens.find((d) => d.token === token);
    if (existing) {
      existing.lastSeenAt = now;
      if (bundleId) existing.bundleId = bundleId;
      if (locale) existing.locale = locale;
      if (appVersion) existing.appVersion = appVersion;
      if (osVersion) existing.osVersion = osVersion;
      existing.environment = env;
    } else {
      req.user.deviceTokens.push({
        token,
        platform: platform || 'ios',
        bundleId: bundleId || '',
        locale: locale || 'en',
        appVersion: appVersion || '',
        osVersion: osVersion || '',
        environment: env,
        lastSeenAt: now,
        createdAt: now,
      });
    }
    if (req.user.deviceTokens.length > MAX_DEVICE_TOKENS) {
      req.user.deviceTokens.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
      req.user.deviceTokens = req.user.deviceTokens.slice(0, MAX_DEVICE_TOKENS);
    }
    req.user.markModified('deviceTokens');
    await req.user.save();
    res.json({ ok: true, deviceCount: req.user.deviceTokens.length });
  } catch (err) {
    console.error('[Users] registerDevice error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /users/me/devices/test — fire a test push at every device the
 * authenticated user has registered. Verifies the whole APNs pipeline
 * end-to-end from the device. Returns 503 if the server has no APNs key.
 */
exports.sendTestPush = async (req, res) => {
  try {
    if (!pushService.isConfigured()) {
      return res.status(503).json({ message: 'APNs not configured on the server' });
    }
    const result = await pushService.sendToUser(req.user._id, {
      title: 'FutPools',
      body: '🔔 Notificaciones activas. ¡Listo!',
      data: { type: 'test' },
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Users] sendTestPush error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /users/me — hard-delete the authenticated account and every record
 * that carries the user's id, so nothing personal survives. Required by
 * App Store Guideline 5.1.1(v) (in-app account deletion) and privacy-law
 * "right to erasure". Stripe charge history lives on Stripe's side; the
 * local QuinielaEntry rows (with their payment metadata) are removed here.
 * Best-effort per collection so one failure can't strand a half-deleted
 * account.
 */
exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const byUser = { user: userId };
    await Promise.allSettled([
      QuinielaEntry.deleteMany(byUser),
      BalanceTransaction.deleteMany(byUser),
      TicketTransaction.deleteMany(byUser),
      Prediction.deleteMany(byUser),
      SweepstakesEntry.deleteMany(byUser),
      DailyPickPrediction.deleteMany(byUser),
      ProcessedIAPTransaction.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Users] deleteMe error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /users/me/balance/recharge
 * Body: { signedTransaction: string } — JWS from StoreKit 2 Transaction
 * Validates transaction, ensures idempotency, adds balance.
 */
exports.rechargeBalance = async (req, res) => {
  try {
    const { signedTransaction } = req.body || {};
    if (!signedTransaction) {
      return res.status(400).json({ message: 'signedTransaction is required' });
    }

    const payload = decodeJWSPayload(signedTransaction);
    const ids = getTransactionIds(payload);
    if (!ids) {
      return res.status(400).json({ message: 'Invalid transaction data' });
    }

    const { productId, originalTransactionId } = ids;
    const amount = getAmountForProductId(productId);
    if (amount <= 0) {
      return res.status(400).json({ message: 'Unknown product' });
    }

    // Legacy idempotency table is preserved for audit continuity with older
    // receipts, but the ledger is now authoritative.
    const legacy = await ProcessedIAPTransaction.findOne({ originalTransactionId });
    if (legacy) {
      const user = await User.findById(req.user._id).select('balance').lean();
      return res.json({ balance: user?.balance ?? 0, alreadyProcessed: true });
    }

    const result = await applyDelta({
      userId: req.user._id,
      amount,
      kind: 'iap_credit',
      idempotencyKey: `iap:${originalTransactionId}`,
      note: `productId=${productId}`,
    });

    // Keep writing to the legacy table so ops dashboards that read it stay in
    // sync until we migrate them.
    if (result.applied) {
      try {
        await ProcessedIAPTransaction.create({
          originalTransactionId,
          userId: req.user._id,
          productId,
          amount,
        });
      } catch (e) {
        // Not fatal — the ledger is the source of truth now.
        if (e?.code !== 11000) console.warn('[IAP] legacy mirror failed:', e.message);
      }
    }

    const user = await User.findById(req.user._id).select('balance').lean();
    res.json({
      balance: user?.balance ?? 0,
      alreadyProcessed: result.alreadyProcessed === true,
    });
  } catch (err) {
    console.error('[IAP] recharge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
