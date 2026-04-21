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

const ADMIN_EMAILS = new Set(['demo@futpools.app', 'admin@futpools.app']);

const isAdminUser = (user) =>
  !!user && ADMIN_EMAILS.has((user.email || '').toLowerCase());

/** Requires req.user; returns 403 if user is not admin. */
const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
};

/**
 * Factory: returns middleware that loads a resource and allows access only if
 * the authenticated user owns it (resource.createdBy === req.user._id) or is an
 * admin. Use after the `auth` middleware.
 *
 *   router.put('/:id', auth, requireOwnerOrAdmin(async (req) => Quiniela.findById(req.params.id)), handler)
 *
 * The loaded document is attached to `req.resource` so handlers can reuse it.
 */
const requireOwnerOrAdmin = (loader) => async (req, res, next) => {
  try {
    const doc = await loader(req);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const ownerId = doc.createdBy ? String(doc.createdBy) : null;
    const userId = req.user ? String(req.user._id) : null;
    const isOwner = ownerId && userId && ownerId === userId;
    if (!isOwner && !isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    req.resource = doc;
    next();
  } catch (err) {
    console.error('[requireOwnerOrAdmin] error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireOwnerOrAdmin = requireOwnerOrAdmin;
module.exports.isAdminUser = isAdminUser;
