import axios from 'axios';
import { useEmployeeStore } from '../store/useEmployeeStore';
import toast from 'react-hot-toast';

const employeeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api'),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

employeeApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('employeeToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

employeeApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 413) {
      toast.error('File size is too large! Please compress the image to under 1MB and try again.');
      return Promise.reject(error);
    }

    if (
      error.response && 
      error.response.status === 401 && 
      !originalRequest._retry &&
      !originalRequest.url.includes('/employee/auth/login') &&
      !originalRequest.url.includes('/employee/auth/refresh-token') &&
      !originalRequest.url.includes('/employee/auth/logout')
    ) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return employeeApi(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      let newToken;
      try {
        const { data } = await axios.post(
          `${employeeApi.defaults.baseURL}/employee/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        newToken = data.token;
      } catch (err) {
        processQueue(err, null);
        const logout = useEmployeeStore.getState().logout;
        logout();
        isRefreshing = false;
        return Promise.reject(err);
      }

      localStorage.setItem('employeeToken', newToken);
      employeeApi.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
      processQueue(null, newToken);
      isRefreshing = false;

      originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
      return employeeApi(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default employeeApi;
