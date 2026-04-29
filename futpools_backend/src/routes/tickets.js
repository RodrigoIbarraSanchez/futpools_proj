const express = require('express');
const ticketsController = require('../controllers/ticketsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, ticketsController.getMyBalance);
router.get('/me/transactions', auth, ticketsController.listMyTransactions);

module.exports = router;
