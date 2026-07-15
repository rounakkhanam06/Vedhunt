import api from './api';

const analyticsService = {
  getEarningsOverview: async () => {
    const response = await api.get('/admin/analytics/earnings');
    return response.data;
  },
};

export default analyticsService;
