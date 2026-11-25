const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * protect() - verifies the bearer token signature, loads the user and puts it
 * on req.user. A disabled account is rejected even with a valid token.
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    throw ApiError.unauthorized('Sign in to continue (missing bearer token)');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError'
        ? 'Your session has expired, please sign in again'
        : 'Invalid session token'
    );
  }

  const user = await User.findById(payload.id);
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  req.user = user;
  return next();
});

/** adminOnly() - role gate. Always used after protect(). */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(ApiError.forbidden('Administrator access required'));
  }
  return next();
};

/** optionalAuth() - attaches req.user when a valid token is present. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (user && user.isActive) req.user = user;
  } catch (error) {
    /* a bad token simply means "guest" on a public route */
  }
  return next();
});

module.exports = { protect, adminOnly, optionalAuth };
