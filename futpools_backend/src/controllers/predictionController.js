const Prediction = require('../models/Prediction');
const Match = require('../models/Match');
const Matchday = require('../models/Matchday');
const { validationResult } = require('express-validator');

exports.createPrediction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { matchday, matches } = req.body;
    const matchdayDoc = await Matchday.findById(matchday);
    if (!matchdayDoc) {
      return res.status(404).json({ message: 'Matchday not found' });
    }
    if (matchdayDoc.status !== 'open' && matchdayDoc.status !== 'upcoming') {
      return res.status(400).json({ message: 'Matchday is closed for predictions' });
    }
    const matchIds = matches.map((m) => m.matchId);
    const matchesInMatchday = await Match.find({ _id: { $in: matchIds }, matchday });
    if (matchesInMatchday.length !== matchIds.length) {
      return res.status(400).json({ message: 'All matches must belong to the same matchday' });
    }
    const validPicks = ['1', 'X', '2'];
    for (const m of matches) {
      if (!validPicks.includes(m.pick)) {
        return res.status(400).json({ message: 'Each pick must be 1, X, or 2' });
      }
    }
    const prediction = new Prediction({
      user: req.user._id,
      matchday,
      matches,
    });
    await prediction.save();
    console.log('[Prediction] Quiniela creada — user:', req.user._id, 'matchday:', matchday, 'predictionId:', prediction._id);
    const populated = await Prediction.findById(prediction._id)
      .populate('matchday', 'name startDate endDate status')
      .populate({ path: 'matches.matchId', select: 'homeTeam awayTeam scheduledAt result' });
    res.status(201).json(populated);
  } catch (err) {
    console.error('[Prediction] Error al crear:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyPredictions = async (req, res) => {
  try {
    const { matchday } = req.query;
    const filter = { user: req.user._id };
    if (matchday) filter.matchday = matchday;
    const predictions = await Prediction.find(filter)
      .populate('matchday', 'name startDate endDate status league')
      .populate('matchday.league', 'name code')
      .populate({ path: 'matches.matchId', select: 'homeTeam awayTeam scheduledAt result' })
      .sort({ createdAt: -1 });
    console.log('[Prediction] GET mis quinielas — user:', req.user._id, 'count:', predictions.length);
    res.json(predictions);
  } catch (err) {
    console.error('[Prediction] Error al listar:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
