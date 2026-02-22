const Match = require('../models/Match');

exports.getMatches = async (req, res) => {
  try {
    const { matchday } = req.query;
    if (!matchday) {
      return res.status(400).json({ message: 'matchday query is required' });
    }
    const matches = await Match.find({ matchday }).sort({ scheduledAt: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
