/** home.js - the browse page: filters live in the URL, so every view is shareable. */
import { api } from './api.js';
import { mountHeader, mountFooter } from './common.js';
import {
  itemCard, skeletonGrid, emptyState, escapeHtml, qs,
  categoryLabel, categoryIcon,
} from './ui.js';

const state = { search: '', type: '', category: '', location: '', sort: 'newest', page: 1 };
let meta = null;
let debounce = null;

const readUrl = () => {
  const params = new URLSearchParams(window.location.search);
  state.search = params.get('search') || '';
  state.type = params.get('type') || '';
  state.category = params.get('category') || '';
  state.location = params.get('location') || '';
  state.sort = params.get('sort') || 'newest';
  state.page = Math.max(1, Number(params.get('page')) || 1);
};

const writeUrl = () => {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.type) params.set('type', state.type);
  if (state.category) params.set('category', state.category);
  if (state.location) params.set('location', state.location);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));

  const query = params.toString();
  window.history.replaceState(null, '', query ? `/?${query}` : '/');
};

const syncControls = () => {
  qs('#search-input').value = state.search;
  qs('#filter-type').value = state.type;
  qs('#filter-category').value = state.category;
  qs('#filter-location').value = state.location;
  qs('#sort-select').value = state.sort;

  [...document.querySelectorAll('#category-chips .chip')].forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.category === state.category));
  });
};

const buildChips = () => {
  const chips = document.getElementById('category-chips');
  const all = `<button type="button" class="chip" data-category="" aria-pressed="true">All categories</button>`;
  const rest = meta.categories
    .map(
      (category) =>
        `<button type="button" class="chip" data-category="${escapeHtml(category)}" aria-pressed="false">
           <span aria-hidden="true">${categoryIcon(category)}</span> ${escapeHtml(categoryLabel(category))}
         </button>`
    )
    .join('');
  chips.innerHTML = all + rest;

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    state.category = chip.dataset.category;
    state.page = 1;
    syncControls();
    load();
  });
};

const fillSelects = () => {
  const categorySelect = qs('#filter-category');
  categorySelect.insertAdjacentHTML(
    'beforeend',
    meta.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(categoryLabel(c))}</option>`).join('')
  );

  const locationSelect = qs('#filter-location');
  locationSelect.insertAdjacentHTML(
    'beforeend',
    meta.locations.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(categoryLabel(l))}</option>`).join('')
  );
};

const renderPagination = (pagination) => {
  const node = qs('#pagination');
  if (!pagination || pagination.pages <= 1) {
    node.innerHTML = '';
    return;
  }

  const { page, pages } = pagination;
  const buttons = [];
  buttons.push(`<button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Previous</button>`);

  const windowStart = Math.max(1, Math.min(page - 1, pages - 2));
  const windowEnd = Math.min(pages, windowStart + 2);
  for (let index = windowStart; index <= windowEnd; index += 1) {
    buttons.push(
      `<button type="button" data-page="${index}" ${index === page ? 'aria-current="page"' : ''}>${index}</button>`
    );
  }

  buttons.push(`<button type="button" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Next</button>`);
  node.innerHTML = buttons.join('');

  node.onclick = (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    writeUrl();
    load();
    document.getElementById('browse').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
};

const load = async () => {
  const grid = qs('#items-grid');
  grid.innerHTML = skeletonGrid(6);
  qs('#pagination').innerHTML = '';

  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.type) params.set('type', state.type);
  if (state.category) params.set('category', state.category);
  if (state.location) params.set('location', state.location);
  params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('limit', '9');

  try {
    const payload = await api(`/items?${params.toString()}`);

    qs('#stat-total').textContent = payload.pagination.total;
    qs('#stat-lost').textContent = payload.counts.lost;
    qs('#stat-found').textContent = payload.counts.found;

    const filters = [state.search, state.type, state.category, state.location].filter(Boolean);
    qs('#results-title').textContent = filters.length ? 'Search results' : 'Recently reported';
    qs('#results-sub').textContent = filters.length
      ? `${payload.pagination.total} listing${payload.pagination.total === 1 ? '' : 's'} match your filters.`
      : 'The newest reports from across the campus.';

    grid.innerHTML = payload.data.length
      ? payload.data.map(itemCard).join('')
      : emptyState({
          icon: '🔍',
          title: 'No listings match that search',
          text: 'Try a broader keyword, clear a filter, or file a report so the other side can find you.',
          cta: '<a class="btn btn-sm" href="/report.html" style="margin-top:14px">Report an item</a>',
        });

    renderPagination(payload.pagination);
  } catch (error) {
    grid.innerHTML = emptyState({
      icon: '⚠️',
      title: 'Could not load listings',
      text: error.message,
      cta: '<button class="btn btn-sm" type="button" id="retry-btn" style="margin-top:14px">Try again</button>',
    });
    const retry = qs('#retry-btn');
    if (retry) retry.addEventListener('click', load);
  }
};

const wireControls = () => {
  const form = qs('#search-form');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = qs('#search-input').value.trim();
    state.type = qs('#filter-type').value;
    state.category = qs('#filter-category').value;
    state.location = qs('#filter-location').value;
    state.page = 1;
    writeUrl();
    load();
  });

  qs('#search-input').addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    state.page = 1;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      writeUrl();
      load();
    }, 400);
  });

  ['#filter-type', '#filter-category', '#filter-location'].forEach((selector) => {
    qs(selector).addEventListener('change', () => {
      state.type = qs('#filter-type').value;
      state.category = qs('#filter-category').value;
      state.location = qs('#filter-location').value;
      state.page = 1;
      syncControls();
      writeUrl();
      load();
    });
  });

  qs('#sort-select').addEventListener('change', (event) => {
    state.sort = event.target.value;
    state.page = 1;
    writeUrl();
    load();
  });
};

const start = async () => {
  mountHeader();
  mountFooter();
  readUrl();

  try {
    const payload = await api('/meta');
    meta = payload.data;
    fillSelects();
    buildChips();
  } catch (error) {
    // The filters still work with whatever is already in the markup.
  }

  syncControls();
  wireControls();
  load();
};

start();
