import api from './api';

export const faqService = {
  // Get FAQ Content
  getFaqContent: async () => {
    const response = await api.get('/faq/content');
    return response.data;
  },

  // Update FAQ Content
  updateFaqContent: async (data) => {
    const response = await api.put('/faq/content', data);
    return response.data;
  },

  // Get FAQs (optional category filter)
  getFaqs: async (category = '') => {
    const response = await api.get(`/faq${category ? `?category=${category}` : ''}`);
    return response.data;
  },

  // Create FAQ
  createFaq: async (data) => {
    const response = await api.post('/faq', data);
    return response.data;
  },

  // Update FAQ
  updateFaq: async (id, data) => {
    const response = await api.put(`/faq/${id}`, data);
    return response.data;
  },

  // Delete FAQ
  deleteFaq: async (id) => {
    const response = await api.delete(`/faq/${id}`);
    return response.data;
  }
};
