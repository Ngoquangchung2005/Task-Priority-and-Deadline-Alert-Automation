import axios from 'axios';

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://api.huuhai.me/api' : 'http://localhost:8080/api');

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const isAuthRoute = typeof config.url === 'string' && config.url.startsWith('/auth/');
    if (token && !isAuthRoute) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
