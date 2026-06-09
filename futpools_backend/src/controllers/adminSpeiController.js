/**
 * Admin dashboard for manual-SPEI pool payments. The user submits picks
 * and gets a reference; once they transfer the $50 MXN, the admin verifies
 * it in their bank and confirms here — which creates the QuinielaEntry.
 *
 * Endpoints (all gated by auth + requireAdmin in routes/admin.js):
 *   GET  /admin/spei-payments?status=pending
 *   POST /admin/spei-payments/:id/confirm
 *   POST /admin/spei-payments/:id/reject   { reason? }
 */

const SpeiPayment = require('../models/SpeiPayment');
const poolPaymentService = require('../services/poolPaymentService');

exports.listSpeiPayments = async (req, res) => {
  try {
    const status = ['pending', 'confirmed', 'rejected'].includes(req.query.status)
      ? req.query.status
      : 'pending';
    const payments = await SpeiPayment.find({ status })
      // Payments the payer marked as paid float to the top (most recent
      // claim first) so the organizer verifies those before abandoned intents.
      .sort({ userMarkedPaidAt: -1, createdAt: -1 })
      .limit(200)
      .populate('user', 'email displayName username')
      .populate('quiniela', 'name entryFeeMXN')
      .lean();

    const payload = payments.map((p) => ({
      id: String(p._id),
      reference: p.reference,
      amountMXN: p.amountMXN,
      status: p.status,
      createdAt: p.createdAt,
      userMarkedPaidAt: p.userMarkedPaidAt || null,
      userNote: p.userNote || '',
      picksCount: (p.picks || []).length,
      pool: p.quiniela ? { id: String(p.quiniela._id), name: p.quiniela.name } : null,
      user: p.user
        ? {
            id: String(p.user._id),
            email: p.user.email,
            displayName: p.user.displayName || p.user.username || p.user.email,
          }
        : null,
    }));
    res.json(payload);
  } catch (err) {
    console.error('[admin/spei] list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.confirmSpeiPayment = async (req, res) => {
  try {
    const result = await poolPaymentService.confirmSpeiPayment({
      paymentId: req.params.id,
      adminUser: req.user,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[admin/spei] confirm error:', err);
    res.status(status).json({ message: err.message || 'Server error', code: err.code || undefined });
  }
};

exports.rejectSpeiPayment = async (req, res) => {
  try {
    const result = await poolPaymentService.rejectSpeiPayment({
      paymentId: req.params.id,
      adminUser: req.user,
      reason: req.body?.reason,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[admin/spei] reject error:', err);
    res.status(status).json({ message: err.message || 'Server error', code: err.code || undefined });
  }
};
