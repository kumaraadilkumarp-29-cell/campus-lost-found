const mongoose = require('mongoose');

/** One source of truth for the pickers in the UI and the schema validators. */
const CATEGORIES = [
  'electronics',
  'keys',
  'id-cards',
  'bags',
  'clothing',
  'books',
  'accessories',
  'other',
];

const LOCATIONS = [
  'library',
  'canteen',
  'main-gate',
  'academic-block-a',
  'academic-block-b',
  'hostel',
  'sports-complex',
  'parking',
  'auditorium',
  'other',
];

const ITEM_STATUSES = ['open', 'claimed', 'recovered', 'closed'];

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [90, 'Title must be 90 characters or fewer'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [1000, 'Description must be 1000 characters or fewer'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: 'Choose a valid category' },
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Report type is required'],
      enum: { values: ['lost', 'found'], message: 'Type must be lost or found' },
      index: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      enum: { values: LOCATIONS, message: 'Choose a valid campus location' },
      index: true,
    },
    dateLostOrFound: {
      type: Date,
      required: [true, 'Date is required'],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    contactInfo: {
      type: String,
      trim: true,
      maxlength: [120, 'Contact info must be 120 characters or fewer'],
      default: 'Contact through the portal',
    },
    status: {
      type: String,
      enum: { values: ITEM_STATUSES, message: 'Invalid status' },
      default: 'open',
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    views: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------ indexes -------------------------------- */

itemSchema.index({ title: 'text', description: 'text' });
itemSchema.index({ type: 1, status: 1, category: 1, createdAt: -1 });

/* ------------------------------ virtuals ------------------------------- */

itemSchema.virtual('isOpen').get(function isOpen() {
  return this.status === 'open';
});

module.exports = mongoose.model('Item', itemSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.LOCATIONS = LOCATIONS;
module.exports.ITEM_STATUSES = ITEM_STATUSES;
