import api from './api.js';

// ---- Meal Schedules ----

// GET /api/meals
export async function getMeals() {
  const res = await api.get('/meals');
  return res.data.data.meals;
}

// GET /api/meals/:id
export async function getMealById(id) {
  const res = await api.get(`/meals/${id}`);
  return res.data.data.meal;
}

// POST /api/meals
export async function createMeal(data) {
  const res = await api.post('/meals', data);
  return res.data.data.meal;
}

// PATCH /api/meals/:id
export async function updateMeal(id, data) {
  const res = await api.patch(`/meals/${id}`, data);
  return res.data.data.meal;
}

// DELETE /api/meals/:id
export async function deleteMeal(id) {
  await api.delete(`/meals/${id}`);
}

// PATCH /api/meals/:id/pause  — toggles active state
export async function toggleMealPause(id) {
  const res = await api.patch(`/meals/${id}/pause`);
  return res.data.data.meal;
}

// ---- Meal Occurrences ----

/**
 * GET /api/meal-occurrences
 * @param {Object} query  { date, startDate, endDate, status, mealId }
 */
export async function getOccurrences(query = {}) {
  const res = await api.get('/meal-occurrences', { params: query });
  return res.data.data.occurrences;
}

// GET /api/meal-occurrences/:id
export async function getOccurrenceById(id) {
  const res = await api.get(`/meal-occurrences/${id}`);
  return res.data.data.occurrence;
}

// PATCH /api/meal-occurrences/:id/complete
export async function completeOccurrence(id, notes) {
  const res = await api.patch(`/meal-occurrences/${id}/complete`, notes ? { notes } : {});
  return res.data.data.occurrence;
}

// PATCH /api/meal-occurrences/:id/skip
export async function skipOccurrence(id, notes) {
  const res = await api.patch(`/meal-occurrences/${id}/skip`, notes ? { notes } : {});
  return res.data.data.occurrence;
}

// PATCH /api/meal-occurrences/:id/postpone
// body: { minutes } or { postponedUntil: ISO string }
export async function postponeOccurrence(id, body) {
  const res = await api.patch(`/meal-occurrences/${id}/postpone`, body);
  return res.data.data.occurrence;
}

// PATCH /api/meal-occurrences/:id/snooze
// body: { durationMinutes: 5 | 10 | 15 }
export async function snoozeOccurrence(id, durationMinutes = 10) {
  const res = await api.patch(`/meal-occurrences/${id}/snooze`, { durationMinutes });
  return res.data.data.occurrence;
}
