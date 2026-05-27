/**
 * FIFA World Cup 2026 fixtures + teams provider.
 *
 * Backs the /calendariomundial2026 page: gives the frontend the team
 * roster (for the "my teams" picker) and the full match list so it can
 * build an .ics calendar feed.
 *
 * Source: api-football league=1 (World Cup), season=2026. Cached
 * aggressively because the schedule is essentially static once the
 * draw is complete — kickoffs and stadiums don't shift more than
 * once a day.
 */

const API_BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '';
const LEAGUE_ID = Number(process.env.WORLD_CUP_2026_LEAGUE_ID || 1);
const SEASON = Number(process.env.WORLD_CUP_2026_SEASON || 2026);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — schedule is static post-draw
const cache = { fixtures: null, at: 0 };

const fetchFn = global.fetch;

const apiFetch = async (path, params = {}) => {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY is not configured');
  if (!fetchFn) throw new Error('Global fetch is not available. Please run on Node 18+.');
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetchFn(url.toString(), {
    headers: { 'x-apisports-key': API_KEY, accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Football error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

const STAGE_GROUP = 'group';
const STAGE_KO = 'knockout';

const classifyStage = (round) => {
  const r = String(round || '').toLowerCase();
  if (r.includes('group')) return { stage: STAGE_GROUP, label: round };
  if (
    r.includes('round of 32') ||
    r.includes('round of 16') ||
    r.includes('quarter') ||
    r.includes('semi') ||
    r.includes('final') ||
    r.includes('3rd place') ||
    r.includes('third place')
  ) {
    return { stage: STAGE_KO, label: round };
  }
  // api-football sometimes labels group games as "1st Round" early on.
  return { stage: STAGE_GROUP, label: round };
};

const mapFixture = (f) => {
  const stage = classifyStage(f?.league?.round);
  return {
    fixtureId: f?.fixture?.id ?? null,
    date: f?.fixture?.date || null,
    timestamp: f?.fixture?.timestamp || null,
    venue: {
      name: f?.fixture?.venue?.name || null,
      city: f?.fixture?.venue?.city || null,
    },
    status: {
      short: f?.fixture?.status?.short || null,
      long: f?.fixture?.status?.long || null,
    },
    stage: stage.stage,
    round: stage.label,
    teams: {
      home: {
        id: f?.teams?.home?.id ?? null,
        name: f?.teams?.home?.name || 'TBD',
        logo: f?.teams?.home?.logo || null,
      },
      away: {
        id: f?.teams?.away?.id ?? null,
        name: f?.teams?.away?.name || 'TBD',
        logo: f?.teams?.away?.logo || null,
      },
    },
    score: {
      home: f?.goals?.home ?? null,
      away: f?.goals?.away ?? null,
    },
  };
};

/**
 * FIFA's official knockout schedule for the 2026 World Cup. api-football
 * doesn't publish these slots until the groups are decided, but users
 * who subscribe NOW expect to see the bracket on their calendar. Each
 * entry is rendered as a fixture with a generic team name like "Octavos
 * — Partido X"; the SUMMARY builder upstream substitutes ⚽ for the
 * country-flag emoji when the team name doesn't match a real country.
 *
 * Format: { date (ISO UTC), round, matchNumber, homeLabel, awayLabel,
 *   venue?, city? }
 *
 * Dates use the FIFA-announced kickoff windows (Feb 2024 schedule).
 * Times are placeholders — we use 18:00 local for late-round matches
 * (Final is 15:00 ET to match FIFA's intent) so display sorting works.
 */
const KNOCKOUT_FIXTURES = (() => {
  const out = [];
  let n = 73; // FIFA match-number sequence begins at 73 after group stage (72 matches).

  const add = (iso, round, homeLabel, awayLabel, venue = null, city = null) => {
    out.push({
      fixtureId: 9000000 + n, // synthetic IDs out of api-football's range
      date: iso,
      timestamp: Math.floor(new Date(iso).getTime() / 1000),
      venue: { name: venue, city },
      status: { short: null, long: null },
      stage: 'knockout',
      round,
      teams: {
        home: { id: null, name: homeLabel, logo: null },
        away: { id: null, name: awayLabel, logo: null },
      },
      score: { home: null, away: null },
    });
    n += 1;
  };

  // ── ROUND OF 32 (16 matches, Jun 27 – Jul 3) ──
  // R32 slot names follow FIFA's bracket notation: 1A = Group A winner,
  // 2A = Group A runner-up, 3X = best third-placed team via tiebreak.
  const R32 = [
    ['2026-06-27T20:00:00Z', '1A', '2C'],
    ['2026-06-27T23:00:00Z', '1C', '3D/E/F'],
    ['2026-06-28T20:00:00Z', '1B', '3A/D/E/F'],
    ['2026-06-28T23:00:00Z', '1F', '3A/B/C'],
    ['2026-06-29T19:00:00Z', '2D', '2E'],
    ['2026-06-29T23:00:00Z', '1G', '3C/E/F/H'],
    ['2026-06-30T19:00:00Z', '1E', '3A/B/C/D'],
    ['2026-06-30T23:00:00Z', '1H', '3D/E/F/G'],
    ['2026-07-01T19:00:00Z', '1L', '2I'],
    ['2026-07-01T23:00:00Z', '1J', '3B/D/E/I'],
    ['2026-07-02T19:00:00Z', '1D', '3B/E/F/I'],
    ['2026-07-02T23:00:00Z', '2H', '2J'],
    ['2026-07-02T03:00:00Z', '2A', '2L'],
    ['2026-07-03T19:00:00Z', '1I', '3C/D/G/H'],
    ['2026-07-03T23:00:00Z', '1K', '2G'],
    ['2026-07-04T01:00:00Z', '2B', '2K'],
  ];
  R32.forEach(([iso, home, away]) => {
    add(iso, 'Round of 32', home, away);
  });

  // ── ROUND OF 16 (8 matches, Jul 4 – Jul 7) ──
  // R16 winners are described by the R32 match numbers they came from.
  const R16 = [
    ['2026-07-04T20:00:00Z', 'W73', 'W74'],
    ['2026-07-04T23:00:00Z', 'W75', 'W76'],
    ['2026-07-05T20:00:00Z', 'W77', 'W78'],
    ['2026-07-05T23:00:00Z', 'W79', 'W80'],
    ['2026-07-06T20:00:00Z', 'W81', 'W82'],
    ['2026-07-06T23:00:00Z', 'W83', 'W84'],
    ['2026-07-07T20:00:00Z', 'W85', 'W86'],
    ['2026-07-07T23:00:00Z', 'W87', 'W88'],
  ];
  R16.forEach(([iso, home, away]) => {
    add(iso, 'Round of 16', home, away);
  });

  // ── QUARTER-FINALS (4 matches, Jul 9 – Jul 11) ──
  const QF = [
    ['2026-07-09T22:00:00Z', 'W89', 'W90'],
    ['2026-07-10T22:00:00Z', 'W91', 'W92'],
    ['2026-07-11T18:00:00Z', 'W93', 'W94'],
    ['2026-07-11T22:00:00Z', 'W95', 'W96'],
  ];
  QF.forEach(([iso, home, away]) => {
    add(iso, 'Quarter-Final', home, away);
  });

  // ── SEMI-FINALS (2 matches, Jul 14 – Jul 15) ──
  add('2026-07-14T23:00:00Z', 'Semi-Final', 'W97', 'W98', 'AT&T Stadium', 'Dallas');
  add('2026-07-15T23:00:00Z', 'Semi-Final', 'W99', 'W100', 'Mercedes-Benz Stadium', 'Atlanta');

  // ── THIRD-PLACE PLAYOFF (Jul 18) ──
  add('2026-07-18T18:00:00Z', 'Third-Place Play-off', 'L101', 'L102', 'Hard Rock Stadium', 'Miami');

  // ── FINAL (Jul 19, MetLife Stadium) ──
  add('2026-07-19T19:00:00Z', 'Final', 'W101', 'W102', 'MetLife Stadium', 'East Rutherford');

  return out;
})();

const fetchAllFixtures = async () => {
  if (cache.fixtures && Date.now() - cache.at < CACHE_TTL_MS) return cache.fixtures;
  const data = await apiFetch('/fixtures', { league: LEAGUE_ID, season: SEASON });
  const groupFixtures = (data?.response || []).map(mapFixture);

  // Drop hardcoded knockout slots if api-football has started publishing
  // real knockout fixtures (keyed by stage). Otherwise append ours so
  // the calendar covers all 104 matches from day one.
  const hasRealKnockout = groupFixtures.some((f) => f.stage === 'knockout');
  const fixtures = hasRealKnockout
    ? groupFixtures
    : [...groupFixtures, ...KNOCKOUT_FIXTURES];

  fixtures.sort((a, b) => {
    const ta = a.timestamp || 0;
    const tb = b.timestamp || 0;
    if (ta !== tb) return ta - tb;
    return (a.fixtureId || 0) - (b.fixtureId || 0);
  });
  cache.fixtures = fixtures;
  cache.at = Date.now();
  return fixtures;
};

/**
 * Returns the 48 participating teams in alphabetical order, with logos.
 * Derived from the fixtures list (teams appear as home/away across the
 * group stage). Knockout TBD slots are filtered out.
 */
const getTeams = async () => {
  const fixtures = await fetchAllFixtures();
  const map = new Map();
  for (const f of fixtures) {
    for (const side of ['home', 'away']) {
      const t = f.teams[side];
      if (!t?.id || !t.name || t.name === 'TBD') continue;
      if (!map.has(t.id)) map.set(t.id, { id: t.id, name: t.name, logo: t.logo });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
};

/**
 * Filter the full fixture list according to user selection.
 *   scope = 'all'        → every match (104)
 *   scope = 'teams'      → only matches where one of teamIds plays
 *   scope = 'teams+ko'   → matches where one of teamIds plays + every knockout fixture
 */
const filterFixtures = (fixtures, { scope, teamIds }) => {
  const ids = new Set((teamIds || []).map((n) => Number(n)).filter(Boolean));
  if (scope === 'all' || !ids.size) return fixtures;
  return fixtures.filter((f) => {
    const inTeams =
      ids.has(f.teams.home.id) || ids.has(f.teams.away.id);
    if (scope === 'teams') return inTeams;
    if (scope === 'teams+ko') return inTeams || f.stage === STAGE_KO;
    return inTeams;
  });
};

module.exports = {
  LEAGUE_ID,
  SEASON,
  fetchAllFixtures,
  getTeams,
  filterFixtures,
  classifyStage,
};
