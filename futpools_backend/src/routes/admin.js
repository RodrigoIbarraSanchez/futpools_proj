const express = require('express');
const adminController = require('../controllers/adminController');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require `auth` first to populate req.user, then
// `requireAdmin` to gate by the ADMIN_EMAILS whitelist.
router.use(auth, requireAdmin);

router.post('/pools/platform-event', adminController.createPlatformEvent);
router.post('/users/:id/mint', adminController.mintCoins);
router.get('/ledger', adminController.getLedger);

module.exports = router;
