import api from './api.js';

// GET /api/analytics/dashboard
export async function getDashboard() {
  const res = await api.get('/analytics/dashboard');
  return res.data.data;
}

// GET /api/analytics/meals?startDate&endDate
export async function getMealAnalytics({ startDate, endDate } = {}) {
  const res = await api.get('/analytics/meals', { params: { startDate, endDate } });
  return res.data.data;
}

// GET /api/analytics/foods?startDate&endDate
export async function getFoodAnalytics({ startDate, endDate } = {}) {
  const res = await api.get('/analytics/foods', { params: { startDate, endDate } });
  return res.data.data;
}

// GET /api/analytics/doses?startDate&endDate
export async function getDoseAnalytics({ startDate, endDate } = {}) {
  const res = await api.get('/analytics/doses', { params: { startDate, endDate } });
  return res.data.data;
}

// GET /api/analytics/calendar?month=YYYY-MM
export async function getCalendarAnalytics(month) {
  const res = await api.get('/analytics/calendar', { params: month ? { month } : {} });
  return res.data.data;
}
