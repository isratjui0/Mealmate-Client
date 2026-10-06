import api from './api.js';

// ---- Food (columns) ----

// GET /api/foods?includeArchived=false
export async function getFoods(includeArchived = false) {
  const res = await api.get('/foods', { params: { includeArchived } });
  return res.data.data.foods;
}

// GET /api/foods/:id
export async function getFoodById(id) {
  const res = await api.get(`/foods/${id}`);
  return res.data.data.food;
}

// POST /api/foods
export async function createFood(data) {
  const res = await api.post('/foods', data);
  return res.data.data.food;
}

// PATCH /api/foods/:id
export async function updateFood(id, data) {
  const res = await api.patch(`/foods/${id}`, data);
  return res.data.data.food;
}

// DELETE /api/foods/:id
export async function deleteFood(id) {
  const res = await api.delete(`/foods/${id}`);
  return res.data.data; // { archived: true } or { deleted: true }
}

// PATCH /api/foods/reorder
export async function reorderFoods(payload) {
  // payload can be { foodIds: [...] } or { orders: [{ id, columnOrder }, ...] }
  const res = await api.patch('/foods/reorder', payload);
  return res.data.data;
}

// ---- Food Tracking (spreadsheet cells) ----

/**
 * GET /api/food-tracking
 * @param {string} month  YYYY-MM format (optional, defaults to current month)
 */
export async function getMonthlyTracking(month) {
  const res = await api.get('/food-tracking', { params: month ? { month } : {} });
  return res.data.data; // { month, foods, days }
}

/**
 * GET /api/food-tracking/:date
 * @param {string} date  YYYY-MM-DD
 */
export async function getDailyTracking(date) {
  const res = await api.get(`/food-tracking/${date}`);
  return res.data.data;
}

/**
 * PUT /api/food-tracking/:date/:foodId
 * @param {string} date
 * @param {string} foodId
 * @param {'consumed'|'not_consumed'} status
 * @param {string} notes
 */
export async function updateTrackingCell(date, foodId, status, notes = '') {
  const res = await api.put(`/food-tracking/${date}/${foodId}`, { status, notes });
  return res.data.data;
}

/**
 * DELETE /api/food-tracking/:date/:foodId  — clear to unrecorded (null)
 */
export async function clearTrackingCell(date, foodId) {
  const res = await api.delete(`/food-tracking/${date}/${foodId}`);
  return res.data.data;
}

// GET /api/food-tracking/analytics
export async function getFoodTrackingAnalytics({ startDate, endDate } = {}) {
  const res = await api.get('/food-tracking/analytics', { params: { startDate, endDate } });
  return res.data.data;
}
