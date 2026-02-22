const mongoose = require('mongoose');

const matchdaySchema = new mongoose.Schema({
  league: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'closed'],
    default: 'upcoming',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

matchdaySchema.index({ league: 1 });

module.exports = mongoose.model('Matchday', matchdaySchema);
