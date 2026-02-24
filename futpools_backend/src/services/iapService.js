/**
 * IAP (In-App Purchase) service: decode and validate StoreKit 2 transaction, map product to amount.
 * For production, verify the JWS with Apple root certificates or call App Store Server API.
 */

const PRODUCT_ID_TO_AMOUNT = {
  'com.futpools.recharge.50': 50,
  'com.futpools.recharge.100': 100,
  'com.futpools.recharge.200': 200,
  'com.futpools.recharge.500': 500,
};

/**
 * Decode JWS payload (middle part) without cryptographic verification.
 * Production should verify the signature with Apple root certs or App Store Server API.
 */
function decodeJWSPayload(signedTransaction) {
  if (!signedTransaction || typeof signedTransaction !== 'string') {
    return null;
  }
  const parts = signedTransaction.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Extract productId and originalTransactionId from decoded JWS transaction payload.
 * Apple's JWSTransaction decoded payload structure (StoreKit 2).
 */
function getTransactionIds(payload) {
  if (!payload) return null;
  const productId = payload.productId || payload.product_id;
  const originalTransactionId = payload.originalTransactionId ?? payload.original_transaction_id ?? payload.transactionId ?? payload.transaction_id;
  if (!productId || !originalTransactionId) return null;
  return { productId, originalTransactionId: String(originalTransactionId) };
}

/**
 * Get balance amount for a product ID.
 */
function getAmountForProductId(productId) {
  return PRODUCT_ID_TO_AMOUNT[productId] ?? 0;
}

module.exports = {
  decodeJWSPayload,
  getTransactionIds,
  getAmountForProductId,
  PRODUCT_IDS: Object.keys(PRODUCT_ID_TO_AMOUNT),
};
