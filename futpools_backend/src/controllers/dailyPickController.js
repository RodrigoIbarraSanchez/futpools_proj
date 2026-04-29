const DailyPick = require('../models/DailyPick');
const DailyPickPrediction = require('../models/DailyPickPrediction');
const { applyTicketDelta } = require('../services/ticketService');
const { localDateKey, selectForToday } = require('../services/dailyPickService');

/**
 * GET /daily-pick/today — returns today's Daily Pick + the user's
 * prediction (if any) + their immediate-Ticket reward state.
 *
 * If today's pick hasn't been selected yet (rare — would only happen if
 * the cron tick hasn't fired since 00:00 AND no priority-league fixture
 * exists today), we try to pick it lazily so the request still returns
 * something useful.
 */
exports.getToday = async (req, res) => {
  try {
    const dateKey = localDateKey();
    let dp = await DailyPick.findOne({ date: dateKey });
    if (!dp) {
      // Lazy fetch — handles cold-start window and cron misfires.
      dp = await selectForToday();
    }
    if (!dp) {
      return res.json({ dailyPick: null, prediction: null });
    }

    const prediction = await DailyPickPrediction.findOne({
      dailyPick: dp._id,
      user: req.user._id,
    }).lean();

    res.json({
      dailyPick: serializeDailyPick(dp),
      prediction: prediction ? serializePrediction(prediction) : null,
    });
  } catch (err) {
    console.error('[DailyPick] getToday error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /daily-pick/today/predict — body: { pick: '1' | 'X' | 'Y' }
 *
 * Records the user's prediction and credits +1 Ticket immediately. If the
 * user already predicted today (unique index would block a duplicate
 * insert), returns 400 with code DUPLICATE_PREDICTION.
 *
 * Predictions are LOCKED once kickoff has passed — late predictions get a
 * 400 with code FIXTURE_STARTED so the UI can show the "el partido ya
 * empezó" state.
 */
exports.predictToday = async (req, res) => {
  try {
    const { pick } = req.body || {};
    if (!['1', 'X', '2'].includes(pick)) {
      return res.status(400).json({ message: 'Invalid pick', code: 'INVALID_PICK' });
    }

    const dateKey = localDateKey();
    const dp = await DailyPick.findOne({ date: dateKey });
    if (!dp) {
      return res.status(404).json({ message: 'No Daily Pick today', code: 'NO_DAILY_PICK' });
    }
    if (new Date(dp.fixture.kickoff) <= new Date()) {
      return res.status(400).json({ message: 'Fixture already started', code: 'FIXTURE_STARTED' });
    }

    // Atomic create — unique index on (dailyPick, user) guards against a
    // double-tap from the user. E11000 → user already predicted today.
    let prediction;
    try {
      prediction = await DailyPickPrediction.create({
        dailyPick: dp._id,
        user: req.user._id,
        pick,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(400).json({
          message: 'Already predicted today',
          code: 'DUPLICATE_PREDICTION',
        });
      }
      throw err;
    }

    // Credit +1 Ticket immediately. Idempotent at the ledger level via the
    // ssv-style key — if somehow the prediction was created but the credit
    // failed mid-flight, retrying the request resumes cleanly.
    const credit = await applyTicketDelta({
      userId: req.user._id,
      amount: 1,
      kind: 'checkin_credit',
      idempotencyKey: `ticket:checkin:${dp._id}:${req.user._id}`,
      dailyPick: dp._id,
      note: `Daily Pick check-in ${dateKey}`,
    });

    res.status(201).json({
      dailyPick: serializeDailyPick(dp),
      prediction: serializePrediction(prediction),
      ticketAwarded: credit.applied || credit.alreadyProcessed,
    });
  } catch (err) {
    console.error('[DailyPick] predictToday error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

function serializeDailyPick(dp) {
  return {
    id: String(dp._id),
    date: dp.date,
    fixture: {
      fixtureId: dp.fixture.fixtureId,
      leagueId: dp.fixture.leagueId,
      leagueName: dp.fixture.leagueName,
      homeTeam: dp.fixture.homeTeam,
      awayTeam: dp.fixture.awayTeam,
      homeLogo: dp.fixture.homeLogo,
      awayLogo: dp.fixture.awayLogo,
      kickoff: dp.fixture.kickoff,
    },
    finalResult: dp.finalResult,
    settledAt: dp.settledAt,
  };
}

function serializePrediction(p) {
  return {
    id: String(p._id),
    pick: p.pick,
    submittedAt: p.submittedAt,
    immediateAwarded: p.immediateAwarded,
    bonusAwarded: p.bonusAwarded,
    bonusAwardedAt: p.bonusAwardedAt,
  };
}
