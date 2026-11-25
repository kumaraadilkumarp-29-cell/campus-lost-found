const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { findPossibleMatches } = require('../utils/findMatches');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  date: { dateLostOrFound: -1 },
  title: { title: 1 },
  popular: { views: -1, createdAt: -1 },
};

const PUBLIC_REPORTER = 'name department role';

/**
 * GET /api/items
 * Search + filter + sort + paginate. Public: anyone can browse.
 * Query: search, type, category, location, status, sort, page, limit, reporter
 */
const getItems = asyncHandler(async (req, res) => {
  const {
    search = '',
    type,
    category,
    location,
    status,
    sort = 'newest',
    reporter,
    page = 1,
    limit = 12,
  } = req.query;

  const filter = {};

  if (search) {
    const pattern = escapeRegex(String(search).trim());
    filter.$or = [
      { title: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (location) filter.location = location;
  if (reporter) filter.reporter = reporter;

  // Public browsing hides archived (closed) reports unless asked for.
  if (status) filter.status = status;
  else filter.status = { $ne: 'closed' };

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 12));
  const sortBy = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

  const [items, total, lostCount, foundCount] = await Promise.all([
    Item.find(filter)
      .populate('reporter', PUBLIC_REPORTER)
      .sort(sortBy)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize),
    Item.countDocuments(filter),
    Item.countDocuments({ ...filter, type: 'lost' }),
    Item.countDocuments({ ...filter, type: 'found' }),
  ]);

  res.json({
    success: true,
    count: items.length,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
    counts: { lost: lostCount, found: foundCount },
    data: items,
  });
});

/** GET /api/items/user/mine - the signed-in user's own reports */
const getMyItems = asyncHandler(async (req, res) => {
  const items = await Item.find({ reporter: req.user._id }).sort({ createdAt: -1 });

  // Claim counts for the dashboard badges, computed in one pass.
  const claimRows = await Claim.find({ item: { $in: items.map((item) => item._id) } }).select(
    'item status'
  );

  const byItem = claimRows.reduce((map, claim) => {
    const key = claim.item.toString();
    if (!map[key]) map[key] = { total: 0, pending: 0 };
    map[key].total += 1;
    if (claim.status === 'pending') map[key].pending += 1;
    return map;
  }, {});

  const data = items.map((item) => ({
    ...item.toObject(),
    claimCounts: byItem[item._id.toString()] || { total: 0, pending: 0 },
  }));

  res.json({ success: true, count: data.length, data });
});

/** GET /api/items/:id */
const getItemById = asyncHandler(async (req, res) => {
  const item = await Item.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate('reporter', PUBLIC_REPORTER);

  if (!item) throw ApiError.notFound('That listing does not exist');

  const claims = await Claim.find({ item: item._id }).populate('claimant', 'name department');
  const isOwner = req.user && item.reporter && item.reporter._id.equals(req.user._id);

  // Claim details are private to the reporter and to the claimant themselves.
  const visibleClaims = isOwner
    ? claims
    : claims.filter((claim) => req.user && claim.claimant._id.equals(req.user._id));

  res.json({ success: true, data: { ...item.toObject(), claims: visibleClaims } });
});

/**
 * POST /api/items
 * multipart/form-data (optional "image") or JSON. Returns the created item plus
 * possibleMatches, the custom duplicate-detection feature.
 */
const createItem = asyncHandler(async (req, res) => {
  const payload = {
    title: req.body.title,
    description: req.body.description,
    category: req.body.category,
    type: req.body.type,
    location: req.body.location,
    dateLostOrFound: req.body.dateLostOrFound,
    contactInfo: req.body.contactInfo || 'Contact through the portal',
    reporter: req.user._id,
  };

  if (req.file) payload.imageUrl = `/uploads/${req.file.filename}`;

  const item = await Item.create(payload);
  await item.populate('reporter', PUBLIC_REPORTER);

  const possibleMatches = await findPossibleMatches(item.toObject(), Item);

  if (possibleMatches.length) {
    const reporterIds = [
      ...new Set(possibleMatches.map((match) => match.reporter.toString())),
    ].filter((id) => id !== req.user._id.toString());

    if (reporterIds.length) {
      await Notification.insertMany(
        reporterIds.map((userId) => ({
          user: userId,
          type: 'duplicate',
          message: `A ${item.type} report matching your ${item.category} listing was just added: "${item.title}"`,
          item: item._id,
        }))
      );
    }
  }

  res.status(201).json({
    success: true,
    message: 'Report submitted',
    data: item,
    possibleMatches,
  });
});

/** PATCH /api/items/:id - owner or admin only */
const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('That listing does not exist');

  const isOwner = item.reporter.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only edit your own reports');
  }

  const allowed = ['title', 'description', 'category', 'type', 'location', 'dateLostOrFound', 'contactInfo'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) item[field] = req.body[field];
  }
  if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;

  await item.save();
  await item.populate('reporter', PUBLIC_REPORTER);

  res.json({ success: true, message: 'Listing updated', data: item });
});

/** PATCH /api/items/:id/status - owner moves the workflow, admin may close */
const updateStatus = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('That listing does not exist');

  const isOwner = item.reporter.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('You can only change the status of your own reports');
  }

  const { status } = req.body;
  if (status === 'closed' && !isAdmin) {
    throw ApiError.forbidden('Only an administrator can close a listing');
  }
  if (item.status === 'closed') {
    throw ApiError.badRequest('A closed listing cannot change status');
  }

  item.status = status;
  await item.save();

  res.json({ success: true, message: `Status set to ${status}`, data: item });
});

/** DELETE /api/items/:id - owner or admin */
const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('That listing does not exist');

  const isOwner = item.reporter.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own reports');
  }

  await Promise.all([
    Claim.deleteMany({ item: item._id }),
    Notification.deleteMany({ item: item._id }),
    item.deleteOne(),
  ]);

  res.json({ success: true, message: 'Listing deleted', data: { _id: item._id } });
});

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  updateStatus,
  deleteItem,
  getMyItems,
};
