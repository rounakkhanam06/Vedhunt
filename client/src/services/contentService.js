import api from './api';

export const contentService = {
  // Hero
  getHero: async () => {
    const response = await api.get('/content/hero');
    return response.data;
  },
  
  updateHero: async (data) => {
    const response = await api.put('/content/hero', data);
    return response.data;
  },

  // Navbar
  getNavbarLinksPublic: async () => {
    const response = await api.get('/content/navbar');
    return response.data;
  },

  getNavbarLinksAdmin: async (page = 1, limit = 10, search = '') => {
    const response = await api.get(`/content/admin/navbar?page=${page}&limit=${limit}&search=${search}`);
    return response.data;
  },

  renameNavbarLink: async (id, label) => {
    const response = await api.put(`/content/admin/navbar/${id}`, { label });
    return response.data;
  },

  deleteNavbarLink: async (id) => {
    const response = await api.delete(`/content/admin/navbar/${id}`);
    return response.data;
  },

  // Services
  getServicesPublic: async (location = '') => {
    const response = await api.get(`/content/services${location ? `?location=${location}` : ''}`);
    return response.data;
  },

  getServicesAdmin: async (page = 1, limit = 10, search = '') => {
    const response = await api.get(`/content/admin/services?page=${page}&limit=${limit}&search=${search}`);
    return response.data;
  },

  createService: async (data) => {
    const response = await api.post('/content/admin/services', data);
    return response.data;
  },

  updateService: async (id, data) => {
    const response = await api.put(`/content/admin/services/${id}`, data);
    return response.data;
  },

  deleteService: async (id) => {
    const response = await api.delete(`/content/admin/services/${id}`);
    return response.data;
  }
};
