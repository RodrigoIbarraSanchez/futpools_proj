const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  bannerImageURL: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'appsettings' });

module.exports = mongoose.model('Settings', settingsSchema);
