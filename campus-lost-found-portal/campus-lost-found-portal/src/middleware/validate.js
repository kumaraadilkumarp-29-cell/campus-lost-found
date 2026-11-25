const ApiError = require('../utils/ApiError');
const { CATEGORIES, LOCATIONS, ITEM_STATUSES } = require('../models/Item');

/**
 * Small hand-written validator. Every function returns a middleware that either
 * calls next() or throws a 400 carrying a details array, so the browser can
 * highlight the exact field that failed.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const push = (errors, field, message) => errors.push({ field, message });

const fail = (errors) =>
  ApiError.badRequest('Please fix the highlighted fields', errors);

const validateRegister = (req, res, next) => {
  const errors = [];
  const { name = '', email = '', password = '', department = '' } = req.body;

  if (!String(name).trim()) push(errors, 'name', 'Name is required');
  else if (String(name).trim().length < 2) push(errors, 'name', 'Name must be at least 2 characters');

  if (!String(email).trim()) push(errors, 'email', 'Email is required');
  else if (!EMAIL_RE.test(String(email).trim())) push(errors, 'email', 'Enter a valid email address');

  if (!password) push(errors, 'password', 'Password is required');
  else if (String(password).length < 8) push(errors, 'password', 'Password must be at least 8 characters');

  if (department && String(department).length > 60) {
    push(errors, 'department', 'Department must be 60 characters or fewer');
  }

  if (errors.length) return next(fail(errors));
  return next();
};

const validateLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body;
  if (!email) push(errors, 'email', 'Email is required');
  if (!password) push(errors, 'password', 'Password is required');
  if (errors.length) return next(fail(errors));
  return next();
};

const validateItem = (req, res, next) => {
  const errors = [];
  const {
    title = '',
    description = '',
    category,
    type,
    location,
    dateLostOrFound,
  } = req.body;

  const cleanTitle = String(title).trim();
  if (!cleanTitle) push(errors, 'title', 'Title is required');
  else if (cleanTitle.length < 3) push(errors, 'title', 'Title must be at least 3 characters');
  else if (cleanTitle.length > 90) push(errors, 'title', 'Title must be 90 characters or fewer');

  const cleanDescription = String(description).trim();
  if (!cleanDescription) push(errors, 'description', 'Description is required');
  else if (cleanDescription.length < 20) {
    push(errors, 'description', 'Description must be at least 20 characters');
  } else if (cleanDescription.length > 1000) {
    push(errors, 'description', 'Description must be 1000 characters or fewer');
  }

  if (!type) push(errors, 'type', 'Report type is required');
  else if (!['lost', 'found'].includes(type)) push(errors, 'type', 'Type must be lost or found');

  if (!category) push(errors, 'category', 'Category is required');
  else if (!CATEGORIES.includes(category)) push(errors, 'category', 'Choose a valid category');

  if (!location) push(errors, 'location', 'Location is required');
  else if (!LOCATIONS.includes(location)) push(errors, 'location', 'Choose a valid campus location');

  if (!dateLostOrFound) {
    push(errors, 'dateLostOrFound', 'Date is required');
  } else {
    const parsed = new Date(dateLostOrFound);
    if (Number.isNaN(parsed.getTime())) {
      push(errors, 'dateLostOrFound', 'Enter a valid date');
    } else {
      const tomorrow = new Date();
      tomorrow.setHours(23, 59, 59, 999);
      if (parsed > tomorrow) push(errors, 'dateLostOrFound', 'Date cannot be in the future');
    }
  }

  if (errors.length) return next(fail(errors));
  return next();
};

const validateItemUpdate = (req, res, next) => {
  const errors = [];
  const { title, description, category, type, location, dateLostOrFound } = req.body;

  if (title !== undefined) {
    const value = String(title).trim();
    if (value.length < 3 || value.length > 90) {
      push(errors, 'title', 'Title must be between 3 and 90 characters');
    }
  }
  if (description !== undefined) {
    const value = String(description).trim();
    if (value.length < 20 || value.length > 1000) {
      push(errors, 'description', 'Description must be between 20 and 1000 characters');
    }
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    push(errors, 'category', 'Choose a valid category');
  }
  if (location !== undefined && !LOCATIONS.includes(location)) {
    push(errors, 'location', 'Choose a valid campus location');
  }
  if (type !== undefined && !['lost', 'found'].includes(type)) {
    push(errors, 'type', 'Type must be lost or found');
  }
  if (dateLostOrFound !== undefined) {
    const parsed = new Date(dateLostOrFound);
    if (Number.isNaN(parsed.getTime())) push(errors, 'dateLostOrFound', 'Enter a valid date');
  }

  if (errors.length) return next(fail(errors));
  return next();
};

const validateStatus = (req, res, next) => {
  const { status } = req.body;
  if (!status) return next(ApiError.badRequest('Status is required'));
  if (!ITEM_STATUSES.includes(status)) {
    return next(
      ApiError.badRequest('Invalid status', [
        { field: 'status', message: `Status must be one of: ${ITEM_STATUSES.join(', ')}` },
      ])
    );
  }
  return next();
};

const validateClaim = (req, res, next) => {
  const errors = [];
  const { item, message = '', proof = '' } = req.body;

  if (!item) push(errors, 'item', 'Item id is required');

  const cleanMessage = String(message).trim();
  if (!cleanMessage) push(errors, 'message', 'Message is required');
  else if (cleanMessage.length < 10) push(errors, 'message', 'Message must be at least 10 characters');
  else if (cleanMessage.length > 500) push(errors, 'message', 'Message must be 500 characters or fewer');

  if (proof && String(proof).length > 300) {
    push(errors, 'proof', 'Proof must be 300 characters or fewer');
  }

  if (errors.length) return next(fail(errors));
  return next();
};

const validateDecision = (req, res, next) => {
  const { status, decisionNote = '' } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return next(
      ApiError.badRequest('Invalid decision', [
        { field: 'status', message: 'Status must be approved or rejected' },
      ])
    );
  }
  if (String(decisionNote).length > 300) {
    return next(ApiError.badRequest('Note too long', [
      { field: 'decisionNote', message: 'Note must be 300 characters or fewer' },
    ]));
  }
  return next();
};

const validateProfile = (req, res, next) => {
  const errors = [];
  const { name, email, department, phone } = req.body;
  if (name !== undefined && String(name).trim().length < 2) {
    push(errors, 'name', 'Name must be at least 2 characters');
  }
  if (email !== undefined && !EMAIL_RE.test(String(email).trim())) {
    push(errors, 'email', 'Enter a valid email address');
  }
  if (department !== undefined && String(department).length > 60) {
    push(errors, 'department', 'Department must be 60 characters or fewer');
  }
  if (phone !== undefined && String(phone).length > 20) {
    push(errors, 'phone', 'Phone must be 20 characters or fewer');
  }
  if (errors.length) return next(fail(errors));
  return next();
};

const validateRole = (req, res, next) => {
  const { role } = req.body;
  if (!['student', 'admin'].includes(role)) {
    return next(
      ApiError.badRequest('Invalid role', [{ field: 'role', message: 'Role must be student or admin' }])
    );
  }
  return next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateItem,
  validateItemUpdate,
  validateStatus,
  validateClaim,
  validateDecision,
  validateProfile,
  validateRole,
};
