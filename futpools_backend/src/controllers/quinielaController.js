const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const User = require('../models/User');
const { fetchFixturesByIds } = require('../services/apiFootball');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/** Compute pool status from fixtures: scheduled | live | completed */
function computePoolStatus(fixtures) {
  if (!fixtures || fixtures.length === 0) return 'scheduled';
  const now = new Date();
  let allFinished = true;
  let anyStarted = false;
  for (const f of fixtures) {
    const short = String(f.status || '').trim().toUpperCase();
    if (FINISHED_STATUSES.has(short)) {
      anyStarted = true;
    } else {
      allFinished = false;
      if (short && short !== 'NS') anyStarted = true;
      else if (new Date(f.kickoff) <= now) anyStarted = true;
    }
  }
  if (allFinished) return 'completed';
  if (anyStarted) return 'live';
  return 'scheduled';
}

function addPoolStatus(quiniela) {
  return { ...quiniela, status: computePoolStatus(quiniela.fixtures || []) };
}

exports.getQuinielas = async (_req, res) => {
  try {
    const list = await Quiniela.find().sort({ startDate: 1 }).lean();
    const ids = list.map((q) => q._id);
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: ids } } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const withCounts = list.map((q) => addPoolStatus({
      ...q,
      entriesCount: countMap.get(String(q._id)) ?? 0,
    }));
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQuinielaById = async (req, res) => {
  try {
    const doc = await Quiniela.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Quiniela not found' });
    const entriesCount = await QuinielaEntry.countDocuments({ quiniela: req.params.id });
    res.json(addPoolStatus({ ...doc, entriesCount }));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitEntry = async (req, res) => {
  try {
    const quinielaId = req.params.id;
    const { picks } = req.body || {};
    console.log(`[Quiniela] submit entry — quiniela=${quinielaId} user=${req.user?._id} picks=${Array.isArray(picks) ? picks.length : 0}`);
    if (!Array.isArray(picks) || picks.length === 0) {
      return res.status(400).json({ message: 'Picks are required' });
    }
    const quiniela = await Quiniela.findById(quinielaId);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });

    const entryCost = parseFloat(String(quiniela.cost).replace(/[^0-9.-]/g, '')) || 0;
    if (entryCost > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: req.user._id, balance: { $gte: entryCost } },
        { $inc: { balance: -entryCost } },
        { new: true }
      );
      if (!updated) {
        const u = await User.findById(req.user._id).select('balance').lean();
        const currentBalance = u?.balance ?? 0;
        return res.status(400).json({
          message: 'Insufficient balance',
          code: 'INSUFFICIENT_BALANCE',
          entryCost,
          currentBalance,
        });
      }
    }

    const entryCount = await QuinielaEntry.countDocuments({ quiniela: quinielaId, user: req.user._id });
    const entry = await QuinielaEntry.create({
      quiniela: quinielaId,
      user: req.user._id,
      entryNumber: entryCount + 1,
      picks,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await entry.populate('quiniela');
    res.status(201).json(entry);
  } catch (err) {
    console.error('[Quiniela] submit error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const resultFromScore = (home, away) => {
  if (home == null || away == null) return null;
  const h = Number(home);
  const a = Number(away);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;
  if (h > a) return '1';
  if (h < a) return '2';
  return 'X';
};

function scoreForEntry(entry, resultsByFixtureId) {
  let score = 0;
  const norm = (p) => (p || '').toString().trim().toUpperCase();
  for (const pick of entry.picks || []) {
    const result = resultsByFixtureId.get(pick.fixtureId);
    if (result != null && norm(result) === norm(pick.pick)) score += 1;
  }
  return score;
}

/** Build map quinielaId -> (fixtureId -> result '1'|'X'|'2') from live fixtures list */
function buildResultsByQuiniela(entries, liveFixtures) {
  const fixtureIdToResult = new Map();
  for (const f of liveFixtures) {
    const short = (f?.status?.short || '').toUpperCase();
    if (!FINISHED_STATUSES.has(short)) continue;
    const result = resultFromScore(f?.score?.home, f?.score?.away);
    if (result != null) fixtureIdToResult.set(f.fixtureId, result);
  }
  const byQuiniela = new Map();
  for (const entry of entries) {
    const qid = entry.quiniela?._id ?? entry.quiniela;
    if (!qid) continue;
    if (!byQuiniela.has(String(qid))) {
      const fixtureIds = (entry.quiniela?.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
      const map = new Map();
      for (const fid of fixtureIds) {
        const r = fixtureIdToResult.get(fid);
        if (r != null) map.set(fid, r);
      }
      byQuiniela.set(String(qid), map);
    }
  }
  return byQuiniela;
}

exports.getMyEntriesForQuiniela = async (req, res) => {
  try {
    const quinielaId = req.params.id;
    const entries = await QuinielaEntry.find({ quiniela: quinielaId, user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('quiniela');
    const quiniela = entries[0]?.quiniela;
    const fixtureIds = (quiniela?.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
    let liveFixtures = [];
    try {
      liveFixtures = fixtureIds.length > 0 ? await fetchFixturesByIds(fixtureIds) : [];
    } catch (e) {
      console.warn('[Quiniela] getMyEntriesForQuiniela: fetch fixtures failed', e.message);
    }
    const resultsMap = new Map();
    for (const f of liveFixtures) {
      const short = (f?.status?.short || '').toUpperCase();
      if (!FINISHED_STATUSES.has(short)) continue;
      const result = resultFromScore(f?.score?.home, f?.score?.away);
      if (result != null) resultsMap.set(f.fixtureId, result);
    }
    const totalPossible = resultsMap.size;
    const payload = entries.map((entry) => {
      const o = entry.toObject ? entry.toObject() : entry;
      return { ...o, score: scoreForEntry(entry, resultsMap), totalPossible };
    });
    res.json(payload);
  } catch (err) {
    console.error('[Quiniela] getMyEntriesForQuiniela error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyEntries = async (req, res) => {
  try {
    const entries = await QuinielaEntry.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('quiniela');
    const allFixtureIds = [...new Set(entries.flatMap((e) => (e.quiniela?.fixtures || []).map((f) => f.fixtureId).filter(Boolean)))];
    let liveFixtures = [];
    try {
      liveFixtures = allFixtureIds.length > 0 ? await fetchFixturesByIds(allFixtureIds) : [];
    } catch (e) {
      console.warn('[Quiniela] getMyEntries: fetch fixtures failed', e.message);
    }
    const resultsByQuiniela = buildResultsByQuiniela(entries, liveFixtures);

    const payload = entries.map((entry) => {
      const q = entry.toObject ? entry.toObject() : entry;
      const qid = q.quiniela?._id ?? q.quiniela;
      const resultsMap = resultsByQuiniela.get(String(qid)) || new Map();
      const totalPossible = resultsMap.size;
      const score = scoreForEntry(entry, resultsMap);
      return { ...q, score, totalPossible };
    });
    res.json(payload);
  } catch (err) {
    console.error('[Quiniela] getMyEntries error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateQuiniela = async (req, res) => {
  try {
    const quiniela = await Quiniela.findById(req.params.id);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });
    const { name, description, prize, cost, currency, fixtures } = req.body || {};
    if (name !== undefined) quiniela.name = String(name).trim();
    if (description !== undefined) quiniela.description = String(description || '').trim();
    if (prize !== undefined) quiniela.prize = String(prize).trim();
    if (cost !== undefined) quiniela.cost = String(cost).trim();
    if (currency !== undefined) quiniela.currency = String(currency || 'MXN').trim();
    if (Array.isArray(fixtures) && fixtures.length > 0) {
      quiniela.fixtures = fixtures.map((f) => ({
        fixtureId: f.fixtureId,
        leagueId: f.leagueId,
        leagueName: f.leagueName || '',
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        homeTeam: f.homeTeam || '',
        awayTeam: f.awayTeam || '',
        homeLogo: f.homeLogo || '',
        awayLogo: f.awayLogo || '',
        kickoff: f.kickoff ? new Date(f.kickoff) : new Date(),
        status: f.status || '',
      }));
      const dates = quiniela.fixtures.map((f) => f.kickoff).filter(Boolean).sort((a, b) => a - b);
      if (dates.length) {
        quiniela.startDate = dates[0];
        quiniela.endDate = dates[dates.length - 1];
      }
    }
    quiniela.updatedAt = new Date();
    await quiniela.save();
    const doc = quiniela.toObject();
    const entriesCount = await QuinielaEntry.countDocuments({ quiniela: quiniela._id });
    res.json({ ...doc, entriesCount });
  } catch (err) {
    console.error('[Quiniela] update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteQuiniela = async (req, res) => {
  try {
    const quiniela = await Quiniela.findById(req.params.id);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });
    await QuinielaEntry.deleteMany({ quiniela: quiniela._id });
    await Quiniela.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('[Quiniela] delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const quinielaId = req.params.id;
    const top = Math.min(Math.max(Number(req.query.top) || 5, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const quiniela = await Quiniela.findById(quinielaId).lean();
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });

    const fixtureIds = (quiniela.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
    let liveFixtures = [];
    try {
      liveFixtures = fixtureIds.length > 0 ? await fetchFixturesByIds(fixtureIds) : [];
    } catch (e) {
      console.warn('[Quiniela] getLeaderboard: fetch fixtures failed', e.message);
    }
    const resultsByFixtureId = new Map();
    for (const f of liveFixtures) {
      const short = (f?.status?.short || '').toUpperCase();
      if (!FINISHED_STATUSES.has(short)) continue;
      const result = resultFromScore(f?.score?.home, f?.score?.away);
      if (result != null) resultsByFixtureId.set(f.fixtureId, result);
    }

    const entries = await QuinielaEntry.find({ quiniela: quinielaId })
      .sort({ entryNumber: 1, createdAt: 1 })
      .populate('user', 'displayName email');
    const totalPossible = resultsByFixtureId.size;

    const rows = entries.map((entry) => {
      let score = 0;
      for (const pick of entry.picks || []) {
        if (resultsByFixtureId.get(pick.fixtureId) === pick.pick) score += 1;
      }
      const user = entry.user || {};
      return {
        entryId: String(entry._id),
        entryNumber: entry.entryNumber ?? 0,
        userId: user._id != null ? String(user._id) : null,
        displayName: user.displayName || user.email || 'Participant',
        score,
        totalPossible,
      };
    });

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.entryNumber || 0) - (b.entryNumber || 0);
    });
    const fullLeaderboard = rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
    const totalCount = fullLeaderboard.length;

    const usePagination = req.query.offset != null || req.query.limit != null;
    const leaderboard = usePagination
      ? fullLeaderboard.slice(offset, offset + limit)
      : fullLeaderboard.slice(0, top);

    let userEntry = null;
    if (req.user && req.user._id) {
      const userRow = fullLeaderboard.find((r) => r.userId === String(req.user._id));
      if (userRow) {
        userEntry = {
          rank: userRow.rank,
          score: userRow.score,
          totalPossible: userRow.totalPossible,
          displayName: userRow.displayName,
        };
      }
    }

    res.json({ leaderboard, totalCount, totalPossible, userEntry });
  } catch (err) {
    console.error('[Quiniela] getLeaderboard error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
