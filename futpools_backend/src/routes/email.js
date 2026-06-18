const express = require('express');

const router = express.Router();
const emailController = require('../controllers/emailController');

// Public unsubscribe landing for marketing/announcement emails.
// GET = footer link click; POST = mailbox one-click (RFC 8058).
router.get('/unsubscribe', emailController.unsubscribe);
router.post('/unsubscribe', emailController.unsubscribe);

module.exports = router;
