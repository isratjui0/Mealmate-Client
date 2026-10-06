import api from './api.js';

// ---- Dose Schedules ----

// GET /api/doses
export async function getDoses() {
  const res = await api.get('/doses');
  return res.data.data.doses;
}

// GET /api/doses/:id
export async function getDoseById(id) {
  const res = await api.get(`/doses/${id}`);
  return res.data.data.dose;
}

// POST /api/doses
export async function createDose(data) {
  const res = await api.post('/doses', data);
  return res.data.data.dose;
}

// PATCH /api/doses/:id
export async function updateDose(id, data) {
  const res = await api.patch(`/doses/${id}`, data);
  return res.data.data.dose;
}

// DELETE /api/doses/:id
export async function deleteDose(id) {
  await api.delete(`/doses/${id}`);
}

// PATCH /api/doses/:id/pause
export async function toggleDosePause(id) {
  const res = await api.patch(`/doses/${id}/pause`);
  return res.data.data.dose;
}

// ---- Dose Occurrences ----

/**
 * GET /api/dose-occurrences
 * @param {Object} query { date, startDate, endDate, status, doseScheduleId }
 */
export async function getDoseOccurrences(query = {}) {
  const res = await api.get('/dose-occurrences', { params: query });
  return res.data.data.occurrences;
}

/**
 * GET /api/dose-occurrences/history
 * @param {Object} query { startDate, endDate }
 */
export async function getDoseHistory({ startDate, endDate } = {}) {
  const res = await api.get('/dose-occurrences/history', { params: { startDate, endDate } });
  return res.data.data;
}

// GET /api/dose-occurrences/:id
export async function getDoseOccurrenceById(id) {
  const res = await api.get(`/dose-occurrences/${id}`);
  return res.data.data.occurrence;
}

// PATCH /api/dose-occurrences/:id/taken
export async function markDoseTaken(id, notes) {
  const res = await api.patch(`/dose-occurrences/${id}/taken`, notes ? { notes } : {});
  return res.data.data.occurrence;
}

// PATCH /api/dose-occurrences/:id/skip
export async function markDoseSkipped(id, notes) {
  const res = await api.patch(`/dose-occurrences/${id}/skip`, notes ? { notes } : {});
  return res.data.data.occurrence;
}

// PATCH /api/dose-occurrences/:id/postpone
// body: { minutes, notes } or { postponedUntil, notes }
export async function postponeDose(id, body) {
  const res = await api.patch(`/dose-occurrences/${id}/postpone`, body);
  return res.data.data.occurrence;
}
