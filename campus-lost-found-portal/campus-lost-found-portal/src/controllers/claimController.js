const Claim = require('../models/Claim');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/claims
 * Business rules: no self-claims, no duplicate claims, no claims on a closed or
 * recovered listing. The reporter is notified and the item moves to "claimed".
 */
const createClaim = asyncHandler(async (req, res) => {
  const { item: itemId, message, proof = '' } = req.body;

  const item = await Item.findById(itemId);
  if (!item) throw ApiError.notFound('That listing does not exist');

  if (item.reporter.equals(req.user._id)) {
    throw ApiError.badRequest('You cannot claim an item you reported yourself');
  }
  if (['recovered', 'closed'].includes(item.status)) {
    throw ApiError.badRequest(`This listing is already ${item.status}`);
  }

  const existing = await Claim.findOne({ item: item._id, claimant: req.user._id });
  if (existing) {
    throw ApiError.conflict('You have already submitted a claim for this item', [
      { field: 'item', message: 'A claim already exists for this item' },
    ]);
  }

  const claim = await Claim.create({
    item: item._id,
    claimant: req.user._id,
    message,
    proof,
  });

  // Notify the reporter, and move the listing into the claimed state.
  await Notification.create({
    user: item.reporter,
    type: 'claim',
    message: `${req.user.name} submitted a claim on "${item.title}"`,
    item: item._id,
    claim: claim._id,
  });

  if (item.status === 'open') {
    item.status = 'claimed';
    await item.save();
  }

  await claim.populate([
    { path: 'item', select: 'title type category status imageUrl' },
    { path: 'claimant', select: 'name department' },
  ]);

  res.status(201).json({ success: true, message: 'Claim submitted', data: claim });
});

/** GET /api/claims/mine - claims I submitted */
const getMyClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ claimant: req.user._id })
    .populate('item', 'title type category status location imageUrl dateLostOrFound')
    .populate('claimant', 'name department')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: claims.length, data: claims });
});

/** GET /api/claims/received - claims on listings I reported */
const getReceivedClaims = asyncHandler(async (req, res) => {
  const myItems = await Item.find({ reporter: req.user._id }).select('_id');
  const ids = myItems.map((item) => item._id);

  const claims = await Claim.find({ item: { $in: ids } })
    .populate('item', 'title type category status location imageUrl')
    .populate('claimant', 'name email department')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: claims.length, data: claims });
});

/**
 * PATCH /api/claims/:id - approve or reject.
 * Only the item's reporter (or an admin) may decide. Approving one claim
 * auto-rejects every rival claim and marks the item recovered.
 */
const decideClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id).populate('item');
  if (!claim) throw ApiError.notFound('That claim does not exist');

  const item = claim.item;
  const isOwner = item.reporter.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the reporter of this item can decide on claims');
  }
  if (claim.status !== 'pending') {
    throw ApiError.badRequest(`This claim was already ${claim.status}`);
  }

  const { status, decisionNote = '' } = req.body;

  claim.status = status;
  claim.decisionNote = decisionNote;
  claim.decidedAt = new Date();
  await claim.save();

  const notifications = [
    {
      user: claim.claimant,
      type: 'decision',
      message:
        status === 'approved'
          ? `Your claim on "${item.title}" was approved. Arrange the handover with the reporter.`
          : `Your claim on "${item.title}" was rejected.${decisionNote ? ` Note: ${decisionNote}` : ''}`,
      item: item._id,
      claim: claim._id,
    },
  ];

  if (status === 'approved') {
    item.status = 'recovered';
    await item.save();

    const rivals = await Claim.find({
      item: item._id,
      _id: { $ne: claim._id },
      status: 'pending',
    });

    if (rivals.length) {
      await Claim.updateMany(
        { _id: { $in: rivals.map((rival) => rival._id) } },
        { status: 'rejected', decisionNote: 'Another claim was approved', decidedAt: new Date() }
      );
      notifications.push(
        ...rivals.map((rival) => ({
          user: rival.claimant,
          type: 'decision',
          message: `Another claim on "${item.title}" was approved, so your claim was closed.`,
          item: item._id,
          claim: rival._id,
        }))
      );
    }
  }

  await Notification.insertMany(notifications);

  res.json({ success: true, message: `Claim ${status}`, data: claim });
});

/** DELETE /api/claims/:id - a claimant may withdraw a pending claim */
const withdrawClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) throw ApiError.notFound('That claim does not exist');

  if (!claim.claimant.equals(req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only withdraw your own claim');
  }
  if (claim.status !== 'pending') {
    throw ApiError.badRequest('Only a pending claim can be withdrawn');
  }

  await claim.deleteOne();

  // If no pending claims remain, the listing goes back to open.
  const remaining = await Claim.countDocuments({ item: claim.item, status: 'pending' });
  if (!remaining) {
    await Item.findByIdAndUpdate(claim.item, { status: 'open' });
  }

  res.json({ success: true, message: 'Claim withdrawn', data: { _id: claim._id } });
});

module.exports = { createClaim, getMyClaims, getReceivedClaims, decideClaim, withdrawClaim };
