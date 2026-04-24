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
 *
 * Callers should only invoke this when at least one of the two identifiers
 * was provided. createChallenge skips it entirely for open-mode challenges
 * (no opponent specified at create time).
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
  // `isOpen` is the source of truth for "any user can claim this slot".
  // It's *only* true while the challenge is pending with no opponent set —
  // once accepted, the slot is filled and no further claims should be
  // possible. The web client uses this to decide whether to show the
  // claim picker to a viewer who isn't the challenger.
  const isOpen = !opponentId && c.status === 'pending';
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
    isOpen,
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

/**
 * POST /challenges — body: {
 *   opponentUserId | opponentUsername | (omitted for open challenge),
 *   fixture, marketType, challengerPick, stakeCoins,
 * }
 *
 * If neither opponentUserId nor opponentUsername is provided, the challenge
 * is created in "open" mode (opponent: null) and can be claimed by any
 * non-challenger via the share link + accept flow.
 */
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

    // Open mode kicks in when caller didn't name a target. We deliberately
    // distinguish "missing identifier" (open) from "identifier supplied but
    // not found" (error) so a typo doesn't silently demote a directed
    // challenge into an open one.
    const opponentRequested = !!(opponentUserId || opponentUsername);
    let opponentId = null;
    if (opponentRequested) {
      const { user: opponent, error } = await resolveOpponent({ opponentUserId, opponentUsername });
      if (error) return res.status(400).json({ message: error });
      if (String(opponent._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'Cannot challenge yourself' });
      }
      opponentId = opponent._id;
    }

    // Reserve the doc id BEFORE debiting so the ledger idempotency key can
    // reference it. Same pattern as submitEntry.
    const code = await mintUniqueCode();
    const challenge = new Challenge({
      code,
      challenger: req.user._id,
      opponent: opponentId,
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

/**
 * Decide whether `viewerId` is allowed to read `c`. Challenger and (current)
 * opponent always see it. Third parties see *only* open pending challenges —
 * the share-link flow depends on this; once accepted, the slot is filled and
 * subsequent viewers get 403 to avoid metadata leaks on directed challenges.
 */
function canReadChallenge(c, viewerId) {
  const vid = String(viewerId);
  if (vid === String(c.challenger?._id || c.challenger)) return true;
  const oid = c.opponent ? String(c.opponent?._id || c.opponent) : null;
  if (oid && vid === oid) return true;
  if (!oid && c.status === 'pending') return true; // open challenge — anyone with the link may view
  return false;
}

/** GET /challenges/:id — challenger, opponent, or any authed user for an open pending. */
exports.getById = async (req, res) => {
  try {
    const c = await Challenge.findById(req.params.id)
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName');
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (!canReadChallenge(c, req.user._id)) {
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
 * GET /challenges/code/:code — invite-link resolver. Same access rules as
 * getById: challenger/opponent always; any authed viewer for open pending
 * (that's the whole point of an open invite). Directed challenges remain
 * private after acceptance so leaked codes don't leak metadata.
 */
exports.getByCode = async (req, res) => {
  try {
    const c = await Challenge.findOne({ code: String(req.params.code || '').toUpperCase() })
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName');
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (!canReadChallenge(c, req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await settleChallengeIfEligible(c);
    res.json(serializeChallenge(c, req.user._id));
  } catch (err) {
    console.error('[Challenge] getByCode error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /challenges/:id/accept — body: { opponentPick }
 *
 * Two paths:
 *   directed: req.user must equal the pre-set opponent. Save mutates the
 *             existing doc.
 *   open    : opponent is null on read. We debit first, then atomically
 *             claim the slot via findOneAndUpdate filtering on
 *             `opponent: null, status: pending` so two concurrent accepts
 *             can't both win. Loser of the race gets refunded.
 */
exports.acceptChallenge = async (req, res) => {
  try {
    const { opponentPick } = req.body || {};
    const c = await Challenge.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Challenge not found' });

    if (c.status !== 'pending') {
      return res.status(400).json({ message: 'Challenge not pending', code: 'NOT_PENDING', status: c.status });
    }
    if (new Date(c.fixture.kickoff) <= new Date()) {
      return res.status(400).json({ message: 'Fixture already started', code: 'FIXTURE_STARTED' });
    }

    const isOpen = !c.opponent;
    if (isOpen) {
      if (String(c.challenger) === String(req.user._id)) {
        return res.status(400).json({ message: 'Cannot accept your own challenge', code: 'SELF_ACCEPT' });
      }
    } else if (String(c.opponent) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
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
      // For open challenges the opponent is the claimer's id, so two
      // distinct claimers get distinct idempotency keys (no false skip).
      // For directed it's a stable string per user-challenge pair.
      idempotencyKey: `challenge:debit:${c._id}:opponent:${req.user._id}`,
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

    if (isOpen) {
      // Atomic slot claim. Filter on `opponent: null, status: 'pending'` so
      // a concurrent accept loses the race deterministically. We bypass the
      // pre-validate hook (findOneAndUpdate skips it), but every invariant
      // it would have checked is already enforced above.
      const claimed = await Challenge.findOneAndUpdate(
        { _id: c._id, opponent: null, status: 'pending' },
        { $set: {
            opponent: req.user._id,
            opponentPick,
            status: 'accepted',
            acceptedAt: new Date(),
          },
        },
        { new: true }
      );
      if (!claimed) {
        // Lost the race — somebody else just claimed the slot, or the
        // challenger cancelled in the same millisecond. Refund and bail.
        await applyDelta({
          userId: req.user._id,
          amount: c.stakeCoins,
          kind: 'refund_credit',
          idempotencyKey: `challenge:refund:${c._id}:opponent:${req.user._id}`,
          note: `Challenge ${c.code} claim conflict`,
        });
        return res.status(409).json({ message: 'Challenge already claimed', code: 'ALREADY_CLAIMED' });
      }
      await claimed.populate('challenger', 'username displayName');
      await claimed.populate('opponent', 'username displayName');
      return res.json(serializeChallenge(claimed, req.user._id));
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
