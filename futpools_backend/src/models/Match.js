const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchday: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matchday',
    required: true,
  },
  homeTeam: {
    type: String,
    required: true,
    trim: true,
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true,
  },
  scheduledAt: {
    type: Date,
    required: true,
  },
  result: {
    type: String,
    enum: ['1', 'X', '2'],
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

matchSchema.index({ matchday: 1 });

module.exports = mongoose.model('Match', matchSchema);
