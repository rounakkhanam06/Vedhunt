import { create } from 'zustand';
import employeeService from '../services/employeeService';

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
      localStorage.removeItem('employeeToken');
      set({ employee: null, isAuthenticated: false, isInitializing: false });
    }
  },

  updateEmployee: (updates) => {
    set((state) => ({ employee: { ...state.employee, ...updates } }));
  },
}));
