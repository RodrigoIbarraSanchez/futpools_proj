const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/** Same as auth but does not require a token; sets req.user only when token is valid. */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (user) req.user = user;
    next();
  } catch (err) {
    next();
  }
};

/** Requires req.user; returns 403 if user is not admin (demo@futpools.app). */
const requireAdmin = (req, res, next) => {
  const adminEmail = 'demo@futpools.app';
  if (!req.user || (req.user.email || '').toLowerCase() !== adminEmail) {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
};

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
