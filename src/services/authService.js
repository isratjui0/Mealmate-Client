import api from './api.js';

// POST /api/auth/register
export async function register({ name, email, password, timezone, preferences }) {
  const res = await api.post('/auth/register', { name, email, password, timezone, preferences });
  return res.data.data; // { user, token }
}

// POST /api/auth/login
export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { user, token }
}

// POST /api/auth/logout
export async function logout() {
  await api.post('/auth/logout');
}

// GET /api/auth/me
export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
