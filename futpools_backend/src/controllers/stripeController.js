const Stripe = require('stripe');
const User = require('../models/User');
const ProcessedStripePayment = require('../models/ProcessedStripePayment');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/** Allowed recharge amounts (credits) and price in MXN centavos (1 credit = 1 MXN) */
const RECHARGE_OPTIONS = [
  { amountCredits: 50, priceCents: 5000, label: '50' },
  { amountCredits: 100, priceCents: 10000, label: '100' },
  { amountCredits: 200, priceCents: 20000, label: '200' },
  { amountCredits: 500, priceCents: 50000, label: '500' },
];

const AMOUNTS_SET = new Set(RECHARGE_OPTIONS.map((o) => o.amountCredits));

/**
 * POST /stripe/create-checkout-session
 * Body: { amountCredits: number }
 * Returns: { url: string }
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: 'Stripe is not configured' });
    }
    const { amountCredits } = req.body || {};
    const amount = Number(amountCredits);
    if (!Number.isInteger(amount) || !AMOUNTS_SET.has(amount)) {
      return res.status(400).json({
        message: 'Invalid amount. Allowed: 50, 100, 200, 500',
      });
    }

    const option = RECHARGE_OPTIONS.find((o) => o.amountCredits === amount);
    const baseUrl = process.env.FRONTEND_URL || process.env.STRIPE_SUCCESS_CANCEL_BASE_URL || (req.protocol + '://' + req.get('host'));
    const successUrl = `${baseUrl.replace(/\/$/, '')}/recharge?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl.replace(/\/$/, '')}/recharge?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: option.priceCents,
            product_data: {
              name: `Recarga Futpools - ${option.label} créditos`,
              description: `${option.label} créditos para jugar quinielas`,
              images: [],
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(req.user._id),
      metadata: {
        userId: String(req.user._id),
        amountCredits: String(amount),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] createCheckoutSession error:', err);
    res.status(500).json({ message: err.message || 'Failed to create checkout session' });
  }
};

/**
 * POST /stripe/webhook
 * Raw body required for signature verification.
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not set, skipping webhook verification');
    return res.status(400).send('Webhook secret not configured');
  }

  if (!stripe) {
    return res.status(503).send('Stripe not configured');
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.json({ received: true });
  }

  const session = event.data.object;
  const sessionId = session.id;
  const userId = session.metadata?.userId;
  const amountCredits = parseInt(session.metadata?.amountCredits || '0', 10);

  if (!userId || amountCredits <= 0) {
    console.error('[Stripe] webhook missing userId or amountCredits', { sessionId, userId, amountCredits });
    return res.status(400).json({ message: 'Invalid session metadata' });
  }

  const existing = await ProcessedStripePayment.findOne({ stripeSessionId: sessionId });
  if (existing) {
    return res.json({ received: true, alreadyProcessed: true });
  }

  const mongoose = require('mongoose');
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: amountCredits } },
      { session: dbSession, new: true }
    ).select('balance');
    await ProcessedStripePayment.create(
      [{ stripeSessionId: sessionId, userId, amountCredits }],
      { session: dbSession }
    );
    await dbSession.commitTransaction();
    console.log(`[Stripe] Applied balance userId=${userId} amountCredits=${amountCredits} sessionId=${sessionId}`);
  } catch (err) {
    await dbSession.abortTransaction();
    console.error('[Stripe] webhook apply balance error:', err);
    return res.status(500).json({ message: 'Failed to apply balance' });
  } finally {
    dbSession.endSession();
  }

  res.json({ received: true });
};

/** GET /stripe/recharge-options - public list of allowed amounts for UI */
exports.getRechargeOptions = (_req, res) => {
  res.json({
    options: RECHARGE_OPTIONS.map(({ amountCredits, priceCents, label }) => ({
      amountCredits,
      priceCents,
      label,
      priceMxn: priceCents / 100,
    })),
  });
};
