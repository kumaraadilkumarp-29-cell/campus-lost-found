/** common.js - header, footer, auth guard and the mobile menu. */
import { getStoredUser, isSignedIn, clearSession, api } from './api.js';
import { escapeHtml, initials, qs } from './ui.js';

const NAV = [
  { href: '/', label: 'Browse' },
  { href: '/report.html', label: 'Report an item' },
  { href: '/dashboard.html', label: 'My reports' },
];

const brandMark = `
  <span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9h12l-1.3 9.2a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8z"></path>
      <path d="M9 9V7a3 3 0 0 1 6 0v2"></path>
    </svg>
  </span>`;

export const mountHeader = () => {
  const header = qs('#site-header');
  if (!header) return;

  const user = getStoredUser();
  const signedIn = isSignedIn();
  const path = window.location.pathname.replace(/index\.html$/, '/');

  const links = NAV.map((entry) => {
    const active = entry.href === path || (entry.href !== '/' && path.startsWith(entry.href.replace('.html', '')));
    return `<a class="nav-link${active ? ' active' : ''}" href="${entry.href}">${entry.label}</a>`;
  }).join('');

  const adminLink = user && user.role === 'admin'
    ? `<a class="nav-link${path.startsWith('/admin') ? ' active' : ''}" href="/admin.html">Admin</a>`
    : '';

  const actions = signedIn
    ? `<a class="bell" href="/dashboard.html" aria-label="Notifications" id="nav-bell">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
           <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
           <path d="M10.3 21a2 2 0 0 0 3.4 0"></path>
         </svg>
       </a>
       <a class="row" href="/dashboard.html" style="gap:8px;color:var(--ink-2)">
         <span class="avatar">${escapeHtml(initials(user && user.name))}</span>
         <span class="small" style="font-weight:600">${escapeHtml((user && user.name) || 'Account')}</span>
       </a>
       <button class="btn btn-ghost btn-sm" type="button" id="logout-btn">Sign out</button>`
    : `<a class="btn btn-ghost btn-sm" href="/login.html">Sign in</a>
       <a class="btn btn-sm" href="/register.html">Create account</a>`;

  header.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="/">
        ${brandMark}
        <span class="brand-text"><b>Campus Lost &amp; Found</b><span>SAI University</span></span>
      </a>
      <nav class="nav" aria-label="Main">${links}${adminLink}</nav>
      <div class="header-actions">${actions}</div>
      <button class="menu-btn" type="button" id="menu-btn" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>`;

  const menuBtn = qs('#menu-btn', header);
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }

  const logout = qs('#logout-btn', header);
  if (logout) {
    logout.addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch (error) {
        /* the local session is cleared either way */
      }
      clearSession();
      window.location.href = '/';
    });
  }

  if (signedIn) {
    // A small unread counter on the bell, loaded in the background.
    api('/notifications')
      .then((payload) => {
        const count = payload.unread || 0;
        const bell = qs('#nav-bell', header);
        if (bell && count > 0) {
          const dot = document.createElement('span');
          dot.className = 'bell-count';
          dot.textContent = count > 9 ? '9+' : String(count);
          bell.appendChild(dot);
        }
      })
      .catch(() => {});
  }
};

export const mountFooter = () => {
  const footer = qs('#site-footer');
  if (!footer) return;
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="/">${brandMark}
            <span class="brand-text"><b>Campus Lost &amp; Found</b><span>SAI University</span></span>
          </a>
          <p class="muted small" style="margin-top:14px;max-width:320px">
            One verified register for everything lost and found on campus.
            Built as a full-stack web technology project.
          </p>
        </div>
        <div>
          <h4>Register</h4>
          <ul>
            <li><a href="/">Browse listings</a></li>
            <li><a href="/report.html?type=lost">Report a lost item</a></li>
            <li><a href="/report.html?type=found">Report a found item</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="/dashboard.html">My dashboard</a></li>
            <li><a href="/login.html">Sign in</a></li>
            <li><a href="/register.html">Create an account</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} Campus Lost &amp; Found Portal · Academic project</span>
        <span>Handovers happen on campus, in daylight, never in private rooms.</span>
      </div>
    </div>`;
};

/** Sends the visitor to the login page and comes back afterwards. */
export const requireLogin = (message = 'Sign in to continue') => {
  if (isSignedIn()) return true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login.html?next=${next}`;
  return false;
};

export const requireAdmin = () => {
  const user = getStoredUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
};

export const setYear = () => {
  const node = qs('#year');
  if (node) node.textContent = String(new Date().getFullYear());
};
