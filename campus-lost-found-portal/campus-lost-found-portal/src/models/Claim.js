const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Tell the owner why this is your item'],
      trim: true,
      minlength: [10, 'Message must be at least 10 characters'],
      maxlength: [500, 'Message must be 500 characters or fewer'],
    },
    proof: {
      type: String,
      trim: true,
      maxlength: [300, 'Proof must be 300 characters or fewer'],
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    decisionNote: { type: String, trim: true, maxlength: 300, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One claim per person per item: a repeat attempt becomes a 409, not a silent row.
claimSchema.index({ item: 1, claimant: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
