const apiFootball = require('../services/apiFootball');
const {
  fetchFixturesForMatchday,
  fetchFixturesByIds,
  searchLeagues,
  searchTeamsApi,
  getTeamFixtures,
  getLeagueFixtures,
  getFixtureEvents,
} = apiFootball;
const League = require('../models/League');
const Team = require('../models/Team');

/**
 * GET /football/teams/lookup?ids=541,529,33
 * GET /football/leagues/lookup?ids=2,140,39
 *
 * Bulk metadata fetch for the desktop favorites editor — given a list
 * of api-football IDs (typically the user's previously-saved customs
 * read from localStorage as bare numbers), returns the corresponding
 * { id, name, logo, country } so the UI can render proper pills.
 *
 * 1h cache server-side keeps repeated opens cheap.
 */
exports.lookupTeams = async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return res.json([]);
    const out = await apiFootball.lookupTeamsByIds(ids);
    res.json(out);
  } catch (err) {
    console.warn('[Football] lookupTeams failed:', err.message);
    res.json([]);
  }
};
exports.lookupLeagues = async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return res.json([]);
    const out = await apiFootball.lookupLeaguesByIds(ids);
    res.json(out);
  } catch (err) {
    console.warn('[Football] lookupLeagues failed:', err.message);
    res.json([]);
  }
};

exports.getMatchdayFixtures = async (req, res) => {
  try {
    const { id } = req.params;
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      console.log(`[Football] GET /football/matchday/${id}`);
    }
    const fixtures = await fetchFixturesForMatchday(id);
    if (process.env.API_FOOTBALL_DEBUG === 'true') {
      const logos = fixtures.filter((m) => m.logos?.home || m.logos?.away).length;
      console.log(`[Football] matchday=${id} fixtures=${fixtures.length} logos=${logos}`);
    }
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.getTeamsByLeague = async (req, res) => {
  try {
    const { league, code, name } = req.query;
    let leagueDoc = null;
    if (league) {
      leagueDoc = await League.findOne({ $or: [{ _id: league }, { apiFootballId: Number(league) || -1 }] });
    }
    if (!leagueDoc && code) {
      leagueDoc = await League.findOne({ code: String(code).toUpperCase() });
    }
    if (!leagueDoc && name) {
      leagueDoc = await League.findOne({ name });
    }
    if (!leagueDoc) {
      return res.status(404).json({ message: 'League not found' });
    }

    const teams = await Team.find({ league: leagueDoc._id }).select('name aliases logo apiFootballId');
    res.json({
      league: {
        id: leagueDoc._id,
        name: leagueDoc.name,
        code: leagueDoc.code,
        apiFootballId: leagueDoc.apiFootballId || null,
      },
      teams,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.getFixturesByIds = async (req, res) => {
  try {
    const { teamId, leagueId, season, ids } = req.query;
    if (leagueId) {
      const list = await getLeagueFixtures(Number(leagueId), season ? Number(season) : undefined);
      return res.json(list);
    }
    if (teamId) {
      const list = await getTeamFixtures(Number(teamId));
      return res.json(list);
    }
    const idsParam = String(ids || '').trim();
    if (!idsParam) return res.json([]);
    const idList = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    const fixtures = await fetchFixturesByIds(idList);
    res.json(fixtures);
  } catch (err) {
    console.warn('[Football] getFixturesByIds failed:', err.message);
    res.json([]);
  }
};

exports.searchLeagues = async (req, res) => {
  try {
    const q = String(req.query.query || '').trim();
    if (!q) return res.json([]);
    const list = await searchLeagues(q);
    res.json(list);
  } catch (err) {
    console.warn('[Football] searchLeagues failed:', err.message);
    res.json([]);
  }
};

exports.searchTeamsApi = async (req, res) => {
  try {
    const q = String(req.query.query || '').trim();
    if (!q) return res.json([]);
    const list = await searchTeamsApi(q);
    res.json(list);
  } catch (err) {
    console.warn('[Football] searchTeamsApi failed:', err.message);
    res.json([]);
  }
};

exports.getFixtureEvents = async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'fixtureId is required' });
    const events = await getFixtureEvents(id);
    res.json(events);
  } catch (err) {
    console.warn('[Football] getFixtureEvents failed:', err.message);
    res.json([]);
  }
};

/**
 * GET /football/fixtures/feed?date=YYYY-MM-DD&leagues=1,2&teams=33,40&season=2025
 *
 * Aggregated feed for the iOS Live Scores tab. Defaults to today (UTC)
 * if `date` is omitted. `leagues` and `teams` are comma-separated
 * api-football ids. Empty/missing returns []. Cached 30s server-side
 * (matching the iOS polling cadence) so a refresh storm doesn't burn
 * api-football quota.
 */
exports.getFixturesFeed = async (req, res) => {
  try {
    // Live-all mode: ?live=true returns every globally-live fixture,
    // ignores leagues/teams/date. The iOS LIVE tab uses this so users
    // see all in-progress football, not just their favorites.
    // ?nocache=1 bypasses the 10s server cache so a manual 'refresh
    // now' button gets the freshest possible api-football data.
    if (String(req.query.live || '').toLowerCase() === 'true') {
      const noCache = String(req.query.nocache || '').toLowerCase() === '1'
        || String(req.query.nocache || '').toLowerCase() === 'true';
      const out = await apiFootball.fetchFixturesFeed({ live: true, noCache });
      return res.json(out);
    }
    const date = String(req.query.date || '').trim()
      || new Date().toISOString().slice(0, 10);
    const leagueIds = String(req.query.leagues || '')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    const teamIds = String(req.query.teams || '')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (leagueIds.length === 0 && teamIds.length === 0) return res.json([]);
    const season = req.query.season ? Number(req.query.season) : undefined;
    const out = await apiFootball.fetchFixturesFeed({
      date, leagueIds, teamIds, season,
    });
    res.json(out);
  } catch (err) {
    console.warn('[Football] getFixturesFeed failed:', err.message);
    res.json([]);
  }
};
