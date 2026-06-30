const express = require('express');
const adminController = require('../controllers/adminController');
const adminPayoutsController = require('../controllers/adminPayoutsController');
const adminSpeiController = require('../controllers/adminSpeiController');
const adminCreditsController = require('../controllers/adminCreditsController');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require `auth` first to populate req.user, then
// `requireAdmin` to gate by the ADMIN_EMAILS whitelist.
router.use(auth, requireAdmin);

router.post('/pools/platform-event', adminController.createPlatformEvent);
router.post('/users/:id/mint', adminController.mintCoins);
router.get('/ledger', adminController.getLedger);

// simple_version payouts dashboard — list settled-but-unpaid pools and
// mark them paid after a manual bank transfer.
router.get('/payouts', adminPayoutsController.getPendingPayouts);
router.post('/pools/:id/mark-paid', adminPayoutsController.markPoolPaid);
// Per-winner payout: mark one winner (grouped by user) as paid individually.
router.post('/pools/:id/winners/:userId/mark-paid', adminPayoutsController.markWinnerPaid);
// Destructive — cancels the pool and refunds every entry via Stripe.
router.post('/pools/:id/cancel', adminPayoutsController.cancelPool);

// Manual-SPEI cobros — list pending transfers, confirm (creates the entry)
// or reject. Replaces Stripe Checkout.
router.get('/spei-payments', adminSpeiController.listSpeiPayments);
router.post('/spei-payments/:id/confirm', adminSpeiController.confirmSpeiPayment);
router.post('/spei-payments/:id/reject', adminSpeiController.rejectSpeiPayment);

// MXN store-credit — grant pesos to a user (by email) so their next pool
// entry is covered without a fresh transfer; revoke for corrections.
router.get('/credits', adminCreditsController.getCredits);
router.get('/credits/search', adminCreditsController.searchUsers);
router.post('/credits/grant', adminCreditsController.grantCredit);
router.post('/credits/revoke', adminCreditsController.revokeCredit);

module.exports = router;
