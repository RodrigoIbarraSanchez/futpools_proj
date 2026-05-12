const Stripe = require('stripe');
const { listPacks, getPack, isConfigured } = require('../config/stripePacks');
const { applyDelta } = require('../services/transactionService');
const BalanceTransaction = require('../models/BalanceTransaction');
const poolPaymentService = require('./../services/poolPaymentService');

// Lazily initialize Stripe so the backend still boots when the secret isn't
// set yet (dev environments without billing configured). We 503 the payments
// endpoints rather than crashing the whole process.
let stripeClient = null;
function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key, { apiVersion: '2024-06-20' });
  return stripeClient;
}

const WEB_APP_BASE_URL = process.env.WEB_APP_BASE_URL || 'http://localhost:5174';
const SUCCESS_PATH = '/shop?success=1&session_id={CHECKOUT_SESSION_ID}';
const CANCEL_PATH  = '/shop?cancel=1';

/**
 * GET /payments/catalog — returns the list of coin packs for the web shop.
 * Public-ish (still auth'd) so clients can render the grid before committing
 * to checkout. Shape is flat on purpose so the frontend doesn't need to know
 * about Stripe.
 */
exports.getCatalog = async (req, res) => {
  if (!isConfigured() || !getStripe()) {
    return res.status(503).json({
      message: 'Payments not yet configured. Set STRIPE_SECRET_KEY + pack Price IDs.',
      configured: false,
    });
  }
  try {
    const packs = listPacks().map((p) => ({
      packId: p.packId,
      coinAmount: p.coinAmount,
      bonusCoins: p.bonusCoins,
      totalCoins: p.totalCoins,
      priceCents: p.priceCents,
      currency: p.currency,
      badge: p.badge,
    }));
    res.json({ packs, configured: true });
  } catch (err) {
    console.error('[payments] getCatalog failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /payments/checkout-session
 * Body: { packId: string }
 * Creates a Stripe Checkout Session and returns its URL. Client redirects.
 *
 * Security:
 *   - `client_reference_id` pinned to req.user._id so the webhook can trust
 *     who the purchase belongs to even if metadata is tampered with.
 *   - `metadata.coinAmount` written from the server-side pack, NEVER from
 *     the client — prevents a malicious client from claiming more coins.
 */
exports.createCheckoutSession = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: 'Payments not configured' });
  try {
    const { packId } = req.body || {};
    const pack = getPack(String(packId || ''));
    if (!pack) return res.status(400).json({ message: 'Unknown pack' });
    if (!pack.stripePriceId || pack.stripePriceId.startsWith('price_TODO')) {
      return res.status(503).json({ message: 'Pack price ID not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],  // Apple/Google Pay auto-included via 'card'
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      client_reference_id: String(req.user._id),
      customer_email: req.user.email || undefined,
      metadata: {
        userId: String(req.user._id),
        packId: pack.packId,
        coinAmount: String(pack.totalCoins), // credited on webhook
      },
      success_url: `${WEB_APP_BASE_URL}${SUCCESS_PATH}`,
      cancel_url:  `${WEB_APP_BASE_URL}${CANCEL_PATH}`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[payments] createCheckoutSession failed:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

/**
 * POST /payments/webhook (raw body!)
 *
 * Stripe calls us when a checkout session completes. We verify the signature,
 * then credit coins to the user via the ledger with `stripe:<sessionId>` as
 * the idempotency key — retries (Stripe re-sends if we don't 200 in <10s)
 * are harmless.
 *
 * IMPORTANT: this route MUST be mounted BEFORE `app.use(express.json())` so
 * `req.body` is still a Buffer when we reach verification. See app.js.
 */
exports.handleWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Payments not configured');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) return res.status(503).send('Webhook secret not set');

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.warn('[payments] webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Dispatch by metadata. The same Stripe webhook URL serves two
      // distinct flows: legacy coin-pack purchases (master) and
      // simple_version pool entries. Both modes can coexist on master,
      // so the dispatch is keyed off metadata rather than the env mode
      // flag — this keeps simple_version verifiable on master infra.
      if (session.metadata?.poolId) {
        await poolPaymentService.handleCheckoutCompleted(session);
      } else if (session.metadata?.packId) {
        await handleCoinPackCompleted(session);
      } else {
        console.warn('[payments] completed session missing dispatch metadata:', session.id);
      }
    }
    // Other events (payment_intent.*, charge.*) we ignore for now.
    res.status(200).send('ok');
  } catch (err) {
    // If handling crashes, tell Stripe so it retries.
    console.error('[payments] webhook handler error:', err);
    res.status(500).send('Handler error');
  }
};

// Coin-pack credit path — extracted from the inline webhook handler so the
// dispatcher above stays readable. Behaviour identical to the pre-Phase-2
// version: re-validate pack metadata server-side, idempotency via
// BalanceTransaction.idempotencyKey, credit via applyDelta.
async function handleCoinPackCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const packId = session.metadata?.packId;
  const coinAmount = Number(session.metadata?.coinAmount);

  if (!userId || !packId || !Number.isFinite(coinAmount) || coinAmount <= 0) {
    console.warn('[payments] coin-pack session missing metadata:', session.id);
    return;
  }

  // Second layer of defense: look up the pack again on our side. If
  // someone spoofed metadata.coinAmount, we reject.
  const pack = getPack(packId);
  if (!pack || pack.totalCoins !== coinAmount) {
    console.warn('[payments] pack/amount mismatch for session', session.id, packId, coinAmount);
    return;
  }

  const idempotencyKey = `stripe:${session.id}`;
  const existing = await BalanceTransaction.findOne({ idempotencyKey }).lean();
  if (existing) {
    console.log('[payments] duplicate coin-pack session, ignored:', session.id);
    return;
  }

  await applyDelta({
    userId,
    amount: coinAmount,
    kind: 'iap_credit',
    idempotencyKey,
    note: `stripe:${packId}:${session.id}`,
  });
  console.log(`[payments] credited ${coinAmount} coins to user ${userId} (pack=${packId}, session=${session.id})`);
}
