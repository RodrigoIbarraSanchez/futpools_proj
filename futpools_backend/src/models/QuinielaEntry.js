const mongoose = require('mongoose');

const pickSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true },
  pick: { type: String, enum: ['1', 'X', '2'], required: true },
}, { _id: false });

const quinielaEntrySchema = new mongoose.Schema({
  quiniela: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiniela', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  entryNumber: { type: Number },
  picks: { type: [pickSchema], default: [] },
  // Frozen at scoring time so re-running the scorer is idempotent. The tuple
  // (score, ratingDelta) is the authoritative record — re-reading from live
  // fixtures could change slightly if an API-Football event is corrected.
  scoredAt: { type: Date, index: true },
  score: { type: Number },
  totalPossibleAtScoring: { type: Number },
  ratingDelta: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QuinielaEntry', quinielaEntrySchema);
