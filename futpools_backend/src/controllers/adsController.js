const BalanceTransaction = require('../models/BalanceTransaction');
const TicketTransaction = require('../models/TicketTransaction');
const User = require('../models/User');
const { applyDelta } = require('../services/transactionService');
const { applyTicketDelta } = require('../services/ticketService');
const { verifyAdMobSSV } = require('../services/admobSSV');

// Phase-2 economics: how many rewarded videos a user can claim per day, and
// what each one pays. Numbers picked to cap inflation — 50 coins/day is
// meaningful for small coin pools (5 entries at 10 coins) but won't dent IAP
// demand for mid/high coin pools.
const DAILY_CAP = 5;
const REWARD_PER_WATCH = 10;

/**
 * POST /ads/rewarded-watched
 * Body: { transactionId: string, adUnit?: string, signature?: string, keyId?: string, timestamp?: string }
 *
 * For production we must verify the signature against Google AdMob's public
 * keys (fetched from googleads.g.doubleclick.net/mobileads/gamertag/...).
 * This MVP accepts unverified tokens with the idempotency guard — same
 * posture as the IAP JWS decoder during dev — but the shape is already
 * correct for the verified path. A production deployment MUST verify before
 * crediting.
 */
exports.rewardedWatched = async (req, res) => {
  try {
    const transactionId = String(req.body?.transactionId || '').trim();
    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' });
    }

    // Daily cap: count today's ads_credit rows for this user. Reset at local
    // midnight UTC — good enough for Phase 2; revisit with timezone-aware
    // windows once we have geo data.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await BalanceTransaction.countDocuments({
      user: req.user._id,
      kind: 'ads_credit',
      createdAt: { $gte: startOfDay },
    });

    if (todayCount >= DAILY_CAP) {
      return res.status(429).json({
        message: 'Daily rewarded video cap reached',
        code: 'DAILY_CAP_REACHED',
        cap: DAILY_CAP,
        watchedToday: todayCount,
      });
    }

    const result = await applyDelta({
      userId: req.user._id,
      amount: REWARD_PER_WATCH,
      kind: 'ads_credit',
      idempotencyKey: `ads:${transactionId}`,
      note: `Rewarded video (adUnit=${req.body?.adUnit || 'unknown'})`,
    });

    const user = await User.findById(req.user._id).select('balance').lean();
    res.json({
      ok: true,
      balance: user?.balance ?? 0,
      alreadyProcessed: result.alreadyProcessed === true,
      reward: REWARD_PER_WATCH,
      watchedToday: todayCount + (result.applied ? 1 : 0),
      cap: DAILY_CAP,
    });
  } catch (err) {
    console.error('[ads] rewardedWatched error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Tickets economy — rewarded ads (v2.4)
// ─────────────────────────────────────────────────────────────────────
//
// Two paths into Ticket credit:
//   1. /ads/admob/ssv-callback — production. AdMob server hits this with
//      a signed callback when a user finishes watching a rewarded ad.
//      We verify the signature against Google's rotating public keys,
//      parse our `user_id` custom data, and credit +1 Ticket. Idempotency
//      key is the AdMob `transaction_id`.
//   2. /ads/ticket-rewarded/dev-credit — dev only. Bypasses SSV so the
//      iOS app can be tested in DEBUG/simulator without wiring real
//      AdMob credentials. Disabled in production via NODE_ENV check.
//
// Per v2.4 there is NO daily cap on ad views. AdMob's own frequency
// capping handles abuse. If telemetry shows ad farming, add a cap
// reactively.

/**
 * GET /ads/admob/ssv-callback — Google AdMob SSV endpoint.
 *
 * Query params from AdMob: ad_network, ad_unit, reward_amount,
 * reward_item, timestamp, transaction_id, user_id (our custom_data),
 * signature, key_id.
 *
 * IMPORTANT: this endpoint is NOT auth-protected — AdMob calls it from
 * Google's servers, not from a logged-in user. We trust the signature,
 * not a JWT. The `user_id` in custom_data tells us who to credit.
 */
exports.admobSSVCallback = async (req, res) => {
  try {
    const valid = await verifyAdMobSSV(req.query, req.url.split('?')[1] || '');
    if (!valid) {
      console.warn('[ads/SSV] invalid signature, refusing credit', {
        transaction_id: req.query.transaction_id,
        key_id: req.query.key_id,
      });
      // Return 200 anyway so AdMob doesn't retry forever — but credit
      // nothing. Returning 4xx makes AdMob mark the callback as failed
      // and we'd flood logs on a key-rotation race.
      return res.status(200).send('invalid');
    }

    const userId = req.query.user_id;
    const transactionId = req.query.transaction_id;
    if (!userId || !transactionId) {
      return res.status(200).send('missing user_id or transaction_id');
    }

    // +1 Ticket per ad. v2.4 sets the reward at the platform level, not
    // per-ad-unit, so we ignore reward_amount/reward_item from AdMob.
    const result = await applyTicketDelta({
      userId,
      amount: 1,
      kind: 'ad_credit',
      idempotencyKey: `ticket:ad:${userId}:${transactionId}`,
      note: `AdMob SSV (ad_unit=${req.query.ad_unit || 'unknown'})`,
    });

    if (result.applied || result.alreadyProcessed) {
      return res.status(200).send('ok');
    }
    return res.status(200).send('not applied');
  } catch (err) {
    console.error('[ads/SSV] error:', err.message);
    res.status(200).send('error');
  }
};

/**
 * POST /ads/ticket-rewarded/dev-credit — DEV-ONLY shortcut.
 *
 * Lets the iOS dev build credit a Ticket without wiring real AdMob (which
 * requires AdMob account + app IDs + ad units). Disabled when
 * NODE_ENV === 'production' so it can never be hit on Render.
 *
 * Body: { transactionId: string }  — caller-generated unique id (e.g. UUID)
 */
exports.devCreditTicket = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Dev endpoint disabled in production' });
    }
    const transactionId = String(req.body?.transactionId || '').trim();
    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' });
    }

    const result = await applyTicketDelta({
      userId: req.user._id,
      amount: 1,
      kind: 'ad_credit',
      idempotencyKey: `ticket:ad:${req.user._id}:${transactionId}`,
      note: 'DEV rewarded ad simulation',
    });

    const user = await User.findById(req.user._id).select('tickets').lean();
    res.json({
      ok: true,
      tickets: user?.tickets ?? 0,
      alreadyProcessed: result.alreadyProcessed === true,
    });
  } catch (err) {
    console.error('[ads] devCreditTicket error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /ads/rewarded-status — how many ad rewards are left today.
 */
exports.rewardedStatus = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await BalanceTransaction.countDocuments({
      user: req.user._id,
      kind: 'ads_credit',
      createdAt: { $gte: startOfDay },
    });
    res.json({
      cap: DAILY_CAP,
      watchedToday: todayCount,
      remaining: Math.max(0, DAILY_CAP - todayCount),
      rewardPerWatch: REWARD_PER_WATCH,
    });
  } catch (err) {
    console.error('[ads] rewardedStatus error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
