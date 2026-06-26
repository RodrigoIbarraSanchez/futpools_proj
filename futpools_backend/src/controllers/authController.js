const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { applyDelta } = require('../services/transactionService');
const { sendTelegramMessage } = require('../services/telegramService');
const { welcomeNewUser, sendPasswordResetCode } = require('../services/brevoService');

const { ADMIN_EMAILS } = require('../middleware/auth');
const { serializePayout } = require('../lib/payout');
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

/**
 * Validator → structured error mapper. express-validator returns an
 * array of `{ msg, path, value, ... }` objects. We pick the first one
 * and map its `path` to a stable `code` the client can localize. The
 * raw `msg` is also returned as a sane fallback for any client that
 * doesn't recognize the code yet.
 */
function firstValidatorError(errors) {
  const e = errors[0];
  if (!e) return { message: 'Invalid request', code: 'INVALID_REQUEST' };
  const codeByPath = {
    email:       'INVALID_EMAIL',
    password:    'WEAK_PASSWORD',
    username:    'INVALID_USERNAME',
    displayName: 'NAME_TOO_SHORT',
  };
  return {
    message: e.msg || 'Invalid request',
    code: codeByPath[e.path] || 'INVALID_REQUEST',
    field: e.path || null,
  };
}

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(firstValidatorError(errors.array()));
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
        return res.status(400).json({
          message: 'Invalid date of birth',
          code: 'INVALID_DOB',
          field: 'dob',
        });
      }
      const ageMs = Date.now() - parsedDob.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        return res.status(400).json({
          message: 'You must be 18 or older to sign up',
          code: 'UNDERAGE',
          field: 'dob',
        });
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
        return res.status(400).json({
          message: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
          field: 'email',
        });
      }
      if (existing.username === normalizedUsername) {
        return res.status(400).json({
          message: 'That username is already taken',
          code: 'USERNAME_TAKEN',
          field: 'username',
        });
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

    // Telegram alert to the organizer: new signup. Best-effort and fully
    // detached — a Telegram outage must never affect registration.
    // `signupSource` is first-touch attribution captured by the web client
    // (first page the visitor ever landed on + external referrer).
    try {
      const src = (req.body && typeof req.body.signupSource === 'object' && req.body.signupSource) || {};
      const firstPath = String(src.path || '').slice(0, 200);
      const referrer = String(src.referrer || '').slice(0, 200);
      const ua = String(req.headers['user-agent'] || '');
      const device = /mobile|iphone|ipad|android/i.test(ua) ? '📱 Móvil' : '💻 Desktop';
      const when = new Date().toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short',
      });
      const lines = [
        '🆕 Nuevo registro en FutPools',
        `👤 ${user.displayName || user.username} (@${user.username})`,
        `📧 ${user.email}`,
        `🕑 ${when} hora CDMX`,
        firstPath ? `📍 Primera página visitada: ${firstPath}` : null,
        referrer ? `🔗 Vino desde: ${referrer}` : null,
        user.countryCode ? `🌎 País: ${user.countryCode}` : null,
        device,
      ].filter(Boolean);
      sendTelegramMessage(lines.join('\n')).catch(() => {});
    } catch (notifyErr) {
      console.warn('[Auth] signup telegram alert failed:', notifyErr.message);
    }

    // Brevo: register the contact in the marketing list + send the welcome
    // email. Best-effort and fully detached (same contract as the Telegram
    // alert above) — a Brevo outage or missing config must never affect
    // registration. No-op until BREVO_API_KEY is set.
    welcomeNewUser(user).catch((e) => console.warn('[Auth] brevo welcome failed:', e.message));

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
        payout: serializePayout(user.payout),
      },
    });
  } catch (err) {
    console.error('[Auth] register error:', err);
    if (err?.code === 11000) {
      if (err?.keyPattern?.email) {
        return res.status(400).json({
          message: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
          field: 'email',
        });
      }
      if (err?.keyPattern?.username) {
        return res.status(400).json({
          message: 'That username is already taken',
          code: 'USERNAME_TAKEN',
          field: 'username',
        });
      }
    }
    // Mongoose validation (e.g. corrupt input that bypassed the
    // express-validator layer) — surface the first invalid path so
    // the client can highlight the right field.
    if (err?.name === 'ValidationError' && err.errors) {
      const firstField = Object.keys(err.errors)[0];
      return res.status(400).json({
        message: err.errors[firstField]?.message || 'Validation error',
        code: 'VALIDATION_ERROR',
        field: firstField,
      });
    }
    res.status(500).json({
      message: "Couldn't create your account. Please try again in a moment.",
      code: 'SERVER_ERROR',
    });
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
        payout: serializePayout(user.payout),
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
      // Email the reset code (best-effort; never blocks the response). The
      // endpoint always returns the same generic message regardless, so it
      // doesn't leak whether the account exists.
      sendPasswordResetCode({
        email: user.email,
        displayName: user.displayName || user.username,
        code,
        minutes: RESET_CODE_EXPIRY_MINUTES,
      }).catch((e) => console.warn('[Auth] brevo reset email failed:', e.message));
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
        payout: serializePayout(user.payout),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
