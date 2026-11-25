const express = require('express');
const {
  getStats,
  getAllItems,
  getAllClaims,
  getAllUsers,
  setUserRole,
  adminDeleteItem,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateRole } = require('../middleware/validate');

const router = express.Router();

// Every admin route sits behind both gates.
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/items', getAllItems);
router.get('/claims', getAllClaims);
router.get('/users', getAllUsers);
router.patch('/users/:id/role', validateRole, setUserRole);
router.delete('/items/:id', adminDeleteItem);

module.exports = router;
