import api from './api.js';

/**
 * Triggers a browser download for a Blob.
 * @param {Blob|string} data 
 * @param {string} filename 
 */
export function downloadBlob(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// GET /api/export/food-tracking?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function downloadFoodTrackingExport({ startDate, endDate } = {}) {
  const res = await api.get('/export/food-tracking', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  const filename = `food_tracking_${startDate || 'all'}_to_${endDate || 'now'}.csv`;
  downloadBlob(res.data, filename);
  return filename;
}

// GET /api/export/meal-history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function downloadMealHistoryExport({ startDate, endDate } = {}) {
  const res = await api.get('/export/meal-history', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  const filename = `meal_history_${startDate || 'all'}_to_${endDate || 'now'}.csv`;
  downloadBlob(res.data, filename);
  return filename;
}

// GET /api/export/dose-history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function downloadDoseHistoryExport({ startDate, endDate } = {}) {
  const res = await api.get('/export/dose-history', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  const filename = `dose_history_${startDate || 'all'}_to_${endDate || 'now'}.csv`;
  downloadBlob(res.data, filename);
  return filename;
}
