const mongoose = require('mongoose');

const processedIAPTransactionSchema = new mongoose.Schema({
  originalTransactionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

processedIAPTransactionSchema.index({ userId: 1, originalTransactionId: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedIAPTransaction', processedIAPTransactionSchema);
