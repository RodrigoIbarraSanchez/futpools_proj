const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  stripeSessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountCredits: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ProcessedStripePayment', schema);
