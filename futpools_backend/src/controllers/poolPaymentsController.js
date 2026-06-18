/**
 * HTTP wrapper around poolPaymentService — stateless, thin.
 * The actual business logic (pool validation, picks validation, Stripe
 * session creation) lives in the service so it can be reused by the
 * webhook handler and future admin endpoints.
 */

const poolPaymentService = require('../services/poolPaymentService');

/**
 * POST /pools/:id/checkout-session
 * Body: { picks: [{fixtureId, pick}, ...] }
 * Auth: required (req.user)
 *
 * Returns { url, sessionId } — client redirects to url. On success the
 * Stripe webhook creates the QuinielaEntry; client gets the success page
 * via redirect to /pool/:id?paid=1.
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { picks } = req.body || {};
    const result = await poolPaymentService.createCheckoutSessionForEntry({
      user: req.user,
      poolId: req.params.id,
      picks,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) {
      console.error('[poolPayments] createCheckoutSession failed:', err);
    }
    res.status(status).json({
      message: err.message || 'Server error',
      code: err.code || undefined,
    });
  }
};

/**
 * POST /pools/:id/spei-intent
 * Body: { picks: [{fixtureId, pick}, ...] }
 * Auth: required.
 *
 * Manual-SPEI replacement for Stripe Checkout. Returns the destination
 * account + a unique reference the payer puts in the transfer concept.
 * The entry is created later, when an admin confirms the transfer.
 * Admins get { ok, freeEntry } (entry created inline).
 */
exports.createSpeiIntent = async (req, res) => {
  try {
    const { picks, method } = req.body || {};
    const result = await poolPaymentService.createSpeiIntentForEntry({
      user: req.user,
      poolId: req.params.id,
      picks,
      method,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) {
      console.error('[poolPayments] createSpeiIntent failed:', err);
    }
    res.status(status).json({
      message: err.message || 'Server error',
      code: err.code || undefined,
    });
  }
};

/**
 * POST /pools/spei/:paymentId/mark-paid
 * Body: { note?: string }  — optional SPEI tracking key ("clave de rastreo").
 * Auth: required (must own the payment).
 *
 * The payer signals they completed the transfer so the organizer knows to
 * verify it. Does NOT create the entry — that still happens on admin confirm.
 */
exports.markSpeiPaid = async (req, res) => {
  try {
    const result = await poolPaymentService.markSpeiPaidByUser({
      user: req.user,
      paymentId: req.params.paymentId,
      note: req.body?.note,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[poolPayments] markSpeiPaid failed:', err);
    res.status(status).json({ message: err.message || 'Server error', code: err.code || undefined });
  }
};
