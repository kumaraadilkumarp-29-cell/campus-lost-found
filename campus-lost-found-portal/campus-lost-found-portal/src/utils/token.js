const jwt = require('jsonwebtoken');

/** Signs a compact session token. Only the id and role travel in the payload. */
const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = { signToken };
