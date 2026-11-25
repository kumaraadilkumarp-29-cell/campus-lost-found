/** ui.js - rendering helpers. Every value that reaches the DOM is escaped. */

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

const CATEGORY_ICONS = {
  electronics: '💻',
  keys: '🔑',
  'id-cards': '🪪',
  bags: '🎒',
  clothing: '🧥',
  books: '📚',
  accessories: '⌚',
  other: '📦',
};

const LOCATION_LABELS = {
  library: 'Library',
  canteen: 'Canteen',
  'main-gate': 'Main gate',
  'academic-block-a': 'Academic block A',
  'academic-block-b': 'Academic block B',
  hostel: 'Hostel',
  'sports-complex': 'Sports complex',
  parking: 'Parking',
  auditorium: 'Auditorium',
  other: 'Other',
};

export const categoryIcon = (category) => CATEGORY_ICONS[category] || '📦';

export const categoryLabel = (category) =>
  String(category || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const locationLabel = (location) =>
  LOCATION_LABELS[location] ||
  String(location || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const timeAgo = (value) => {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
};

export const initials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

export const badge = (kind, label) =>
  `<span class="badge badge-${escapeHtml(kind)}">${escapeHtml(label)}</span>`;

export const statusBadge = (status) =>
  badge(status, String(status || '').replace(/-/g, ' '));

export const typeBadge = (type) => badge(type, type === 'lost' ? 'Lost' : 'Found');

/** One listing card. Used by the home page and the dashboard. */
export const itemCard = (item) => {
  const media = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">`
    : `<span class="thumb-icon" aria-hidden="true">${categoryIcon(item.category)}</span>`;

  return `
    <article class="item-card">
      <a class="item-thumb" href="/item.html?id=${encodeURIComponent(item._id)}" aria-label="${escapeHtml(item.title)}">
        ${media}
        ${typeBadge(item.type)}
      </a>
      <div class="item-body">
        <p class="item-meta">${escapeHtml(categoryLabel(item.category))} · ${escapeHtml(locationLabel(item.location))}</p>
        <h3 class="item-title">
          <a href="/item.html?id=${encodeURIComponent(item._id)}">${escapeHtml(item.title)}</a>
        </h3>
        <p class="item-desc">${escapeHtml(item.description)}</p>
        <div class="item-foot">
          ${statusBadge(item.status)}
          <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(timeAgo(item.createdAt))}</time>
        </div>
      </div>
    </article>`;
};

export const skeletonGrid = (count = 6) =>
  Array.from({ length: count }, () => '<div class="skeleton"></div>').join('');

export const emptyState = ({ icon = '📭', title = 'Nothing here yet', text = '', cta = '' } = {}) => `
  <div class="empty-state" style="grid-column: 1 / -1">
    <div class="empty-icon" aria-hidden="true">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    ${cta}
  </div>`;

export const spinner = (dark = false) =>
  `<span class="spinner ${dark ? 'spinner-dark' : ''}" role="status" aria-label="Loading"></span>`;

let toastTimer = null;

export const toast = (message, kind = 'info') => {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.setAttribute('role', 'status');
  node.textContent = message;
  stack.appendChild(node);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.remove();
  }, 4200);
};

/** Renders a 400 response's details array into the form error box. */
export const showFormErrors = (container, error) => {
  if (!container) return;
  const details = (error && error.details) || [];
  const lines = details.length
    ? details.map((detail) => `<li><strong>${escapeHtml(detail.field)}</strong> — ${escapeHtml(detail.message)}</li>`).join('')
    : `<li>${escapeHtml((error && error.message) || 'Something went wrong')}</li>`;

  container.innerHTML = `<strong>Please check the form</strong><ul>${lines}</ul>`;
  container.hidden = false;
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export const clearFormErrors = (container) => {
  if (!container) return;
  container.hidden = true;
  container.innerHTML = '';
};

/** Sets a submit button into a loading state and returns a restore function. */
export const withButtonState = (button, busyLabel = 'Working…') => {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${spinner()} <span>${escapeHtml(busyLabel)}</span>`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
};
