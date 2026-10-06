import api from './api.js';

// GET /api/users/profile
export async function getUserProfile() {
  const res = await api.get('/users/profile');
  return res.data.data.user;
}

// PATCH /api/users/profile
export async function updateProfile(data) {
  const res = await api.patch('/users/profile', data);
  return res.data.data.user;
}

// PATCH /api/users/preferences
export async function updatePreferences(data) {
  const res = await api.patch('/users/preferences', data);
  return res.data.data.user;
}

// DELETE /api/users/account
export async function deleteAccount() {
  await api.delete('/users/account');
}
