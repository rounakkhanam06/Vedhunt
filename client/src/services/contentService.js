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

  // Services Hero
  getServicesHero: async () => {
    const response = await api.get('/content/services-hero');
    return response.data;
  },

  updateServicesHero: async (data) => {
    const response = await api.put('/content/admin/services-hero', data);
    return response.data;
  },

  // Advantage Section
  getAdvantagePublic: async () => {
    const response = await api.get('/content/advantage');
    return response.data;
  },
  getAdvantageAdmin: async () => {
    const response = await api.get('/content/admin/advantage');
    return response.data;
  },
  updateAdvantageHeader: async (data) => {
    const response = await api.put('/content/admin/advantage/header', data);
    return response.data;
  },
  createAdvantageRow: async (data) => {
    const response = await api.post('/content/admin/advantage/row', data);
    return response.data;
  },
  updateAdvantageRow: async (id, data) => {
    const response = await api.put(`/content/admin/advantage/row/${id}`, data);
    return response.data;
  },
  deleteAdvantageRow: async (id) => {
    const response = await api.delete(`/content/admin/advantage/row/${id}`);
    return response.data;
  },

  // Stats Counter Section
  getStatsCounterPublic: async () => {
    const response = await api.get('/content/stats-counter');
    return response.data;
  },
  getStatsCounterAdmin: async (page = 1, limit = 20) => {
    const response = await api.get(`/content/admin/stats-counter?page=${page}&limit=${limit}`);
    return response.data;
  },
  createStat: async (data) => {
    const response = await api.post('/content/admin/stats-counter', data);
    return response.data;
  },
  updateStat: async (id, data) => {
    const response = await api.put(`/content/admin/stats-counter/${id}`, data);
    return response.data;
  },
  deleteStat: async (id) => {
    const response = await api.delete(`/content/admin/stats-counter/${id}`);
    return response.data;
  },

  // Home Services Section
  getHomeServicesSection: async () => {
    const response = await api.get('/content/home-services-section');
    return response.data;
  },

  updateHomeServicesSection: async (data) => {
    const response = await api.put('/content/admin/home-services-section', data);
    return response.data;
  },

  // Why Choose Us Section
  getWhyChooseUsPublic: async () => {
    const response = await api.get('/content/why-choose-us');
    return response.data;
  },

  getWhyChooseUsAdmin: async (page = 1, limit = 20) => {
    const response = await api.get(`/content/admin/why-choose-us?page=${page}&limit=${limit}`);
    return response.data;
  },

  updateWhyChooseUsHeader: async (data) => {
    const response = await api.put('/content/admin/why-choose-us/header', data);
    return response.data;
  },

  createWhyChooseUsCard: async (data) => {
    const response = await api.post('/content/admin/why-choose-us/cards', data);
    return response.data;
  },

  updateWhyChooseUsCard: async (id, data) => {
    const response = await api.put(`/content/admin/why-choose-us/cards/${id}`, data);
    return response.data;
  },

  deleteWhyChooseUsCard: async (id) => {
    const response = await api.delete(`/content/admin/why-choose-us/cards/${id}`);
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
  },

  // Portfolio Metrics Section
  getPortfolioMetricsPublic: async () => {
    const response = await api.get('/portfolio/metrics');
    return response.data;
  },
  getPortfolioMetricsAdmin: async () => {
    const response = await api.get('/portfolio/admin/metrics');
    return response.data;
  },
  createPortfolioMetric: async (data) => {
    const response = await api.post('/portfolio/admin/metrics', data);
    return response.data;
  },
  updatePortfolioMetric: async (id, data) => {
    const response = await api.put(`/portfolio/admin/metrics/${id}`, data);
    return response.data;
  },
  deletePortfolioMetric: async (id) => {
    const response = await api.delete(`/portfolio/admin/metrics/${id}`);
    return response.data;
  },

  // Presence Section
  getPresencePublic: async () => {
    const response = await api.get('/content/presence');
    return response.data;
  },
  getPresenceAdmin: async () => {
    const response = await api.get('/content/admin/presence');
    return response.data;
  },
  updatePresenceHeader: async (data) => {
    const response = await api.put('/content/admin/presence/header', data);
    return response.data;
  },
  createPresenceLocation: async (data) => {
    const response = await api.post('/content/admin/presence/location', data);
    return response.data;
  },
  updatePresenceLocation: async (id, data) => {
    const response = await api.put(`/content/admin/presence/location/${id}`, data);
    return response.data;
  },
  deletePresenceLocation: async (id) => {
    const response = await api.delete(`/content/admin/presence/location/${id}`);
    return response.data;
  }
};
