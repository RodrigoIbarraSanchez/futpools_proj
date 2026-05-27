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

const fetchAllFixtures = async () => {
  if (cache.fixtures && Date.now() - cache.at < CACHE_TTL_MS) return cache.fixtures;
  const data = await apiFetch('/fixtures', { league: LEAGUE_ID, season: SEASON });
  const fixtures = (data?.response || []).map(mapFixture);
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
