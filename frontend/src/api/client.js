// src/api/client.js - Cliente HTTP para la API
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar token de auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('falc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('falc_token');
      localStorage.removeItem('falc_admin');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
