import { create } from 'zustand';
import employeeService from '../services/employeeService';
import { getPreview, endPreview } from '../shared/portalPreview';

export const useEmployeeStore = create((set) => ({
  employee: null,
  isAuthenticated: false,
  isInitializing: true,

  login: async (email, password) => {
    const data = await employeeService.login(email, password);
    if (data.token) {
      localStorage.setItem('employeeToken', data.token);
    }
    set({ employee: data.employee, isAuthenticated: true });
    return data;
  },

  resetTempPassword: async (newPassword) => {
    const data = await employeeService.resetTempPassword(newPassword);
    if (data.success) {
      const meData = await employeeService.getMe();
      set({ employee: meData.employee });
    }
    return data;
  },

  logout: async () => {
    // A preview tab has no session of its own: leave the real login in this browser alone
    if (getPreview('employee')) return endPreview();
    try {
      await employeeService.logout();
    } catch (_) {
    } finally {
      localStorage.removeItem('employeeToken');
      set({ employee: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      const data = await employeeService.getMe();
      set({ employee: data.employee, isAuthenticated: true, isInitializing: false });
    } catch (_) {
      if (!getPreview('employee')) localStorage.removeItem('employeeToken');
      set({ employee: null, isAuthenticated: false, isInitializing: false });
    }
  },

  updateEmployee: (updates) => {
    set((state) => ({ employee: { ...state.employee, ...updates } }));
  },
}));

// The login (token + cookie) is shared by every tab of this browser. If someone
// signs in as a different employee in another tab, this tab would keep showing
// the old name in the sidebar while every request (profile, leads, clock-in)
// already runs as the new person. Reload so the whole tab matches who is
// really signed in, and no cached data of the previous person is left.
if (typeof window !== 'undefined') {
  const reloadIfSwitched = async () => {
    const shown = useEmployeeStore.getState().employee;
    if (!shown || getPreview('employee')) return;
    try {
      const { employee } = await employeeService.getMe();
      if (employee?._id && String(employee._id) !== String(shown._id)) return window.location.reload();
      // Same person: pick up role/permission changes an admin made meanwhile,
      // so a newly assigned page shows without signing out and in again.
      if (employee) useEmployeeStore.setState({ employee });
    } catch (_) { /* signed out elsewhere: the next request's 401 handles it */ }
  };
  setInterval(() => { if (document.visibilityState === 'visible') reloadIfSwitched(); }, 60_000);
  window.addEventListener('storage', (e) => {
    if (e.key === 'employeeToken') reloadIfSwitched();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reloadIfSwitched();
  });
}
