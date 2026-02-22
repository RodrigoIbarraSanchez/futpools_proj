require('dotenv').config();
const mongoose = require('mongoose');
const League = require('../models/League');
const Team = require('../models/Team');

const API_BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '';

const LEAGUE_PRESETS = [
  { code: 'EPL', name: 'Premier League', country: 'England', apiFootballId: 39 },
  { code: 'LA_LIGA', name: 'La Liga', country: 'Spain', apiFootballId: 140 },
  { code: 'SERIE_A', name: 'Serie A', country: 'Italy', apiFootballId: 135 },
  { code: 'BUNDESLIGA', name: 'Bundesliga', country: 'Germany', apiFootballId: 78 },
  { code: 'LIGUE_1', name: 'Ligue 1', country: 'France', apiFootballId: 61 },
  { code: 'BRASILEIRAO', name: 'Brasileirao', country: 'Brazil', apiFootballId: 71 },
  { code: 'LIGA_MX', name: 'Liga MX', country: 'Mexico', apiFootballId: 262 },
  { code: 'PRIMEIRA_LIGA', name: 'Primeira Liga', country: 'Portugal', apiFootballId: 94 },
  { code: 'EREDIVISIE', name: 'Eredivisie', country: 'Netherlands', apiFootballId: 88 },
  { code: 'MLS', name: 'Major League Soccer', country: 'USA', apiFootballId: 253 },
];

const normalizeTeam = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|club|deportivo|ud|cd)\b/gi, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const LIGA_MX_ALIASES = {
  'guadalajara': ['Chivas', 'CD Guadalajara', 'Club Guadalajara', 'Guadalajara Chivas'],
  'cd guadalajara': ['Chivas', 'Guadalajara', 'Club Guadalajara'],
  'guadalajara chivas': ['Chivas', 'Guadalajara', 'Club Guadalajara'],
  'pumas unam': ['Pumas', 'UNAM', 'Pumas UNAM'],
  'unam pumas': ['Pumas', 'Pumas UNAM'],
  'u n a m pumas': ['Pumas', 'Pumas UNAM', 'UNAM'],
  'club america': ['America', 'América'],
  'tigres uanl': ['Tigres'],
  'monterrey': ['Rayados', 'CF Monterrey', 'Rayados de Monterrey'],
};

const apiFetch = async (path, params = {}) => {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY missing');
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_KEY,
      accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Football error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

const getSeasonForLeague = async (leagueId) => {
  const data = await apiFetch('/leagues', { id: leagueId });
  const seasons = data?.response?.[0]?.seasons || [];
  const current = seasons.find((s) => s.current === true) || seasons[seasons.length - 1];
  return String(current?.year || new Date().getFullYear());
};

const syncLeagueAndTeams = async (preset) => {
  const season = await getSeasonForLeague(preset.apiFootballId);
  const league = await League.findOneAndUpdate(
    { code: preset.code },
    {
      $set: {
        name: preset.name,
        country: preset.country,
        apiFootballId: preset.apiFootballId,
      },
    },
    { upsert: true, new: true }
  );

  let data = await apiFetch('/teams', { league: preset.apiFootballId, season });
  let response = data?.response || [];
  if (!response.length) {
    data = await apiFetch('/teams', { league: preset.apiFootballId });
    response = data?.response || [];
  }

  const bulk = response.map((r) => {
    const name = r?.team?.name || '';
    const normalizedName = normalizeTeam(name);
    let aliases = [];
    if (preset.code === 'LIGA_MX') {
      aliases = LIGA_MX_ALIASES[normalizedName] || [];
    }
    return {
      updateOne: {
        filter: { apiFootballId: r?.team?.id, league: league._id },
        update: {
          $set: {
            name,
            normalizedName,
            aliases,
            logo: r?.team?.logo || '',
            country: r?.team?.country || preset.country,
            league: league._id,
            leagueApiFootballId: preset.apiFootballId,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  if (bulk.length) {
    await Team.bulkWrite(bulk);
  }
  console.log(`[Sync] ${preset.name} teams=${response.length} season=${season}`);
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const preset of LEAGUE_PRESETS) {
    await syncLeagueAndTeams(preset);
  }
  console.log('[Sync] Completed');
  process.exit(0);
};

run().catch((err) => {
  console.error('[Sync] Error', err.message);
  process.exit(1);
});
