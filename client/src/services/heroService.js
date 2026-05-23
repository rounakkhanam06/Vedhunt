import api from './api';

export const heroService = {
  getHero: async () => {
    const response = await api.get('/content/hero');
    return response.data.data;
  },
  
  updateHero: async (data) => {
    const response = await api.put('/content/hero', data);
    return response.data.data;
  }
};
