const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be 60 characters or fewer'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address'],
    },
    // select:false keeps the hash out of every query result unless asked for.
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: [60, 'Department must be 60 characters or fewer'],
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone must be 20 characters or fewer'],
      default: '',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ------------------------------ hooks ---------------------------------- */

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

/* ----------------------------- methods --------------------------------- */

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** The only shape of a user that is ever sent to a browser. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    phone: this.phone,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
