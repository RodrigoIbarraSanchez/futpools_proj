const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('displayName').optional().trim(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);

module.exports = router;
