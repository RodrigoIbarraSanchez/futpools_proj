const User = require('../models/User');
const { tierForRating } = require('./ratingController');

// Admin/demo accounts never appear in the global ranking. They exist to run
// the platform (create Platform Events, mint coins, etc.) and their activity
// would skew leaderboards. Kept in lock-step with middleware/auth.js.
const EXCLUDED_FROM_LEADERBOARD = ['demo@futpools.app', 'admin@futpools.app'];
const LEADERBOARD_FILTER = { email: { $nin: EXCLUDED_FROM_LEADERBOARD } };

/**
 * Global leaderboard by rating. Returns top N players with tier + basic stats
 * so the UI can render the FutPools Rank screen without a second round trip.
 *
 *   GET /leaderboard/global?top=100&offset=0
 *
 * Window is accepted but ignored for now — seasonal decay lives in a future
 * batch job. The endpoint always returns lifetime rating for Phase 1.
 */
exports.getGlobalLeaderboard = async (req, res) => {
  try {
    const top = Math.min(Math.max(Number(req.query.top) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const projection = 'username displayName rating ratingPeak poolsPlayed poolsWon streakBest picksCorrect picksTotal';
    // Include every registered user EXCEPT admin/demo accounts — they run the
    // platform and shouldn't compete in rankings. New players show up at the
    // default rating; active players rise because rating climbs only by playing.
    const users = await User.find(LEADERBOARD_FILTER)
      .select(projection)
      .sort({ rating: -1, ratingPeak: -1, poolsWon: -1, createdAt: 1 })
      .skip(offset)
      .limit(top)
      .lean();

    const rows = users.map((u, idx) => {
      const tier = tierForRating(u.rating);
      const picksTotal = u.picksTotal || 0;
      return {
        rank: offset + idx + 1,
        userId: String(u._id),
        username: u.username,
        displayName: u.displayName,
        rating: Math.round(u.rating ?? 1000),
        ratingPeak: Math.round(u.ratingPeak ?? 1000),
        tier: tier.code,
        tierName: tier.name,
        poolsPlayed: u.poolsPlayed ?? 0,
        poolsWon: u.poolsWon ?? 0,
        streakBest: u.streakBest ?? 0,
        winRate: picksTotal > 0 ? (u.picksCorrect || 0) / picksTotal : 0,
      };
    });

    const totalCount = await User.countDocuments(LEADERBOARD_FILTER);
    res.json({ leaderboard: rows, totalCount });
  } catch (err) {
    console.error('[leaderboard] global error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** My own leaderboard snapshot — rank + tier + stats in one call. */
exports.getMyRankSummary = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select('rating ratingPeak streakCurrent streakBest poolsPlayed poolsWon poolsTop3 picksCorrect picksTotal achievements')
      .lean();
    if (!me) return res.status(404).json({ message: 'Not found' });

    // Count users with strictly higher rating for a live rank estimate,
    // ignoring admin/demo accounts (they're excluded from the global list
    // above — rank numbers must match between endpoints).
    const rank = await User.countDocuments({
      ...LEADERBOARD_FILTER,
      rating: { $gt: me.rating ?? 1000 },
    }) + 1;
    const tier = tierForRating(me.rating);
    const picksTotal = me.picksTotal || 0;

    res.json({
      rank,
      rating: Math.round(me.rating ?? 1000),
      ratingPeak: Math.round(me.ratingPeak ?? 1000),
      tier: tier.code,
      tierName: tier.name,
      tierMin: tier.min,
      tierMax: tier.max,
      streakCurrent: me.streakCurrent ?? 0,
      streakBest: me.streakBest ?? 0,
      poolsPlayed: me.poolsPlayed ?? 0,
      poolsWon: me.poolsWon ?? 0,
      poolsTop3: me.poolsTop3 ?? 0,
      picksCorrect: me.picksCorrect ?? 0,
      picksTotal,
      winRate: picksTotal > 0 ? (me.picksCorrect || 0) / picksTotal : 0,
      achievements: me.achievements || [],
    });
  } catch (err) {
    console.error('[leaderboard] myRankSummary error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
