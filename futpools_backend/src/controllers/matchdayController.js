const Matchday = require('../models/Matchday');
const Match = require('../models/Match');

exports.getMatchdays = async (req, res) => {
  try {
    const { league } = req.query;
    const filter = league ? { league } : {};
    const matchdays = await Matchday.find(filter)
      .populate('league', 'name code')
      .sort({ startDate: -1 });
    res.json(matchdays);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMatchdayById = async (req, res) => {
  try {
    const matchday = await Matchday.findById(req.params.id)
      .populate('league', 'name code');
    if (!matchday) {
      return res.status(404).json({ message: 'Matchday not found' });
    }
    const matches = await Match.find({ matchday: matchday._id }).sort({ scheduledAt: 1 });
    res.json({ ...matchday.toObject(), matches });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
