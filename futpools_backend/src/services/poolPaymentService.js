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
const SpeiPayment = require('../models/SpeiPayment');
const User = require('../models/User');
const { sendTelegramMessage } = require('./telegramService');
const brevoService = require('./brevoService');
const creditService = require('./creditService');
const { isAdminUser } = require('../middleware/auth');

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
  const pool = await Quiniela.findById(poolId);
  if (!pool) throw Object.assign(new Error('Pool not found'), { code: 'POOL_NOT_FOUND', status: 404 });

  // Cutoff: any fixture already kicked off blocks new entries. We don't
  // rely on the pool's settlementStatus because that flips much later
  // (post-FT) and we want the gate at first kickoff.
  const cutoff = firstKickoff(pool);
  if (cutoff && cutoff.getTime() <= Date.now()) {
    throw Object.assign(new Error('Pool already started'), { code: 'POOL_STARTED', status: 400 });
  }

  // simple_version allows multiple entries per user — each new
  // checkout creates an additional entry, displayed in the leaderboard
  // as "username", "username 2", "username 3", etc. The duplicate
  // guard from the previous iteration is gone; entryNumber scoping
  // per-user happens in handleCheckoutCompleted.

  validatePicks(pool, picks);

  // Admin bypass — admins curate the platform and shouldn't be charged
  // to test pools or fill in for missing players. Skip Stripe entirely
  // and create the entry inline. The webhook flow stays untouched for
  // regular users so the audit trail (sessionId, paymentIntent) is only
  // missing for admin entries, which is fine — they never settled money.
  if (isAdminUser(user)) {
    const userEntryCount = await QuinielaEntry.countDocuments({
      quiniela: poolId, user: user._id,
    });
    const entry = await QuinielaEntry.create({
      quiniela: poolId,
      user: user._id,
      entryNumber: userEntryCount + 1,
      picks,
      // No stripeSessionId / stripePaymentIntentId — these stay null so
      // future refundEntry calls correctly skip the Stripe API and just
      // soft-delete the entry.
      paidAt: new Date(),
      adminFreeEntry: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[poolPayment] admin free entry — pool=${poolId} user=${user._id} entry=${entry._id}`);
    return { ok: true, freeEntry: true, entryId: String(entry._id) };
  }

  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error('Payments not configured'), { code: 'STRIPE_NOT_CONFIGURED', status: 503 });

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

  // entryNumber is scoped per-user so it reads as "your nth entry in
  // this pool", not "the nth entry overall". The leaderboard renders
  // username #N when the number is > 1, so the user sees "tester",
  // "tester 2", "tester 3" for their three submissions.
  const userEntryCount = await QuinielaEntry.countDocuments({ quiniela: poolId, user: userId });
  const entry = new QuinielaEntry({
    quiniela: poolId,
    user: userId,
    entryNumber: userEntryCount + 1,
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

// ──────────────────────────────────────────────────────────────────────
// Manual SPEI flow (replaces Stripe — account closed).
//
// The user composes picks, we stash them in a SpeiPayment with a unique
// numeric reference, and show them the destination CLABE + reference. An
// admin verifies the incoming transfer in their bank and confirms; only
// then is the real QuinielaEntry created. Unpaid intents therefore never
// reach the leaderboard or settlement.
// ──────────────────────────────────────────────────────────────────────

/** Destination account shown to the payer. Configured via env. */
function getSpeiConfig() {
  return {
    clabe: process.env.SPEI_CLABE || '',
    beneficiary: process.env.SPEI_BENEFICIARY || '',
    bank: process.env.SPEI_BANK || '',
  };
}

/**
 * PayPal config for players outside Mexico (manual flow, USD). When
 * PAYPAL_ME_URL is unset the PayPal option simply isn't offered (no
 * broken screens). Two link formats are supported:
 *   - PayPal.me (https://paypal.me/user): the amount CAN be appended as
 *     /3USD so it arrives prefilled.
 *   - Payment Links (https://www.paypal.com/ncp/payment/XXXX): must be
 *     used VERBATIM — appending anything 302s to PayPal's "something
 *     went wrong" page. The amount lives in the button's own settings,
 *     so keep it in sync with PAYPAL_ENTRY_USD.
 */
function getPaypalConfig() {
  const url = (process.env.PAYPAL_ME_URL || '').trim().replace(/\/$/, '');
  const entryUSD = Math.max(1, Number(process.env.PAYPAL_ENTRY_USD) || 3);
  const isPaypalMe = /paypal\.me\//i.test(url);
  return {
    paypalMeUrl: url,
    payUrl: isPaypalMe ? `${url}/${entryUSD}USD` : url,
    entryUSD,
    enabled: !!url,
  };
}

/**
 * Generate a unique 7-digit numeric reference. Numeric so it fits SPEI's
 * "referencia numérica" field AND doubles as the "concepto". Retries on the
 * rare collision against the unique index.
 */
async function generateSpeiReference() {
  for (let i = 0; i < 6; i += 1) {
    // 7 digits, no leading zero so it never gets trimmed by a bank field.
    const ref = String(1000000 + Math.floor(Math.random() * 9000000));
    // eslint-disable-next-line no-await-in-loop
    const exists = await SpeiPayment.exists({ reference: ref });
    if (!exists) return ref;
  }
  throw Object.assign(new Error('Could not mint a unique SPEI reference'), { code: 'SPEI_REF_COLLISION', status: 500 });
}

/**
 * Create a QuinielaEntry from picks, scoping entryNumber per-user. Shared by
 * the SPEI confirm path; mirrors the Stripe webhook's entry creation (sans
 * stripe fields). Caller is responsible for pool/cutoff/picks validation.
 */
async function createEntryFromPicks({ poolId, userId, picks }) {
  const userEntryCount = await QuinielaEntry.countDocuments({ quiniela: poolId, user: userId });
  const entry = await QuinielaEntry.create({
    quiniela: poolId,
    user: userId,
    entryNumber: userEntryCount + 1,
    picks,
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return entry;
}

/**
 * Validate a pool + picks and create a pending SpeiPayment. Returns the
 * payment reference + the destination account so the web can render the
 * "transfer $50 here" screen. Admins bypass payment entirely (free entry),
 * matching the Stripe path.
 */
async function createSpeiIntentForEntry({ user, poolId, picks, method = 'spei' }) {
  const pool = await Quiniela.findById(poolId);
  if (!pool) throw Object.assign(new Error('Pool not found'), { code: 'POOL_NOT_FOUND', status: 404 });

  const payMethod = method === 'paypal' ? 'paypal' : 'spei';
  const paypalCfg = getPaypalConfig();
  if (payMethod === 'paypal' && !paypalCfg.enabled) {
    throw Object.assign(new Error('PayPal payments are not configured'), { code: 'PAYPAL_NOT_CONFIGURED', status: 400 });
  }

  const cutoff = firstKickoff(pool);
  if (cutoff && cutoff.getTime() <= Date.now()) {
    throw Object.assign(new Error('Pool already started'), { code: 'POOL_STARTED', status: 400 });
  }

  validatePicks(pool, picks);

  // Telegram alert: a user just signed up as participant (picks submitted).
  // This is the TOP of the join funnel — the existing "marcó como pagado"
  // alert is the next step, and admin confirm closes it. Best-effort.
  const notifyJoinIntent = (kind, amountMXN, reference) => {
    try {
      const when = new Date().toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short',
      });
      const lines = [
        '📝 Nueva inscripción a quiniela',
        `🏆 ${pool.name}`,
        `👤 ${user.displayName || user.username || ''} (${user.email || 'sin email'})`,
        kind === 'free'
          ? '💸 Entrada gratuita (pool $0): entrada creada al instante'
          : kind === 'credit'
            ? `🎟️ Entrada cubierta con crédito ($${amountMXN} MXN): inscrito al instante.\n✅ No requiere confirmación (no aparece en Pagos SPEI).`
            : kind === 'paypal'
              ? `💰 $${paypalCfg.entryUSD} USD · pendiente de pago PayPal${reference ? ` · ref ${reference}` : ''}`
              : `💰 $${amountMXN} MXN · pendiente de pago SPEI${reference ? ` · ref ${reference}` : ''}`,
        `🕑 ${when} hora CDMX`,
      ];
      sendTelegramMessage(lines.join('\n')).catch(() => {});
    } catch (e) {
      console.warn('[poolPayment] join-intent telegram skipped:', e.message);
    }
  };

  // Admin bypass — same as the Stripe path: admins curate the platform and
  // shouldn't be charged. Create the entry inline, no SPEI needed.
  if (isAdminUser(user)) {
    const entry = await createEntryFromPicks({ poolId, userId: user._id, picks });
    await QuinielaEntry.updateOne({ _id: entry._id }, { $set: { adminFreeEntry: true } });
    console.log(`[poolPayment] admin free entry (spei path) — pool=${poolId} user=${user._id} entry=${entry._id}`);
    return { ok: true, freeEntry: true, entryId: String(entry._id) };
  }

  // Note: `Number(x) || 50` would wrongly charge $50 on a free ($0) pool,
  // so resolve the fee explicitly.
  const amountMXN = Number.isFinite(Number(pool.entryFeeMXN)) ? Number(pool.entryFeeMXN) : 50;

  // Free pool ($0 entry) → no SPEI; create the entry directly so the user
  // joins instantly. The UI flags these as "sin premio / de prueba".
  if (amountMXN <= 0) {
    const entry = await createEntryFromPicks({ poolId, userId: user._id, picks });
    console.log(`[poolPayment] free entry ($0 pool) — pool=${poolId} user=${user._id} entry=${entry._id}`);
    notifyJoinIntent('free', 0, null);
    return { ok: true, freeEntry: true, entryId: String(entry._id) };
  }

  // MXN store-credit → if the user's balance covers the WHOLE entry fee, spend
  // it and create the entry instantly (no SPEI). All-or-nothing: a balance
  // short of the fee is left untouched and we fall through to SPEI. Typical
  // case: organizer rolled a missed-pool payment forward as $50 credit.
  const availableCredit = await creditService.getAvailableCredit(user._id);
  if (availableCredit >= amountMXN) {
    const entry = await createEntryFromPicks({ poolId, userId: user._id, picks });
    const spend = await creditService.useCreditForEntry({
      userId: user._id, poolId, entryId: entry._id, amountMXN,
    });
    if (!spend.applied && !spend.already) {
      // Defensive: spend failed for a non-idempotency reason. Roll back the
      // entry so we don't hand out a free entry without charging credit.
      await QuinielaEntry.deleteOne({ _id: entry._id });
      throw Object.assign(new Error('Could not apply credit'), { code: 'CREDIT_APPLY_FAILED', status: 500 });
    }
    // Race guard against double-spend: the balance is read-then-debited, so two
    // near-simultaneous joins could both pass the `availableCredit >= amount`
    // check above and overdraw the ledger. The UI disables the button while
    // submitting, but that's not airtight across tabs/devices. If our post-spend
    // balance went negative, this request lost the race — reverse it (the
    // earlier request keeps its entry) and ask the user to retry.
    if (spend.applied) {
      const postBalance = await creditService.getAvailableCredit(user._id);
      if (postBalance < 0) {
        await creditService.refundCreditForEntry({ userId: user._id, poolId, entryId: entry._id, amountMXN });
        await QuinielaEntry.deleteOne({ _id: entry._id });
        throw Object.assign(new Error('Credit just changed — please try again'), { code: 'CREDIT_RACE', status: 409 });
      }
    }
    await QuinielaEntry.updateOne(
      { _id: entry._id },
      { $set: { creditEntry: true, creditAmountMXN: amountMXN } },
    );
    console.log(`[poolPayment] credit entry — pool=${poolId} user=${user._id} entry=${entry._id} −$${amountMXN} MXN`);
    notifyJoinIntent('credit', amountMXN, null);
    return {
      ok: true,
      creditEntry: true,
      freeEntry: true, // keeps the existing client redirect (res.freeEntry) working
      entryId: String(entry._id),
      creditAppliedMXN: amountMXN,
      creditRemainingMXN: availableCredit - amountMXN,
    };
  }

  // Dedup pending intents per (user, pool). Without this, every re-submit
  // (back button → submit again, refresh, retry) minted a fresh SpeiPayment
  // row AND fired another "Nueva inscripción" Telegram alert — the cause of
  // the "1 jugador, 3 pagos generados, 3 notificaciones" bug. Reuse the most
  // recent pending intent instead: refresh its picks/method/amount, keep its
  // reference stable (so a transfer already started still matches), and do
  // NOT notify again.
  let payment = await SpeiPayment.findOne({
    quiniela: poolId,
    user: user._id,
    status: 'pending',
  }).sort({ createdAt: -1 });

  if (payment) {
    payment.picks = picks;
    payment.method = payMethod;
    payment.amountMXN = amountMXN;
    payment.amountUSD = payMethod === 'paypal' ? paypalCfg.entryUSD : null;
    payment.updatedAt = new Date();
    await payment.save();
    console.log(`[poolPayment] reusing pending ${payMethod} intent — pool=${poolId} user=${user._id} ref=${payment.reference}`);
    // No notifyJoinIntent on reuse — the admin was already pinged when the
    // first intent was created; re-submits must not spam.
  } else {
    const reference = await generateSpeiReference();
    payment = await SpeiPayment.create({
      quiniela: poolId,
      user: user._id,
      picks,
      amountMXN,
      method: payMethod,
      amountUSD: payMethod === 'paypal' ? paypalCfg.entryUSD : null,
      reference,
      status: 'pending',
    });
    console.log(`[poolPayment] ${payMethod} intent created — pool=${poolId} user=${user._id} ref=${reference}`);
    notifyJoinIntent(payMethod, amountMXN, reference);
  }

  if (payMethod === 'paypal') {
    return {
      ok: true,
      method: 'paypal',
      paymentId: String(payment._id),
      reference: payment.reference,
      amountMXN,
      amountUSD: paypalCfg.entryUSD,
      // PayPal.me links get the amount appended; Payment Links go verbatim.
      paypalMeUrl: paypalCfg.payUrl,
      poolName: pool.name,
    };
  }

  const cfg = getSpeiConfig();
  return {
    ok: true,
    method: 'spei',
    paymentId: String(payment._id),
    reference: payment.reference,
    amountMXN,
    poolName: pool.name,
    ...cfg,
  };
}

/**
 * Admin confirms an incoming SPEI transfer arrived → create the entry.
 * Idempotent: a payment already 'confirmed' returns its existing entry.
 * Re-validates pool/cutoff/picks (the pool could have started or been
 * edited between intent and confirmation).
 */
async function confirmSpeiPayment({ paymentId, adminUser }) {
  const payment = await SpeiPayment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { code: 'PAYMENT_NOT_FOUND', status: 404 });
  if (payment.status === 'confirmed') {
    return { ok: true, alreadyConfirmed: true, entryId: payment.entry ? String(payment.entry) : null };
  }
  if (payment.status === 'rejected') {
    throw Object.assign(new Error('Payment was rejected'), { code: 'PAYMENT_REJECTED', status: 400 });
  }

  const pool = await Quiniela.findById(payment.quiniela);
  if (!pool) throw Object.assign(new Error('Pool no longer exists'), { code: 'POOL_GONE', status: 400 });

  const cutoff = firstKickoff(pool);
  if (cutoff && cutoff.getTime() <= Date.now()) {
    throw Object.assign(new Error('Pool already started — cannot confirm this payment'), { code: 'POOL_STARTED', status: 400 });
  }
  // Picks were validated at intent; re-check in case fixtures were edited.
  validatePicks(pool, payment.picks);

  const entry = await createEntryFromPicks({ poolId: payment.quiniela, userId: payment.user, picks: payment.picks });
  payment.status = 'confirmed';
  payment.entry = entry._id;
  payment.confirmedBy = adminUser?._id || null;
  payment.confirmedAt = new Date();
  payment.updatedAt = new Date();
  await payment.save();

  console.log(`[poolPayment] SPEI confirmed — ref=${payment.reference} entry=${entry._id} by=${adminUser?.email}`);

  // Participation-confirmed email (best-effort) — re-engage: invite them to add
  // another entry to the same pool (more entries = more chances). Fire-and-forget;
  // never blocks/affects the admin's confirm response.
  User.findById(payment.user).select('email displayName username').lean()
    .then((u) => (u?.email
      ? brevoService.sendParticipationConfirmed({
          email: u.email,
          displayName: u.displayName || u.username,
          poolName: pool.name,
          poolId: String(pool._id),
        })
      : null))
    .catch((e) => console.warn('[poolPayment] brevo confirm email failed:', e.message));

  return { ok: true, entryId: String(entry._id) };
}

/**
 * Payer taps "I've transferred" → flag their pending payment so the
 * organizer knows to verify it. Owner-only; only meaningful while pending.
 * Idempotent (re-tapping just updates the note/timestamp).
 */
async function markSpeiPaidByUser({ user, paymentId, note }) {
  const payment = await SpeiPayment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { code: 'PAYMENT_NOT_FOUND', status: 404 });
  if (String(payment.user) !== String(user._id)) {
    throw Object.assign(new Error('Not your payment'), { code: 'NOT_OWNER', status: 403 });
  }
  if (payment.status !== 'pending') {
    // Already confirmed/rejected — nothing to claim. Return ok so the client
    // can show a friendly "already handled" state instead of an error.
    return { ok: true, status: payment.status, alreadyHandled: true };
  }
  payment.userMarkedPaidAt = new Date();
  payment.userNote = (note || '').toString().trim().slice(0, 200);
  payment.updatedAt = new Date();
  await payment.save();
  console.log(`[poolPayment] SPEI marked paid by user — ref=${payment.reference} user=${user._id}`);

  // Fire-and-forget Telegram ping to the organizer so they can verify the
  // transfer in their bank. Never block the user's action on it.
  try {
    const pool = await Quiniela.findById(payment.quiniela).select('name').lean();
    const base = WEB_APP_BASE_URL();
    const who = user.displayName || user.email || String(user._id);
    const isPaypal = payment.method === 'paypal';
    const text = [
      `💸 Pago marcado como pagado (${isPaypal ? 'PayPal' : 'SPEI'})`,
      '',
      `Quiniela: ${pool?.name || '—'}`,
      `Jugador: ${who}${user.email ? ` (${user.email})` : ''}`,
      isPaypal ? `Monto: $${payment.amountUSD} USD vía PayPal` : `Monto: $${payment.amountMXN} MXN`,
      `Referencia: ${payment.reference}`,
      isPaypal ? `Nota del pagador: ${payment.userNote || '—'}` : `Clave de rastreo: ${payment.userNote || '—'}`,
      '',
      `Valida aquí: ${base}/admin/spei`,
    ].join('\n');
    sendTelegramMessage(text).catch(() => {});
  } catch (e) {
    console.warn('[poolPayment] telegram notify skipped:', e.message);
  }

  // Best-effort: reassure the payer we received their notice (account email —
  // ignores the marketing opt-out). Fire-and-forget; never blocks the action.
  Quiniela.findById(payment.quiniela).select('name').lean()
    .then((p) => brevoService.sendPaymentReceivedAck({
      email: user.email,
      displayName: user.displayName || user.username,
      poolName: p?.name,
      poolId: String(payment.quiniela),
    }))
    .catch((e) => console.warn('[poolPayment] brevo ack email failed:', e.message));

  return { ok: true };
}

/** Admin marks a pending SPEI payment as not-arrived / invalid. */
async function rejectSpeiPayment({ paymentId, adminUser, reason }) {
  const payment = await SpeiPayment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { code: 'PAYMENT_NOT_FOUND', status: 404 });
  if (payment.status === 'confirmed') {
    throw Object.assign(new Error('Payment already confirmed — cannot reject'), { code: 'ALREADY_CONFIRMED', status: 400 });
  }
  payment.status = 'rejected';
  payment.rejectedReason = (reason || '').toString().trim().slice(0, 500);
  payment.confirmedBy = adminUser?._id || null;
  payment.confirmedAt = new Date();
  payment.updatedAt = new Date();
  await payment.save();
  console.log(`[poolPayment] SPEI rejected — ref=${payment.reference} by=${adminUser?.email}`);
  return { ok: true };
}

module.exports = {
  createCheckoutSessionForEntry,
  handleCheckoutCompleted,
  refundEntry,
  // Manual SPEI flow.
  createSpeiIntentForEntry,
  markSpeiPaidByUser,
  confirmSpeiPayment,
  rejectSpeiPayment,
  getSpeiConfig,
  getPaypalConfig,
  // Exported for unit tests / future integrations.
  serializePicks,
  deserializePicks,
  validatePicks,
};
