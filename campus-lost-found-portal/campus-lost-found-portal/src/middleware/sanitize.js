/**
 * NoSQL-injection guard.
 *
 * Mongoose will happily interpret { email: { $gt: '' } } as a query operator,
 * so every key that starts with "$" or contains a "." is removed from the
 * body, the query string and the route params before anything else runs.
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clean = (target) => {
  if (Array.isArray(target)) {
    target.forEach((entry, index) => {
      if (isPlainObject(entry) || Array.isArray(entry)) target[index] = clean(entry);
    });
    return target;
  }

  if (!isPlainObject(target)) return target;

  // for...of over a snapshot of the keys, so deleting while iterating is safe.
  for (const key of Object.keys(target)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete target[key];
      continue;
    }
    const value = target[key];
    if (isPlainObject(value) || Array.isArray(value)) clean(value);
  }
  return target;
};

const sanitize = (req, res, next) => {
  if (req.body) clean(req.body);
  if (req.query) clean(req.query);
  if (req.params) clean(req.params);
  next();
};

module.exports = sanitize;
module.exports.clean = clean;
