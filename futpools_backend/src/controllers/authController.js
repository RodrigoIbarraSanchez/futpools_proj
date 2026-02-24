const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const ADMIN_EMAILS = new Set(['demo@futpools.app', 'admin@futpools.app']);
const RESET_CODE_EXPIRY_MINUTES = 15;

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, displayName, username } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();

    let existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    }).select('email username');

    if (existing) {
      if (existing.email === normalizedEmail) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
      if (existing.username === normalizedUsername) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    let user = new User({
      email: normalizedEmail,
      password,
      username: normalizedUsername,
      displayName: String(displayName || '').trim(),
    });
    await user.save();
    const token = generateToken(user._id);
    const isAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        isAdmin,
        balance: user.balance ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      if (err?.keyPattern?.email) return res.status(400).json({ message: 'User already exists with this email' });
      if (err?.keyPattern?.username) return res.status(400).json({ message: 'Username is already taken' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user._id);
    const isAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        isAdmin,
        balance: user.balance ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Generate 6-digit numeric code */
function generateResetCode() {
  return String(crypto.randomInt(100000, 999999));
}

exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordResetCode +passwordResetExpiresAt');
    if (user) {
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);
      user.passwordResetCode = code;
      user.passwordResetExpiresAt = expiresAt;
      await user.save({ validateBeforeSave: false });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Auth] Password reset code for ${normalizedEmail}: ${code} (expires in ${RESET_CODE_EXPIRY_MINUTES} min)`);
      }
      // Production: connect an email provider (e.g. nodemailer + SMTP, Resend, SendGrid)
      // and send the code to user.email. Then set isPasswordRecoveryEnabled = true in the app.
    }
    res.json({
      message: 'If an account exists with this email, you will receive a recovery code shortly.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, newPassword } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password +passwordResetCode +passwordResetExpiresAt');
    if (!user || !user.passwordResetCode || !user.passwordResetExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired code. Request a new one.' });
    }
    if (user.passwordResetCode !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid or expired code. Request a new one.' });
    }
    if (new Date() > user.passwordResetExpiresAt) {
      user.passwordResetCode = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'Code has expired. Request a new one.' });
    }
    user.password = newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    const token = generateToken(user._id);
    const isAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
    res.json({
      message: 'Password updated. You are now signed in.',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        isAdmin,
        balance: user.balance ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
