const User = require('../models/User');
const Challenge = require('../models/Challenge');
const { ALLOWED_STAKES, MARKET_TYPES, VALID_PICKS } = Challenge;
const { debitOrFail, applyDelta } = require('../services/transactionService');
const { settleChallengeIfEligible, settleMany } = require('../services/challengeSettlement');

// Same confusable-safe alphabet as invite codes. 8 chars = 32^8 ≈ 1T — zero
// collision anxiety at FutPools scale with the retry loop below.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function mintUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const existing = await Challenge.findOne({ code }).select('_id').lean();
    if (!existing) return code;
  }
  throw new Error('Could not mint a unique challenge code');
}

/**
 * Resolve an opponent identifier to a User document. Accepts:
 *   - `opponentUserId`: raw Mongo id (from iOS app after picking a friend)
 *   - `opponentUsername`: case-insensitive username (human-facing share flow)
 *
 * Returns { user, error } — exactly one is non-null.
 */
async function resolveOpponent({ opponentUserId, opponentUsername }) {
  if (opponentUserId) {
    const u = await User.findById(opponentUserId).select('_id username displayName').lean();
    if (!u) return { error: 'Opponent not found' };
    return { user: u };
  }
  if (opponentUsername) {
    const u = await User.findOne({
      username: String(opponentUsername).trim().toLowerCase(),
    }).select('_id username displayName').lean();
    if (!u) return { error: 'Opponent not found' };
    return { user: u };
  }
  return { error: 'opponentUserId or opponentUsername required' };
}

/**
 * Shape returned to the client. Intentionally mirrors the raw document so the
 * mobile/web clients can decode with a single DTO, plus a computed `youAre`
 * field so the UI doesn't need to compare ids itself.
 */
function serializeChallenge(c, meUserId) {
  const me = meUserId ? String(meUserId) : null;
  const challengerId = String(c.challenger?._id || c.challenger);
  const opponentId = c.opponent ? String(c.opponent?._id || c.opponent) : null;
  const youAre = me === challengerId ? 'challenger'
    : me === opponentId ? 'opponent'
    : null;
  return {
    _id: String(c._id),
    code: c.code,
    challenger: populatedUser(c.challenger),
    opponent: populatedUser(c.opponent),
    stakeCoins: c.stakeCoins,
    marketType: c.marketType,
    challengerPick: c.challengerPick,
    opponentPick: c.opponentPick,
    fixture: c.fixture,
    status: c.status,
    winnerUserId: c.winnerUserId ? String(c.winnerUserId) : null,
    outcomeKey: c.outcomeKey,
    rakePercent: c.rakePercent,
    createdAt: c.createdAt,
    acceptedAt: c.acceptedAt,
    settledAt: c.settledAt,
    youAre,
  };
}

function populatedUser(u) {
  if (!u) return null;
  if (typeof u === 'string' || (u._bsontype === 'ObjectID')) return { id: String(u) };
  return {
    id: String(u._id || u.id),
    username: u.username,
    displayName: u.displayName,
  };
}

/** POST /challenges — body: { opponentUserId|opponentUsername, fixture, marketType, challengerPick, stakeCoins } */
exports.createChallenge = async (req, res) => {
  try {
    const {
      opponentUserId, opponentUsername,
      fixture, marketType, challengerPick, stakeCoins,
    } = req.body || {};

    if (!ALLOWED_STAKES.includes(Number(stakeCoins))) {
      return res.status(400).json({ message: 'Invalid stake amount' });
    }
    if (!MARKET_TYPES.includes(marketType)) {
      return res.status(400).json({ message: 'Invalid market type' });
    }
    if (!VALID_PICKS[marketType].includes(challengerPick)) {
      return res.status(400).json({ message: 'Invalid pick for market' });
    }
    if (!fixture || !fixture.fixtureId || !fixture.kickoff) {
      return res.status(400).json({ message: 'Fixture is required' });
    }
    if (new Date(fixture.kickoff) <= new Date()) {
      return res.status(400).json({ message: 'Fixture already started', code: 'FIXTURE_STARTED' });
    }

    const { user: opponent, error } = await resolveOpponent({ opponentUserId, opponentUsername });
    if (error) return res.status(400).json({ message: error });
    if (String(opponent._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot challenge yourself' });
    }

    // Reserve the doc id BEFORE debiting so the ledger idempotency key can
    // reference it. Same pattern as submitEntry.
    const code = await mintUniqueCode();
    const challenge = new Challenge({
      code,
      challenger: req.user._id,
      opponent: opponent._id,
      stakeCoins: Number(stakeCoins),
      marketType,
      challengerPick,
      fixture: {
        fixtureId: Number(fixture.fixtureId),
        leagueId: fixture.leagueId,
        leagueName: fixture.leagueName || '',
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeLogo: fixture.homeLogo || '',
        awayLogo: fixture.awayLogo || '',
        kickoff: new Date(fixture.kickoff),
      },
      status: 'pending',
    });

    const debit = await debitOrFail({
      userId: req.user._id,
      amount: challenge.stakeCoins,
      kind: 'challenge_debit',
      idempotencyKey: `challenge:debit:${challenge._id}:challenger`,
      note: `Challenge ${challenge.code} created`,
    });
    if (!debit.ok) {
      return res.status(400).json({
        message: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        entryCost: challenge.stakeCoins,
        currentBalance: debit.balance,
      });
    }

    await challenge.save();
    await challenge.populate('challenger', 'username displayName');
    await challenge.populate('opponent', 'username displayName');
    res.status(201).json(serializeChallenge(challenge, req.user._id));
  } catch (err) {
    console.error('[Challenge] create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** GET /challenges/me?tab=sent|received|active|settled */
exports.listMine = async (req, res) => {
  try {
    const tab = String(req.query.tab || 'active');
    const userId = req.user._id;

    let filter;
    if (tab === 'sent')        filter = { challenger: userId };
    else if (tab === 'received') filter = { opponent: userId };
    else if (tab === 'settled') filter = { $or: [{ challenger: userId }, { opponent: userId }], status: { $in: ['settled', 'refunded', 'declined', 'cancelled'] } };
    else                        filter = { $or: [{ challenger: userId }, { opponent: userId }], status: { $in: ['pending', 'accepted'] } };

    const docs = await Challenge.find(filter)
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(100);

    const settled = await settleMany(docs);
    res.json(settled.map((c) => serializeChallenge(c, userId)));
  } catch (err) {
    console.error('[Challenge] listMine error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** GET /challenges/:id — must be challenger or opponent. */
exports.getById = async (req, res) => {
  try {
    const c = await Challenge.findById(req.params.id)
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName');
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    const uid = String(req.user._id);
    if (uid !== String(c.challenger?._id || c.challenger) &&
        uid !== String(c.opponent?._id || c.opponent)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await settleChallengeIfEligible(c);
    res.json(serializeChallenge(c, req.user._id));
  } catch (err) {
    console.error('[Challenge] getById error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /challenges/code/:code — invite-link resolver. Returns the challenge
 * if the requester is the intended opponent OR the creator. A random third
 * party hitting the link gets 403 so leaked codes don't leak metadata.
 */
exports.getByCode = async (req, res) => {
  try {
    const c = await Challenge.findOne({ code: String(req.params.code || '').toUpperCase() })
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName');
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    const uid = String(req.user._id);
    if (uid !== String(c.challenger?._id || c.challenger) &&
        uid !== String(c.opponent?._id || c.opponent)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await settleChallengeIfEligible(c);
    res.json(serializeChallenge(c, req.user._id));
  } catch (err) {
    console.error('[Challenge] getByCode error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** POST /challenges/:id/accept — body: { opponentPick } */
exports.acceptChallenge = async (req, res) => {
  try {
    const { opponentPick } = req.body || {};
    const c = await Challenge.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (String(c.opponent) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (c.status !== 'pending') {
      return res.status(400).json({ message: 'Challenge not pending', code: 'NOT_PENDING', status: c.status });
    }
    if (new Date(c.fixture.kickoff) <= new Date()) {
      return res.status(400).json({ message: 'Fixture already started', code: 'FIXTURE_STARTED' });
    }

    const allowed = VALID_PICKS[c.marketType] || [];
    if (!allowed.includes(opponentPick)) {
      return res.status(400).json({ message: 'Invalid pick for market' });
    }
    if (opponentPick === c.challengerPick) {
      return res.status(400).json({ message: 'Pick must differ from challenger', code: 'DUPLICATE_PICK' });
    }

    const debit = await debitOrFail({
      userId: req.user._id,
      amount: c.stakeCoins,
      kind: 'challenge_debit',
      idempotencyKey: `challenge:debit:${c._id}:opponent`,
      note: `Challenge ${c.code} accepted`,
    });
    if (!debit.ok) {
      return res.status(400).json({
        message: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        entryCost: c.stakeCoins,
        currentBalance: debit.balance,
      });
    }

    c.opponentPick = opponentPick;
    c.status = 'accepted';
    c.acceptedAt = new Date();
    await c.save();
    await c.populate('challenger', 'username displayName');
    await c.populate('opponent', 'username displayName');
    res.json(serializeChallenge(c, req.user._id));
  } catch (err) {
    console.error('[Challenge] accept error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** POST /challenges/:id/decline — opponent rejects; refund challenger. */
exports.declineChallenge = async (req, res) => {
  try {
    const c = await Challenge.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (String(c.opponent) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (c.status !== 'pending') {
      return res.status(400).json({ message: 'Challenge not pending', code: 'NOT_PENDING', status: c.status });
    }

    await applyDelta({
      userId: c.challenger,
      amount: c.stakeCoins,
      kind: 'refund_credit',
      idempotencyKey: `challenge:refund:${c._id}:challenger`,
      note: `Challenge ${c.code} declined by opponent`,
    });
    c.status = 'declined';
    c.settledAt = new Date();
    await c.save();
    res.json({ ok: true, status: c.status });
  } catch (err) {
    console.error('[Challenge] decline error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** DELETE /challenges/:id — challenger cancels before accept; refund self. */
exports.cancelChallenge = async (req, res) => {
  try {
    const c = await Challenge.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (String(c.challenger) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (c.status !== 'pending') {
      return res.status(400).json({ message: 'Challenge not pending', code: 'NOT_PENDING', status: c.status });
    }

    await applyDelta({
      userId: c.challenger,
      amount: c.stakeCoins,
      kind: 'refund_credit',
      idempotencyKey: `challenge:refund:${c._id}:challenger`,
      note: `Challenge ${c.code} cancelled by creator`,
    });
    c.status = 'cancelled';
    c.settledAt = new Date();
    await c.save();
    res.json({ ok: true, status: c.status });
  } catch (err) {
    console.error('[Challenge] cancel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
