const Sweepstakes = require('../models/Sweepstakes');
const SweepstakesEntry = require('../models/SweepstakesEntry');
const { buyEntry, settleSweepstakes, cancelSweepstakes } = require('../services/sweepstakesService');

/**
 * Sweepstakes endpoints. List/detail are public to authed users; admin
 * gates create/settle/cancel via the existing isAdmin email check
 * (mirrored from quinielas admin actions).
 */

const ADMIN_EMAILS = new Set([
  'demo@futpools.app',
  'admin@futpools.app',
  'rodrigoibarrasanchez@gmail.com',
]);
const isAdmin = (user) => ADMIN_EMAILS.has((user?.email || '').toLowerCase());

/**
 * GET /sweepstakes — list sweepstakes the user can see. Filters by
 * `allowedCountries` against the user's countryCode (Fase 5). For now
 * MX-only is the default.
 *
 * Query: ?status=open|settled|cancelled (default: open)
 */
exports.list = async (req, res) => {
  try {
    const status = ['open', 'settled', 'cancelled'].includes(req.query.status)
      ? req.query.status
      : 'open';

    const filter = { status };
    // Country gate. If user has no countryCode yet (pre-Fase 5), don't
    // restrict — the geo check tightens up after we collect that field.
    const userCountry = req.user.countryCode;
    if (userCountry) {
      filter.$or = [
        { allowedCountries: { $size: 0 } },
        { allowedCountries: userCountry },
      ];
    }

    const items = await Sweepstakes.find(filter)
      .sort({ entryClosesAt: 1 })
      .limit(20)
      .lean();

    res.json({
      sweepstakes: items.map((s) => serialize(s, req.user._id)),
    });
  } catch (err) {
    console.error('[Sweepstakes] list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /sweepstakes/:id — full detail + the user's entry count.
 */
exports.getById = async (req, res) => {
  try {
    const s = await Sweepstakes.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ message: 'Sweepstakes not found' });

    const myEntries = await SweepstakesEntry.countDocuments({
      sweepstakes: s._id,
      user: req.user._id,
    });
    const totalEntries = await SweepstakesEntry.countDocuments({
      sweepstakes: s._id,
    });

    res.json({
      ...serialize(s, req.user._id),
      myEntries,
      totalEntries,
    });
  } catch (err) {
    console.error('[Sweepstakes] getById error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /sweepstakes/:id/enter — debits 7 Tickets and creates an entry.
 *
 * Returns 400 with code field on user-facing failures so the iOS/web
 * client can show the right copy:
 *   INSUFFICIENT_TICKETS, NOT_OPEN, ENTRY_CLOSED, NOT_OPEN_YET,
 *   NOT_FOUND, ENTRY_RACE
 */
exports.enter = async (req, res) => {
  try {
    // Age + country gate (Fase 5). Defense in depth — register also
    // enforces these, but a legacy account may have signed up before we
    // collected dob/country. We refuse entry until they update profile.
    if (!req.user.dob) {
      return res.status(400).json({ message: 'Profile incomplete', code: 'NEEDS_DOB' });
    }
    const ageYears = (Date.now() - new Date(req.user.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) {
      return res.status(403).json({ message: 'Underage', code: 'UNDERAGE' });
    }
    if (!req.user.countryCode) {
      return res.status(400).json({ message: 'Profile incomplete', code: 'NEEDS_COUNTRY' });
    }

    // Also enforce country whitelist server-side (the list endpoint
    // already filters, but a directly-typed POST shouldn't bypass).
    const sweepstakes = await Sweepstakes.findById(req.params.id).select('allowedCountries');
    if (sweepstakes && Array.isArray(sweepstakes.allowedCountries) && sweepstakes.allowedCountries.length > 0) {
      if (!sweepstakes.allowedCountries.includes(req.user.countryCode)) {
        return res.status(403).json({
          message: 'Not eligible from your country',
          code: 'GEO_RESTRICTED',
        });
      }
    }

    const result = await buyEntry(req.user._id, req.params.id);
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({
        message: result.code,
        code: result.code,
        tickets: result.tickets,
      });
    }
    res.status(201).json({
      ok: true,
      entry: {
        id: String(result.entry._id),
        entryNumber: result.entry.entryNumber,
        ticketsSpent: result.entry.ticketsSpent,
      },
      tickets: result.tickets,
    });
  } catch (err) {
    console.error('[Sweepstakes] enter error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /sweepstakes/:id/settle — admin only. Picks a winner uniformly
 * at random across all entries (or cancels + refunds if below
 * minEntries). Idempotent.
 */
exports.settle = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Admin only' });
    const s = await settleSweepstakes(req.params.id);
    if (!s) return res.status(404).json({ message: 'Sweepstakes not found' });
    res.json(serialize(s, req.user._id));
  } catch (err) {
    console.error('[Sweepstakes] settle error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /sweepstakes — admin only. Body: title, description, prizeLabel,
 * prizeUSD, entryCostTickets, minEntries, entryOpensAt, entryClosesAt,
 * allowedCountries.
 */
exports.create = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Admin only' });
    const body = req.body || {};
    if (!body.title || !body.prizeLabel || !body.entryClosesAt) {
      return res.status(400).json({ message: 'title, prizeLabel, entryClosesAt required' });
    }
    const s = await Sweepstakes.create({
      title: body.title,
      description: body.description || '',
      prizeLabel: body.prizeLabel,
      prizeUSD: Number(body.prizeUSD) || 0,
      entryCostTickets: Number(body.entryCostTickets) || 7,
      minEntries: Number(body.minEntries) || 20,
      entryOpensAt: body.entryOpensAt ? new Date(body.entryOpensAt) : new Date(),
      entryClosesAt: new Date(body.entryClosesAt),
      allowedCountries: Array.isArray(body.allowedCountries) ? body.allowedCountries : ['MX'],
      createdBy: req.user._id,
    });
    res.status(201).json(serialize(s, req.user._id));
  } catch (err) {
    console.error('[Sweepstakes] create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /sweepstakes/:id — admin only. Soft-cancels: refunds every
 * paid entry, marks status='cancelled', keeps the row for audit. The
 * row drops out of `?status=open` queries so it disappears from the
 * user-facing list immediately.
 */
exports.remove = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Admin only' });
    const s = await cancelSweepstakes(req.params.id, { note: 'Admin deleted via UI' });
    if (!s) return res.status(404).json({ message: 'Sweepstakes not found' });
    res.json({ ok: true, sweepstakes: serialize(s, req.user._id) });
  } catch (err) {
    console.error('[Sweepstakes] delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

function serialize(s, viewerId) {
  return {
    id: String(s._id),
    title: s.title,
    description: s.description,
    prizeLabel: s.prizeLabel,
    prizeUSD: s.prizeUSD,
    entryCostTickets: s.entryCostTickets,
    minEntries: s.minEntries,
    entryOpensAt: s.entryOpensAt,
    entryClosesAt: s.entryClosesAt,
    status: s.status,
    allowedCountries: s.allowedCountries,
    winnerUserId: s.winnerUserId ? String(s.winnerUserId) : null,
    didIWin: viewerId && s.winnerUserId
      ? String(viewerId) === String(s.winnerUserId)
      : false,
    settledAt: s.settledAt,
    createdAt: s.createdAt,
  };
}
