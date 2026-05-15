const Matchday = require('../models/Matchday');
const Match = require('../models/Match');
const League = require('../models/League');
const Team = require('../models/Team');

const API_BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '';
const DEFAULT_SEASON = process.env.API_FOOTBALL_SEASON || String(new Date().getFullYear());
const LEAGUE_MAP = (() => {
  try {
    return JSON.parse(process.env.API_FOOTBALL_LEAGUES || '{}');
  } catch {
    return {};
  }
})();
const LEAGUE_COUNTRY_FALLBACK = (() => {
  try {
    return JSON.parse(process.env.API_FOOTBALL_LEAGUE_COUNTRIES || '{}');
  } catch {
    return {};
  }
})();

const DEFAULT_COUNTRY_BY_CODE = {
  LIGA_MX: 'Mexico',
};

const TEAM_LOGO_CACHE = new Map(); // normalized team name -> logo url
const TEAMS_BY_LEAGUE_CACHE = new Map(); // leagueId -> Map(normalized team name -> logo)
const TEAMS_BY_LEAGUE_PENDING = new Map(); // leagueId -> Promise<Map>
const LEAGUE_SEASON_CACHE = new Map(); // leagueId -> season string
const TEAMS_DB_CACHE = new Map(); // leagueDbId -> Map(normalized team name -> logo)
const LEAGUE_ID_FALLBACK = {
  'Liga MX': 262,
  LIGA_MX: 262,
  'Premier League': 39,
  EPL: 39,
  'La Liga': 140,
  LaLiga: 140,
  'Serie A': 135,
  Bundesliga: 78,
  'Ligue 1': 61,
  Brasileirao: 71,
  'Primeira Liga': 94,
  Eredivisie: 88,
  'Major League Soccer': 253,
  MLS: 253,
};

const TEAM_ALIASES = {
  'club america': ['america', 'américa'],
  guadalajara: ['chivas', 'cd guadalajara', 'club guadalajara', 'guadalajara chivas'],
  'cd guadalajara': ['chivas', 'guadalajara', 'club guadalajara'],
  'guadalajara chivas': ['chivas', 'guadalajara', 'club guadalajara'],
  'chivas guadalajara': ['chivas', 'guadalajara'],
  'pumas unam': ['pumas', 'unam', 'pumas de la unam'],
  'u n a m pumas': ['pumas', 'pumas unam', 'unam'],
  'unam pumas': ['pumas', 'pumas unam'],
  'tigres uanl': ['tigres'],
  monterrey: ['rayados', 'cf monterrey', 'rayados de monterrey'],
};

const LEAGUE_ALIASES = {
  'Premier League': ['Premier League', 'EPL'],
  'La Liga': ['La Liga', 'LaLiga', 'Primera Division'],
  'Serie A': ['Serie A'],
  Bundesliga: ['Bundesliga'],
  'Ligue 1': ['Ligue 1'],
  'Brasileirao': ['Brasileirao', 'Brazil Serie A', 'Serie A'],
  'Liga MX': ['Liga MX', 'Liga de Mexico'],
  'Primeira Liga': ['Primeira Liga', 'Liga Portugal', 'Portuguese Primera Liga'],
  'Eredivisie': ['Eredivisie'],
  'Major League Soccer': ['Major League Soccer', 'MLS'],
};

const cache = {
  fixturesByMatchday: new Map(), // matchdayId -> { updatedAt, fixtures }
  leagueIdByName: new Map(),
  fixturesById: new Map(),       // fixtureId -> { updatedAt, payload }
  searchLeagues: new Map(),      // query -> { updatedAt, payload }
  searchTeams: new Map(),        // query -> { updatedAt, payload }
  teamFixtures: new Map(),       // teamId -> { updatedAt, payload }
  leagueFixtures: new Map(),     // leagueId:season -> { updatedAt, payload }
  fixtureEvents: new Map(),      // fixtureId -> { updatedAt, payload }
};

const cacheTTLms = 25 * 1000; // 25s to allow 30s polling
const searchCacheTTLms = 10 * 60 * 1000; // 10 min — leagues/teams don't change
const fixturePreviewTTLms = 60 * 1000;   // 1 min for "next 10/20 fixtures"

const isLiveStatus = (short) => {
  const live = new Set(['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT']);
  return live.has(short);
};

const normalize = (s) => String(s || '').trim().toLowerCase();

const normalizeTeam = (s) => {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|club|deportivo|ud|cd)\b/gi, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const loadTeamsFromDb = async (leagueDbId) => {
  const key = String(leagueDbId);
  if (TEAMS_DB_CACHE.has(key)) return TEAMS_DB_CACHE.get(key);
  const teams = await Team.find({ league: leagueDbId });
  const map = new Map();
  teams.forEach((t) => {
    map.set(normalizeTeam(t.name), t.logo || null);
    (t.aliases || []).forEach((a) => map.set(normalizeTeam(a), t.logo || null));
  });
  TEAMS_DB_CACHE.set(key, map);
  return map;
};

const getLogoFromDb = async (leagueDbId, teamName) => {
  if (!leagueDbId) return null;
  const map = await loadTeamsFromDb(leagueDbId);
  const normalized = normalizeTeam(teamName);
  return map.get(normalized) || null;
};

const fetchFn = global.fetch;

const apiFetch = async (path, params = {}) => {
  if (!API_KEY) {
    console.warn('[API-Football] API_FOOTBALL_KEY is missing');
    throw new Error('API_FOOTBALL_KEY is not configured');
  }
  if (!fetchFn) {
    throw new Error('Global fetch is not available. Please run on Node 18+.');
  }
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetchFn(url.toString(), {
    headers: {
      'x-apisports-key': API_KEY,
      'accept': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Football error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (process.env.API_FOOTBALL_DEBUG === 'true' && data?.errors && Object.keys(data.errors).length) {
    console.log(`[API-Football] errors: ${JSON.stringify(data.errors).slice(0, 200)}`);
  }
  return data;
};

const getLeagueIdForMatchday = async (matchday) => {
  const code = matchday?.league?.code;
  const name = matchday?.league?.name;
  if (code && LEAGUE_MAP[code]) return LEAGUE_MAP[code];
  if (name && LEAGUE_MAP[name]) return LEAGUE_MAP[name];
  if (code && LEAGUE_ID_FALLBACK[code]) return LEAGUE_ID_FALLBACK[code];
  if (name && LEAGUE_ID_FALLBACK[name]) return LEAGUE_ID_FALLBACK[name];
  const leagueDoc = await League.findOne({ code: code || '', name: name || '' }).select('apiFootballId');
  if (leagueDoc?.apiFootballId) return leagueDoc.apiFootballId;
  const key = normalize(name || code || '');
  if (cache.leagueIdByName.has(key)) return cache.leagueIdByName.get(key);

  const aliases = LEAGUE_ALIASES[name] || (name ? [name] : []);
  const country =
    LEAGUE_COUNTRY_FALLBACK[name] ||
    LEAGUE_COUNTRY_FALLBACK[code] ||
    DEFAULT_COUNTRY_BY_CODE[code] ||
    undefined;

  for (const candidate of aliases) {
    try {
      const data = await apiFetch('/leagues', {
        name: candidate,
        country,
        season: DEFAULT_SEASON,
        current: 'true',
      });
      const response = data?.response || [];
      if (process.env.API_FOOTBALL_DEBUG === 'true') {
        console.log(`[API-Football] league search name="${candidate}" country="${country || ''}" results=${response.length}`);
      }
      const found = response.find((r) =>
        normalize(r?.league?.name) === normalize(candidate)
      );
      const leagueId = found?.league?.id || response[0]?.league?.id;
      if (leagueId) {
        cache.leagueIdByName.set(key, leagueId);
        return leagueId;
      }
    } catch {
      continue;
    }
  }

  if (process.env.API_FOOTBALL_DEBUG === 'true') {
    console.log(`[API-Football] league not resolved name="${name || ''}" code="${code || ''}"`);
  }
  return null;
};

const getSeasonForLeague = async (leagueId) => {
  const key = String(leagueId);
  if (LEAGUE_SEASON_CACHE.has(key)) return LEAGUE_SEASON_CACHE.get(key);
  try {
    const data = await apiFetch('/leagues', { id: leagueId });
    const seasons = data?.response?.[0]?.seasons || [];
    const current = seasons.find((s) => s.current === true) || seasons[seasons.length - 1];
    const season = current?.year ? String(current.year) : DEFAULT_SEASON;
    LEAGUE_SEASON_CACHE.set(key, season);
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[API-Football] leagueId=${leagueId} season=${season}`);
    }
    return season;
  } catch (err) {
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[API-Football] league season error leagueId=${leagueId} ${err.message}`);
    }
    return DEFAULT_SEASON;
  }
};

const fetchTeamLogo = async (teamName, country) => {
  const key = normalizeTeam(teamName);
  if (!key) return null;
  if (TEAM_LOGO_CACHE.has(key)) return TEAM_LOGO_CACHE.get(key);
  try {
    let data = await apiFetch('/teams', {
      search: teamName,
      country,
      season: DEFAULT_SEASON,
    });
    const response = data?.response || [];
    if (!response.length && country) {
      data = await apiFetch('/teams', {
        search: teamName,
        season: DEFAULT_SEASON,
      });
    }
    const response2 = data?.response || [];
    const exact = response2.find((r) => normalizeTeam(r?.team?.name) === key);
    const logo = exact?.team?.logo || response2[0]?.team?.logo || null;
    TEAM_LOGO_CACHE.set(key, logo);
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[API-Football] team search="${teamName}" country="${country || ''}" logo=${logo ? 'yes' : 'no'}`);
    }
    return logo;
  } catch (err) {
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[API-Football] team search error="${teamName}" ${err.message}`);
    }
    return null;
  }
};

const getTeamLogoFromLeague = async (leagueId, teamName) => {
  const leagueKey = String(leagueId);
  if (!TEAMS_BY_LEAGUE_CACHE.has(leagueKey)) {
    if (!TEAMS_BY_LEAGUE_PENDING.has(leagueKey)) {
      const pending = (async () => {
        const season = await getSeasonForLeague(leagueId);
        let data = await apiFetch('/teams', {
          league: leagueId,
          season,
        });
        let response = data?.response || [];
        if (!response.length) {
          data = await apiFetch('/teams', { league: leagueId });
          response = data?.response || [];
        }
        const map = new Map();
        response.forEach((r) => {
          const name = normalizeTeam(r?.team?.name);
          if (name) map.set(name, r?.team?.logo || null);
        });
        // add aliases
        Object.entries(TEAM_ALIASES).forEach(([canonical, aliases]) => {
          const logo = map.get(normalizeTeam(canonical));
          if (logo) {
            aliases.forEach((a) => map.set(normalizeTeam(a), logo));
          }
        });
        TEAMS_BY_LEAGUE_CACHE.set(leagueKey, map);
        if (process.env.API_FOOTBALL_DEBUG === 'true') {
          console.log(`[API-Football] teams loaded leagueId=${leagueId} count=${map.size}`);
        }
        return map;
      })();
      TEAMS_BY_LEAGUE_PENDING.set(leagueKey, pending);
    }
    await TEAMS_BY_LEAGUE_PENDING.get(leagueKey);
    TEAMS_BY_LEAGUE_PENDING.delete(leagueKey);
  }

  const map = TEAMS_BY_LEAGUE_CACHE.get(leagueKey);
  const normalized = normalizeTeam(teamName);
  const logo = map?.get(normalized) || null;
  if (process.env.API_FOOTBALL_DEBUG === 'true') {
    console.log(`[API-Football] team lookup leagueId=${leagueId} name="${teamName}" logo=${logo ? 'yes' : 'no'}`);
  }
  return logo;
};

const scoreFixtureMatch = (match, fixture) => {
  const home = normalizeTeam(match.homeTeam);
  const away = normalizeTeam(match.awayTeam);
  const fHome = normalizeTeam(fixture?.teams?.home?.name || '');
  const fAway = normalizeTeam(fixture?.teams?.away?.name || '');
  let score = 0;
  if (home === fHome) score += 3;
  else if (fHome.includes(home) || home.includes(fHome)) score += 1;
  if (away === fAway) score += 3;
  else if (fAway.includes(away) || away.includes(fAway)) score += 1;

  const mDate = new Date(match.scheduledAt).getTime();
  const fDate = new Date(fixture?.fixture?.date || '').getTime();
  if (!Number.isNaN(mDate) && !Number.isNaN(fDate)) {
    const diffHours = Math.abs(mDate - fDate) / (1000 * 60 * 60);
    if (diffHours <= 2) score += 2;
    else if (diffHours <= 8) score += 1;
  }
  return score;
};

const mapFixturesToMatches = (matches, fixtures) => {
  const byKey = new Map();
  fixtures.forEach((f) => {
    const home = normalizeTeam(f?.teams?.home?.name);
    const away = normalizeTeam(f?.teams?.away?.name);
    const key = `${home}__${away}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(f);
  });

  return matches.map((m) => {
    const key = `${normalizeTeam(m.homeTeam)}__${normalizeTeam(m.awayTeam)}`;
    let candidates = byKey.get(key) || [];
    if (!candidates.length) candidates = fixtures;
    let best = null;
    let bestScore = -1;
    for (const f of candidates) {
      const s = scoreFixtureMatch(m, f);
      if (s > bestScore) {
        bestScore = s;
        best = f;
      }
    }
    const fixture = bestScore >= 2 ? best : null;
    const status = fixture?.fixture?.status || {};
    const score = fixture?.goals || {};
    return {
      matchId: m._id,
      scheduledAt: m.scheduledAt,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      status: {
        short: status.short || null,
        long: status.long || null,
        elapsed: status.elapsed ?? null,
        isLive: status.short ? isLiveStatus(status.short) : false,
      },
      score: {
        home: score.home ?? null,
        away: score.away ?? null,
      },
      logos: {
        home: fixture?.teams?.home?.logo || null,
        away: fixture?.teams?.away?.logo || null,
      },
      league: fixture?.league
        ? {
            id: fixture.league.id,
            name: fixture.league.name,
            logo: fixture.league.logo,
          }
        : null,
      fixtureId: fixture?.fixture?.id || null,
    };
  });
};

const fetchFixturesForMatchday = async (matchdayId) => {
  const cached = cache.fixturesByMatchday.get(matchdayId);
  if (cached && Date.now() - cached.updatedAt < cacheTTLms) {
    return cached.fixtures;
  }

  const matchday = await Matchday.findById(matchdayId).populate('league', 'name code apiFootballId');
  if (!matchday) throw new Error('Matchday not found');
  const matches = await Match.find({ matchday: matchday._id }).sort({ scheduledAt: 1 });
  const leagueDbId = matchday?.league?._id;
  const leagueId = matchday?.league?.apiFootballId || (await getLeagueIdForMatchday(matchday));

  if (!leagueId) {
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[API-Football] leagueId missing for matchday=${matchdayId} leagueName="${matchday.league?.name || ''}" code="${matchday.league?.code || ''}"`);
    }
    const country =
      LEAGUE_COUNTRY_FALLBACK[matchday.league?.name] ||
      LEAGUE_COUNTRY_FALLBACK[matchday.league?.code] ||
      DEFAULT_COUNTRY_BY_CODE[matchday.league?.code] ||
      undefined;

    // Fallback: enrich with team logos via /teams search
    const fallback = await Promise.all(
      matches.map(async (m) => {
        const homeLogo = (await getLogoFromDb(leagueDbId, m.homeTeam)) || (await fetchTeamLogo(m.homeTeam, country));
        const awayLogo = (await getLogoFromDb(leagueDbId, m.awayTeam)) || (await fetchTeamLogo(m.awayTeam, country));
        return {
          matchId: m._id,
          scheduledAt: m.scheduledAt,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          status: { short: null, long: null, elapsed: null, isLive: false },
          score: { home: null, away: null },
          logos: { home: homeLogo, away: awayLogo },
          league: null,
          fixtureId: null,
        };
      })
    );
    cache.fixturesByMatchday.set(matchdayId, { updatedAt: Date.now(), fixtures: fallback });
    return fallback;
  }

  const teamLogosByLeague = await Promise.all(
    matches.map(async (m) => {
      const homeLogo = await getTeamLogoFromLeague(leagueId, m.homeTeam);
      const awayLogo = await getTeamLogoFromLeague(leagueId, m.awayTeam);
      return { matchId: m._id, homeLogo, awayLogo };
    })
  );

  const from = new Date(matchday.startDate);
  const to = new Date(matchday.endDate);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const season = await getSeasonForLeague(leagueId);
  const data = await apiFetch('/fixtures', {
    league: leagueId,
    season,
    from: fromStr,
    to: toStr,
  });

  const fixtures = data?.response || [];
  if (process.env.API_FOOTBALL_DEBUG === 'true') {
    console.log(`[API-Football] matchday=${matchdayId} leagueId=${leagueId} fixtures=${fixtures.length}`);
  }
  let enriched = mapFixturesToMatches(matches, fixtures);
  // Fill/override logos from league teams cache (authoritative)
  const logoMap = new Map(teamLogosByLeague.map((t) => [String(t.matchId), t]));
  enriched = enriched.map((m) => {
    const l = logoMap.get(String(m.matchId));
    return {
      ...m,
      logos: {
        home: l?.homeLogo || m.logos?.home || null,
        away: l?.awayLogo || m.logos?.away || null,
      },
    };
  });

  // Final override from DB (authoritative for logo accuracy)
  enriched = await Promise.all(
    enriched.map(async (m) => {
      const dbHome = await getLogoFromDb(leagueDbId, m.homeTeam);
      const dbAway = await getLogoFromDb(leagueDbId, m.awayTeam);
      return {
        ...m,
        logos: {
          home: dbHome || m.logos?.home || null,
          away: dbAway || m.logos?.away || null,
        },
      };
    })
  );
  if (process.env.API_FOOTBALL_DEBUG === 'true') {
    enriched.forEach((m) => {
      console.log(
        `[API-Football] match=${m.homeTeam} vs ${m.awayTeam} logoHome=${m.logos.home ? 'yes' : 'no'} logoAway=${m.logos.away ? 'yes' : 'no'} status=${m.status.short || 'n/a'}`
      );
    });
  }
  cache.fixturesByMatchday.set(matchdayId, { updatedAt: Date.now(), fixtures: enriched });
  return enriched;
};

const fetchFixturesByIds = async (fixtureIds = []) => {
  const ids = (fixtureIds || []).filter(Boolean).map((id) => String(id));
  if (!ids.length) return [];

  const now = Date.now();
  const fresh = [];
  const stale = [];
  for (const id of ids) {
    const hit = cache.fixturesById.get(id);
    if (hit && now - hit.updatedAt < cacheTTLms) fresh.push(hit.payload);
    else stale.push(id);
  }
  if (!stale.length) return fresh;

  const data = await apiFetch('/fixtures', {
    ids: stale.join('-'),
  });
  const fixtures = data?.response || [];
  const mapped = fixtures.map((f) => {
    const status = f?.fixture?.status || {};
    const goals = f?.goals || {};
    const fullTime = goals.fullTime || {};
    const home = goals.home ?? fullTime.home ?? null;
    const away = goals.away ?? fullTime.away ?? null;
    return {
      fixtureId: f?.fixture?.id || null,
      scheduledAt: f?.fixture?.date || null,
      status: {
        short: status.short || null,
        long: status.long || null,
        elapsed: status.elapsed ?? null,
        isLive: status.short ? isLiveStatus(status.short) : false,
      },
      score: {
        home,
        away,
      },
      logos: {
        home: f?.teams?.home?.logo || null,
        away: f?.teams?.away?.logo || null,
      },
      league: f?.league
        ? {
            id: f.league.id,
            name: f.league.name,
            logo: f.league.logo,
          }
        : null,
    };
  });
  for (const m of mapped) {
    if (m.fixtureId != null) {
      cache.fixturesById.set(String(m.fixtureId), { updatedAt: now, payload: m });
    }
  }
  return [...fresh, ...mapped];
};

const startLivePolling = () => {
  if (!API_KEY) {
    console.warn('[API-Football] API_FOOTBALL_KEY missing — live polling disabled');
    return;
  }
  const intervalMs = Number(process.env.API_FOOTBALL_POLL_MS || 30000);
  setInterval(async () => {
    try {
      const upcoming = await Matchday.find({ status: { $in: ['open', 'upcoming'] } }).select('_id');
      for (const md of upcoming) {
        try {
          await fetchFixturesForMatchday(md._id);
        } catch (err) {
          console.warn('[API-Football] Poll error', err.message);
        }
      }
    } catch (err) {
      console.warn('[API-Football] Poll list error', err.message);
    }
  }, intervalMs);
};

const searchLeagues = async (rawQuery) => {
  const query = String(rawQuery || '').trim();
  if (!query) return [];
  const key = query.toLowerCase();
  const hit = cache.searchLeagues.get(key);
  if (hit && Date.now() - hit.updatedAt < searchCacheTTLms) return hit.payload;

  const byId = new Map();
  const collect = async (q) => {
    const data = await apiFetch('/leagues', { search: q });
    for (const row of data?.response || []) {
      const league = row?.league;
      const country = row?.country;
      if (!league?.id || byId.has(league.id)) continue;
      byId.set(league.id, {
        id: league.id,
        name: league.name,
        type: league.type,
        logo: league.logo,
        country: country?.name || '',
        countryCode: country?.code || '',
        season: row?.seasons?.find((s) => s?.current)?.year || null,
      });
    }
  };
  await collect(query);
  if (byId.size === 0 && !query.includes(' ')) {
    const spaced = query.replace(/([a-z])([A-Z])/g, '$1 $2');
    if (spaced !== query) await collect(spaced);
  }
  const out = Array.from(byId.values());
  cache.searchLeagues.set(key, { updatedAt: Date.now(), payload: out });
  return out;
};

const searchTeamsApi = async (rawQuery) => {
  const query = String(rawQuery || '').trim();
  if (!query) return [];
  const key = query.toLowerCase();
  const hit = cache.searchTeams.get(key);
  if (hit && Date.now() - hit.updatedAt < searchCacheTTLms) return hit.payload;

  const data = await apiFetch('/teams', { search: query });
  const out = (data?.response || []).map((r) => ({
    id: r?.team?.id,
    name: r?.team?.name,
    logo: r?.team?.logo,
    country: r?.team?.country,
  })).filter((t) => t.id);
  cache.searchTeams.set(key, { updatedAt: Date.now(), payload: out });
  return out;
};

const mapFixturePreview = (f) => ({
  fixtureId: f?.fixture?.id,
  date: f?.fixture?.date,
  status: f?.fixture?.status?.short,
  // Live + final scores. Extend over the historical preview shape so
  // simple_version's LiveScoresView can render scores inline without a
  // second round-trip. Existing callers (CreatePool fixture picker,
  // pre-game pool list) ignore these fields.
  elapsed: f?.fixture?.status?.elapsed ?? null,
  goals: {
    home: f?.goals?.home ?? null,
    away: f?.goals?.away ?? null,
  },
  league: {
    id: f?.league?.id,
    name: f?.league?.name,
    logo: f?.league?.logo,
  },
  teams: {
    home: {
      id: f?.teams?.home?.id,
      name: f?.teams?.home?.name,
      logo: f?.teams?.home?.logo,
    },
    away: {
      id: f?.teams?.away?.id,
      name: f?.teams?.away?.name,
      logo: f?.teams?.away?.logo,
    },
  },
});

const fixturePreviewSort = (a, b) => {
  const aLive = isLiveStatus(String(a?.status || '').toUpperCase());
  const bLive = isLiveStatus(String(b?.status || '').toUpperCase());
  if (aLive && !bLive) return -1;
  if (!aLive && bLive) return 1;
  return new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime();
};

const getTeamFixtures = async (teamId) => {
  const key = String(teamId);
  const hit = cache.teamFixtures.get(key);
  if (hit && Date.now() - hit.updatedAt < fixturePreviewTTLms) return hit.payload;

  // Merge live + next fixtures so users can pick an ongoing match for a demo
  // pool. We fetch both in parallel and dedupe by fixture id.
  const [liveData, nextData] = await Promise.all([
    apiFetch('/fixtures', { live: 'all' }).catch(() => null),
    apiFetch('/fixtures', { team: teamId, next: 10 }),
  ]);
  const byId = new Map();
  for (const f of (liveData?.response || [])) {
    if (f?.teams?.home?.id === Number(teamId) || f?.teams?.away?.id === Number(teamId)) {
      byId.set(f.fixture?.id, mapFixturePreview(f));
    }
  }
  for (const f of (nextData?.response || [])) {
    if (!byId.has(f?.fixture?.id)) byId.set(f.fixture?.id, mapFixturePreview(f));
  }
  const out = Array.from(byId.values()).sort(fixturePreviewSort);
  cache.teamFixtures.set(key, { updatedAt: Date.now(), payload: out });
  return out;
};

const getLeagueFixtures = async (leagueId, season) => {
  const resolvedSeason = Number(season) || Number(DEFAULT_SEASON) || new Date().getFullYear();
  const key = `${leagueId}:${resolvedSeason}`;
  const hit = cache.leagueFixtures.get(key);
  if (hit && Date.now() - hit.updatedAt < fixturePreviewTTLms) return hit.payload;

  const [liveData, nextData] = await Promise.all([
    apiFetch('/fixtures', { live: 'all' }).catch(() => null),
    apiFetch('/fixtures', { league: leagueId, season: resolvedSeason, next: 20 }),
  ]);
  const byId = new Map();
  for (const f of (liveData?.response || [])) {
    if (f?.league?.id === Number(leagueId)) {
      byId.set(f.fixture?.id, mapFixturePreview(f));
    }
  }
  for (const f of (nextData?.response || [])) {
    if (!byId.has(f?.fixture?.id)) byId.set(f.fixture?.id, mapFixturePreview(f));
  }
  const out = Array.from(byId.values()).sort(fixturePreviewSort);
  cache.leagueFixtures.set(key, { updatedAt: Date.now(), payload: out });
  return out;
};

/// Match feed for a single fixture (goals, cards, substitutions, VAR).
/// Cached aggressively (25s) since it powers the live match view which polls.
const getFixtureEvents = async (fixtureId) => {
  const key = String(fixtureId);
  const hit = cache.fixtureEvents.get(key);
  if (hit && Date.now() - hit.updatedAt < cacheTTLms) return hit.payload;

  const data = await apiFetch('/fixtures/events', { fixture: fixtureId });
  const out = (data?.response || []).map((e) => ({
    minute: e?.time?.elapsed ?? null,
    extra: e?.time?.extra ?? null,
    team: e?.team ? { id: e.team.id, name: e.team.name, logo: e.team.logo } : null,
    player: e?.player?.name || null,
    assist: e?.assist?.name || null,
    type: e?.type || null,          // "Goal" | "Card" | "subst" | "Var"
    detail: e?.detail || null,      // "Normal Goal" | "Yellow Card" | "Substitution 1" | etc.
    comments: e?.comments || null,
  })).sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0)); // newest first
  cache.fixtureEvents.set(key, { updatedAt: Date.now(), payload: out });
  return out;
};

/**
 * Fetch fixtures for a single league + ISO date (YYYY-MM-DD). Used by the
 * Daily Pick scheduler to find candidate fixtures from priority leagues.
 * Returns the raw API-Football `response` array — caller decides how to
 * filter/sort.
 */
const getFixturesByLeagueAndDate = async (leagueId, date, season) => {
  const resolvedSeason = Number(season) || Number(DEFAULT_SEASON) || new Date().getFullYear();
  const data = await apiFetch('/fixtures', {
    league: leagueId,
    season: resolvedSeason,
    date,
  });
  return data?.response || [];
};

/**
 * Fetch every fixture worldwide for a given ISO date (YYYY-MM-DD). Used
 * as the Daily Pick fallback when none of the priority leagues have a
 * match that day (common on Thursdays — most top leagues only play
 * weekends + UCL on Tue/Wed). Caller is responsible for filtering down
 * to upcoming + sane kickoffs.
 */
const getFixturesByDate = async (date) => {
  const data = await apiFetch('/fixtures', { date });
  return data?.response || [];
};

/**
 * Fetch fixtures for a single team on a single date. Powers the
 * simple_version Live Scores feed when the user has favorite teams
 * outside the leagues they follow (e.g. follows Real Madrid but not
 * LaLiga as a whole).
 */
const getFixturesByTeamAndDate = async (teamId, date) => {
  const data = await apiFetch('/fixtures', { team: teamId, date });
  return data?.response || [];
};

/**
 * Aggregated fixtures feed for the iOS Live Scores tab. Two modes:
 *
 *   - { live: true } → returns ALL globally-live fixtures via
 *     api-football's `/fixtures?live=all` (server-side filter, single
 *     round-trip). Ignores leagueIds/teamIds. Cache 15s — live data
 *     moves fast and stale scores are visible to users.
 *
 *   - { date, leagueIds, teamIds } → fan-out per league + per team for
 *     the given date, dedupe by fixtureId. Cache 30s.
 *
 * In both modes we map to the preview shape so the client renders
 * scores + status inline without a second round-trip.
 */
const fixturesFeedCache = new Map();
const FIXTURES_FEED_TTL_MS = 30_000;
// Live data moves fast — minute counter ticks every 60s, scores can flip
// at any time. Keep the cache tight enough that a 20s poll from two
// clients can't both observe minute X for more than one tick.
const FIXTURES_LIVE_TTL_MS = 10_000;

const fetchFixturesFeed = async ({ date, leagueIds = [], teamIds = [], season, live = false, noCache = false } = {}) => {
  // Live-all mode: one api-football call, returns the in-progress games
  // worldwide. Much cheaper than fan-out and matches what users expect
  // on the LIVE tab — they want to see ALL live football, not just the
  // intersection of their favorites.
  if (live) {
    const cacheKey = 'LIVE_ALL';
    if (!noCache) {
      const hit = fixturesFeedCache.get(cacheKey);
      if (hit && Date.now() - hit.updatedAt < FIXTURES_LIVE_TTL_MS) return hit.payload;
    }
    const data = await apiFetch('/fixtures', { live: 'all' }).catch(() => null);
    const out = (data?.response || []).map(mapFixturePreview).sort(fixturePreviewSort);
    fixturesFeedCache.set(cacheKey, { updatedAt: Date.now(), payload: out });
    return out;
  }

  const sortedLeagues = Array.from(new Set(leagueIds.map(Number))).filter((n) => n > 0).sort((a, b) => a - b);
  const sortedTeams = Array.from(new Set(teamIds.map(Number))).filter((n) => n > 0).sort((a, b) => a - b);
  const cacheKey = `${date}|L:${sortedLeagues.join(',')}|T:${sortedTeams.join(',')}`;

  const hit = fixturesFeedCache.get(cacheKey);
  if (hit && Date.now() - hit.updatedAt < FIXTURES_FEED_TTL_MS) return hit.payload;

  const tasks = [];
  for (const lid of sortedLeagues) {
    tasks.push(getFixturesByLeagueAndDate(lid, date, season).catch(() => []));
  }
  for (const tid of sortedTeams) {
    tasks.push(getFixturesByTeamAndDate(tid, date).catch(() => []));
  }
  const results = await Promise.all(tasks);

  // Dedupe by fixtureId across leagues + teams (a Real Madrid–Barcelona
  // game would otherwise appear twice if the user follows both teams
  // and LaLiga). Map at the same time.
  const byId = new Map();
  for (const arr of results) {
    for (const f of arr) {
      const id = f?.fixture?.id;
      if (!id || byId.has(id)) continue;
      byId.set(id, mapFixturePreview(f));
    }
  }
  const payload = Array.from(byId.values()).sort(fixturePreviewSort);
  fixturesFeedCache.set(cacheKey, { updatedAt: Date.now(), payload });
  return payload;
};

module.exports = {
  fetchFixturesForMatchday,
  fetchFixturesByIds,
  searchLeagues,
  searchTeamsApi,
  getTeamFixtures,
  getLeagueFixtures,
  getFixtureEvents,
  getFixturesByLeagueAndDate,
  getFixturesByDate,
  getFixturesByTeamAndDate,
  fetchFixturesFeed,
  startLivePolling,
};
