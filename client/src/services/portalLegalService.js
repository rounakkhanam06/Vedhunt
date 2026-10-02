import api from './api';

// Client/Employee Portal Terms & Privacy documents (see server
// controllers/portalLegalController.js).
export const PORTAL_LEGAL_DOCS = {
  'client-terms': { audience: 'client', label: 'Client Terms & Conditions', short: 'Terms & Conditions' },
  'client-privacy': { audience: 'client', label: 'Client Privacy Policy', short: 'Privacy Policy' },
  'employee-terms': { audience: 'employee', label: 'Employee Terms & Conditions', short: 'Terms & Conditions' },
  'employee-privacy': { audience: 'employee', label: 'Employee Privacy Policy', short: 'Privacy Policy' },
};

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Public read with plain fetch — used on the login pages (no session yet)
// and inside both portals, so it must not depend on any portal's auth client.
export async function getPortalLegal(doc) {
  const res = await fetch(`${API_BASE}/settings/portal-legal/${doc}`);
  if (!res.ok) throw new Error(`Could not load document (${res.status})`);
  return res.json();
}

// Admin save (Super Admin / legal.manage)
export const updatePortalLegal = (doc, data) => api.put(`/admin/settings/portal-legal/${doc}`, data);
