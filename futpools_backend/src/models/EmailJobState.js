const mongoose = require('mongoose');

/**
 * Durable timestamps for periodic email jobs (survives restarts, unlike an
 * in-memory throttle). Currently just the weekly digest cadence guard; keyed so
 * future scheduled blasts can reuse it.
 */
const emailJobStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  lastRunAt: { type: Date, default: null },
}, { collection: 'emailjobstate' });

module.exports = mongoose.model('EmailJobState', emailJobStateSchema);
