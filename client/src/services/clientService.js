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

  // ─── Account ─────────────────────────────────────────────────────────────
  updateProfile: async ({ contactName, phone }) => {
    const { data } = await clientApi.put('/client/auth/profile', { contactName, phone });
    return data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const { data } = await clientApi.put('/client/auth/password', { currentPassword, newPassword });
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

  // Fetches the server-generated PDF (auth header attached by clientApi) and
  // saves it — a plain <a href> couldn't send the Bearer token.
  downloadInvoicePdf: async (id, invoiceNumber) => {
    const { data } = await clientApi.get(`/client/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${String(invoiceNumber || id).replace(/[^\w-]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  getSupportCategories: async () => {
    // We can use the public endpoint we created for settings
    const { data } = await clientApi.get('/settings/support-categories');
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

  addTicketMessage: async (id, text) => {
    const { data } = await clientApi.post(`/client/tickets/${id}/messages`, { text });
    return data;
  },

  uploadTicketAttachments: async (id, files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const { data } = await clientApi.post(`/client/tickets/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // status: 'Closed' (close) or 'Open' (reopen a Resolved/Closed ticket)
  setTicketStatus: async (id, status, message = '') => {
    const { data } = await clientApi.put(`/client/tickets/${id}/status`, { status, message });
    return data;
  },

  // ─── Notifications ───────────────────────────────────────────────────────
  getNotifications: async () => {
    const { data } = await clientApi.get('/client/notifications');
    return data;
  },

  markNotificationRead: async (id) => {
    const { data } = await clientApi.put(`/client/notifications/${id}/read`);
    return data;
  },

  markAllNotificationsRead: async () => {
    const { data } = await clientApi.put('/client/notifications/read-all');
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
