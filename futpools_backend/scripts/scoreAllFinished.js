#!/usr/bin/env node
/**
 * Manual scorer: applies rating/achievements/streaks to every pool whose
 * fixtures are all FT and hasn't been settled yet. Idempotent — safe to
 * run repeatedly. Replaces the Phase 2 cron while we ship Phase 1.
 *
 *   node scripts/scoreAllFinished.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Quiniela = require('../src/models/Quiniela');
const { applyScoringToQuiniela } = require('../src/controllers/ratingController');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('[scoreAll] connected');

  const pending = await Quiniela.find({
    $or: [
      { settlementStatus: 'pending' },
      { settlementStatus: { $exists: false } },
    ],
  }).select('_id name').lean();

  console.log(`[scoreAll] ${pending.length} pending pools`);

  let scoredTotal = 0;
  for (const p of pending) {
    const result = await applyScoringToQuiniela(p._id);
    if (result.scored > 0) {
      console.log(`[scoreAll] ${p.name}: scored ${result.scored} entries (totalPossible=${result.totalPossible})`);
      scoredTotal += result.scored;
    } else {
      console.log(`[scoreAll] ${p.name}: skip (${result.reason})`);
    }
  }

  console.log(`[scoreAll] done — ${scoredTotal} entries scored`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[scoreAll] failed', err);
  process.exit(1);
});
