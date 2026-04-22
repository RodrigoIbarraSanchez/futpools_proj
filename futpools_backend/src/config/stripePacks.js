/**
 * Coin pack catalog — source of truth for what the Web shop sells.
 *
 * How to wire this up:
 *   1. In Stripe Dashboard → Products, create 4 products (one per pack).
 *   2. For each product add a one-off Price in USD with the amounts below.
 *   3. Copy the Price ID (format `price_...`) into the matching entry here.
 *   4. Restart the backend. `/payments/catalog` returns these packs and
 *      `/payments/checkout-session` uses the stripePriceId when opening a
 *      Stripe Checkout Session.
 *
 * iOS IAP uses its own product IDs (com.futpools.recharge.*) — this file is
 * Web-only. Keep coin amounts in sync between the two so users see the same
 * deals regardless of platform.
 *
 * The client never sees stripePriceId — backend looks it up by packId.
 */

// Price IDs are not secret — they identify products in a specific Stripe
// account but can't do anything without the secret key. Safe to keep in repo.
// (The actual charge amounts are sourced from the Price object inside Stripe
// at checkout time, so priceCents here is display-only; editing it changes
// the UI label but not what the user is charged.)
const STRIPE_PACKS = {
  pack_50: {
    packId: 'pack_50',
    stripePriceId: process.env.STRIPE_PRICE_50 || 'price_1TOrVnAjj1DPkGsRocQFmeZi',
    coinAmount: 50,
    bonusCoins: 0,
    totalCoins: 50,
    priceCents: 99,
    currency: 'USD',
    badge: null,
  },
  pack_100: {
    packId: 'pack_100',
    stripePriceId: process.env.STRIPE_PRICE_100 || 'price_1TOrXiAjj1DPkGsRLsuiVFzL',
    coinAmount: 100,
    bonusCoins: 5,
    totalCoins: 105,
    priceCents: 199,
    currency: 'USD',
    badge: 'POPULAR',
  },
  pack_200: {
    packId: 'pack_200',
    stripePriceId: process.env.STRIPE_PRICE_200 || 'price_1TOrb4Ajj1DPkGsRcJdCnF4W',
    coinAmount: 200,
    bonusCoins: 20,
    totalCoins: 220,
    priceCents: 399,
    currency: 'USD',
    badge: '+10% BONUS',
  },
  pack_500: {
    packId: 'pack_500',
    stripePriceId: process.env.STRIPE_PRICE_500 || 'price_1TOrblAjj1DPkGsR2mwFwvti',
    coinAmount: 500,
    bonusCoins: 75,
    totalCoins: 575,
    priceCents: 999,
    currency: 'USD',
    badge: 'BEST VALUE',
  },
};

/** Ordered list for the catalog endpoint (UI renders in this order). */
const STRIPE_PACK_ORDER = ['pack_50', 'pack_100', 'pack_200', 'pack_500'];

function getPack(packId) {
  return STRIPE_PACKS[packId] || null;
}

function listPacks() {
  return STRIPE_PACK_ORDER.map((id) => STRIPE_PACKS[id]).filter(Boolean);
}

/**
 * Sanity check — every pack has a valid-looking Stripe Price ID AND the
 * secret key is set in env. Catalog endpoint short-circuits to 503 when
 * this returns false, avoiding a confusing UX where the user clicks a
 * pack and Stripe errors out mid-flow.
 */
function isConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  return listPacks().every((p) => p.stripePriceId && p.stripePriceId.startsWith('price_'));
}

module.exports = {
  STRIPE_PACKS,
  STRIPE_PACK_ORDER,
  getPack,
  listPacks,
  isConfigured,
};
