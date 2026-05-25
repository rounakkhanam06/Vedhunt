import { create } from 'zustand';
import { authService } from '../services/authService';

export const useAdminStore = create((set, get) => ({
  admin: null,
  isAuthenticated: false,
  isInitializing: true, // Used to wait for initial me check

  login: async (email, password) => {
    const data = await authService.login(email, password);
    if (data.token) {
      localStorage.setItem('adminToken', data.token);
    }
    set({ admin: data.admin, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      localStorage.removeItem('adminToken');
      set({ admin: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      const data = await authService.getMe();
      set({ admin: data.admin, isAuthenticated: true, isInitializing: false });
    } catch (error) {
      localStorage.removeItem('adminToken');
      set({ admin: null, isAuthenticated: false, isInitializing: false });
    }
  },
}));
