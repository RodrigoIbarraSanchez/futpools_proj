const { getLeagueFixtures, getFixturesByDate, getFixturePrediction, mapFixturePreview } = require('../services/apiFootball');
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
 * GET /public/payment-config
 * Public (no auth) — which manual payment channels are available, so the
 * pick screen only offers PayPal when it's actually configured. Exposes
 * NO account details (those come with the payment intent, post-auth).
 */
const { getSpeiConfig, getPaypalConfig } = require('../services/poolPaymentService');

exports.paymentConfig = (req, res) => {
  const spei = getSpeiConfig();
  const paypal = getPaypalConfig();
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    spei: { enabled: !!spei.clabe },
    paypal: { enabled: paypal.enabled, amountUSD: paypal.entryUSD },
  });
};

/**
 * GET /public/fixtures/today
 * Public (no auth) — today's fixtures (Mexico City calendar day) across a
 * curated league set, queried BY DATE so it works regardless of the
 * configured API_FOOTBALL_SEASON (e.g. World Cup 2026 while the env is
 * still on the 2025 club season). Powers the dynamic "Partidos de hoy"
 * module on the /pronosticos-futbol-hoy SEO landing.
 *
 * Order: upcoming first (soonest kickoff), then live, then finished —
 * the page is about matches you can still predict. Cached 10 min (the
 * by-date API call returns every fixture worldwide; don't hammer it).
 */
const TODAY_PRIORITY_LEAGUES = new Set([
  1,    // FIFA World Cup
  262,  // Liga MX
  263,  // Liga de Expansión MX
  2,    // UEFA Champions League
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A
  78,   // Bundesliga
  61,   // Ligue 1
  253,  // MLS
  71,   // Brasileirao
]);
let todayCache = { key: '', data: null, at: 0 };
const TODAY_TTL_MS = 10 * 60 * 1000;

exports.todayFixtures = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 12);
    // "Today" on the product's home clock, not the server's (UTC).
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    const cacheKey = `${date}:${limit}`;
    if (todayCache.key === cacheKey && Date.now() - todayCache.at < TODAY_TTL_MS) {
      res.set('Cache-Control', 'public, max-age=300');
      return res.json(todayCache.data);
    }

    const raw = await getFixturesByDate(date, 'America/Mexico_City');
    let pool = raw.filter((f) => TODAY_PRIORITY_LEAGUES.has(f?.league?.id));
    // Only when NO priority league plays today fall back to the full feed
    // (otherwise 2 World Cup matches would drown in 160 minor-league ones).
    if (pool.length === 0) pool = raw;

    const FINISHED = new Set(['FT', 'AET', 'PEN']);
    const rank = (f) => {
      const s = String(f?.fixture?.status?.short || '').toUpperCase();
      if (FINISHED.has(s)) return 2;     // finished last
      if (s && s !== 'NS' && s !== 'TBD') return 1; // live in the middle
      return 0;                          // upcoming first
    };
    pool.sort((a, b) => rank(a) - rank(b)
      || new Date(a?.fixture?.date) - new Date(b?.fixture?.date));

    const out = pool.slice(0, limit).map(mapFixturePreview);
    // Enrich with the provider's statistical L/E/V prediction (one call per
    // fixture, amortized by the 10-min cache; null when unavailable). The
    // landing renders these as orientative percentages with a disclaimer —
    // never as betting advice.
    const predictions = await Promise.all(out.map((f) => getFixturePrediction(f.fixtureId)));
    out.forEach((f, i) => { f.prediction = predictions[i]; });
    todayCache = { key: cacheKey, data: out, at: Date.now() };
    res.set('Cache-Control', 'public, max-age=300');
    res.json(out);
  } catch (err) {
    console.error('[Public] todayFixtures error:', err.message);
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
