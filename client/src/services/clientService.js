import clientApi from './clientApi';

const clientService = {
  // ─── Auth ────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    const { data } = await clientApi.post('/client/auth/login', { email, password });
    return data;
  },

  logout: async () => {
    const { data } = await clientApi.post('/client/auth/logout');
    return data;
  },

  getMe: async () => {
    const { data } = await clientApi.get('/client/auth/me');
    return data;
  },

  forgotPassword: async (email) => {
    const { data } = await clientApi.post('/client/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (token, password) => {
    const { data } = await clientApi.put(`/client/auth/reset-password/${token}`, { password });
    return data;
  },

  resetTempPassword: async (newPassword) => {
    const { data } = await clientApi.post('/client/auth/reset-temp-password', { newPassword });
    return data;
  },

  // ─── Invoices ────────────────────────────────────────────────────────────
  getInvoices: async (params = {}) => {
    const { data } = await clientApi.get('/client/invoices', { params });
    return data;
  },

  getInvoiceById: async (id) => {
    const { data } = await clientApi.get(`/client/invoices/${id}`);
    return data;
  },

  // ─── Projects ────────────────────────────────────────────────────────────
  getProjects: async (params = {}) => {
    const { data } = await clientApi.get('/client/projects', { params });
    return data;
  },

  getProjectById: async (id) => {
    const { data } = await clientApi.get(`/client/projects/${id}`);
    return data;
  },

  // ─── Retainers ───────────────────────────────────────────────────────────
  getRetainers: async (params = {}) => {
    const { data } = await clientApi.get('/client/retainers', { params });
    return data;
  },

  getRetainerById: async (id) => {
    const { data } = await clientApi.get(`/client/retainers/${id}`);
    return data;
  },

  // ─── Support Tickets ─────────────────────────────────────────────────────
  getTickets: async (params = {}) => {
    const { data } = await clientApi.get('/client/tickets', { params });
    return data;
  },

  createTicket: async (payload) => {
    const { data } = await clientApi.post('/client/tickets', payload);
    return data;
  },

  getTicketById: async (id) => {
    const { data } = await clientApi.get(`/client/tickets/${id}`);
    return data;
  },

  // ─── Payments ────────────────────────────────────────────────────────────
  submitPaymentProof: async (payload) => {
    const { data } = await clientApi.post('/client/payments', payload);
    return data;
  },

  getPaymentHistory: async (invoice_ref) => {
    const { data } = await clientApi.get('/client/payments/history', { params: { invoice_ref } });
    return data;
  },

  uploadPublicImage: async (formData) => {
    // Assuming /api/upload/public doesn't require clientAuth, but we can use clientApi
    const { data } = await clientApi.post('/upload/public', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
};

export default clientService;
