const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { applyDelta } = require('../services/transactionService');

const ADMIN_EMAILS = new Set(['demo@futpools.app', 'admin@futpools.app']);
const RESET_CODE_EXPIRY_MINUTES = 15;
// v3: every new account gets seeded coins so the first Sponsored pool they
// create doesn't require an IAP. Defaulting to 100 (enough for a 50-coin
// prize + 5-coin fee with headroom). Override via env without redeploy.
const SIGNUP_BONUS_COINS = Math.max(0, Number(process.env.SIGNUP_BONUS_COINS) || 100);

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
    const { email, password, displayName, username, dob, countryCode } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();

    // Age gate (Fase 5) — sweepstakes require 18+. Backend enforces
    // this so a tampered client can't bypass. dob is optional ONLY for
    // legacy clients that haven't shipped the DOB field yet; new clients
    // should always send it. When sweepstakes geo-MX rolls out, the
    // sweepstakes endpoint refuses entry without dob+18+, even if
    // register let it through.
    let parsedDob = null;
    if (dob) {
      parsedDob = new Date(dob);
      if (isNaN(parsedDob.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth', code: 'INVALID_DOB' });
      }
      const ageMs = Date.now() - parsedDob.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        return res.status(400).json({ message: 'Must be 18 or older', code: 'UNDERAGE' });
      }
    }
    const normalizedCountry = countryCode
      ? String(countryCode).trim().toUpperCase().slice(0, 2)
      : null;

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
      dob: parsedDob,
      countryCode: normalizedCountry,
    });
    await user.save();

    // v3 signup bonus — credit the new account and write a ledger row so the
    // balance change is auditable. Idempotent via signup:<userId> in case the
    // register endpoint is retried (e.g. by a flaky client). Non-fatal on
    // failure — the user is still created; we just log and continue.
    //
    // We echo the bonus amount in the response so the client can celebrate it
    // with a welcome sheet ("🎁 +100 COINS") without having to compare
    // balances or guess. Null = no bonus applied.
    let bonusGranted = null;
    if (SIGNUP_BONUS_COINS > 0) {
      try {
        const result = await applyDelta({
          userId: user._id,
          amount: SIGNUP_BONUS_COINS,
          kind: 'signup_bonus',
          idempotencyKey: `signup:${user._id}`,
          note: `Welcome bonus (${SIGNUP_BONUS_COINS} coins)`,
        });
        if (result.applied) bonusGranted = SIGNUP_BONUS_COINS;
        user = await User.findById(user._id);
      } catch (err) {
        console.warn('[Auth] signup bonus failed:', err.message);
      }
    }

    const token = generateToken(user._id);
    const isAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
    res.status(201).json({
      token,
      signupBonus: bonusGranted,
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
