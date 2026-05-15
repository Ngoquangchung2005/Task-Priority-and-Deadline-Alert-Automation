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
    const sessionToken = sessionStorage.getItem('token');
    const skipAuthHeader =
      typeof config.url === 'string' &&
      (config.url === '/auth/login' || config.url.startsWith('/auth/login?'));
    if ((token || sessionToken) && !skipAuthHeader) {
      config.headers['Authorization'] = `Bearer ${token || sessionToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isLoginRequest = typeof requestUrl === 'string' && requestUrl.startsWith('/auth/login');

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
