const { getLeagueFixtures } = require('../services/apiFootball');

/**
 * GET /public/fixtures/upcoming
 * Public (no auth) — returns up to N upcoming fixtures across the
 * requested leagues, sorted by kickoff. Used by the iOS onboarding
 * "App Demo" screen to show real fixtures to a user who hasn't
 * created an account yet.
 *
 * Query:
 *   leagueIds=39,140,2   comma-separated API-Football league ids
 *   limit=3              max fixtures returned (default 3, max 10)
 *
 * Response: array of fixture-preview objects matching the shape used
 * by `/football/fixtures` (mapFixturePreview): fixtureId, date,
 * status, league {id,name,logo}, teams {home, away}.
 */
exports.upcomingFixtures = async (req, res) => {
  try {
    const raw = String(req.query.leagueIds || '').trim();
    // Default to a popular mix when no league filter is supplied so
    // the demo never shows an empty state — Liga MX (262), LaLiga
    // (140), Champions (2). Caller can override per onboarding pref.
    const ids = (raw ? raw.split(',') : ['262', '140', '2'])
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 6);
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 10);

    const now = Date.now();
    const lists = await Promise.all(
      ids.map((id) => getLeagueFixtures(id).catch(() => []))
    );
    const merged = [];
    for (const l of lists) merged.push(...(l || []));
    // Keep only fixtures whose kickoff is in the future (strict — we
    // don't want already-started matches in the demo since the user
    // can't make a meaningful prediction).
    const upcoming = merged.filter((fx) => {
      const ts = fx?.date ? Date.parse(fx.date) : NaN;
      return Number.isFinite(ts) && ts > now;
    });
    upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    res.json(upcoming.slice(0, limit));
  } catch (err) {
    console.error('[Public] upcomingFixtures error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
