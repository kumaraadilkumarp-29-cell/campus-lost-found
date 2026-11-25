/** admin.js - moderation dashboard: statistics, charts and three tables. */
import { api } from './api.js';
import { mountHeader, mountFooter, requireAdmin } from './common.js';
import {
  qs, escapeHtml, timeAgo, statusBadge, typeBadge, categoryLabel, toast, spinner, emptyState,
} from './ui.js';

let stats = null;
let items = [];
let claims = [];
let users = [];

const barChart = (rows, { labelKey, valueKey, variant = '' } = {}) => {
  const max = Math.max(1, ...rows.map((row) => row[valueKey]));
  return rows
    .map((row) => {
      const value = row[valueKey];
      const width = value === 0 ? 0 : Math.max(3, Math.round((value / max) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label" title="${escapeHtml(row[labelKey])}">${escapeHtml(String(row[labelKey]).replace(/-/g, ' '))}</span>
          <span class="bar-track"><span class="bar-fill ${variant}" style="width:${width}%"></span></span>
          <span class="bar-value">${row[valueKey]}</span>
        </div>`;
    })
    .join('');
};

const renderStats = () => {
  const totals = stats.totals;
  qs('#stat-items').textContent = totals.items;
  qs('#stat-lost').textContent = stats.byType.find((row) => row.type === 'lost').count;
  qs('#stat-found').textContent = stats.byType.find((row) => row.type === 'found').count;
  qs('#stat-recovery').textContent = `${totals.recoveryRate}%`;

  qs('#note-items').textContent = `${totals.openItems} open · ${totals.recovered} recovered`;
  qs('#note-lost').textContent = 'reported missing';
  qs('#note-found').textContent = 'handed in';
  qs('#note-recovery').textContent = `${totals.claims} claims · ${totals.pendingClaims} pending`;
};

const renderCharts = () => {
  qs('#chart-category').innerHTML = stats.byCategory.length
    ? barChart(stats.byCategory, { labelKey: 'category', valueKey: 'count' })
    : '<p class="muted small">No listings yet.</p>';

  const statusRows = stats.byStatus.slice().sort((a, b) => b.count - a.count);
  qs('#chart-status').innerHTML = statusRows.length
    ? barChart(statusRows, { labelKey: 'status', valueKey: 'count', variant: 'gold' })
    : '<p class="muted small">No listings yet.</p>';

  const activity = stats.activity.flatMap((day) => [
    { label: day.label, count: day.lost, variant: 'lost' },
    { label: day.label, count: day.found, variant: '' },
  ]);

  // Two bars per day would be noisy: draw a single total per day instead.
  const totalsPerDay = stats.activity.map((day) => ({
    label: day.label,
    count: day.lost + day.found,
  }));
  qs('#chart-activity').innerHTML = barChart(totalsPerDay, { labelKey: 'label', valueKey: 'count' });
  const total = activity.reduce((sum, row) => sum + row.count, 0);
  qs('#activity-total').textContent = `${total} report${total === 1 ? '' : 's'} in seven days`;
};

const renderItems = () => {
  const root = qs('#admin-items');
  if (!items.length) {
    root.innerHTML = emptyState({ icon: '📋', title: 'No listings', text: 'The register is empty.' });
    return;
  }

  const rows = items
    .map(
      (item) => `
      <tr>
        <td>
          <div class="table-title"><a href="/item.html?id=${encodeURIComponent(item._id)}">${escapeHtml(item.title)}</a></div>
          <div class="muted small">${escapeHtml(categoryLabel(item.category))} · ${escapeHtml(timeAgo(item.createdAt))}</div>
        </td>
        <td>${typeBadge(item.type)}</td>
        <td>${statusBadge(item.status)}</td>
        <td class="small">${escapeHtml((item.reporter && item.reporter.name) || '—')}</td>
        <td>
          <div class="table-actions">
            <select data-status-for="${item._id}" style="width:auto;padding:6px 30px 6px 10px;font-size:.8rem">
              ${['open', 'claimed', 'recovered', 'closed']
                .map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`)
                .join('')}
            </select>
            <button class="btn btn-danger btn-sm" type="button" data-delete="${item._id}">Remove</button>
          </div>
        </td>
      </tr>`
    )
    .join('');

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Listing</th><th>Type</th><th>Status</th><th>Reporter</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  root.querySelectorAll('[data-status-for]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await api(`/items/${select.dataset.statusFor}/status`, {
          method: 'PATCH',
          body: { status: select.value },
        });
        toast(`Status set to ${select.value}`, 'success');
        refresh();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  root.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Remove this listing permanently?')) return;
      try {
        await api(`/admin/items/${button.dataset.delete}`, { method: 'DELETE' });
        toast('Listing removed', 'success');
        refresh();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
};

const renderClaims = () => {
  const root = qs('#admin-claims');
  if (!claims.length) {
    root.innerHTML = emptyState({ icon: '🗂️', title: 'No claims', text: 'No claims have been filed yet.' });
    return;
  }

  const rows = claims
    .map(
      (claim) => `
      <tr>
        <td class="table-title">${escapeHtml((claim.item && claim.item.title) || 'Removed listing')}</td>
        <td class="small">${escapeHtml((claim.claimant && claim.claimant.name) || '—')}</td>
        <td>${statusBadge(claim.status)}</td>
        <td class="small muted">${escapeHtml(claim.message)}</td>
        <td class="small">${escapeHtml(timeAgo(claim.createdAt))}</td>
      </tr>`
    )
    .join('');

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Listing</th><th>Claimant</th><th>Status</th><th>Message</th><th>Filed</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
};

const renderUsers = () => {
  const root = qs('#admin-users');
  const rows = users
    .map(
      (user) => `
      <tr>
        <td class="table-title">${escapeHtml(user.name)}</td>
        <td class="small">${escapeHtml(user.email)}</td>
        <td class="small">${escapeHtml(user.department || '—')}</td>
        <td><span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-open'}">${escapeHtml(user.role)}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" type="button" data-role="${user._id}" data-next="${user.role === 'admin' ? 'student' : 'admin'}">
            Make ${user.role === 'admin' ? 'student' : 'admin'}
          </button>
        </td>
      </tr>`
    )
    .join('');

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  root.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api(`/admin/users/${button.dataset.role}/role`, {
          method: 'PATCH',
          body: { role: button.dataset.next },
        });
        toast(`Role changed to ${button.dataset.next}`, 'success');
        refresh();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
};

const wireTabs = () => {
  const tabs = [...document.querySelectorAll('.tab')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((node) => {
        const selected = node === tab;
        node.setAttribute('aria-selected', String(selected));
        const panel = document.getElementById(node.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
    });
  });
};

const refresh = async () => {
  qs('#admin-items').innerHTML = `<div class="panel center">${spinner(true)}</div>`;
  const results = await Promise.allSettled([
    api('/admin/stats'),
    api('/admin/items'),
    api('/admin/claims'),
    api('/admin/users'),
  ]);

  const failure = results.find((result) => result.status === 'rejected');
  if (failure) {
    toast(failure.reason.message, 'error');
    if (failure.reason.status === 403) {
      window.location.href = '/dashboard.html';
      return;
    }
  }

  if (results[0].status === 'fulfilled') stats = results[0].value.data;
  if (results[1].status === 'fulfilled') items = results[1].value.data || [];
  if (results[2].status === 'fulfilled') claims = results[2].value.data || [];
  if (results[3].status === 'fulfilled') users = results[3].value.data || [];

  if (stats) {
    renderStats();
    renderCharts();
  }
  renderItems();
  renderClaims();
  renderUsers();
};

const start = () => {
  mountHeader();
  mountFooter();
  if (!requireAdmin()) return;
  wireTabs();
  qs('#refresh-btn').addEventListener('click', refresh);
  refresh();
};

start();
