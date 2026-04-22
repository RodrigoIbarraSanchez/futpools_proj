const BalanceTransaction = require('../models/BalanceTransaction');
const User = require('../models/User');
const { applyDelta } = require('../services/transactionService');

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
