/**
 * api.js - the only file in the front end that knows about the session token.
 * Everything else calls api(path, options) and gets parsed JSON back, or a
 * readable Error with .status and .details attached.
 */

const TOKEN_KEY = 'clf.token';
const USER_KEY = 'clf.user';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (error) {
    return null;
  }
};

export const saveSession = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const saveUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isSignedIn = () => Boolean(getToken());

/**
 * @param {string} path   starts with a slash, e.g. "/items?limit=5"
 * @param {object} options { method, body, headers }
 */
export async function api(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const requestHeaders = { ...headers };
  const config = { method, headers: requestHeaders };

  if (body instanceof FormData) {
    // Never set Content-Type for FormData: the browser adds the boundary.
    config.body = body;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const token = getToken();
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, config);
  } catch (error) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    payload = {};
  }

  if (response.status === 401 && token) {
    // The token expired or was tampered with: drop it so the UI resets.
    clearSession();
  }

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload.details || [];
    throw error;
  }

  return payload;
}
