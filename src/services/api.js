import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mealmate_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize errors, handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Remove token and redirect to login
      localStorage.removeItem('mealmate_token');
      localStorage.removeItem('mealmate_user');
      // Avoid redirect loops on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login?session=expired';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extracts a human-readable error message from an Axios error.
 */
export function getErrorMessage(error) {
  if (error?.response?.data?.errors?.length) {
    const fieldErrors = error.response.data.errors
      .map((e) => (typeof e === 'string' ? e : e.message || `${e.field}: invalid value`))
      .filter(Boolean)
      .join('. ');
    if (fieldErrors) return fieldErrors;
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message === 'Network Error') {
    return 'Unable to reach the server. Please check that the MealMate backend is running on http://localhost:5000.';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }
  return error?.message || 'An unexpected error occurred.';
}

export default api;
