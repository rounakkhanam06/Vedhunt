import { create } from 'zustand';
import clientService from '../services/clientService';

/**
 * Client Portal Auth Store
 *
 * ISOLATED from useAdminStore:
 * - Uses 'clientToken' localStorage key (not 'adminToken')
 * - Calls clientService (different axios instance from admin api.js)
 * - No shared state with admin
 */
export const useClientStore = create((set) => ({
  client: null,
  isAuthenticated: false,
  isInitializing: true,

  login: async (email, password) => {
    const data = await clientService.login(email, password);
    if (data.token) {
      localStorage.setItem('clientToken', data.token);
    }
    set({ client: data.client, isAuthenticated: true });
    return data;
  },

  logout: async () => {
    try {
      await clientService.logout();
    } catch (_) {
      // Silent fail — clear state regardless
    } finally {
      localStorage.removeItem('clientToken');
      set({ client: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      const data = await clientService.getMe();
      set({ client: data.client, isAuthenticated: true, isInitializing: false });
    } catch (_) {
      localStorage.removeItem('clientToken');
      set({ client: null, isAuthenticated: false, isInitializing: false });
    }
  },

  updateClient: (updates) => {
    set((state) => ({ client: { ...state.client, ...updates } }));
  },
}));
