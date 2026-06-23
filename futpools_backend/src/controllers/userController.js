const User = require('../models/User');
const ProcessedIAPTransaction = require('../models/ProcessedIAPTransaction');
const QuinielaEntry = require('../models/QuinielaEntry');
const BalanceTransaction = require('../models/BalanceTransaction');
const CreditTransaction = require('../models/CreditTransaction');
const TicketTransaction = require('../models/TicketTransaction');
const Prediction = require('../models/Prediction');
const SweepstakesEntry = require('../models/SweepstakesEntry');
const DailyPickPrediction = require('../models/DailyPickPrediction');
const { decodeJWSPayload, getTransactionIds, getAmountForProductId } = require('../services/iapService');
const { applyDelta } = require('../services/transactionService');
const creditService = require('../services/creditService');
const brevoService = require('../services/brevoService');
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

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RX = /^[a-z0-9_.]{3,20}$/;

/**
 * PUT /users/me — update profile fields.
 *
 * displayName can change freely. email and username are login identifiers and
 * unique, so changing EITHER requires the account's current password (guards
 * against a leaked/stolen token silently taking over the account). Fields not
 * present in the body are left untouched. Returns the same shape as getMe
 * (incl. isAdmin) so the client can refresh state — note isAdmin can flip when
 * the email moves in/out of the ADMIN_EMAILS allowlist.
 */
exports.updateMe = async (req, res) => {
  try {
    const { displayName, username, email, currentPassword } = req.body || {};
    // Reload WITH password (auth middleware selected it out) so we can verify
    // currentPassword for sensitive changes.
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (displayName !== undefined) {
      const dn = (displayName ?? '').toString().trim();
      if (dn.length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters', code: 'NAME_TOO_SHORT', field: 'displayName' });
      }
      user.displayName = dn;
    }

    const newEmail = email !== undefined ? String(email).trim().toLowerCase() : null;
    const newUsername = username !== undefined ? String(username).trim().toLowerCase() : null;
    const wantsEmail = newEmail !== null && newEmail !== user.email;
    const wantsUsername = newUsername !== null && newUsername !== user.username;

    // Sensitive change → require the current password.
    if (wantsEmail || wantsUsername) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Enter your current password to change your email or username', code: 'PASSWORD_REQUIRED', field: 'currentPassword' });
      }
      const ok = await user.comparePassword(currentPassword);
      if (!ok) {
        return res.status(400).json({ message: 'Current password is incorrect', code: 'INVALID_PASSWORD', field: 'currentPassword' });
      }
    }

    if (wantsUsername) {
      if (!USERNAME_RX.test(newUsername)) {
        return res.status(400).json({ message: 'Username must be 3-20 chars (letters, numbers, _ or .)', code: 'INVALID_USERNAME', field: 'username' });
      }
      const taken = await User.findOne({ username: newUsername, _id: { $ne: user._id } }).select('_id').lean();
      if (taken) {
        return res.status(400).json({ message: 'That username is already taken', code: 'USERNAME_TAKEN', field: 'username' });
      }
      user.username = newUsername;
    }

    if (wantsEmail) {
      if (!EMAIL_RX.test(newEmail)) {
        return res.status(400).json({ message: 'Enter a valid email', code: 'INVALID_EMAIL', field: 'email' });
      }
      const taken = await User.findOne({ email: newEmail, _id: { $ne: user._id } }).select('_id').lean();
      if (taken) {
        return res.status(400).json({ message: 'An account with this email already exists', code: 'EMAIL_EXISTS', field: 'email' });
      }
      user.email = newEmail;
    }

    try {
      await user.save();
    } catch (err) {
      // Unique-index race (two saves collided between our check and write).
      if (err && err.code === 11000) {
        const field = err.keyPattern && err.keyPattern.username ? 'username' : 'email';
        const code = field === 'username' ? 'USERNAME_TAKEN' : 'EMAIL_EXISTS';
        return res.status(400).json({ message: `That ${field} is already in use`, code, field });
      }
      throw err;
    }

    // Keep the Brevo contact in sync when the email changed (best-effort).
    if (wantsEmail) {
      brevoService.upsertContact({ email: user.email, displayName: user.displayName, locale: 'es' })
        .catch((e) => console.warn('[Users] brevo contact sync failed:', e.message));
    }

    const isAdmin = ADMIN_EMAILS.has((user.email || '').toLowerCase());
    res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      isAdmin,
      balance: user.balance ?? 0,
      tickets: user.tickets ?? 0,
    });
  } catch (err) {
    console.error('[Users] updateMe error:', err.message);
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
      CreditTransaction.deleteMany(byUser),
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
 * GET /users/me/credit
 * Returns the user's available MXN store-credit so the client can show
 * "your entry will be covered by credit" before they join a pool.
 */
exports.getMyCredit = async (req, res) => {
  try {
    const availableMXN = await creditService.getAvailableCredit(req.user._id);
    res.json({ availableMXN });
  } catch (err) {
    console.error('[Users] getMyCredit error:', err.message);
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
