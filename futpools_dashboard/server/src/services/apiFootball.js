const API_BASE = process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY || "";

const apiFetch = async (path, params = {}) => {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY missing");
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": API_KEY,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Football error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

export const searchTeams = async (query) => {
  const data = await apiFetch("/teams", { search: query });
  return (data?.response || []).map((r) => ({
    id: r?.team?.id,
    name: r?.team?.name,
    logo: r?.team?.logo,
    country: r?.team?.country,
  }));
};

export const searchLeagues = async (query) => {
  const byId = new Map();

  const collect = async (q) => {
    const data = await apiFetch("/leagues", { search: q });
    for (const row of data?.response || []) {
      const league = row?.league;
      const country = row?.country;
      if (!league?.id || byId.has(league.id)) continue;
      byId.set(league.id, {
        id: league.id,
        name: league.name,
        type: league.type,
        logo: league.logo,
        country: country?.name || "",
        countryCode: country?.code || "",
        season: row?.seasons?.find((s) => s?.current)?.year || null,
      });
    }
  };

  await collect(query);

  // Fallback for inputs like "LigaMX" -> "Liga MX"
  if (byId.size === 0 && query && !query.includes(" ")) {
    const spaced = query.replace(/([a-z])([A-Z])/g, "$1 $2");
    if (spaced !== query) await collect(spaced);
  }

  return Array.from(byId.values());
};

const mapFixture = (f) => ({
  fixtureId: f?.fixture?.id,
  date: f?.fixture?.date,
  status: f?.fixture?.status?.short,
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

const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);

const fixtureSortOrder = (a, b) => {
  const aLive = LIVE_STATUSES.has(String(a?.status || "").toUpperCase());
  const bLive = LIVE_STATUSES.has(String(b?.status || "").toUpperCase());
  if (aLive && !bLive) return -1;
  if (!aLive && bLive) return 1;
  const dateA = new Date(a?.date || 0).getTime();
  const dateB = new Date(b?.date || 0).getTime();
  return dateA - dateB;
};

export const getTeamFixtures = async (teamId) => {
  const [liveData, nextData] = await Promise.all([
    apiFetch("/fixtures", { live: "all" }),
    apiFetch("/fixtures", { team: teamId, next: 10 }),
  ]);

  const liveRaw = (liveData?.response || []).filter(
    (f) => f?.teams?.home?.id === teamId || f?.teams?.away?.id === teamId
  );
  const nextRaw = nextData?.response || [];

  const byId = new Map();
  for (const f of liveRaw) {
    const id = f?.fixture?.id;
    if (id != null) byId.set(id, mapFixture(f));
  }
  for (const f of nextRaw) {
    const id = f?.fixture?.id;
    if (id != null && !byId.has(id)) byId.set(id, mapFixture(f));
  }

  return Array.from(byId.values()).sort(fixtureSortOrder);
};

export const getLeagueFixtures = async (leagueId, season) => {
  const currentYear = new Date().getFullYear();
  const resolvedSeason = Number(season) || Number(process.env.API_FOOTBALL_SEASON) || currentYear;

  const [liveData, nextData] = await Promise.all([
    apiFetch("/fixtures", { live: "all" }),
    apiFetch("/fixtures", { league: leagueId, season: resolvedSeason, next: 20 }),
  ]);

  const liveRaw = (liveData?.response || []).filter((f) => f?.league?.id === leagueId);
  const nextRaw = nextData?.response || [];

  const byId = new Map();
  for (const f of liveRaw) {
    const id = f?.fixture?.id;
    if (id != null) byId.set(id, mapFixture(f));
  }
  for (const f of nextRaw) {
    const id = f?.fixture?.id;
    if (id != null && !byId.has(id)) byId.set(id, mapFixture(f));
  }

  return Array.from(byId.values()).sort(fixtureSortOrder);
};

export const getLeagueSeasons = async (leagueId) => {
  const data = await apiFetch("/leagues", { id: leagueId });
  return data?.response?.[0]?.seasons || [];
};
