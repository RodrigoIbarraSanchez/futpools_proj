const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, index: true },
  aliases: { type: [String], default: [] },
  apiFootballId: { type: Number, required: true, index: true },
  logo: { type: String, default: '' },
  country: { type: String, default: '' },
  league: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true, index: true },
  leagueApiFootballId: { type: Number, required: true, index: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Team', teamSchema);
