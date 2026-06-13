import api from './api';

export const settingsService = {
  getContactInfo: () => api.get('/settings/contact'),
  updateContactInfo: (data) => api.put('/admin/settings/contact', data),
  getPrivacyPolicy: () => api.get('/settings/privacy-policy'),
  updatePrivacyPolicy: (data) => api.put('/admin/settings/privacy-policy', data),
  getTermsConditions: () => api.get('/settings/terms-conditions'),
  updateTermsConditions: (data) => api.put('/admin/settings/terms-conditions', data),
  getCookiePolicy: () => api.get('/settings/cookie-policy'),
  updateCookiePolicy: (data) => api.put('/admin/settings/cookie-policy', data),
  getDPA: () => api.get('/settings/dpa'),
  updateDPA: (data) => api.put('/admin/settings/dpa', data),
  getRefundPolicy: () => api.get('/settings/refund-policy'),
  updateRefundPolicy: (data) => api.put('/admin/settings/refund-policy', data),
  getCampaignSettings: () => api.get('/settings/campaigns'),
  updateCampaignSettings: (data) => api.put('/admin/settings/campaigns', data),
  getEmailSettings: () => api.get('/settings/email'),
  updateEmailSettings: (data) => api.put('/admin/settings/email', data),
};

