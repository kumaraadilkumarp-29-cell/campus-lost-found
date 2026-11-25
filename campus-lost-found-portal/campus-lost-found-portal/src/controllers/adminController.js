const Item = require('../models/Item');
const Claim = require('../models/Claim');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/admin/stats
 * Dashboard numbers. Grouping happens in the database with an aggregation
 * pipeline; the seven-day series is bucketed in JS so it works on every
 * MongoDB version without depending on $dateToString timezone support.
 */
const getStats = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [byStatus, byCategory, byType, totalItems, totalUsers, totalClaims, pendingClaims, recentItems] =
    await Promise.all([
      Item.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Item.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Item.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Item.countDocuments(),
      User.countDocuments(),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'pending' }),
      Item.find({ createdAt: { $gte: sevenDaysAgo } }).select('createdAt type').lean(),
    ]);

  const statusMap = byStatus.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});
  const typeMap = byType.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});

  // Seven-day activity: one bucket per day, labelled dd Mon.
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + index);
    return {
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      lost: 0,
      found: 0,
    };
  });

  for (const item of recentItems) {
    const key = new Date(item.createdAt).toISOString().slice(0, 10);
    const bucket = days.find((day) => day.date === key);
    if (bucket) bucket[item.type] += 1;
  }

  const recovered = statusMap.recovered || 0;

  res.json({
    success: true,
    data: {
      totals: {
        items: totalItems,
        users: totalUsers,
        claims: totalClaims,
        pendingClaims,
        openItems: statusMap.open || 0,
        recovered,
        recoveryRate: totalItems ? Math.round((recovered / totalItems) * 100) : 0,
      },
      byStatus: byStatus.map((row) => ({ status: row._id, count: row.count })),
      byCategory: byCategory.map((row) => ({ category: row._id, count: row.count })),
      byType: [
        { type: 'lost', count: typeMap.lost || 0 },
        { type: 'found', count: typeMap.found || 0 },
      ],
      activity: days,
    },
  });
});

/** GET /api/admin/items - every listing including closed ones */
const getAllItems = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  const items = await Item.find(filter)
    .populate('reporter', 'name email role')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json({ success: true, count: items.length, data: items });
});

/** GET /api/admin/claims */
const getAllClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find()
    .populate('item', 'title type status')
    .populate('claimant', 'name email')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json({ success: true, count: claims.length, data: claims });
});

/** GET /api/admin/users */
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: users.length, data: users.map((user) => user.toSafeJSON()) });
});

/** PATCH /api/admin/users/:id/role */
const setUserRole = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('That user does not exist');

  user.role = req.body.role;
  await user.save();

  res.json({ success: true, message: `Role set to ${user.role}`, data: user.toSafeJSON() });
});

/** DELETE /api/admin/items/:id - force delete with its claims */
const adminDeleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('That listing does not exist');

  await Promise.all([
    Claim.deleteMany({ item: item._id }),
    Notification.deleteMany({ item: item._id }),
    item.deleteOne(),
  ]);

  res.json({ success: true, message: 'Listing removed by administrator', data: { _id: item._id } });
});

module.exports = { getStats, getAllItems, getAllClaims, getAllUsers, setUserRole, adminDeleteItem };
