const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/token');

/**
 * POST /api/auth/register
 * The role is never read from the request body - privilege escalation through
 * the payload is therefore impossible.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, department = '', phone = '' } = req.body;

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', [
      { field: 'email', message: 'This email is already registered' },
    ]);
  }

  const user = await User.create({ name, email, password, department, phone });

  res.status(201).json({
    success: true,
    message: 'Account created',
    token: signToken(user),
    data: user.toSafeJSON(),
  });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password has select:false, so it must be asked for explicitly.
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email or password is incorrect');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  res.json({
    success: true,
    message: 'Signed in',
    token: signToken(user),
    data: user.toSafeJSON(),
  });
});

/** GET /api/auth/me */
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toSafeJSON() });
});

/** PATCH /api/auth/me */
const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'department', 'phone'];
  const updates = {};

  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.email) {
    updates.email = String(updates.email).toLowerCase().trim();
    const clash = await User.findOne({ email: updates.email, _id: { $ne: req.user._id } });
    if (clash) {
      throw ApiError.conflict('That email is already in use', [
        { field: 'email', message: 'This email is already registered' },
      ]);
    }
  }

  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('That account no longer exists');

  Object.assign(user, updates);
  await user.save(); // schema validators and hooks run here

  res.json({ success: true, message: 'Profile updated', data: user.toSafeJSON() });
});

/**
 * POST /api/auth/logout
 * Tokens are stateless, so this is an acknowledgement: the client drops the
 * token. The endpoint exists so the front end has one place to call.
 */
const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Signed out' });
});

module.exports = { register, login, getMe, updateMe, logout };
