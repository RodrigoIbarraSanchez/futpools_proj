const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/me', auth, userController.getMe);
router.put('/me', auth, userController.updateMe);
router.delete('/me', auth, userController.deleteMe);
router.put('/me/onboarding', auth, userController.updateOnboarding);
router.post('/me/devices', auth, userController.registerDevice);
router.post('/me/devices/test', auth, userController.sendTestPush);
router.post('/me/balance/recharge', auth, userController.rechargeBalance);

module.exports = router;
