const { fetchFixturesForMatchday, fetchFixturesByIds } = require('../services/apiFootball');
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
    const idsParam = String(req.query.ids || '').trim();
    if (!idsParam) return res.json([]);
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    const fixtures = await fetchFixturesByIds(ids);
    res.json(fixtures);
  } catch (err) {
    console.warn('[Football] getFixturesByIds failed (API may be down or invalid key):', err.message);
    res.json([]);
  }
};
