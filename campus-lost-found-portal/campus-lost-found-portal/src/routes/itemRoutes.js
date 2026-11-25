const express = require('express');
const {
  getItems,
  getItemById,
  createItem,
  updateItem,
  updateStatus,
  deleteItem,
  getMyItems,
} = require('../controllers/itemController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  validateItem,
  validateItemUpdate,
  validateStatus,
} = require('../middleware/validate');

const router = express.Router();

// "/user/mine" must be declared before "/:id" or it would be read as an id.
router.get('/user/mine', protect, getMyItems);

router.get('/', optionalAuth, getItems);
router.get('/:id', optionalAuth, getItemById);
router.post('/', protect, upload.single('image'), validateItem, createItem);
router.patch('/:id', protect, upload.single('image'), validateItemUpdate, updateItem);
router.patch('/:id/status', protect, validateStatus, updateStatus);
router.delete('/:id', protect, deleteItem);

module.exports = router;
