const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  apiFootballId: {
    type: Number,
    default: null,
  },
  logo: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('League', leagueSchema);
