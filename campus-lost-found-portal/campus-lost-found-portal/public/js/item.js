/** item.js - listing detail, the claim form and the reporter's controls. */
import { api, getStoredUser, isSignedIn } from './api.js';
import { mountHeader, mountFooter } from './common.js';
import {
  qs, escapeHtml, formatDate, timeAgo, categoryIcon, categoryLabel, locationLabel,
  typeBadge, statusBadge, initials, toast, withButtonState, emptyState, spinner,
} from './ui.js';

const id = new URLSearchParams(window.location.search).get('id');
const root = () => qs('#detail-root');

const fact = (label, value) => `
  <div class="fact"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;

const claimCard = (claim, showActions = false) => {
  const claimant = claim.claimant || {};
  const actions = showActions && claim.status === 'pending'
    ? `<div class="row" style="margin-top:12px">
         <button class="btn btn-sm" type="button" data-decision="approved">Approve</button>
         <button class="btn btn-outline btn-sm" type="button" data-decision="rejected">Reject</button>
       </div>`
    : '';
  return `
    <div class="panel" data-claim-id="${escapeHtml(claim._id)}" style="padding:18px;margin-bottom:12px">
      <div class="row-between" style="margin-bottom:8px">
        <div class="row" style="gap:10px">
          <span class="avatar">${escapeHtml(initials(claimant.name))}</span>
          <div>
            <b class="small">${escapeHtml(claimant.name || 'Student')}</b>
            <div class="muted small">${escapeHtml(claimant.department || '')} · ${escapeHtml(timeAgo(claim.createdAt))}</div>
          </div>
        </div>
        ${statusBadge(claim.status)}
      </div>
      <p class="small" style="margin:0 0 8px">${escapeHtml(claim.message)}</p>
      ${claim.proof ? `<p class="small muted" style="margin:0"><strong>Proof:</strong> ${escapeHtml(claim.proof)}</p>` : ''}
      ${claim.decisionNote ? `<p class="small muted" style="margin:8px 0 0"><strong>Note:</strong> ${escapeHtml(claim.decisionNote)}</p>` : ''}
      ${actions}
    </div>`;
};

const ownerPanel = (item) => `
  <div class="panel">
    <div class="panel-head"><h3>You filed this report</h3></div>
    <div class="field" style="margin-bottom:14px">
      <label for="status-select">Listing status</label>
      <select id="status-select">
        ${['open', 'claimed', 'recovered']
          .map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`)
          .join('')}
      </select>
    </div>
    <button class="btn btn-block" type="button" id="save-status">Update status</button>
    <div class="row" style="margin-top:10px">
      <a class="btn btn-outline btn-sm" href="/report.html?id=${encodeURIComponent(item._id)}">Edit</a>
      <button class="btn btn-danger btn-sm" type="button" id="delete-item">Delete</button>
    </div>
    <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
    <h3 style="font-size:.95rem">Claims received</h3>
    <div id="claims-box">${
      item.claims && item.claims.length
        ? item.claims.map((claim) => claimCard(claim, true)).join('')
        : '<p class="muted small">No claims yet. Share the listing link with your batch group.</p>'
    }</div>
  </div>`;

const claimPanel = (item, myClaim) => {
  if (!isSignedIn()) {
    const next = encodeURIComponent(`/item.html?id=${item._id}`);
    return `
      <div class="panel">
        <div class="panel-head"><h3>Is this yours?</h3></div>
        <p class="muted small">Sign in to send a private claim to the person who filed this report.</p>
        <a class="btn btn-block" href="/login.html?next=${next}">Sign in to claim</a>
      </div>`;
  }

  if (myClaim) {
    return `
      <div class="panel">
        <div class="panel-head"><h3>Your claim</h3>${statusBadge(myClaim.status)}</div>
        <p class="small muted">You submitted this claim ${escapeHtml(timeAgo(myClaim.createdAt))}. The reporter reviews it and you get a notification either way.</p>
        ${myClaim.status === 'pending'
          ? '<button class="btn btn-outline btn-block btn-sm" type="button" id="withdraw-claim">Withdraw claim</button>'
          : ''}
      </div>`;
  }

  if (['recovered', 'closed'].includes(item.status)) {
    return `
      <div class="panel">
        <div class="panel-head"><h3>Listing ${escapeHtml(item.status)}</h3></div>
        <p class="muted small">This item is no longer open for claims.</p>
        <a class="btn btn-outline btn-block btn-sm" href="/?search=${encodeURIComponent(item.category)}">Browse similar listings</a>
      </div>`;
  }

  return `
    <div class="panel">
      <div class="panel-head"><h3>Claim this item</h3></div>
      <p class="muted small" style="margin-top:-6px">Only the reporter reads what you write here. Describe one detail that is not in the public listing.</p>
      <form id="claim-form" class="stack">
        <div class="field">
          <label for="claim-message">Why is this yours?</label>
          <textarea id="claim-message" minlength="10" maxlength="500" required placeholder="e.g. The charger brick has a blue lightning sticker on the underside."></textarea>
        </div>
        <div class="field">
          <label for="claim-proof">Private proof <span class="muted small">(optional)</span></label>
          <input type="text" id="claim-proof" maxlength="300" placeholder="Serial number, engraving, contents…">
        </div>
        <div class="form-errors" id="claim-errors" hidden></div>
        <button class="btn btn-block" type="submit" id="claim-submit">Send claim</button>
      </form>
    </div>`;
};

const render = (item) => {
  const user = getStoredUser();
  const isOwner = user && item.reporter && String(item.reporter._id) === String(user._id);
  const myClaim = (item.claims || []).find(
    (claim) => user && claim.claimant && String(claim.claimant._id) === String(user._id)
  );

  const media = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="Photo of ${escapeHtml(item.title)}">`
    : `<span aria-hidden="true">${categoryIcon(item.category)}</span>
       <span class="media-caption">No photo was attached</span>`;

  document.title = `${item.title} · Campus Lost & Found`;
  qs('#crumb-current').textContent = item.title;

  root().innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-media">${media}</div>
        <div style="margin-top:22px">
          <div class="detail-head">
            ${typeBadge(item.type)}
            ${statusBadge(item.status)}
            <span class="muted small">${escapeHtml(timeAgo(item.createdAt))}</span>
          </div>
          <h1 class="detail-title">${escapeHtml(item.title)}</h1>
          <p style="white-space:pre-line;color:var(--ink-2)">${escapeHtml(item.description)}</p>

          <dl class="detail-facts">
            ${fact('Category', escapeHtml(categoryLabel(item.category)))}
            ${fact('Campus zone', escapeHtml(locationLabel(item.location)))}
            ${fact(item.type === 'lost' ? 'Date lost' : 'Date found', escapeHtml(formatDate(item.dateLostOrFound)))}
            ${fact('Views', String(item.views || 0))}
          </dl>

          <div class="owner-card">
            <span class="avatar">${escapeHtml(initials(item.reporter && item.reporter.name))}</span>
            <div>
              <b>${escapeHtml((item.reporter && item.reporter.name) || 'Campus member')}</b>
              <span>${escapeHtml((item.reporter && item.reporter.department) || 'Reported through the portal')}</span>
            </div>
            <span class="badge badge-open" style="margin-left:auto">Verified reporter</span>
          </div>
          <p class="muted small" style="margin-top:14px">Contact: ${escapeHtml(item.contactInfo || 'Contact through the portal')}</p>
        </div>
      </div>
      <aside>
        ${isOwner ? ownerPanel(item) : claimPanel(item, myClaim)}
      </aside>
    </div>`;

  if (isOwner) wireOwner(item);
  else wireClaim(item);
};

const wireOwner = (item) => {
  const saveButton = qs('#save-status');
  saveButton.addEventListener('click', async () => {
    const status = qs('#status-select').value;
    const restore = withButtonState(saveButton, 'Saving…');
    try {
      await api(`/items/${item._id}/status`, { method: 'PATCH', body: { status } });
      toast(`Status set to ${status}`, 'success');
      window.location.reload();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  const deleteButton = qs('#delete-item');
  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('Delete this listing? Its claims will be removed too.')) return;
    const restore = withButtonState(deleteButton, 'Deleting…');
    try {
      await api(`/items/${item._id}`, { method: 'DELETE' });
      toast('Listing deleted', 'success');
      window.location.href = '/dashboard.html';
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  document.querySelectorAll('#claims-box .panel').forEach((node) => {
    const claimId = node.dataset.claimId;
    if (!claimId) return;
    node.querySelectorAll('button[data-decision]').forEach((button) => {
      button.addEventListener('click', async () => {
        const decision = button.dataset.decision;
        let decisionNote = '';
        if (decision === 'rejected') {
          decisionNote = window.prompt('Why are you rejecting this claim? (optional)') || '';
        }
        try {
          await api(`/claims/${claimId}`, { method: 'PATCH', body: { status: decision, decisionNote } });
          toast(`Claim ${decision}`, 'success');
          window.location.reload();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  });
};

const wireClaim = (item) => {
  const form = qs('#claim-form');
  if (!form) {
    const withdraw = qs('#withdraw-claim');
    if (withdraw) {
      withdraw.addEventListener('click', async () => {
        const myClaim = (item.claims || [])[0];
        if (!myClaim) return;
        try {
          await api(`/claims/${myClaim._id}`, { method: 'DELETE' });
          toast('Claim withdrawn', 'success');
          window.location.reload();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    }
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = qs('#claim-errors');
    const button = qs('#claim-submit');
    errors.hidden = true;

    const restore = withButtonState(button, 'Sending…');
    try {
      await api('/claims', {
        method: 'POST',
        body: {
          item: item._id,
          message: qs('#claim-message').value.trim(),
          proof: qs('#claim-proof').value.trim(),
        },
      });
      toast('Claim sent to the reporter', 'success');
      window.location.reload();
    } catch (error) {
      restore();
      errors.hidden = false;
      errors.innerHTML = `<strong>${escapeHtml(error.message)}</strong>`;
    }
  });
};

const start = async () => {
  mountHeader();
  mountFooter();

  if (!id) {
    window.location.href = '/';
    return;
  }

  root().innerHTML = `<div class="panel center" style="padding:60px">${spinner(true)}<p class="muted" style="margin-top:12px">Loading the listing…</p></div>`;

  try {
    const payload = await api(`/items/${id}`);
    render(payload.data);
  } catch (error) {
    root().innerHTML = emptyState({
      icon: '🧭',
      title: 'Listing not found',
      text: error.message,
      cta: '<a class="btn btn-sm" href="/" style="margin-top:14px">Back to the register</a>',
    });
  }
};

start();
