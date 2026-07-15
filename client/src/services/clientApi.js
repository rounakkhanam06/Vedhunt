import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * Separate Axios instance for the Client Portal.
 *
 * ISOLATED from the admin api.js:
 * - Reads 'clientToken' from localStorage (NOT 'adminToken')
 * - Calls /api/client/auth/refresh (NOT /api/auth/refresh-token)
 * - On failure calls useClientStore.logout() (NOT admin logout)
 */
const clientApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor — attach clientToken ─────────────────────────────────
clientApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clientToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — handle 401 with refresh ──────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

clientApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 413) {
      toast.error('File too large. Please use a smaller file.');
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/client/auth/login') &&
      !originalRequest.url.includes('/client/auth/refresh') &&
      !originalRequest.url.includes('/client/auth/logout')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return clientApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      let newToken;
      try {
        const { data } = await axios.post(
          `${clientApi.defaults.baseURL}/client/auth/refresh`,
          {},
          { withCredentials: true }
        );
        newToken = data.token;
      } catch (err) {
        processQueue(err, null);
        // Import lazily to avoid circular dependency
        const { useClientStore } = await import('../store/useClientStore');
        useClientStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(err);
      }

      localStorage.setItem('clientToken', newToken);
      clientApi.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
      processQueue(null, newToken);
      isRefreshing = false;
      
      // Update the original request's header and retry
      originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
      return clientApi(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default clientApi;
