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

  updateProfile: (updatedAdmin) => {
    set({ admin: updatedAdmin });
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

// Permissions are read at sign-in; re-read them when the tab is shown again and
// every minute, so a page an admin just added to someone's role appears (and a
// removed one disappears) without them signing out and in again.
if (typeof window !== 'undefined') {
  const refreshPermissions = async () => {
    const shown = useAdminStore.getState().admin;
    if (!shown || document.visibilityState !== 'visible') return;
    try {
      const { admin } = await authService.getMe();
      if (admin?._id && String(admin._id) !== String(shown._id)) return window.location.reload();
      if (admin) useAdminStore.setState({ admin });
    } catch (_) { /* a real sign-out is handled by the next request's 401 */ }
  };
  document.addEventListener('visibilitychange', refreshPermissions);
  setInterval(refreshPermissions, 60_000);
}
