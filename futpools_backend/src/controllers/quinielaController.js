const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');
const User = require('../models/User');
const { fetchFixturesByIds } = require('../services/apiFootball');
const { isAdminUser } = require('../middleware/auth');
const { applyScoringToQuiniela } = require('./ratingController');
const { debitOrFail, applyDelta } = require('../services/transactionService');

/**
 * Resolve the coin cost a participant pays/paid for a single entry in the
 * given pool. Mirrors the logic in `submitEntry` so that refunds on delete
 * return the exact amount debited on create. Sponsored pools are always
 * free; peer pools use `entryCostCoins`; legacy pools parse the string
 * `cost` (pre-v3 field).
 */
function resolveEntryCost(quiniela) {
  if (quiniela.fundingModel === 'sponsored') return 0;
  if (Number(quiniela.entryCostCoins) > 0) return Number(quiniela.entryCostCoins);
  return parseFloat(String(quiniela.cost).replace(/[^0-9.-]/g, '')) || 0;
}

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

/**
 * Compute pool status from fixtures: scheduled | live | completed.
 *
 * The `fixture.status` we persist on the Quiniela doc is frozen at create
 * time — it never transitions to FT even after the match finishes in the
 * real world. If we trusted it alone, a completed pool would look 'live'
 * forever (kickoff in past + stored status == "NS" → anyStarted + !allFinished).
 *
 * The `liveStatusMap` parameter lets callers pass a fixtureId → currentStatus
 * map sourced from API-Football so the computation reflects reality. Live
 * map keys beat the stored value; a missing key falls back to the snapshot.
 */
function computePoolStatus(fixtures, liveStatusMap) {
  if (!fixtures || fixtures.length === 0) return 'scheduled';
  const now = new Date();
  let allFinished = true;
  let anyStarted = false;
  for (const f of fixtures) {
    const liveShort = liveStatusMap && f.fixtureId ? liveStatusMap.get(f.fixtureId) : null;
    const short = (liveShort || String(f.status || '')).trim().toUpperCase();
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

function addPoolStatus(quiniela, liveStatusMap) {
  return { ...quiniela, status: computePoolStatus(quiniela.fixtures || [], liveStatusMap) };
}

/**
 * Batch-fetch current fixture statuses for a list of pools. One round-trip
 * to API-Football (which is itself cached 25s upstream) regardless of how
 * many pools are in the list. Returns a Map<fixtureId, shortStatus>.
 */
async function buildLiveStatusMap(pools) {
  const fixtureIds = [...new Set(
    pools.flatMap((q) => (q.fixtures || []).map((f) => f.fixtureId).filter(Boolean))
  )];
  if (fixtureIds.length === 0) return new Map();
  try {
    const live = await fetchFixturesByIds(fixtureIds);
    return new Map(live.map((f) => [f.fixtureId, (f?.status?.short || '').toUpperCase()]));
  } catch (err) {
    console.warn('[Quiniela] live status fetch failed:', err.message);
    return new Map();
  }
}

/**
 * Sort pools so users see them in the order that makes sense:
 *   1. LIVE (something is happening right now)
 *   2. SCHEDULED (upcoming — soonest first, so today's pools appear first)
 *   3. COMPLETED (already settled — most-recently finished first, so users
 *      see their latest result at the top of the completed bucket)
 * Stale completed pools from last month drift to the bottom naturally.
 */
const POOL_STATUS_RANK = { live: 0, scheduled: 1, completed: 2 };
function sortPoolsByStatus(pools) {
  return [...pools].sort((a, b) => {
    const rankA = POOL_STATUS_RANK[a.status] ?? 99;
    const rankB = POOL_STATUS_RANK[b.status] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    if (a.status === 'completed') {
      return new Date(b.endDate || b.startDate) - new Date(a.endDate || a.startDate);
    }
    return new Date(a.startDate) - new Date(b.startDate);
  });
}

/**
 * Create a user-owned pool. MVP: free pools only (no entry fee / prize pool).
 * Any authenticated user can call this. Fixtures must be non-empty and all
 * kickoffs must be in the future.
 */
exports.createQuiniela = async (req, res) => {
  try {
    const {
      name, description, prizeLabel, visibility, fixtures,
      entryCostCoins: rawEntryCost,
      prizeCoins: rawPrizeCoins,
    } = req.body || {};

    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(400).json({ message: 'At least one fixture is required' });
    }

    // Live statuses from API-Football — kickoff is in the past but the match
    // hasn't finished, so it's still fair game for a pool (useful for demos).
    const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
    const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD']);
    // Window within which a "not started" fixture is still acceptable even if
    // the nominal kickoff is past. Some feeds lag — Real Madrid's actual
    // kickoff can be 15-30 min after the scheduled time, and we don't want a
    // 400 to block the user mid-demo. 3 hours covers the whole game length.
    const LIVE_TOLERANCE_MS = 3 * 60 * 60 * 1000;

    const now = new Date();
    const normalizedFixtures = [];
    for (const f of fixtures) {
      const kickoff = f.kickoff ? new Date(f.kickoff) : null;
      if (!kickoff || isNaN(kickoff.getTime())) {
        return res.status(400).json({ message: 'All fixtures need a valid kickoff' });
      }
      const status = String(f.status || '').toUpperCase();
      const isLive = LIVE_STATUSES.has(status);
      const isFinished = FINISHED_STATUSES.has(status);
      const withinWindow = kickoff.getTime() > now.getTime() - LIVE_TOLERANCE_MS;
      if (isFinished) {
        return res.status(400).json({ message: 'Finished fixtures cannot be added to a pool' });
      }
      if (kickoff <= now && !isLive && !withinWindow) {
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

    // Entry-cost gating (v3 peer pool, 3-tier simplification):
    //   25   — Casual
    //   100  — Standard
    //   500  — High Stakes
    // 0 means "not a peer pool". Reducing from 6 presets to 3 matches
    // competitor UX norms (Sleeper/DraftKings) and lowers analysis paralysis.
    const ENTRY_COST_PRESETS = new Set([0, 25, 100, 500]);
    const entryCostCoins = ENTRY_COST_PRESETS.has(Number(rawEntryCost)) ? Number(rawEntryCost) : 0;

    // Sponsored prize gating (v3, 3-tier): 50 Casual / 250 Standard / 1000
    // High Stakes. 0 = not sponsored. Same rationale as entry presets above.
    const PRIZE_COIN_PRESETS = new Set([0, 50, 250, 1000]);
    const prizeCoins = PRIZE_COIN_PRESETS.has(Number(rawPrizeCoins)) ? Number(rawPrizeCoins) : 0;

    // Mutex: can't be both peer AND sponsored. If client sends both, reject —
    // a pool has ONE economy model. This matches the simplified wizard UX.
    if (entryCostCoins > 0 && prizeCoins > 0) {
      return res.status(400).json({
        message: 'A pool is either peer-pay or creator-sponsored, not both',
        code: 'MUTUALLY_EXCLUSIVE_FUNDING',
      });
    }

    // Pick the funding model + min participants for the chosen economy.
    const fundingModel = prizeCoins > 0 ? 'sponsored' : (entryCostCoins > 0 ? 'peer' : 'none');
    // Sponsored needs at least 2 participants (else no contest). Peer also 2.
    // For a thicker default on sponsored, we scale with fixture count — a
    // 12-fixture pool should gather more players to feel legit.
    const minParticipants =
      fundingModel === 'sponsored' ? Math.max(2, Math.floor(normalizedFixtures.length / 3)) :
      fundingModel === 'peer' ? 2 : 1;

    // Sponsored flow: debit creator upfront for prize × 1.1 BEFORE we create
    // the pool document. If balance is insufficient, bail early so we never
    // leave a phantom pool behind. The rake (10% fee) stays in the system as
    // a virtual sink — it does NOT enter the pot.
    let sponsorDebitKey = null;
    const inviteCode = await mintUniqueInviteCode();
    if (fundingModel === 'sponsored') {
      const RAKE = 0.10;
      const totalToDebit = Math.ceil(prizeCoins * (1 + RAKE));
      // Tie the idempotency key to the invite code — unique per pool attempt.
      sponsorDebitKey = `sponsor:${inviteCode}`;
      const result = await debitOrFail({
        userId: req.user._id,
        amount: totalToDebit,
        kind: 'sponsorship_debit',
        idempotencyKey: sponsorDebitKey,
        note: `Sponsor prize ${prizeCoins} coins for pool ${trimmedName}`,
      });
      if (!result.ok) {
        return res.status(400).json({
          message: 'Insufficient balance to sponsor this prize',
          code: 'INSUFFICIENT_BALANCE',
          needed: totalToDebit,
          currentBalance: result.balance,
        });
      }
    }

    const doc = await Quiniela.create({
      name: trimmedName,
      description: String(description || '').trim(),
      prize: '',           // legacy field unused in v3
      prizeLabel: String(prizeLabel || '').trim(),
      cost: String(entryCostCoins),  // mirror into legacy field for UI back-compat
      currency: 'COIN',
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      fixtures: normalizedFixtures,
      featured: false,
      createdBy: req.user._id,
      visibility: vis,
      inviteCode,
      fundingModel,
      entryCostCoins,
      platformPrizeCoins: prizeCoins, // sponsored → creator's prize lives here
      prizeFunderUserId: fundingModel === 'sponsored' ? req.user._id : undefined,
      minParticipants,
      rakePercent: 10,
      prizeLockStatus: 'pledged',
      settlementStatus: 'pending',
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
    const liveStatusMap = await buildLiveStatusMap(list);
    const withCounts = list.map((q) => addPoolStatus({
      ...q,
      entriesCount: countMap.get(String(q._id)) ?? 0,
      createdByUsername: req.user.username,
      createdByDisplayName: req.user.displayName,
    }, liveStatusMap));
    res.json(sortPoolsByStatus(withCounts));
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
      .lean();
    const ids = list.map((q) => q._id);
    const counts = await QuinielaEntry.aggregate([
      { $match: { quiniela: { $in: ids } } },
      { $group: { _id: '$quiniela', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    // Cross-reference with live fixture data so completed pools don't keep
    // claiming to be 'live' just because the stored status snapshot is stale.
    const liveStatusMap = await buildLiveStatusMap(list);
    const withCounts = list.map((q) => addPoolStatus({
      ...q,
      entriesCount: countMap.get(String(q._id)) ?? 0,
      createdByUsername: q.createdBy?.username || null,
      createdByDisplayName: q.createdBy?.displayName || null,
      createdBy: q.createdBy?._id || null,
    }, liveStatusMap));
    // Live first, then upcoming (sooner = higher), then completed (recently
    // finished = higher within the bucket). Users scan tops-down.
    res.json(sortPoolsByStatus(withCounts));
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
    const liveStatusMap = await buildLiveStatusMap([doc]);
    res.json(addPoolStatus({
      ...doc,
      entriesCount,
      createdByUsername: doc.createdBy?.username || null,
      createdByDisplayName: doc.createdBy?.displayName || null,
      createdBy: doc.createdBy?._id || null,
    }, liveStatusMap));
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

    // Block submissions once any fixture has kicked off. Historically this
    // handler accepted entries at any time — the client disabled the CTA but
    // a direct API hit would succeed, which violates the core contract that
    // picks are frozen at kickoff.
    if (computePoolStatus(quiniela.fixtures || [], null) !== 'scheduled') {
      return res.status(400).json({ message: 'Pool already started', code: 'POOL_STARTED' });
    }

    const coinCost = resolveEntryCost(quiniela);

    // Reserve the entry doc id up-front so the ledger idempotency key can
    // reference it. The debit runs BEFORE the entry is persisted to avoid a
    // window where balance is decremented but the pool has no record of the
    // entry existing.
    const entryCount = await QuinielaEntry.countDocuments({ quiniela: quinielaId, user: req.user._id });
    const entry = new QuinielaEntry({
      quiniela: quinielaId,
      user: req.user._id,
      entryNumber: entryCount + 1,
      picks,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (coinCost > 0) {
      const result = await debitOrFail({
        userId: req.user._id,
        amount: coinCost,
        kind: 'entry_debit',
        idempotencyKey: `entry:${entry._id}`,
        quiniela: quinielaId,
        entry: entry._id,
        note: `Entry #${entry.entryNumber} in ${quiniela.name}`,
      });
      if (!result.ok) {
        return res.status(400).json({
          message: 'Insufficient balance',
          code: 'INSUFFICIENT_BALANCE',
          entryCost: coinCost,
          currentBalance: result.balance,
        });
      }
    }

    await entry.save();
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

    // Fire-and-forget scoring hook: once all fixtures are FT, `applyScoringToQuiniela`
    // updates user rating/streaks/achievements and stamps entries with scoredAt.
    // Idempotent — repeat calls on already-scored pools are no-ops. A cron in Phase
    // 2 will replace this opportunistic trigger, but reading a finished leaderboard
    // is a reasonable moment to settle for Phase 1.
    if (totalPossible > 0 && totalPossible === (quiniela.fixtures || []).length) {
      applyScoringToQuiniela(quinielaId).catch((err) => {
        console.warn('[Quiniela] post-leaderboard scoring failed', err.message);
      });
    }
  } catch (err) {
    console.error('[Quiniela] getLeaderboard error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /quinielas/:id/participants — creator/admin view of who has entered.
 *
 * Mounted behind `requireOwnerOrAdmin` so only the pool's creator (or a
 * platform admin) sees it. `picks` is included only once the pool has
 * started (status !== 'scheduled'): exposing picks to the creator before
 * kickoff would let them moderate based on who guessed well ("kick the
 * one with the lucky picks"), breaking fairness. After kickoff the picks
 * are locked and reveal is harmless — at that point the creator gets the
 * same view participants see on the leaderboard, just grouped by player.
 */
exports.getParticipants = async (req, res) => {
  try {
    const quinielaId = req.params.id;
    // `req.resource` is populated by requireOwnerOrAdmin — no second fetch.
    const quiniela = req.resource || await Quiniela.findById(quinielaId);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });

    const status = computePoolStatus(quiniela.fixtures || [], null);
    const exposePicks = status !== 'scheduled';

    const entries = await QuinielaEntry.find({ quiniela: quinielaId })
      .populate('user', 'username displayName')
      .sort({ createdAt: 1 })
      .lean();

    // Group by user, preserving entry order.
    const byUser = new Map();
    for (const e of entries) {
      const uid = String(e.user?._id || e.user || 'unknown');
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          user: e.user
            ? { id: String(e.user._id), username: e.user.username, displayName: e.user.displayName }
            : { id: uid, username: null, displayName: null },
          entryCount: 0,
          firstEntryAt: e.createdAt,
          entries: [],
        });
      }
      const row = byUser.get(uid);
      row.entryCount += 1;
      const entryOut = {
        _id: String(e._id),
        entryNumber: e.entryNumber,
        createdAt: e.createdAt,
        score: typeof e.score === 'number' ? e.score : null,
        totalPossible: typeof e.totalPossibleAtScoring === 'number' ? e.totalPossibleAtScoring : null,
      };
      if (exposePicks) {
        entryOut.picks = (e.picks || []).map((p) => ({
          fixtureId: p.fixtureId,
          pick: p.pick,
        }));
      }
      row.entries.push(entryOut);
    }

    res.json({
      status,
      picksHidden: !exposePicks,
      participants: [...byUser.values()],
    });
  } catch (err) {
    console.error('[Quiniela] getParticipants error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /quinielas/:id/entries/:entryId — entry owner edits their own picks.
 *
 * Only the user who submitted the entry can edit it. Neither the pool
 * creator nor admins are allowed — editing someone else's picks would be
 * tampering, not moderation. Blocked once the pool has started.
 */
exports.updateEntry = async (req, res) => {
  try {
    const { id: quinielaId, entryId } = req.params;
    const { picks } = req.body || {};
    if (!Array.isArray(picks) || picks.length === 0) {
      return res.status(400).json({ message: 'Picks are required' });
    }

    const entry = await QuinielaEntry.findOne({ _id: entryId, quiniela: quinielaId });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    if (String(entry.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const quiniela = await Quiniela.findById(quinielaId);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });
    if (computePoolStatus(quiniela.fixtures || [], null) !== 'scheduled') {
      return res.status(400).json({ message: 'Pool already started', code: 'POOL_STARTED' });
    }

    // Validate each pick: fixtureId must exist in the pool, value must be 1/X/2.
    const validFixtureIds = new Set((quiniela.fixtures || []).map((f) => Number(f.fixtureId)));
    const validPicks = new Set(['1', 'X', '2']);
    for (const p of picks) {
      if (!validFixtureIds.has(Number(p.fixtureId)) || !validPicks.has(String(p.pick))) {
        return res.status(400).json({ message: 'Invalid pick', invalid: p });
      }
    }

    entry.picks = picks;
    entry.updatedAt = new Date();
    await entry.save();
    await entry.populate('quiniela');
    res.json(entry);
  } catch (err) {
    console.error('[Quiniela] updateEntry error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /quinielas/:id/entries/:entryId — remove a single entry.
 *
 * Authorized for: the entry's owner (self-withdraw), the pool creator
 * (kicking), or a platform admin. Blocked once the pool has started — once
 * fixtures kick off, every entry is locked to preserve the leaderboard.
 *
 * Refund: if the pool debited coins on create, we credit the same amount
 * back to the entry owner (NOT the requester — a creator kicking a player
 * refunds the player, not themselves). Keyed by `refund:entry:<entryId>`
 * so a duplicate DELETE — or a retry mid-flight — doesn't double-credit.
 */
exports.deleteEntry = async (req, res) => {
  try {
    const { id: quinielaId, entryId } = req.params;
    const entry = await QuinielaEntry.findOne({ _id: entryId, quiniela: quinielaId });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const quiniela = await Quiniela.findById(quinielaId);
    if (!quiniela) return res.status(404).json({ message: 'Quiniela not found' });

    const requesterId = String(req.user._id);
    const entryOwnerId = String(entry.user);
    const creatorId = quiniela.createdBy ? String(quiniela.createdBy) : null;
    const isSelf = requesterId === entryOwnerId;
    const isCreator = creatorId && requesterId === creatorId;
    const isAdmin = isAdminUser(req.user);
    if (!isSelf && !isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    if (computePoolStatus(quiniela.fixtures || [], null) !== 'scheduled') {
      return res.status(400).json({ message: 'Pool already started', code: 'POOL_STARTED' });
    }

    // Refund first, delete second. If the refund fails mid-flight, a retry
    // of DELETE will hit the idempotency key and skip the double-credit —
    // and the entry still exists, so the client sees a consistent state.
    const coinCost = resolveEntryCost(quiniela);
    let refundedAmount = 0;
    if (coinCost > 0) {
      const result = await applyDelta({
        userId: entry.user,
        amount: coinCost,
        kind: 'refund_credit',
        idempotencyKey: `refund:entry:${entry._id}`,
        quiniela: quinielaId,
        entry: entry._id,
        note: `Entry #${entry.entryNumber} removed before kickoff`,
      });
      if (result.applied) refundedAmount = coinCost;
    }

    await entry.deleteOne();
    res.json({ ok: true, refundedAmount, entryId: String(entry._id) });
  } catch (err) {
    console.error('[Quiniela] deleteEntry error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
