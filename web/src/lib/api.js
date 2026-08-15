const API_BASE = '/api';

export function getSessionToken() {
  return localStorage.getItem('apdf417_session') || '';
}

export function setSessionToken(token) {
  if (token) {
    localStorage.setItem('apdf417_session', token);
  } else {
    localStorage.removeItem('apdf417_session');
  }
}

async function request(endpoint, options = {}) {
  const sessionToken = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({ error: 'Invalid server response' }));

  if (res.status === 401 && !endpoint.includes('/auth/login')) {
    setSessionToken('');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  checkMe: () => request('/auth/me'),
  changePassword: (oldPassword, newPassword, newUsername) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword, newUsername }) }),

  getTokens: () => request('/tokens'),
  addToken: (token, name) => request('/tokens', { method: 'POST', body: JSON.stringify({ token, name }) }),
  toggleToken: (id) => request(`/tokens/${id}/toggle`, { method: 'POST' }),
  deleteToken: (id) => request(`/tokens/${id}`, { method: 'DELETE' }),
  checkToken: (id) => request(`/tokens/${id}/check`, { method: 'POST' }),
  checkAllTokens: () => request('/tokens/check-all', { method: 'POST' }),

  getStates: () => request('/pdf417/states'),
  getFields: (state, type = 'full') => request(`/pdf417/fields?state=${encodeURIComponent(state)}&type=${type}`),
  generateBarcode: (payload) => request('/pdf417/generate', { method: 'POST', body: JSON.stringify(payload) }),

  getHistory: () => request('/history'),
  clearHistory: () => request('/history', { method: 'DELETE' })
};
