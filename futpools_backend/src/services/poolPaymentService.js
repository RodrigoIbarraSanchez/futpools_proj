/**
 * Stripe Checkout for paid pool entries (simple_version).
 *
 * Flow:
 *   1. Web client calls POST /pools/:id/checkout-session with picks in body
 *   2. createCheckoutSessionForEntry validates pool + picks + non-duplicate,
 *      creates a Stripe Checkout Session with picks serialized into metadata,
 *      returns { url, sessionId }. Client redirects to url.
 *   3. User pays on Stripe-hosted page (Apple Pay enabled by default).
 *   4. Stripe POSTs `checkout.session.completed` to /payments/webhook.
 *      paymentsController.handleWebhook dispatches to handleCheckoutCompleted
 *      here (because session.metadata.poolId is set).
 *   5. handleCheckoutCompleted reconstructs picks from metadata and creates
 *      the QuinielaEntry. Idempotent via the sparse unique index on
 *      QuinielaEntry.stripeSessionId — Stripe re-deliveries fail the insert
 *      and the handler treats E11000 as already-applied.
 *
 * The legacy debit-from-coins path (`quinielaController.submitEntry`) is
 * unchanged and stays mounted on master. In simple_version the entries
 * route is unmounted, so this is the only way an entry can be created.
 */

const Stripe = require('stripe');
const Quiniela = require('../models/Quiniela');
const QuinielaEntry = require('../models/QuinielaEntry');

let stripeClient = null;
function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key, { apiVersion: '2024-06-20' });
  return stripeClient;
}

const WEB_APP_BASE_URL = () => process.env.WEB_APP_BASE_URL || 'http://localhost:5174';

/**
 * Compact picks serialization for Stripe metadata (500 char limit per value).
 * Format: "fixtureId:pick,fixtureId:pick,..."
 * 14 fixtures × ~12 chars ≈ 170 chars — well under the limit.
 * JSON would also fit but is ~30% bulkier and we control both ends, so the
 * compact format keeps headroom for unusually large pools.
 */
function serializePicks(picks) {
  return picks.map((p) => `${p.fixtureId}:${p.pick}`).join(',');
}

function deserializePicks(s) {
  if (!s || typeof s !== 'string') return [];
  return s.split(',').map((token) => {
    const [fid, pick] = token.split(':');
    return { fixtureId: Number(fid), pick: String(pick) };
  });
}

/**
 * Picks must cover every fixture in the pool exactly once with a valid 1/X/2.
 * Order doesn't matter; we normalize. Throws on invalid input so the controller
 * can return a 400 with a clear reason.
 */
function validatePicks(pool, picks) {
  if (!Array.isArray(picks) || picks.length === 0) {
    const e = new Error('Picks are required');
    e.code = 'PICKS_REQUIRED';
    throw e;
  }
  const fixtureIds = new Set((pool.fixtures || []).map((f) => Number(f.fixtureId)));
  const seen = new Set();
  for (const p of picks) {
    const fid = Number(p?.fixtureId);
    const pick = String(p?.pick || '');
    if (!fixtureIds.has(fid)) {
      const e = new Error(`Fixture ${fid} not in this pool`);
      e.code = 'PICK_FIXTURE_INVALID';
      throw e;
    }
    if (!['1', 'X', '2'].includes(pick)) {
      const e = new Error(`Pick "${pick}" must be 1, X, or 2`);
      e.code = 'PICK_VALUE_INVALID';
      throw e;
    }
    if (seen.has(fid)) {
      const e = new Error(`Duplicate pick for fixture ${fid}`);
      e.code = 'PICK_DUPLICATE';
      throw e;
    }
    seen.add(fid);
  }
  if (seen.size !== fixtureIds.size) {
    const e = new Error(`Picks must cover every fixture (${fixtureIds.size} required, ${seen.size} given)`);
    e.code = 'PICKS_INCOMPLETE';
    throw e;
  }
}

/**
 * Derive the kickoff cutoff for a pool — the earliest fixture kickoff.
 * After this moment, no new entries are accepted.
 */
function firstKickoff(pool) {
  const ks = (pool.fixtures || [])
    .map((f) => f.kickoff && new Date(f.kickoff))
    .filter((d) => d && !Number.isNaN(d.getTime()));
  if (ks.length === 0) return null;
  return new Date(Math.min(...ks.map((d) => d.getTime())));
}

/**
 * Create a Stripe Checkout Session for a pool entry.
 *
 * Per-pool dynamic pricing: we use `price_data` inline rather than a
 * pre-configured Stripe Price object so the admin can override
 * Quiniela.entryFeeMXN per pool without touching Stripe Dashboard. The
 * line item description carries the pool name so the user sees what
 * they're paying for in the Stripe UI.
 */
async function createCheckoutSessionForEntry({ user, poolId, picks }) {
  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error('Payments not configured'), { code: 'STRIPE_NOT_CONFIGURED', status: 503 });

  const pool = await Quiniela.findById(poolId);
  if (!pool) throw Object.assign(new Error('Pool not found'), { code: 'POOL_NOT_FOUND', status: 404 });

  // Cutoff: any fixture already kicked off blocks new entries. We don't
  // rely on the pool's settlementStatus because that flips much later
  // (post-FT) and we want the gate at first kickoff.
  const cutoff = firstKickoff(pool);
  if (cutoff && cutoff.getTime() <= Date.now()) {
    throw Object.assign(new Error('Pool already started'), { code: 'POOL_STARTED', status: 400 });
  }

  // Block duplicate entries: one user, one entry per pool. The legacy
  // master flow allowed multiple entries (entryNumber on the schema) but
  // simple_version's product spec is one-shot per user. Easy to relax
  // later if needed.
  const existing = await QuinielaEntry.findOne({ quiniela: poolId, user: user._id }).lean();
  if (existing) {
    throw Object.assign(new Error('You are already entered in this pool'), { code: 'ALREADY_ENTERED', status: 409 });
  }

  validatePicks(pool, picks);

  // Stripe expects unit_amount in the smallest currency unit (centavos
  // for MXN). Schema stores pesos for legibility; we ×100 here.
  const amountPesos = Number(pool.entryFeeMXN) || 50;
  const amountCents = amountPesos * 100;
  const picksMeta = serializePicks(picks);
  if (picksMeta.length > 480) {
    // Defensive — Stripe limit is 500. If we ever ship a pool with more
    // than ~35 fixtures we'd need a different storage strategy (e.g.
    // stash picks in a temp collection keyed by sessionId, drop after
    // webhook). Surfacing this as a 500 is fine for now since we'd never
    // ship such a pool.
    throw Object.assign(new Error('Pool too large for inline picks metadata'), { code: 'PICKS_METADATA_OVERFLOW', status: 500 });
  }

  const baseUrl = WEB_APP_BASE_URL();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'], // 'card' includes Apple Pay + Google Pay automatically
    line_items: [{
      price_data: {
        currency: 'mxn',
        unit_amount: amountCents,
        product_data: {
          name: pool.name || 'FutPools entry',
          description: `Entry to ${pool.name} (${(pool.fixtures || []).length} fixtures)`,
        },
      },
      quantity: 1,
    }],
    client_reference_id: String(user._id),
    customer_email: user.email || undefined,
    metadata: {
      // Pinned server-side — never trust client to set userId/poolId.
      // The webhook re-validates these against client_reference_id.
      userId: String(user._id),
      poolId: String(poolId),
      // Picks ride along in metadata so the webhook can rebuild the entry
      // exactly as the user composed it. They're also signed by Stripe
      // (the webhook verifies signature over the entire session payload).
      picks: picksMeta,
    },
    success_url: `${baseUrl}/pool/${poolId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pool/${poolId}?cancelled=1`,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Webhook side: Stripe POSTed `checkout.session.completed` for a session
 * whose metadata.poolId is set, so this is an entry creation. The caller
 * (paymentsController.handleWebhook) has already verified the signature.
 *
 * Idempotency: QuinielaEntry.stripeSessionId is sparse + unique. If
 * Stripe re-delivers, the second save throws E11000 and we treat that as
 * already-applied (return without error so we 200 the webhook and Stripe
 * stops retrying).
 */
async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const poolId = session.metadata?.poolId;
  const picksRaw = session.metadata?.picks;
  if (!userId || !poolId || !picksRaw) {
    console.warn('[poolPayment] missing metadata on session:', session.id);
    return { ok: false, reason: 'MISSING_METADATA' };
  }

  // Quick existence-check on the idempotency side first to avoid a doomed
  // DB write when Stripe re-delivers.
  const dup = await QuinielaEntry.findOne({ stripeSessionId: session.id }).lean();
  if (dup) {
    console.log('[poolPayment] duplicate session, ignored:', session.id);
    return { ok: true, alreadyProcessed: true };
  }

  const pool = await Quiniela.findById(poolId);
  if (!pool) {
    // Pool deleted between checkout start and payment completion. The
    // user paid for nothing — this needs a refund. We log loud so an
    // operator can act; the refund endpoint comes in Phase 9.
    console.error('[poolPayment] CRITICAL pool gone for paid session:', session.id, poolId);
    return { ok: false, reason: 'POOL_GONE_NEEDS_REFUND' };
  }

  // If the pool kicked off between checkout start and now, the user is
  // entered too late. Same refund situation as above.
  const cutoff = firstKickoff(pool);
  if (cutoff && cutoff.getTime() <= Date.now()) {
    console.error('[poolPayment] CRITICAL pool started for paid session:', session.id, poolId);
    return { ok: false, reason: 'POOL_STARTED_NEEDS_REFUND' };
  }

  const picks = deserializePicks(picksRaw);
  // Re-validate — picks were validated at checkout-create but pool fixtures
  // could have been edited by the admin in between (rare but possible).
  try {
    validatePicks(pool, picks);
  } catch (e) {
    console.error('[poolPayment] picks invalid at completion:', session.id, e.code, e.message);
    return { ok: false, reason: 'PICKS_INVALID_NEEDS_REFUND' };
  }

  const entryCount = await QuinielaEntry.countDocuments({ quiniela: poolId });
  const entry = new QuinielaEntry({
    quiniela: poolId,
    user: userId,
    entryNumber: entryCount + 1,
    picks,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null,
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    await entry.save();
  } catch (err) {
    if (err && err.code === 11000) {
      // Race: another worker handled this session first. Idempotent.
      console.log('[poolPayment] race-collision on session:', session.id);
      return { ok: true, alreadyProcessed: true };
    }
    throw err;
  }

  console.log(`[poolPayment] entry created — pool=${poolId} user=${userId} session=${session.id}`);
  return { ok: true, entryId: String(entry._id) };
}

/**
 * Refund an entry via Stripe and soft-flag the entry document.
 * Used by the admin payouts dashboard (Phase 9) when cancelling a pool.
 * Idempotent: re-calling on an already-refunded entry returns the existing
 * refundId without hitting Stripe.
 */
async function refundEntry(entryId, reason = 'requested_by_customer') {
  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error('Payments not configured'), { code: 'STRIPE_NOT_CONFIGURED' });

  const entry = await QuinielaEntry.findById(entryId);
  if (!entry) throw Object.assign(new Error('Entry not found'), { code: 'ENTRY_NOT_FOUND' });
  if (entry.refundedAt) return { alreadyRefunded: true, refundId: entry.refundId };
  if (!entry.stripePaymentIntentId) {
    throw Object.assign(new Error('Entry has no payment intent — cannot refund'), { code: 'NO_PAYMENT_INTENT' });
  }

  const refund = await stripe.refunds.create({
    payment_intent: entry.stripePaymentIntentId,
    reason,
  });

  entry.refundedAt = new Date();
  entry.refundId = refund.id;
  await entry.save();

  return { refundId: refund.id, alreadyRefunded: false };
}

module.exports = {
  createCheckoutSessionForEntry,
  handleCheckoutCompleted,
  refundEntry,
  // Exported for unit tests / future integrations.
  serializePicks,
  deserializePicks,
  validatePicks,
};
