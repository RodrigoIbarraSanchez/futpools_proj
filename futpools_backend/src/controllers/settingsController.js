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
    const body = req.body || {};
    const update = { updatedAt: new Date() };
    // Use `in` rather than typeof so an explicit `null` payload (sent by
    // the dashboard when the admin clears the input to remove the banner)
    // actually nulls the field. The previous `typeof === 'string'` guard
    // silently dropped null because `typeof null === 'object'`, leaving
    // the old URL stuck in Mongo and the banner unremovable.
    if ('bannerImageURL' in body) {
      const raw = body.bannerImageURL;
      update.bannerImageURL = (typeof raw === 'string' && raw.trim()) ? raw.trim() : null;
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
