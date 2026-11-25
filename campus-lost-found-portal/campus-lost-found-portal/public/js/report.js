/** report.js - create a report, or edit one with ?id=... */
import { api, getStoredUser } from './api.js';
import { mountHeader, mountFooter, requireLogin } from './common.js';
import {
  qs, escapeHtml, showFormErrors, clearFormErrors, withButtonState,
  toast, categoryLabel, categoryIcon, typeBadge, locationLabel,
} from './ui.js';

let meta = null;
let editingId = null;

const setType = (type) => {
  const value = type === 'lost' ? 'lost' : 'found';
  qs('#type').value = value;
  document.querySelectorAll('#type-toggle button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.type === value));
  });
};

const updateCounter = (inputSelector, countSelector, max) => {
  const input = qs(inputSelector);
  const counter = qs(countSelector);
  const length = input.value.length;
  counter.textContent = `${length} / ${max}`;
  counter.classList.toggle('over', length > max);
};

const wireCounters = () => {
  const title = qs('#title');
  const description = qs('#description');

  title.addEventListener('input', () => updateCounter('#title', '#title-count', 90));
  description.addEventListener('input', () => updateCounter('#description', '#description-count', 1000));
};

const wireTypeToggle = () => {
  document.querySelectorAll('#type-toggle button').forEach((button) => {
    button.addEventListener('click', () => setType(button.dataset.type));
  });
};

const wireImagePreview = () => {
  const input = qs('#image');
  const preview = qs('#image-preview');

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    preview.innerHTML = '';
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      preview.innerHTML = '<div class="notice error">That image is larger than 2 MB. Choose a smaller file.</div>';
      input.value = '';
      return;
    }

    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Selected photo preview" style="max-width:220px;border-radius:12px;border:1px solid var(--line)">`;
  });
};

const renderMatches = (matches) => {
  const panel = qs('#match-panel');
  const list = qs('#match-list');
  if (!panel || !list) return;

  if (!matches || !matches.length) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  list.innerHTML = matches
    .map(
      (match) => `
      <a class="match-item" href="/item.html?id=${encodeURIComponent(match._id)}">
        <span class="thumb-icon" aria-hidden="true">${categoryIcon(match.category)}</span>
        <span>
          <b>${escapeHtml(match.title)}</b>
          <span>${escapeHtml(categoryLabel(match.category))} · ${escapeHtml(locationLabel(match.location))}</span>
        </span>
        <span class="match-score">${match.matchScore}%</span>
      </a>`
    )
    .join('');

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const fillSelects = () => {
  qs('#category').insertAdjacentHTML(
    'beforeend',
    meta.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(categoryLabel(c))}</option>`).join('')
  );
  qs('#location').insertAdjacentHTML(
    'beforeend',
    meta.locations.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(categoryLabel(l))}</option>`).join('')
  );
};

const loadExisting = async (id) => {
  const payload = await api(`/items/${id}`);
  const item = payload.data;
  const user = getStoredUser();

  if (!user || (String(item.reporter._id) !== String(user._id) && user.role !== 'admin')) {
    toast('You can only edit your own reports', 'error');
    window.location.href = `/item.html?id=${id}`;
    return;
  }

  editingId = id;
  qs('#form-title').textContent = 'Edit your report';
  qs('#form-subtitle').textContent = 'Changes are saved to the same listing and keep its claim history.';
  qs('#crumb-current').textContent = 'Edit report';
  qs('#submit-btn').textContent = 'Save changes';

  qs('#title').value = item.title;
  qs('#description').value = item.description;
  qs('#category').value = item.category;
  qs('#location').value = item.location;
  qs('#contactInfo').value = item.contactInfo || '';
  qs('#dateLostOrFound').value = new Date(item.dateLostOrFound).toISOString().slice(0, 10);
  setType(item.type);

  updateCounter('#title', '#title-count', 90);
  updateCounter('#description', '#description-count', 1000);
};

const submit = async (event) => {
  event.preventDefault();
  const errors = qs('#form-errors');
  const button = qs('#submit-btn');
  clearFormErrors(errors);

  const form = new FormData();
  form.append('title', qs('#title').value.trim());
  form.append('description', qs('#description').value.trim());
  form.append('category', qs('#category').value);
  form.append('type', qs('#type').value);
  form.append('location', qs('#location').value);
  form.append('dateLostOrFound', qs('#dateLostOrFound').value);
  form.append('contactInfo', qs('#contactInfo').value.trim());

  const file = qs('#image').files[0];
  if (file) form.append('image', file);

  const restore = withButtonState(button, editingId ? 'Saving…' : 'Submitting…');

  try {
    if (editingId) {
      await api(`/items/${editingId}`, { method: 'PATCH', body: form });
      toast('Listing updated', 'success');
      window.location.href = `/item.html?id=${editingId}`;
      return;
    }

    const payload = await api('/items', { method: 'POST', body: form });
    toast('Report submitted', 'success');

    qs('#report-form').reset();
    setType('found');
    updateCounter('#title', '#title-count', 90);
    updateCounter('#description', '#description-count', 1000);
    qs('#image-preview').innerHTML = '';
    restore();

    if (payload.possibleMatches && payload.possibleMatches.length) {
      renderMatches(payload.possibleMatches);
      qs('#form-subtitle').textContent =
        'Your report is live. We already found something that might be the other half of it — check the panel below.';
    } else {
      window.location.href = `/item.html?id=${payload.data._id}`;
    }
  } catch (error) {
    restore();
    showFormErrors(errors, error);
  }
};

const start = async () => {
  mountHeader();
  mountFooter();

  if (!requireLogin()) return;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id');
  const initialType = params.get('type') || 'found';

  try {
    const payload = await api('/meta');
    meta = payload.data;
    fillSelects();
  } catch (error) {
    toast('Could not load the form options', 'error');
  }

  setType(initialType);
  qs('#dateLostOrFound').value = new Date().toISOString().slice(0, 10);
  updateCounter('#title', '#title-count', 90);
  updateCounter('#description', '#description-count', 1000);

  wireTypeToggle();
  wireCounters();
  wireImagePreview();
  qs('#report-form').addEventListener('submit', submit);
  qs('#cancel-btn').addEventListener('click', () => window.history.back());

  if (editId) {
    try {
      await loadExisting(editId);
    } catch (error) {
      toast(error.message, 'error');
      window.location.href = '/dashboard.html';
    }
  }
};

start();
