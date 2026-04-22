const {
  fetchFixturesForMatchday,
  fetchFixturesByIds,
  searchLeagues,
  searchTeamsApi,
  getTeamFixtures,
  getLeagueFixtures,
  getFixtureEvents,
} = require('../services/apiFootball');
const League = require('../models/League');
const Team = require('../models/Team');

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
