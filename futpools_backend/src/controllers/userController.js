const User = require('../models/User');
const ProcessedIAPTransaction = require('../models/ProcessedIAPTransaction');
const { decodeJWSPayload, getTransactionIds, getAmountForProductId } = require('../services/iapService');

const ADMIN_EMAILS = new Set(['demo@futpools.app', 'admin@futpools.app']);

exports.getMe = async (req, res) => {
  try {
    const isAdmin = ADMIN_EMAILS.has((req.user.email || '').toLowerCase());
    res.json({
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      isAdmin,
      balance: req.user.balance ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { displayName } = req.body;
    if (displayName !== undefined) {
      req.user.displayName = (displayName ?? '').toString().trim();
    }
    await req.user.save();
    res.json({
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      balance: req.user.balance ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /users/me/balance/recharge
 * Body: { signedTransaction: string } — JWS from StoreKit 2 Transaction
 * Validates transaction, ensures idempotency, adds balance.
 */
exports.rechargeBalance = async (req, res) => {
  try {
    const { signedTransaction } = req.body || {};
    if (!signedTransaction) {
      return res.status(400).json({ message: 'signedTransaction is required' });
    }

    const payload = decodeJWSPayload(signedTransaction);
    const ids = getTransactionIds(payload);
    if (!ids) {
      return res.status(400).json({ message: 'Invalid transaction data' });
    }

    const { productId, originalTransactionId } = ids;
    const amount = getAmountForProductId(productId);
    if (amount <= 0) {
      return res.status(400).json({ message: 'Unknown product' });
    }

    const existing = await ProcessedIAPTransaction.findOne({ originalTransactionId });
    if (existing) {
      const user = await User.findById(req.user._id).select('balance').lean();
      return res.json({ balance: user?.balance ?? 0, alreadyProcessed: true });
    }

    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { balance: amount } },
        { session, new: true }
      ).select('balance');
      await ProcessedIAPTransaction.create(
        [{ originalTransactionId, userId: req.user._id, productId, amount }],
        { session }
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const user = await User.findById(req.user._id).select('balance').lean();
    res.json({ balance: user?.balance ?? 0 });
  } catch (err) {
    console.error('[IAP] recharge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
