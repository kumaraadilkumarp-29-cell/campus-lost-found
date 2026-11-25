const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/notifications */
const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .populate('item', 'title type category status')
    .sort({ createdAt: -1 })
    .limit(50);

  const unread = await Notification.countDocuments({ user: req.user._id, read: false });

  res.json({ success: true, unread, count: notifications.length, data: notifications });
});

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) throw ApiError.notFound('That notification does not exist');
  res.json({ success: true, message: 'Marked as read', data: notification });
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: 'All notifications marked as read', modified: result.modifiedCount });
});

module.exports = { getMyNotifications, markRead, markAllRead };
