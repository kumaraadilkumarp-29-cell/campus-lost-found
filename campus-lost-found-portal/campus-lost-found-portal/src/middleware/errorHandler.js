const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

/** Unknown /api routes get JSON; unknown pages get the styled 404 page. */
const notFound = (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
  }
  return res.status(404).sendFile(path.join(__dirname, '..', '..', 'public', '404.html'));
};

/**
 * One error shape for the whole API: { success:false, message, details? }.
 * Mongoose and multer errors are translated, and stack traces only appear
 * outside production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details || undefined;

  // Mongoose schema validation
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Please fix the highlighted fields';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Duplicate key (unique email, duplicate claim)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message =
      field === 'email'
        ? 'An account with this email already exists'
        : 'That record already exists';
    details = [{ field, message }];
  }

  // Malformed ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Upload limits
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is larger than 2 MB'
        : `Upload failed: ${err.message}`;
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
    message = 'Something went wrong on our side, please try again';
  }

  const body = { success: false, message };
  if (details) body.details = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler, ApiError };
