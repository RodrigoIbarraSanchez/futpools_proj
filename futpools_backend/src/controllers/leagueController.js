const League = require('../models/League');

exports.getLeagues = async (req, res) => {
  try {
    const leagues = await League.find().sort({ name: 1 });
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
