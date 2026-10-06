import api from './api.js';

// GET /api/health
export async function getHealth() {
  const res = await api.get('/health');
  return res.data;
}

// GET /api/docs.json
export async function getDocsSpec() {
  const res = await api.get('/docs.json');
  return res.data;
}
