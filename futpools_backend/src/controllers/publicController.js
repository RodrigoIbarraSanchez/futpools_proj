const { getLeagueFixtures } = require('../services/apiFootball');
const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const { computePoolStatus } = require('./quinielaController');

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

/**
 * GET /public/pools/next-open
 * Public (no auth) — returns the public pool that is still open for
 * registration (no fixture has kicked off yet) whose first match starts
 * soonest. Powers the dynamic CTA on the /pronosticos-de-futbol SEO
 * landing: pool open → CTA deep-links to /pool/:id; nothing open →
 * `{ pool: null }` and the landing falls back to /onboarding.
 *
 * 200 + { pool: null } on the empty state (not 404): "no open pool" is a
 * normal weekly condition, and the web client treats >=400 as an error.
 */
let nextOpenCache = { data: null, at: 0 };
const NEXT_OPEN_TTL_MS = 60 * 1000;

exports.nextOpenPool = async (req, res) => {
  try {
    const now = new Date();
    if (nextOpenCache.data && now - nextOpenCache.at < NEXT_OPEN_TTL_MS) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(nextOpenCache.data);
    }

    // "Registration open" === no fixture has started. The $not+$elemMatch
    // expresses "min(kickoff) > now" — a plain `fixtures.kickoff > now`
    // would also match live pools whose later matches are still upcoming.
    const candidates = await Quiniela.find({
      visibility: 'public',
      cancelledAt: null,
      'fixtures.0': { $exists: true },
      fixtures: { $not: { $elemMatch: { kickoff: { $lte: now } } } },
    })
      .select('name fixtures.kickoff fixtures.status fixtures.fixtureId entryFeeMXN currency prizeLabel')
      .lean();

    const firstKickoffOf = (q) =>
      Math.min(...q.fixtures.map((f) => new Date(f.kickoff).getTime()));
    candidates.sort((a, b) => firstKickoffOf(a) - firstKickoffOf(b));

    // Defensive re-check against the canonical status function (no live
    // status map needed: every kickoff is in the future by the query).
    const open = candidates.find((q) => computePoolStatus(q.fixtures, null) === 'scheduled');

    let payload = { pool: null };
    if (open) {
      const entriesCount = await QuinielaEntry.countDocuments({ quiniela: open._id });
      payload = {
        pool: {
          id: String(open._id),
          name: open.name,
          firstKickoff: new Date(firstKickoffOf(open)).toISOString(),
          entriesCount,
          entryFeeMXN: open.entryFeeMXN,
          currency: open.currency || 'MXN',
        },
      };
    }
    nextOpenCache = { data: payload, at: now };
    res.set('Cache-Control', 'public, max-age=60');
    res.json(payload);
  } catch (err) {
    console.error('[Public] nextOpenPool error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
