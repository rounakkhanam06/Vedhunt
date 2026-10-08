import api from '../../services/api';
import employeeApi from '../../services/employeeApi';
import { openPdf } from './ess';

// The Proposal button is the same component in both portals — only the API
// it talks to differs. Both mount the same routers (server/routes/
// essProposalRoutes.js): the Employee Portal scoped to the BD's own leads,
// the admin panel (Super Admin) across every lead.
const PORTALS = {
  employee: { http: employeeApi, base: '/employee-portal/ess', keyPrefix: 'ess' },
  admin: { http: api, base: '/admin/sales', keyPrefix: 'admin' },
};

/** Proposal API calls and query keys for `portal` ('employee' | 'admin'). */
export function proposalApi(portal = 'employee') {
  const { http, base, keyPrefix } = PORTALS[portal];
  return {
    get: (path) => http.get(`${base}${path}`).then((r) => r.data),
    post: (path, body) => http.post(`${base}${path}`, body).then((r) => r.data),
    put: (path, body) => http.put(`${base}${path}`, body).then((r) => r.data),
    blob: (path) => http.get(`${base}${path}`, { responseType: 'blob' }).then((r) => r.data),
    openPdf: (path, options) => openPdf(`${base}${path}`, { ...options, http }),
    keys: {
      proposals: (leadId) => [keyPrefix, 'proposals', leadId],
      masters: [keyPrefix, 'proposal-masters'],
    },
  };
}
