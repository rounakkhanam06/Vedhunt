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
    return data;
  },

  resetTempPassword: async (newPassword) => {
    const data = await authService.resetTempPassword(newPassword);
    if (data.success) {
      // Re-fetch profile to clear any temp password state if applicable
      const meData = await authService.getMe();
      set({ admin: meData.admin });
    }
    return data;
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
