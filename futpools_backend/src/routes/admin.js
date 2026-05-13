const express = require('express');
const adminController = require('../controllers/adminController');
const adminPayoutsController = require('../controllers/adminPayoutsController');
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

module.exports = router;
