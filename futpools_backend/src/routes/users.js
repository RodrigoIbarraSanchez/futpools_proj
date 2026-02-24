const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/me', auth, userController.getMe);
router.put('/me', auth, userController.updateMe);
router.post('/me/balance/recharge', auth, userController.rechargeBalance);

module.exports = router;
