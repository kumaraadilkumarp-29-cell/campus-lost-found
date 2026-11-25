/** dashboard.js - the signed-in workspace: reports, claims, received claims, alerts. */
import { api, getStoredUser, saveUser } from './api.js';
import { mountHeader, mountFooter, requireLogin } from './common.js';
import {
  qs, escapeHtml, formatDate, timeAgo, statusBadge, typeBadge, categoryLabel,
  locationLabel, emptyState, toast, spinner, itemCard, initials,
} from './ui.js';

let data = { items: [], claims: [], received: [], notifications: [], unread: 0 };

const setText = (selector, value) => {
  const node = qs(selector);
  if (node) node.textContent = String(value);
};

const renderStats = () => {
  const open = data.items.filter((item) => item.status === 'open').length;
  const review = data.received.filter((claim) => claim.status === 'pending').length;

  setText('#stat-listings', data.items.length);
  setText('#stat-open', open);
  setText('#stat-sent', data.claims.length);
  setText('#stat-review', review);
  setText('#count-listings', data.items.length);
  setText('#count-claims', data.claims.length);
  setText('#count-received', data.received.length);
  setText('#count-alerts', data.unread);
};

const renderListings = () => {
  const root = qs('#listings-root');
  if (!data.items.length) {
    root.innerHTML = emptyState({
      icon: '📄',
      title: 'You have not filed a report yet',
      text: 'Lost something on campus? File a report and the matching found report will reach you.',
      cta: '<a class="btn btn-sm" href="/report.html?type=lost" style="margin-top:14px">File your first report</a>',
    });
    return;
  }

  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>
          <div class="table-title"><a href="/item.html?id=${encodeURIComponent(item._id)}">${escapeHtml(item.title)}</a></div>
          <div class="muted small">${escapeHtml(categoryLabel(item.category))} · ${escapeHtml(locationLabel(item.location))} · ${escapeHtml(formatDate(item.dateLostOrFound))}</div>
        </td>
        <td>${typeBadge(item.type)}</td>
        <td>${statusBadge(item.status)}</td>
        <td>${item.claimCounts ? item.claimCounts.total : 0}${item.claimCounts && item.claimCounts.pending ? ` <span class="badge badge-pending">${item.claimCounts.pending} new</span>` : ''}</td>
        <td>
          <div class="table-actions">
            <a class="btn btn-outline btn-sm" href="/item.html?id=${encodeURIComponent(item._id)}">Open</a>
            <a class="btn btn-ghost btn-sm" href="/report.html?id=${encodeURIComponent(item._id)}">Edit</a>
            <button class="btn btn-danger btn-sm" type="button" data-delete="${item._id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join('');

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Listing</th><th>Type</th><th>Status</th><th>Claims</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  root.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this listing and all of its claims?')) return;
      try {
        await api(`/items/${button.dataset.delete}`, { method: 'DELETE' });
        toast('Listing deleted', 'success');
        load();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
};

const renderClaims = () => {
  const root = qs('#claims-root');
  if (!data.claims.length) {
    root.innerHTML = emptyState({
      icon: '🙋',
      title: 'No claims sent yet',
      text: 'Found a listing that looks like yours? Open it and send a private claim.',
      cta: '<a class="btn btn-sm" href="/" style="margin-top:14px">Browse listings</a>',
    });
    return;
  }

  const rows = data.claims
    .map(
      (claim) => `
      <tr>
        <td>
          <div class="table-title">${claim.item ? `<a href="/item.html?id=${encodeURIComponent(claim.item._id)}">${escapeHtml(claim.item.title)}</a>` : 'Removed listing'}</div>
          <div class="muted small">${escapeHtml(timeAgo(claim.createdAt))}</div>
        </td>
        <td>${statusBadge(claim.status)}</td>
        <td class="muted small">${escapeHtml(claim.message)}</td>
        <td>${
          claim.status === 'pending'
            ? `<button class="btn btn-ghost btn-sm" type="button" data-withdraw="${claim._id}">Withdraw</button>`
            : `<span class="muted small">${escapeHtml(claim.decisionNote || '—')}</span>`
        }</td>
      </tr>`
    )
    .join('');

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Listing</th><th>Decision</th><th>Your message</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  root.querySelectorAll('[data-withdraw]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Withdraw this claim?')) return;
      try {
        await api(`/claims/${button.dataset.withdraw}`, { method: 'DELETE' });
        toast('Claim withdrawn', 'success');
        load();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
};

const renderReceived = () => {
  const root = qs('#received-root');
  if (!data.received.length) {
    root.innerHTML = emptyState({
      icon: '📬',
      title: 'No claims on your listings',
      text: 'When someone claims one of your reports it appears here with their private proof.',
    });
    return;
  }

  root.innerHTML = data.received
    .map((claim) => {
      const claimant = claim.claimant || {};
      const item = claim.item || {};
      return `
        <div class="panel" style="margin-bottom:14px">
          <div class="row-between" style="margin-bottom:10px">
            <div class="row" style="gap:10px">
              <span class="avatar">${escapeHtml(initials(claimant.name))}</span>
              <div>
                <b class="small">${escapeHtml(claimant.name || 'Student')}</b>
                <div class="muted small">${escapeHtml(claimant.department || '')} · claims ${escapeHtml(item.title || 'a removed listing')}</div>
              </div>
            </div>
            ${statusBadge(claim.status)}
          </div>
          <p class="small" style="margin:0 0 6px">${escapeHtml(claim.message)}</p>
          ${claim.proof ? `<p class="small muted" style="margin:0 0 10px"><strong>Private proof:</strong> ${escapeHtml(claim.proof)}</p>` : ''}
          ${claim.status === 'pending'
            ? `<div class="row">
                 <button class="btn btn-sm" type="button" data-approve="${claim._id}">Approve claim</button>
                 <button class="btn btn-outline btn-sm" type="button" data-reject="${claim._id}">Reject</button>
                 ${item._id ? `<a class="btn btn-ghost btn-sm" href="/item.html?id=${encodeURIComponent(item._id)}">Open listing</a>` : ''}
               </div>`
            : `<p class="muted small" style="margin:0">Decided ${escapeHtml(timeAgo(claim.decidedAt))}${claim.decisionNote ? ` · ${escapeHtml(claim.decisionNote)}` : ''}</p>`}
        </div>`;
    })
    .join('');

  root.querySelectorAll('[data-approve]').forEach((button) => {
    button.addEventListener('click', () => decide(button.dataset.approve, 'approved'));
  });
  root.querySelectorAll('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => decide(button.dataset.reject, 'rejected'));
  });
};

const decide = async (claimId, status) => {
  let decisionNote = '';
  if (status === 'rejected') {
    decisionNote = window.prompt('Why are you rejecting this claim? (optional)') || '';
  }
  try {
    await api(`/claims/${claimId}`, { method: 'PATCH', body: { status, decisionNote } });
    toast(status === 'approved' ? 'Claim approved — the listing is now recovered' : 'Claim rejected', 'success');
    load();
  } catch (error) {
    toast(error.message, 'error');
  }
};

const renderNotifications = () => {
  const root = qs('#alerts-root');
  if (!data.notifications.length) {
    root.innerHTML = '<p class="muted small">No notifications yet. Matching reports and claim decisions appear here.</p>';
    return;
  }

  root.innerHTML = data.notifications
    .map(
      (note) => `
      <div class="row-between" style="gap:14px;padding:14px 0;border-bottom:1px solid var(--line-soft)">
        <div>
          <div class="small" style="font-weight:${note.read ? '400' : '600'}">${escapeHtml(note.message)}</div>
          <div class="muted small">${escapeHtml(timeAgo(note.createdAt))}</div>
        </div>
        ${note.read ? '<span class="muted small">read</span>' : '<button class="btn btn-ghost btn-sm" type="button" data-read="' + note._id + '">Mark read</button>'}
      </div>`
    )
    .join('');

  root.querySelectorAll('[data-read]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api(`/notifications/${button.dataset.read}/read`, { method: 'PATCH' });
        load();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
};

const wireTabs = () => {
  const tabs = [...document.querySelectorAll('.tab')];
  const select = (tab) => {
    tabs.forEach((node) => {
      const selected = node === tab;
      node.setAttribute('aria-selected', String(selected));
      const panel = document.getElementById(node.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));
};

const wireMarkAll = () => {
  const button = qs('#mark-all-btn');
  if (!button) return;
  button.addEventListener('click', async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      toast('All notifications marked as read', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
};

const load = async () => {
  const results = await Promise.allSettled([
    api('/items/user/mine'),
    api('/claims/mine'),
    api('/claims/received'),
    api('/notifications'),
  ]);

  const [items, claims, received, notifications] = results;

  if (items.status === 'fulfilled') data.items = items.value.data || [];
  if (claims.status === 'fulfilled') data.claims = claims.value.data || [];
  if (received.status === 'fulfilled') data.received = received.value.data || [];
  if (notifications.status === 'fulfilled') {
    data.notifications = notifications.value.data || [];
    data.unread = notifications.value.unread || 0;
  }

  const failure = results.find((result) => result.status === 'rejected');
  if (failure) toast(failure.reason.message, 'error');

  renderStats();
  renderListings();
  renderClaims();
  renderReceived();
  renderNotifications();
};

const start = () => {
  mountHeader();
  mountFooter();
  if (!requireLogin()) return;

  const user = getStoredUser();
  if (user) {
    setText('#user-name', user.name.split(' ')[0]);
    const meta = qs('#user-meta');
    if (meta) meta.textContent = `${user.department || 'Campus member'} · ${user.email}`;
    saveUser(user);
  }

  wireTabs();
  wireMarkAll();
  load();
};

start();
