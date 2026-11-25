/**
 * Higher-order function: wraps an async controller so a rejected promise is
 * forwarded to next() and lands in the single error handler.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
