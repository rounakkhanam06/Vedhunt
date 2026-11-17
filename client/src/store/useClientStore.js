import { create } from 'zustand';
import clientService from '../services/clientService';
import { getPreview, endPreview } from '../shared/portalPreview';

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
    // A preview tab has no session of its own: leave the real login in this browser alone
    if (getPreview('client')) return endPreview();
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
      if (!getPreview('client')) localStorage.removeItem('clientToken');
      set({ client: null, isAuthenticated: false, isInitializing: false });
    }
  },

  // Re-reads the client's details without the loading screen — picks up what an admin
  // changed (business name, contact, profile) while the portal stays open. A failed
  // refresh changes nothing; checkAuth / the API's 401 handling deal with real logouts.
  refreshClient: async () => {
    try {
      const data = await clientService.getMe();
      if (data?.client) set({ client: data.client });
    } catch (_) { /* keep what we have */ }
  },

  updateClient: (updates) => {
    set((state) => ({ client: { ...state.client, ...updates } }));
  },
}));
