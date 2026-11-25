/**
 * Custom feature: possible-duplicate detection.
 *
 * When a report is created we look for items of the OPPOSITE type in the SAME
 * category and score them on shared keywords. Anything at or above 30% is
 * returned (best five) so the reporter immediately sees likely matches, and the
 * opposite side is notified.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'with', 'without', 'for', 'from', 'to',
  'in', 'on', 'at', 'of', 'is', 'was', 'are', 'were', 'my', 'mine', 'i', 'it',
  'this', 'that', 'these', 'those', 'have', 'has', 'had', 'lost', 'found',
  'item', 'items', 'please', 'help', 'near', 'around', 'some', 'any', 'very',
  'black', 'blue', 'red', 'white', 'green',
]);

const keywordsOf = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {object} item   the item just created (lean document)
 * @param {Model}  Item   the Item model, injected to avoid a circular import
 * @returns {Promise<Array>} scored candidates, best first
 */
const findPossibleMatches = async (item, Item, { limit = 5 } = {}) => {
  const words = [...new Set(keywordsOf(`${item.title} ${item.description}`))].slice(0, 8);
  if (!words.length) return [];

  const oppositeType = item.type === 'lost' ? 'found' : 'lost';
  const pattern = words.map(escapeRegex).join('|');

  const candidates = await Item.find({
    _id: { $ne: item._id },
    type: oppositeType,
    category: item.category,
    status: { $in: ['open', 'claimed'] },
    $or: [
      { title: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ],
  })
    .limit(40)
    .lean();

  return candidates
    .map((candidate) => {
      const haystack = `${candidate.title} ${candidate.description}`.toLowerCase();
      const hits = words.filter((word) => haystack.includes(word)).length;
      const sameLocation = candidate.location === item.location ? 1 : 0;
      const score = Math.min(
        100,
        Math.round((hits / words.length) * 80 + sameLocation * 20)
      );
      return { ...candidate, matchScore: score };
    })
    .filter((candidate) => candidate.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};

module.exports = { findPossibleMatches, keywordsOf };
