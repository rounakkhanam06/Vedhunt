const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { normalizeGrants, pageScope, grantSummary, grantsOf, grantablePages, grantableActions, fromLegacyCrmGrants, PAGE_CATALOG } = require('../config/pageAccess');
const { isPortalOnly } = require('../config/permissions');
const { crmRouter } = require('../routes/clientManagementRoutes');

// Person-wise page grants (page + actions + scope). Run: npm test
// The full server is exercised by `npm run test:e2e`.

const A = '64b000000000000000000001';
const B = '64b000000000000000000002';

describe('catalog', () => {
  test('role-only pages are never grantable', () => {
    const keys = PAGE_CATALOG.map((p) => p.key);
    for (const roleOnly of ['roles', 'team', 'settings', 'facebook-integration']) assert.ok(!keys.includes(roleOnly), roleOnly);
  });
});

describe('normalizeGrants', () => {
  test('keeps the page’s own actions, implies view, one entry per page', () => {
    const { value } = normalizeGrants([
      { page: 'invoices', actions: ['edit', 'bogus'], scope: { mode: 'clients', clients: [A, A, 'not-an-id'] } },
      { page: 'payments', actions: ['delete', 'edit'], scope: { mode: 'all' } }, // payments has no delete
    ]);
    assert.deepEqual(value, [
      { page: 'invoices', actions: ['view', 'edit'], scope: { mode: 'clients', clients: [A] } },
      { page: 'payments', actions: ['view', 'edit'], scope: { mode: 'all' } },
    ]);
  });

  test('drops entries that would grant nothing (that is how access is revoked)', () => {
    const { value } = normalizeGrants([
      { page: 'projects', actions: [], scope: { mode: 'all' } },
      { page: 'tickets', actions: ['view'], scope: { mode: 'clients', clients: [] } },
    ]);
    assert.deepEqual(value, []);
  });

  test('rejects unknown pages, wrong scope modes and non-lists', () => {
    assert.ok(normalizeGrants([{ page: 'roles', actions: ['view'], scope: { mode: 'all' } }]).error);
    assert.ok(normalizeGrants([{ page: 'invoices', actions: ['view'], scope: { mode: 'own' } }]).error);
    assert.ok(normalizeGrants('nope').error);
  });
});

describe('pageScope', () => {
  const grantee = { permissions: ['ess.access'], accessGrants: [{ page: 'invoices', actions: ['view', 'edit'], scope: { mode: 'clients', clients: [A] } }] };

  test('the page’s role permission (or *) is full, unscoped access', () => {
    assert.equal(pageScope({ permissions: ['cms.manage'] }, 'invoices', 'delete'), null);
    assert.equal(pageScope({ permissions: ['*'] }, 'agreements', 'edit'), null);
  });

  test('a grant gives only its actions, on its clients', () => {
    assert.deepEqual(pageScope(grantee, 'invoices', 'view'), { mode: 'clients', clients: [A] });
    assert.equal(pageScope(grantee, 'invoices', 'delete'), false);
    assert.equal(pageScope(grantee, 'projects', 'view'), false);
  });

  test('other admin permissions do not open the CRM', () => {
    assert.equal(pageScope({ permissions: ['leave.manage', 'employees.manage'] }, 'clients', 'view'), false);
  });

  test('summary for the portal; nothing for pages the role already covers', () => {
    assert.deepEqual(grantSummary(grantee), { invoices: { actions: ['view', 'edit'], mode: 'clients' } });
    assert.deepEqual(grantSummary({ permissions: ['cms.manage'], accessGrants: grantee.accessGrants }), {});
  });

  test('you can only grant pages you hold', () => {
    assert.deepEqual(grantablePages({ permissions: ['employees.manage'] }).map((p) => p.key), ['employees']);
    assert.deepEqual(grantableActions({ permissions: ['employees.manage'] }, 'employees'), ['view']); // Sensitive needs employees.sensitive
    assert.equal(grantablePages({ permissions: ['ess.access', 'leads.view'] }).length, 0);
    const crm = PAGE_CATALOG.filter((p) => p.scope === 'client').map((p) => p.key);
    assert.deepEqual(grantablePages({ permissions: ['cms.manage'] }).map((p) => p.key), crm);
    assert.equal(grantablePages({ permissions: ['*'] }).length, PAGE_CATALOG.length);
  });
});

describe('lead pages: role scope and grants combined', () => {
  const bde = { permissions: ['ess.access', 'leads.view', 'followups.view'] };
  const pm = { permissions: ['leads.view', 'leads.assign', 'followups.view'] };

  test('roles keep exactly what they had', () => {
    assert.deepEqual(pageScope(bde, 'leads', 'view'), { mode: 'own' });
    assert.deepEqual(pageScope(bde, 'leads', 'edit'), { mode: 'own' });
    assert.equal(pageScope(bde, 'leads', 'assign'), false);
    assert.equal(pageScope(pm, 'leads', 'assign'), null); // leads.assign = assign any lead
    assert.equal(pageScope(pm, 'followups', 'view'), null);
    assert.equal(pageScope({ permissions: ['leads.viewAll'] }, 'leads', 'edit'), null);
    assert.equal(pageScope({ permissions: ['dashboard.management'] }, 'lead-activity', 'view'), null);
    assert.equal(pageScope({ permissions: ['dashboard.management'] }, 'followups', 'view'), false);
  });

  test('a grant widens the role, never narrows it', () => {
    const teamLead = { ...bde, accessGrants: [{ page: 'leads', actions: ['view', 'edit', 'assign'], scope: { mode: 'team' } }] };
    assert.deepEqual(pageScope(teamLead, 'leads', 'view'), { mode: 'team' });
    assert.deepEqual(pageScope(teamLead, 'leads', 'assign'), { mode: 'team' });
    assert.equal(pageScope(teamLead, 'leads', 'delete'), false);
    const narrower = { permissions: ['leads.viewAll'], accessGrants: [{ page: 'leads', actions: ['view'], scope: { mode: 'own' } }] };
    assert.equal(pageScope(narrower, 'leads', 'view'), null);
  });

  test('portal summary shows the combined actions of a granted lead page', () => {
    const teamLead = { ...bde, accessGrants: [{ page: 'leads', actions: ['view', 'edit', 'assign'], scope: { mode: 'team' } }] };
    assert.deepEqual(grantSummary(teamLead).leads, { actions: ['view', 'edit', 'assign'], mode: 'team' });
  });

  test('granters hand out only the lead actions they hold in full', () => {
    assert.deepEqual(grantableActions({ permissions: ['leads.viewAll'] }, 'leads'), ['view', 'edit']);
    assert.deepEqual(grantableActions({ permissions: ['leads.viewAll', 'leads.assign'] }, 'leads'), ['view', 'edit', 'assign']);
    assert.deepEqual(grantableActions(pm, 'leads'), ['assign']); // no full View → can't grant the page
    assert.ok(!grantablePages(pm).some((p) => p.key === 'leads'));
  });
});

describe('payroll: separate, explicit actions', () => {
  test('nobody has payroll without payroll.manage or a grant', () => {
    for (const perms of [['ess.access'], ['employees.manage', 'employees.sensitive'], ['cms.manage', 'leads.viewAll']]) {
      for (const a of ['view', 'sensitive', 'process']) assert.equal(pageScope({ permissions: perms }, 'payroll', a), false, `${perms} ${a}`);
    }
  });

  test('Process must come with Sensitive ticked; it is never added silently', () => {
    assert.match(normalizeGrants([{ page: 'payroll', actions: ['process'], scope: { mode: 'all' } }]).error, /needs "sensitive"/);
    assert.match(normalizeGrants([{ page: 'payroll', actions: ['view', 'process'], scope: { mode: 'all' } }]).error, /needs "sensitive"/);
    assert.deepEqual(normalizeGrants([{ page: 'payroll', actions: ['sensitive'], scope: { mode: 'reports' } }]).value[0].actions, ['view', 'sensitive']);
  });

  test('each action is checked on its own', () => {
    const viewer = { permissions: [], accessGrants: [{ page: 'payroll', actions: ['view'], scope: { mode: 'all' } }] };
    assert.deepEqual(pageScope(viewer, 'payroll', 'view'), { mode: 'all' });
    assert.equal(pageScope(viewer, 'payroll', 'sensitive'), false);
    assert.equal(pageScope(viewer, 'payroll', 'process'), false);
  });

  test('only payroll.manage holders can grant it', () => {
    assert.deepEqual(grantableActions({ permissions: ['payroll.manage'] }, 'payroll'), ['view', 'sensitive', 'process']);
    assert.deepEqual(grantableActions({ permissions: ['employees.manage', 'employees.sensitive', 'cms.manage'] }, 'payroll'), []);
  });
});

describe('legacy crmGrants', () => {
  const legacy = [{ page: 'clients', allClients: false, clients: [A], actions: ['view'] }, { page: 'tickets', allClients: true, clients: [], actions: ['view', 'edit'] }];

  test('are read as client-scoped grants until migrated', () => {
    assert.deepEqual(pageScope({ permissions: [], crmGrants: legacy }, 'clients', 'view'), { mode: 'clients', clients: [A] });
    assert.deepEqual(pageScope({ permissions: [], crmGrants: legacy }, 'tickets', 'edit'), { mode: 'all' });
  });

  test('are ignored once accessGrants is set — even to [] — so a revoke sticks', () => {
    assert.equal(pageScope({ permissions: [], accessGrants: [], crmGrants: legacy }, 'clients', 'view'), false);
    assert.deepEqual(grantsOf({ accessGrants: [], crmGrants: legacy }), []);
  });

  test('convert to the same access', () => {
    const { value } = fromLegacyCrmGrants(legacy);
    assert.deepEqual(value, [
      { page: 'clients', actions: ['view'], scope: { mode: 'clients', clients: [A] } },
      { page: 'tickets', actions: ['view', 'edit'], scope: { mode: 'all' } },
    ]);
  });
});

describe('isPortalOnly (Admin login and Admin APIs)', () => {
  const employeeRole = { isEmployeeRole: true, permissions: ['ess.access', 'leads.view'] };
  test('plain employee roles stay out of the Admin panel', () => {
    assert.equal(isPortalOnly([employeeRole]), true);
  });
  test('an admin role or an admin-panel permission lets them in', () => {
    assert.equal(isPortalOnly([employeeRole, { isEmployeeRole: false, permissions: ['cms.manage'] }]), false);
    assert.equal(isPortalOnly([{ isEmployeeRole: true, permissions: ['ess.access', 'leave.manage'] }]), false);
    assert.equal(isPortalOnly([]), false);
  });
});

// Requests that must be refused before any database read
describe('CRM router refuses out-of-grant requests', () => {
  let server;
  let base;
  const users = {
    nobody: { _id: 'u1', permissions: ['ess.access'], accessGrants: [] },
    hr: { _id: 'u2', permissions: ['employees.manage', 'leave.manage'], accessGrants: [] },
    invoicesA: { _id: 'u3', permissions: ['ess.access'], accessGrants: [{ page: 'invoices', actions: ['view', 'create'], scope: { mode: 'clients', clients: [A] } }] },
    clientsA: { _id: 'u4', permissions: ['ess.access'], accessGrants: [{ page: 'clients', actions: ['view', 'create', 'edit'], scope: { mode: 'clients', clients: [A] } }] },
  };

  before(async () => {
    // requirePermission audits each refusal; there is no database here
    require('../models/AuditLog').create = async () => {};
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = users[req.get('x-user')]; next(); });
    app.use(crmRouter);
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  const call = (user, method, path, body) => fetch(base + path, {
    method,
    headers: { 'x-user': user, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });

  test('no grant → 403 on every page, including for other admin permissions', async () => {
    for (const path of ['/clients', '/invoices', '/projects', '/retainers', '/tickets', '/payments', '/agreements', '/projects-staff', '/tickets-staff']) {
      assert.equal((await call('nobody', 'GET', path)).status, 403, path);
      assert.equal((await call('hr', 'GET', path)).status, 403, path);
    }
  });

  test('an action outside the grant → 403', async () => {
    assert.equal((await call('invoicesA', 'DELETE', `/invoices/${A}`)).status, 403);
    assert.equal((await call('invoicesA', 'PUT', `/invoices/${A}`, {})).status, 403);
    assert.equal((await call('invoicesA', 'PUT', `/payments/${A}/approve`)).status, 403);
  });

  test('creating for a client outside the grant → 403', async () => {
    const res = await call('invoicesA', 'POST', '/invoices', { client_ref: B, dueDate: '2026-12-01', lineItems: [{}], totalAmount: 10 });
    assert.equal(res.status, 403);
  });

  test('a client-list grant cannot create new clients', async () => {
    const res = await call('clientsA', 'POST', '/clients', { businessName: 'X Ltd', contactName: 'X', email: 'x@x.com', password: 'secret1' });
    assert.equal(res.status, 403);
  });

  test('a client outside the grant reads as not found', async () => {
    assert.equal((await call('clientsA', 'GET', `/clients/${B}`)).status, 404);
    assert.equal((await call('clientsA', 'PUT', `/clients/${B}`, { businessName: 'Hijack' })).status, 404);
  });

  test('the agreement template and account actions stay full-access only', async () => {
    assert.equal((await call('clientsA', 'GET', '/agreement')).status, 403);
    assert.equal((await call('clientsA', 'POST', `/clients/${A}/suspend`)).status, 403);
    assert.equal((await call('clientsA', 'DELETE', `/clients/${A}`)).status, 403);
  });
});
