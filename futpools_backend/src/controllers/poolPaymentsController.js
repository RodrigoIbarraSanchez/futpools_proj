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
