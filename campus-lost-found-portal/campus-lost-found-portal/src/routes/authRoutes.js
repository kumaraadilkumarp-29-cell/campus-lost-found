const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, getMe, updateMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateProfile,
} = require('../middleware/validate');

const router = express.Router();

// Brute-force guard: 30 attempts per IP per 15 minutes on the credential routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again in 15 minutes' },
});

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.get('/me', protect, getMe);
router.patch('/me', protect, validateProfile, updateMe);
router.post('/logout', protect, logout);

module.exports = router;
