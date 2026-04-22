const mongoose = require('mongoose');
const Quiniela = require('../models/Quiniela');
const User = require('../models/User');
const BalanceTransaction = require('../models/BalanceTransaction');
const { applyDelta } = require('../services/transactionService');

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateInviteCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}
async function mintUniqueInviteCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const existing = await Quiniela.findOne({ inviteCode: code }).select('_id').lean();
    if (!existing) return code;
  }
  throw new Error('Could not mint unique invite code');
}

/**
 * POST /admin/pools/platform-event
 * Create a platform-funded pool. Admin-only. Prize is pledged until
 * `minParticipants` is reached — then locked in at first-fixture kickoff.
 *
 * Body: {
 *   name, description?, fixtures: [...],
 *   platformPrizeCoins: number, minParticipants: number,
 *   entryCostCoins?: number (default 0 = free),
 * }
 */
exports.createPlatformEvent = async (req, res) => {
  try {
    const {
      name, description, fixtures,
      platformPrizeCoins, minParticipants, entryCostCoins,
    } = req.body || {};

    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Name is required' });
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(400).json({ message: 'At least one fixture is required' });
    }
    const prize = Math.max(0, Number(platformPrizeCoins) || 0);
    const minPart = Math.max(1, Number(minParticipants) || 1);
    const entryCost = Math.max(0, Number(entryCostCoins) || 0);
    if (prize <= 0) {
      return res.status(400).json({ message: 'platformPrizeCoins must be > 0' });
    }

    const now = new Date();
    const normalizedFixtures = fixtures.map((f) => ({
      fixtureId: f.fixtureId,
      leagueId: f.leagueId,
      leagueName: f.leagueName || '',
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeTeam: String(f.homeTeam || ''),
      awayTeam: String(f.awayTeam || ''),
      homeLogo: f.homeLogo || '',
      awayLogo: f.awayLogo || '',
      kickoff: f.kickoff ? new Date(f.kickoff) : now,
      status: f.status || '',
    }));
    const dates = normalizedFixtures.map((f) => f.kickoff).sort((a, b) => a - b);

    const inviteCode = await mintUniqueInviteCode();
    const pool = await Quiniela.create({
      name: trimmedName,
      description: String(description || '').trim(),
      prize: '',
      prizeLabel: `${prize.toLocaleString()} COINS`,
      cost: String(entryCost),
      currency: 'COIN',
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      fixtures: normalizedFixtures,
      featured: true,
      createdBy: req.user._id,
      visibility: 'public',
      inviteCode,
      fundingModel: 'platform',
      platformPrizeCoins: prize,
      minParticipants: minPart,
      entryCostCoins: entryCost,
      rakePercent: 10,
      prizeLockStatus: 'pledged',
      settlementStatus: 'pending',
    });

    res.status(201).json(pool);
  } catch (err) {
    console.error('[admin] createPlatformEvent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /admin/users/:id/mint
 * Adjust a user's balance with a full ledger audit trail. Use for event
 * prizes, correction after a bug, or promotional grants.
 *
 * Body: { amount: number (signed), note?: string }
 * Positive amount → admin_mint, negative → admin_burn.
 */
exports.mintCoins = async (req, res) => {
  try {
    const userId = req.params.id;
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note || '').trim();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ message: 'Amount must be a non-zero number' });
    }

    const user = await User.findById(userId).select('email balance');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (amount < 0 && (user.balance ?? 0) + amount < 0) {
      return res.status(400).json({
        message: 'Cannot burn more coins than the user has',
        balance: user.balance ?? 0,
      });
    }

    const key = `mint:${req.user._id}:${userId}:${Date.now()}`;
    await applyDelta({
      userId,
      amount,
      kind: amount > 0 ? 'admin_mint' : 'admin_burn',
      idempotencyKey: key,
      note: note || `Admin ${amount > 0 ? 'mint' : 'burn'} by ${req.user.email}`,
    });

    const updated = await User.findById(userId).select('balance').lean();
    res.json({ ok: true, balance: updated?.balance ?? 0 });
  } catch (err) {
    console.error('[admin] mintCoins error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /admin/ledger?kind=&userId=&quinielaId=&limit=50
 * Simple audit query over the BalanceTransaction log.
 */
exports.getLedger = async (req, res) => {
  try {
    const filter = {};
    if (req.query.kind) filter.kind = String(req.query.kind);
    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      filter.user = req.query.userId;
    }
    if (req.query.quinielaId && mongoose.Types.ObjectId.isValid(req.query.quinielaId)) {
      filter.quiniela = req.query.quinielaId;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const rows = await BalanceTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'email displayName')
      .populate('quiniela', 'name')
      .lean();
    res.json({ rows, count: rows.length });
  } catch (err) {
    console.error('[admin] getLedger error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
