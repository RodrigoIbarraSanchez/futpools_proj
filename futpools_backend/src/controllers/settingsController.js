const Settings = require('../models/Settings');

const GLOBAL_KEY = 'global';

exports.getSettings = async (req, res) => {
  try {
    let doc = await Settings.findOne({ key: GLOBAL_KEY });
    if (!doc) {
      doc = await Settings.create({ key: GLOBAL_KEY });
    }
    res.json({
      bannerImageURL: doc.bannerImageURL || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { bannerImageURL } = req.body || {};
    const update = { updatedAt: new Date() };
    if (typeof bannerImageURL === 'string') {
      update.bannerImageURL = bannerImageURL.trim() || null;
    }
    const doc = await Settings.findOneAndUpdate(
      { key: GLOBAL_KEY },
      update,
      { new: true, upsert: true }
    );
    res.json({
      bannerImageURL: doc.bannerImageURL || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};
