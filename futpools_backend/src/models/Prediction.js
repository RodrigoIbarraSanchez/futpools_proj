const mongoose = require('mongoose');

const matchPickSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  pick: {
    type: String,
    enum: ['1', 'X', '2'],
    required: true,
  },
}, { _id: false });

const predictionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  matchday: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matchday',
    required: true,
  },
  matches: [matchPickSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Índice sin unique: los usuarios pueden tener varias quinielas por jornada
predictionSchema.index({ user: 1, matchday: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);
