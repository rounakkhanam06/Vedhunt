import axios from 'axios';
import { useAdminStore } from '../store/useAdminStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // IMPORTANT: Allows sending HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for responses to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only intercept 401 if it's not the logout route itself
    if (
      error.response && 
      error.response.status === 401 && 
      !error.config.url.includes('/auth/logout')
    ) {
      // If we get a 401, the token is invalid or expired
      const logout = useAdminStore.getState().logout;
      logout();
    }
    return Promise.reject(error);
  }
);

export default api;
