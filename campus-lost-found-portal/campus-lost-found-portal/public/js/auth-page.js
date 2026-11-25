/** auth-page.js - one module for sign in and registration. */
import { api, saveSession, isSignedIn } from './api.js';
import { mountHeader, mountFooter } from './common.js';
import { qs, showFormErrors, clearFormErrors, withButtonState, toast } from './ui.js';

const redirectTarget = () => {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/')) return next;
  return null;
};

const goAfterAuth = (user) => {
  const next = redirectTarget();
  if (next) {
    window.location.href = next;
    return;
  }
  window.location.href = user && user.role === 'admin' ? '/admin.html' : '/dashboard.html';
};

const wireLogin = () => {
  const form = qs('#login-form');
  if (!form) return;

  const errors = qs('#form-errors');
  const button = qs('#submit-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(errors);

    const email = qs('#email').value.trim();
    const password = qs('#password').value;

    if (!email || !password) {
      showFormErrors(errors, { message: 'Enter your email and password.', details: [] });
      return;
    }

    const restore = withButtonState(button, 'Signing in…');
    try {
      const payload = await api('/auth/login', { method: 'POST', body: { email, password } });
      saveSession(payload.token, payload.data);
      toast(`Welcome back, ${payload.data.name.split(' ')[0]}`, 'success');
      goAfterAuth(payload.data);
    } catch (error) {
      restore();
      showFormErrors(errors, error);
    }
  });
};

const wireRegister = () => {
  const form = qs('#register-form');
  if (!form) return;

  const errors = qs('#form-errors');
  const button = qs('#submit-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(errors);

    const name = qs('#name').value.trim();
    const email = qs('#email').value.trim();
    const department = qs('#department').value.trim();
    const password = qs('#password').value;
    const confirm = qs('#confirm').value;

    if (password !== confirm) {
      showFormErrors(errors, {
        message: 'Passwords do not match',
        details: [{ field: 'confirm', message: 'The two passwords must be identical' }],
      });
      return;
    }

    const restore = withButtonState(button, 'Creating account…');
    try {
      const payload = await api('/auth/register', {
        method: 'POST',
        body: { name, email, password, department },
      });
      saveSession(payload.token, payload.data);
      toast('Account created', 'success');
      goAfterAuth(payload.data);
    } catch (error) {
      restore();
      showFormErrors(errors, error);
    }
  });
};

mountHeader();
mountFooter();

if (isSignedIn()) {
  const user = JSON.parse(localStorage.getItem('clf.user') || 'null');
  if (user) goAfterAuth(user);
} else {
  wireLogin();
  wireRegister();
}
