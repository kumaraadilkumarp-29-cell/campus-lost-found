const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['duplicate', 'claim', 'decision', 'status'],
      default: 'status',
    },
    message: { type: String, required: true, maxlength: 300 },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
