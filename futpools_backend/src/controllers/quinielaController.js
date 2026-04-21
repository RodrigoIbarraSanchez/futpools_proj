const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const User = require('../models/User');
const { fetchFixturesByIds } = require('../services/apiFootball');
const { isAdminUser } = require('../middleware/auth');

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

// Invite-code alphabet: uppercase alphanumeric minus confusable chars (0/O/1/I).
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

/** Try up to 5 times to find a non-colliding invite code. */
async function mintUniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const existing = await Quiniela.findOne({ inviteCode: code }).select('_id').lean();
    if (!existing) return code;
  }
  throw new Error('Could not mint a unique invite code after 5 attempts');
}

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

/**
 * Create a user-owned pool. MVP: free pools only (no entry fee / prize pool).
 * Any authenticated user can call this. Fixtures must be non-empty and all
 * kickoffs must be in the future.
 */
exports.createQuiniela = async (req, res) => {
  try {
    const { name, description, prizeLabel, visibility, fixtures } = req.body || {};

    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(400).json({ message: 'At least one fixture is required' });
    }

    // Live statuses from API-Football — kickoff is in the past but the match
    // hasn't finished, so it's still fair game for a pool (useful for demos).
    const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

    const now = new Date();
    const normalizedFixtures = [];
    for (const f of fixtures) {
      const kickoff = f.kickoff ? new Date(f.kickoff) : null;
      if (!kickoff || isNaN(kickoff.getTime())) {
        return res.status(400).json({ message: 'All fixtures need a valid kickoff' });
      }
      const status = String(f.status || '').toUpperCase();
      const isLive = LIVE_STATUSES.has(status);
      if (kickoff <= now && !isLive) {
        return res.status(400).json({ message: 'All fixture kickoffs must be in the future or live' });
      }
      if (!f.homeTeam || !f.awayTeam) {
        return res.status(400).json({ message: 'Each fixture needs homeTeam and awayTeam' });
      }
      normalizedFixtures.push({
        fixtureId: f.fixtureId,
        leagueId: f.leagueId,
        leagueName: f.leagueName || '',
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        homeTeam: String(f.homeTeam),
        awayTeam: String(f.awayTeam),
        homeLogo: f.homeLogo || '',
        awayLogo: f.awayLogo || '',
        kickoff,
        status: f.status || '',
      });
    }

    const dates = normalizedFixtures.map((f) => f.kickoff).sort((a, b) => a - b);
    // Only admins can create public pools. Everyone else is forced to private,
    // regardless of what the client sends — keeps the "public" surface curated.
    const vis = visibility === 'public' && isAdminUser(req.user) ? 'public' : 'private';
    const inviteCode = await mintUniqueInviteCode();

    const doc = await Quiniela.create({
      name: trimmedName,
      description: String(description || '').trim(),
      prize: '',           // legacy field unused in MVP free pools
      prizeLabel: String(prizeLabel || '').trim(),
      cost: '0',           // MVP = free, no entry fee
      currency: 'MXN',
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      fixtures: normalizedFixtures,
      featured: false,
      createdBy: req.user._id,
      visibility: vis,
      inviteCode,
    });

    console.log(`[Quiniela] create user=${req.user._id} code=${inviteCode} fixtures=${normalizedFixtures.length}`);
    const out = addPoolStatus({
      ...doc.toObject(),
      entriesCount: 0,
      createdBy: req.user._id,
      createdByUsername: req.user.username,
      createdByDisplayName: req.user.displayName,
    });
    res.status(201).json(out);
  } catch (err) {
    console.error('[Quiniela] create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Resolve a share link like `futpools://p/ABC23456` → full pool doc. Public. */
exports.getQuinielaByInvite = async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ message: 'Missing code' });
    const doc = await Quiniela.findOne({ inviteCode: code })
      .populate('createdBy', 'username displayName')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Invite not found' });
    const entriesCount = await QuinielaEntry.countDocuments({ quiniela: doc._id });
    res.json(addPoolStatus({
      ...doc,
      entriesCount,
      createdByUsername: doc.createdBy?.username || null,
      createdByDisplayName: doc.createdBy?.displayName || null,
      createdBy: doc.createdBy?._id || null,
    }));
  } catch (err) {
    console.error('[Quiniela] byInvite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Pools created by the authenticated user (for "MY CREATED POOLS" surface). */
exports.getMyCreatedQuinielas = async (req, res) => {
  try {
    const list = await Quiniela.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    const ids = list.map((q) => q._id);
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: ids } } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json(list.map((q) => addPoolStatus({
      ...q,
      entriesCount: countMap.get(String(q._id)) ?? 0,
      createdByUsername: req.user.username,
      createdByDisplayName: req.user.displayName,
    })));
  } catch (err) {
    console.error('[Quiniela] getMine error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQuinielas = async (req, res) => {
  try {
    // Discovery list: public pools + legacy pools without visibility + the
    // caller's own private pools (so they show up in MINE/ALL filters). Other
    // people's private pools stay reachable only by invite code.
    const visibilityClauses = [{ visibility: 'public' }, { visibility: { $exists: false } }];
    if (req.user?._id) {
      visibilityClauses.push({ visibility: 'private', createdBy: req.user._id });
    }
    const list = await Quiniela.find({ $or: visibilityClauses })
      .populate('createdBy', 'username displayName')
      .sort({ startDate: 1 })
      .lean();
    const ids = list.map((q) => q._id);
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: ids } } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const withCounts = list.map((q) => addPoolStatus({
      ...q,
      entriesCount: countMap.get(String(q._id)) ?? 0,
      createdByUsername: q.createdBy?.username || null,
      createdByDisplayName: q.createdBy?.displayName || null,
      createdBy: q.createdBy?._id || null,
    }));
    res.json(withCounts);
  } catch (err) {
    console.error('[Quiniela] list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQuinielaById = async (req, res) => {
  try {
    const doc = await Quiniela.findById(req.params.id)
      .populate('createdBy', 'username displayName')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Quiniela not found' });
    const entriesCount = await QuinielaEntry.countDocuments({ quiniela: req.params.id });
    res.json(addPoolStatus({
      ...doc,
      entriesCount,
      createdByUsername: doc.createdBy?.username || null,
      createdByDisplayName: doc.createdBy?.displayName || null,
      createdBy: doc.createdBy?._id || null,
    }));
  } catch (err) {
    console.error('[Quiniela] byId error:', err.message);
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
    // Prefer the doc already loaded by requireOwnerOrAdmin when present.
    const quiniela = req.resource || await Quiniela.findById(req.params.id);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });
    const { name, description, prize, prizeLabel, cost, currency, fixtures, featured, visibility } = req.body || {};

    // Field-level guard: `featured` is admin-only regardless of ownership.
    if (featured !== undefined && !isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Only admins can change the featured flag' });
    }

    if (name !== undefined) quiniela.name = String(name).trim();
    if (description !== undefined) quiniela.description = String(description || '').trim();
    if (prize !== undefined) quiniela.prize = String(prize).trim();
    if (prizeLabel !== undefined) quiniela.prizeLabel = String(prizeLabel || '').trim();
    if (cost !== undefined) quiniela.cost = String(cost).trim();
    if (currency !== undefined) quiniela.currency = String(currency || 'MXN').trim();
    if (featured !== undefined) quiniela.featured = Boolean(featured);
    if (visibility !== undefined && ['public', 'private'].includes(visibility)) {
      // Only admins can switch a pool to public. Owners can still flip their
      // own pool back to private, but public requires admin blessing.
      if (visibility === 'public' && !isAdminUser(req.user)) {
        return res.status(403).json({ message: 'Only admins can make a pool public' });
      }
      quiniela.visibility = visibility;
    }
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
