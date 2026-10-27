/**
 * End-to-end check of the Phase 0 guard fixes and Phase 1 page grants against
 * the REAL server (server.js: every middleware, auth and route), backed by a
 * throwaway in-memory MongoDB. Nothing touches the database in server/.env:
 * the child server gets its own MONGODB_URI, JWT secret and empty email /
 * push / Cloudinary keys (dotenv never overrides variables already set).
 *
 *   npm run test:e2e
 *
 * Roles mirror production as read on 2026-10-16 (SUPER_ADMIN '*', EDITOR with
 * no holders, PROJECT MANAGER / BDE employee roles, HR with careers.manage).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const net = require('net');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER_DIR = path.resolve(__dirname, '../..');
// Same key in this process (fixtures) and the server it starts
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
const JWT_SECRET = 'e2e-test-secret';
const PASSWORD = 'Passw0rd!e2e';

let mongo;
let server;
let serverLog = '';
let base;
const ids = {};

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const childEnv = (uri, port) => ({
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(port),
  MONGODB_URI: uri,
  JWT_SECRET,
  JWT_REFRESH_SECRET: `${JWT_SECRET}-refresh`,
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  HR_EMAIL: '',
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
  FB_APP_SECRET: '',
  FB_VERIFY_TOKEN: '',
  FB_PAGE_ACCESS_TOKEN: '',
  FIREBASE_SERVICE_ACCOUNT_JSON: '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'a'.repeat(64),
});

const token = (who) => jwt.sign({ id: ids[who] }, JWT_SECRET, { expiresIn: '1h' });
const call = async (who, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${token(who)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
};

async function seed() {
  const Role = require('../../models/Role');
  const Admin = require('../../models/Admin');
  const Client = require('../../models/Client');
  const Invoice = require('../../models/Invoice');
  const PaymentProof = require('../../models/PaymentProof');
  const Settings = require('../../models/Settings');
  const { DEFAULT_EMPLOYEE_ROLES } = require('../../utils/employeeRoles');

  // As in production: start-up seeding and the HR permission split already ran
  await Settings.create([
    { key: 'employee_roles_seeded', value: DEFAULT_EMPLOYEE_ROLES.map((r) => r.name) },
    { key: 'permission_migration', value: { version: 1 } },
  ]);

  const role = (name, permissions, isEmployeeRole = false) => Role.create({ name, permissions, isEmployeeRole });
  const roles = {
    super: await role('SUPER_ADMIN', ['*']),
    editor: await role('EDITOR', ['blogs.manage', 'portfolio.manage']),
    bde: await role('BDE', ['leads.view', 'ess.access', 'followups.view'], true),
    pm: await role('PROJECT MANAGER', ['leads.assign', 'ess.access', 'followups.view', 'leads.view'], true),
    hr: await role('HR', ['ess.access', 'employees.view', 'employees.manage', 'leave.manage', 'attendance.manage', 'holidays.manage', 'performance.manage', 'payroll.manage', 'ess.manage', 'tasks.manage', 'careers.manage'], true),
    crmAdmin: await role('CRM_ADMIN', ['cms.manage', 'employees.view', 'employees.manage']),
    finance: await role('FINANCE', ['finance.view']),
    leadViewer: await role('LEAD_VIEWER', ['leads.view']), // Admin-panel, own leads only, not an assigner
    leadAdmin: await role('LEAD_ADMIN', ['leads.viewAll', 'employees.view', 'employees.manage']), // sees all leads, can't assign
    payrollAdmin: await role('PAYROLL_ADMIN', ['payroll.manage', 'employees.view', 'employees.manage']), // may grant payroll
    teamAdmin: await role('TEAM_ADMIN', ['team.manage']), // Team Management without Super Admin
    plain: await role('PLAIN_ADMIN', []),
  };

  // One at a time — clientId is generated from the previous one
  const A = await Client.create({ businessName: 'Alpha Ltd', contactName: 'Alpha Owner', email: 'alpha@example.com', phone: '+919800000001', password: 'ClientPass1' });
  const B = await Client.create({ businessName: 'Beta Ltd', contactName: 'Beta Owner', email: 'beta@example.com', phone: '+919800000002', password: 'ClientPass1' });
  ids.clientA = String(A._id);
  ids.clientB = String(B._id);

  const admin = async (key, roleDoc, extra = {}) => {
    const a = await Admin.create({ firstName: key, lastName: 'Test', email: `${key}@e2e.test`, password: PASSWORD, roles: [roleDoc._id], ...extra });
    ids[key] = String(a._id);
    return a;
  };
  await admin('super', roles.super);
  await admin('editor', roles.editor);
  await admin('bde', roles.bde, { employeeId: 'VH-E2E-1' });
  await admin('pm', roles.pm, { employeeId: 'VH-E2E-2' });
  await admin('hr', roles.hr, { employeeId: 'VH-E2E-3' });
  await admin('crmAdmin', roles.crmAdmin);
  await admin('finance', roles.finance);
  await admin('leadViewer', roles.leadViewer);
  await admin('leadAdmin', roles.leadAdmin);
  // Portal-only BDE who leads a team: lead pages granted for their reporting tree
  await admin('teamLead', roles.bde, {
    employeeId: 'VH-E2E-6',
    accessGrants: [
      { page: 'leads', actions: ['view', 'edit', 'assign'], scope: { mode: 'team' } },
      { page: 'followups', actions: ['view'], scope: { mode: 'team' } },
      { page: 'lead-activity', actions: ['view'], scope: { mode: 'team' } },
    ],
  });
  await admin('outsider', roles.bde, { employeeId: 'VH-E2E-7' });
  // Payroll grants — three separate actions, each explicit
  await admin('payViewer', roles.bde, { employeeId: 'VH-E2E-8', accessGrants: [{ page: 'payroll', actions: ['view'], scope: { mode: 'all' } }] });
  await admin('payManager', roles.bde, { employeeId: 'VH-E2E-9', accessGrants: [{ page: 'payroll', actions: ['view', 'sensitive'], scope: { mode: 'reports' } }] });
  await admin('payProcessor', roles.bde, {
    employeeId: 'VH-E2E-10',
    accessGrants: [{ page: 'payroll', actions: ['view', 'sensitive', 'process'], scope: { mode: 'departments', departments: ['Engineering'] } }],
  });
  await admin('payrollAdmin', roles.payrollAdmin);
  await admin('teamAdmin', roles.teamAdmin);
  await admin('plainAdmin', roles.plain);
  // HR pages granted for direct reports (Phase 4) — Bank changes without Sensitive, Holidays without Delete
  const reports = { mode: 'reports' };
  await admin('hrLead', roles.bde, {
    employeeId: 'VH-E2E-11',
    accessGrants: [
      { page: 'employees', actions: ['view'], scope: reports },
      { page: 'leave', actions: ['view', 'edit'], scope: reports },
      { page: 'attendance', actions: ['view'], scope: reports },
      { page: 'corrections', actions: ['view', 'edit'], scope: reports },
      { page: 'bank-changes', actions: ['view'], scope: reports },
      { page: 'holidays', actions: ['view', 'create'], scope: { mode: 'all' } },
      { page: 'tasks', actions: ['view', 'create'], scope: reports },
      { page: 'productivity', actions: ['view'], scope: reports },
      { page: 'performance', actions: ['view', 'edit'], scope: reports },
    ],
  });
  // Portal-only BDE with person-wise grants for client A only
  await admin('grantee', roles.bde, {
    employeeId: 'VH-E2E-4',
    accessGrants: [
      { page: 'invoices', actions: ['view', 'create'], scope: { mode: 'clients', clients: [A._id] } },
      { page: 'payments', actions: ['view', 'edit'], scope: { mode: 'clients', clients: [A._id] } },
      { page: 'agreements', actions: ['view'], scope: { mode: 'clients', clients: [A._id] } },
    ],
  });
  // Saved before accessGrants existed — only the legacy field (raw write, like old data)
  const legacy = await admin('legacy', roles.bde, { employeeId: 'VH-E2E-5' });
  await Admin.collection.updateOne({ _id: legacy._id }, { $set: { crmGrants: [{ page: 'clients', allClients: false, clients: [A._id], actions: ['view'] }] } });

  // Employee HR records (raw: the HR form's validation isn't under test)
  const Employee = require('../../models/Employee');
  for (const key of ['bde', 'pm', 'hr', 'grantee', 'legacy', 'teamLead', 'outsider', 'payViewer', 'payManager', 'payProcessor', 'payrollAdmin', 'hrLead']) {
    const doc = await Employee.collection.insertOne({
      employeeId: `VH-E2E-${key}`, adminId: new mongoose.Types.ObjectId(ids[key]), firstName: key, lastName: 'Test',
      email: `${key}@e2e.test`, phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent',
    });
    ids[`emp_${key}`] = String(doc.insertedId);
  }
  // The BDE reports to the team lead; the outsider reports to no one
  await Employee.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids.emp_bde) }, { $set: { reportingManager: new mongoose.Types.ObjectId(ids.emp_teamLead) } });
  // Payroll scopes: the outsider reports to the pay manager; the BDE and the
  // processor themselves are in Engineering (HR-set department), the PM only by role department
  const setEmp = (key, $set) => Employee.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids[`emp_${key}`]) }, { $set });
  await setEmp('outsider', { reportingManager: new mongoose.Types.ObjectId(ids.emp_payManager) });
  await setEmp('bde', { department: 'Engineering' });
  await setEmp('payProcessor', { department: 'Engineering' });
  await setEmp('pm', { department: '', roleDept: 'Engineering' });

  const PayrollRun = require('../../models/PayrollRun');
  const Payslip = require('../../models/Payslip');
  for (const key of ['bde', 'outsider', 'pm', 'payProcessor']) {
    const run = await PayrollRun.create({
      employeeId: ids[`emp_${key}`], month: 9, year: 2026, status: 'Draft',
      earnings: { basic: 30000, hra: 12000 }, deductions: { pf: 1800 }, grossEarnings: 42000, totalDeductions: 1800, netPay: 40200, remarks: 'September',
    });
    ids[`run_${key}`] = String(run._id);
  }
  // A finished payslip for the BDE (and its run), to check PDFs and mark-paid
  const slip = await Payslip.create({
    employeeId: ids.emp_bde, payrollRunId: ids.run_bde, month: 8, year: 2026, status: 'Active',
    earnings: { basic: 30000 }, deductions: { pf: 1800 }, grossEarnings: 30000, totalDeductions: 1800, netPay: 28200,
    pdfUrl: 'https://example.test/payslip.pdf', paymentReference: 'UTR123',
  });
  ids.slip_bde = String(slip._id);
  await PayrollRun.updateOne({ _id: ids.run_bde }, { $set: { payslipId: slip._id } });

  // ── HR fixtures (Phase 4): grantee and legacy report to hrLead; bde does not ──
  const oidOf = (key) => new mongoose.Types.ObjectId(ids[`emp_${key}`]);
  await setEmp('grantee', { reportingManager: oidOf('hrLead') });
  await setEmp('legacy', { reportingManager: oidOf('hrLead') });
  const { encrypt } = require('../../utils/encryption');
  for (const key of ['grantee', 'bde']) await setEmp(key, { panNumber: encrypt('ABCDE1234F'), aadhaarNumber: encrypt('234567890123') });

  const db = mongoose.connection.db;
  const insert = async (col, doc) => String((await db.collection(col).insertOne({ createdAt: new Date(), updatedAt: new Date(), ...doc })).insertedId);
  for (const key of ['grantee', 'bde', 'hrLead']) {
    ids[`leave_${key}`] = await insert('leaverequests', {
      employeeId: oidOf(key), leaveType: 'CL', startDate: new Date('2026-11-02'), endDate: new Date('2026-11-02'), reason: 'Family', status: 'Pending', days: 1,
    });
    ids[`corr_${key}`] = await insert('correctionrequests', {
      employee: oidOf(key), kind: 'Attendance', type: 'Correction', status: 'Pending', reason: 'Forgot', date: new Date('2026-10-01'), original: {}, requested: {},
    });
  }
  const bank = require('../../services/bankDetails');
  for (const key of ['grantee', 'bde']) {
    ids[`bank_${key}`] = await insert('bankchangerequests', {
      employee: oidOf(key), status: 'Pending',
      previous: bank.forStorage({ bankName: 'Old Bank', accountName: key, accountNumber: '111122223333', ifscCode: 'OLDB0000001' }),
      requested: bank.forStorage({ bankName: 'New Bank', accountName: key, accountNumber: '999988887777', ifscCode: 'NEWB0000001' }),
    });
  }
  ids.cycle = await insert('performancecycles', {
    title: 'Q4 2026', quarter: 'Q4', year: 2026, startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Active', createdBy: new mongoose.Types.ObjectId(ids.super),
  });
  for (const key of ['grantee', 'bde']) {
    ids[`review_${key}`] = await insert('performancereviews', { cycleId: new mongoose.Types.ObjectId(ids.cycle), employeeId: oidOf(key) });
  }

  const inv = async (client, n) => Invoice.create({
    client_ref: client._id, dueDate: new Date(Date.now() + 864e5), totalAmount: 1000 * n, subtotal: 1000 * n, taxPercent: 0, taxAmount: 0,
    lineItems: [{ description: `Work ${n}`, qty: 1, unitPrice: 1000 * n, amount: 1000 * n }],
  });
  const invA = await inv(A, 1);
  const invB = await inv(B, 2);
  ids.invA = String(invA._id);
  ids.invB = String(invB._id);
  // Leads: one owned by the Project Manager, one by the lead viewer, one by a BDE (raw: lead intake rules aren't under test)
  const lead = async (owner, name) => String((await mongoose.connection.db.collection('leads').insertOne({
    fullName: name, phone: '9811111111', email: `${name.toLowerCase()}@lead.test`, status: 'Contacted',
    assignedTo: new mongoose.Types.ObjectId(ids[owner]), createdAt: new Date(), updatedAt: new Date(), documents: [],
  })).insertedId);
  ids.leadPm = await lead('pm', 'PmLead');
  ids.leadViewerOwn = await lead('leadViewer', 'ViewerLead');
  ids.leadBde = await lead('bde', 'BdeLead');
  ids.leadTeamLead = await lead('teamLead', 'TeamLeadLead');
  ids.leadOutsider = await lead('outsider', 'OutsiderLead');
  ids.leadUnassigned = String((await mongoose.connection.db.collection('leads').insertOne({
    fullName: 'PoolLead', phone: '9822222222', email: 'pool@lead.test', status: 'New', assignedTo: null,
    leadType: 'Sales', createdAt: new Date(), updatedAt: new Date(), documents: [],
  })).insertedId);

  const proof = async (invoice, client, utr) => PaymentProof.create({ invoice_ref: invoice._id, client_ref: client._id, amountPaid: 500, utrNumber: utr, paymentDate: new Date(), status: 'Pending' });
  ids.proofA = String((await proof(invA, A, 'UTRAAAA11112222')).id);
  ids.proofB = String((await proof(invB, B, 'UTRBBBB11112222')).id);
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('vedhunt_e2e');
  await mongoose.connect(uri);
  await seed();

  const port = await freePort();
  base = `http://127.0.0.1:${port}/api`;
  server = spawn(process.execPath, ['server.js'], { cwd: SERVER_DIR, env: childEnv(uri, port), stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const started = Date.now();
  for (;;) {
    if (serverLog.includes('Server running')) break;
    if (server.exitCode !== null || Date.now() - started > 90_000) throw new Error(`Server did not start:\n${serverLog.slice(-3000)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}, { timeout: 300_000 });

after(async () => {
  // E2E_SERVER_LOG=<file> keeps the server's own output for debugging
  if (process.env.E2E_SERVER_LOG) require('fs').writeFileSync(process.env.E2E_SERVER_LOG, serverLog);
  server?.kill();
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Phase 0 — no API is reachable by role name or without a permission', () => {
  const CMS_ADMIN_APIS = [
    ['GET', '/content/admin/navbar'],
    ['PUT', '/content/admin/about-hero', {}],
    ['GET', '/content/admin/why-choose-us'],
    ['PUT', '/admin/settings/contact', {}],
    ['PUT', '/admin/settings/privacy-policy', {}],
    ['GET', '/admin/payments'],
    ['GET', '/subscribe/admin/list'],
    ['POST', '/blog-categories', { name: 'x' }],
    ['POST', '/home-pricing', {}],
    ['POST', '/upload'],
  ];

  test('no token → 401', async () => {
    for (const [m, u, b] of CMS_ADMIN_APIS) assert.equal((await call(null, m, u, b)).status, 401, `${m} ${u}`);
  });

  test('Employee Portal login (BDE) is refused on every admin API — the old token hole', async () => {
    for (const [m, u, b] of [...CMS_ADMIN_APIS, ['GET', '/admin/clients'], ['GET', '/admin/invoices'], ['POST', '/jobs', {}]]) {
      assert.equal((await call('bde', m, u, b)).status, 403, `${m} ${u}`);
    }
  });

  test('admin-panel employee without the page permission (Project Manager) is refused', async () => {
    for (const [m, u, b] of [...CMS_ADMIN_APIS, ['POST', '/jobs', {}]]) assert.equal((await call('pm', m, u, b)).status, 403, `${m} ${u}`);
  });

  test('previously unguarded writes now need their page permission', async () => {
    assert.equal((await call('pm', 'POST', '/jobs', {})).status, 403);
    assert.equal((await call('pm', 'POST', '/blog-categories', { name: 'x' })).status, 403);
    assert.equal((await call('pm', 'POST', '/home-pricing', {})).status, 403);
  });

  test('HR keeps careers pages (careers.manage) and stays out of the CRM / CMS', async () => {
    assert.notEqual((await call('hr', 'POST', '/jobs', { title: 'E2E job' })).status, 403);
    assert.equal((await call('hr', 'GET', '/content/admin/life-at-vedhunt')).status, 200);
    assert.equal((await call('hr', 'GET', '/admin/clients')).status, 403);
    assert.equal((await call('hr', 'GET', '/content/admin/navbar')).status, 403);
  });

  test('Super Admin keeps everything', async () => {
    for (const u of ['/content/admin/navbar', '/content/admin/why-choose-us', '/admin/payments', '/subscribe/admin/list', '/admin/clients', '/admin/invoices', '/admin/lead-forms', '/admin/agreements']) {
      assert.equal((await call('super', 'GET', u)).status, 200, u);
    }
    assert.equal((await call('super', 'PUT', '/admin/settings/office-timings', { start: '09:30', end: '18:30' })).status === 403, false);
  });

  test('lead forms list follows leads.view; editing them needs settings.manage', async () => {
    assert.equal((await call('pm', 'GET', '/admin/lead-forms')).status, 200);
    assert.equal((await call('pm', 'PUT', `/admin/lead-forms/${ids.clientA}`, { leadType: 'x' })).status, 403);
  });

  test('My Performance in the portal still works with a portal login', async () => {
    assert.equal((await call('bde', 'GET', '/performance/active-cycle')).status, 200);
    assert.equal((await call('bde', 'GET', '/performance/history/me')).status, 200);
  });

  test('EDITOR (0 holders in production) no longer passes CMS APIs by its name', async () => {
    assert.equal((await call('editor', 'GET', '/content/admin/navbar')).status, 403);
  });
});

describe('Phase 2 — remaining API gaps closed', () => {
  const LOGIN_ONLY_BEFORE = [
    ['GET', '/portfolio/admin'], ['POST', '/portfolio', {}], ['PUT', '/portfolio/admin/hero', {}], ['DELETE', `/portfolio/${'6'.repeat(24)}`],
    ['GET', '/pricing/admin/plans'], ['POST', '/pricing/admin/categories', {}], ['DELETE', `/pricing/admin/plans/${'6'.repeat(24)}`],
    ['GET', '/testimonials'], ['POST', '/testimonials/admin', {}], ['PUT', `/testimonials/${'6'.repeat(24)}/status`, {}],
    ['POST', '/faq', {}], ['PUT', '/faq/content', {}],
    ['GET', '/service-pages'], ['PUT', '/service-pages/x', {}],
    ['GET', '/admin/analytics/earnings'],
  ];

  test('H2: an Admin login without the page permission is refused (was: any login)', async () => {
    for (const [m, u, b] of LOGIN_ONLY_BEFORE) {
      assert.equal((await call('pm', m, u, b)).status, 403, `pm ${m} ${u}`);
      assert.equal((await call('leadViewer', m, u, b)).status, 403, `leadViewer ${m} ${u}`);
    }
  });

  test('H2: Super Admin still reaches every one of those pages', async () => {
    for (const u of ['/portfolio/admin', '/pricing/admin/plans', '/pricing/admin/categories', '/testimonials', '/service-pages', '/admin/analytics/earnings']) {
      assert.equal((await call('super', 'GET', u)).status, 200, u);
    }
  });

  test('H2: the matching page permission opens them (cms.manage → testimonials, FAQ)', async () => {
    assert.equal((await call('crmAdmin', 'GET', '/testimonials')).status, 200);
    assert.notEqual((await call('crmAdmin', 'POST', '/faq', { question: 'Q?', answer: 'A.' })).status, 403);
    assert.equal((await call('crmAdmin', 'GET', '/pricing/admin/plans')).status, 403);
  });

  test('M2: revenue needs finance.view', async () => {
    assert.equal((await call('finance', 'GET', '/admin/analytics/earnings')).status, 200);
    assert.equal((await call('crmAdmin', 'GET', '/admin/analytics/earnings')).status, 403);
  });

  test('H1: an Admin login without leads.viewAll can only change its own leads', async () => {
    // own lead: allowed
    assert.equal((await call('leadViewer', 'PUT', `/leads/${ids.leadViewerOwn}`, { remark: 'own lead note' })).status, 200);
    assert.equal((await call('leadViewer', 'POST', `/leads/${ids.leadViewerOwn}/lock`)).status, 200);
    // someone else's lead: reads as not found, nothing changes
    assert.equal((await call('leadViewer', 'PUT', `/leads/${ids.leadBde}`, { remark: 'hijack' })).status, 404);
    assert.equal((await call('leadViewer', 'POST', `/leads/${ids.leadBde}/lock`)).status, 404);
    assert.equal((await call('leadViewer', 'DELETE', `/leads/${ids.leadBde}/documents/${'6'.repeat(24)}`)).status, 404);
    assert.equal((await call('leadViewer', 'GET', `/leads/${ids.leadBde}/tasks`)).status, 404);
    assert.equal((await call('leadViewer', 'PUT', `/leads/${ids.leadBde}/tasks/${'6'.repeat(24)}/complete`, { result: 'x' })).status, 404);
    const untouched = await mongoose.connection.db.collection('leads').findOne({ _id: new mongoose.Types.ObjectId(ids.leadBde) });
    assert.equal(untouched.remark, undefined);
    assert.equal(untouched.lockedBy ?? null, null);
  });

  test('H1: assigners (leads.assign) keep follow-up tasks across BDEs; full visibility keeps everything', async () => {
    assert.equal((await call('pm', 'GET', `/leads/${ids.leadBde}/tasks`)).status, 200);
    assert.equal((await call('pm', 'PUT', `/leads/${ids.leadBde}`, { remark: 'x' })).status, 404);
    assert.equal((await call('super', 'PUT', `/leads/${ids.leadBde}`, { remark: 'super note' })).status, 200);
  });

  test('M1: anonymous upload refuses SVG before anything is stored', async () => {
    const form = new FormData();
    form.append('image', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'x.svg');
    const res = await fetch(`${base}/upload/public`, { method: 'POST', body: form });
    assert.notEqual(res.status, 200);
    assert.ok(res.headers.get('ratelimit-limit') || res.headers.get('ratelimit-policy'), 'rate limit headers present');
  });

  test('L1: internal settings need a login with settings.manage; client-facing ones stay public', async () => {
    for (const u of ['/settings/email', '/settings/office-timings', '/settings/attendance-rules']) {
      assert.equal((await call(null, 'GET', u)).status, 401, u);
      assert.equal((await call('pm', 'GET', u)).status, 403, u);
      assert.equal((await call('super', 'GET', u)).status, 200, u);
    }
    for (const u of ['/settings/payment', '/settings/facebook', '/settings/campaigns', '/settings/contact']) {
      assert.equal((await call(null, 'GET', u)).status, 200, u);
    }
  });
});

describe('Phase 3 — lead pages: roles unchanged, grants scoped to own / team / all', () => {
  const g = '/employee-portal/grants';
  const leadIds = (r) => (r.body.data || []).map((l) => String(l._id)).sort();

  test('roles: own-leads logins still see only their own leads', async () => {
    assert.deepEqual(leadIds(await call('leadViewer', 'GET', '/leads')), [ids.leadViewerOwn]);
    assert.deepEqual(leadIds(await call('pm', 'GET', '/leads')), [ids.leadPm]);
    const all = leadIds(await call('super', 'GET', '/leads'));
    for (const id of [ids.leadPm, ids.leadBde, ids.leadOutsider, ids.leadUnassigned]) assert.ok(all.includes(id));
  });

  test('M3: assigners see and can open the unassigned pool; others cannot', async () => {
    assert.deepEqual(leadIds(await call('pm', 'GET', '/leads?assignedTo=Unassigned')), [ids.leadUnassigned]);
    assert.equal((await call('pm', 'GET', `/leads/${ids.leadUnassigned}`)).status, 200);
    assert.deepEqual(leadIds(await call('leadViewer', 'GET', '/leads?assignedTo=Unassigned')), []);
    assert.equal((await call('leadViewer', 'GET', `/leads/${ids.leadUnassigned}`)).status, 404);
    // opening is not editing: the pool lead isn't theirs to change
    assert.equal((await call('pm', 'PUT', `/leads/${ids.leadUnassigned}`, { remark: 'x' })).status, 404);
  });

  test('team grant: the portal lists the team’s leads only', async () => {
    const r = await call('teamLead', 'GET', `${g}/leads`);
    assert.equal(r.status, 200);
    assert.deepEqual(leadIds(r), [ids.leadBde, ids.leadTeamLead].sort());
    assert.deepEqual(leadIds(await call('teamLead', 'GET', `${g}/leads?assignedTo=${ids.outsider}`)), []);
  });

  test('team grant: outside the team reads as not found and cannot be changed', async () => {
    assert.equal((await call('teamLead', 'GET', `${g}/leads/${ids.leadBde}`)).status, 200);
    assert.equal((await call('teamLead', 'GET', `${g}/leads/${ids.leadOutsider}`)).status, 404);
    assert.equal((await call('teamLead', 'PUT', `${g}/leads/${ids.leadBde}`, { remark: 'team lead note' })).status, 200);
    assert.equal((await call('teamLead', 'PUT', `${g}/leads/${ids.leadOutsider}`, { remark: 'x' })).status, 404);
  });

  test('team grant: assign only within the team; no round robin, no delete', async () => {
    assert.equal((await call('teamLead', 'POST', `${g}/leads/${ids.leadUnassigned}/assign`, { assignedTo: ids.outsider })).status, 403);
    assert.equal((await call('teamLead', 'POST', `${g}/leads/${ids.leadOutsider}/assign`, { assignedTo: ids.bde })).status, 404);
    assert.equal((await call('teamLead', 'POST', `${g}/leads/bulk-assign`, { leadIds: [ids.leadBde], assignedTo: 'round-robin' })).status, 403);
    assert.equal((await call('teamLead', 'DELETE', `${g}/leads/${ids.leadBde}`)).status, 403);
    // picking up a pool lead for someone in the team works
    assert.equal((await call('teamLead', 'POST', `${g}/leads/${ids.leadUnassigned}/assign`, { assignedTo: ids.bde })).status, 200);
    const moved = await mongoose.connection.db.collection('leads').findOne({ _id: new mongoose.Types.ObjectId(ids.leadUnassigned) });
    assert.equal(String(moved.assignedTo), ids.bde);
  });

  test('team grant: BD picker and reports cover the team only', async () => {
    const bds = await call('teamLead', 'GET', `${g}/admin/assignment/bds`);
    assert.equal(bds.status, 200);
    assert.deepEqual(bds.body.data.map((b) => String(b._id)).sort(), [ids.bde, ids.teamLead].sort());
    const fu = await call('teamLead', 'GET', `${g}/admin/activity/followups?by=${ids.outsider}`);
    assert.equal(fu.status, 200);
    assert.equal((fu.body.data || fu.body.leads || []).length, 0);
    assert.equal((await call('teamLead', 'GET', `${g}/admin/activity/calls`)).status, 200);
    assert.equal((await call('teamLead', 'GET', `${g}/admin/activity/bd-accountability`)).status, 200);
    assert.equal((await call('teamLead', 'GET', `${g}/admin/lead-forms`)).status, 200);
  });

  test('team grant: the same portal token is refused by the Admin lead APIs', async () => {
    assert.equal((await call('teamLead', 'GET', '/leads')).status, 403);
    assert.equal((await call('teamLead', 'GET', '/admin/activity/followups')).status, 403);
  });

  test('a BDE without a grant gets nothing from the granted lead routes beyond their own leads', async () => {
    assert.deepEqual(leadIds(await call('outsider', 'GET', `${g}/leads`)), [ids.leadOutsider]);
    assert.equal((await call('outsider', 'GET', `${g}/admin/activity/followups`)).status, 403);
    assert.equal((await call('outsider', 'POST', `${g}/leads/${ids.leadOutsider}/assign`, { assignedTo: ids.bde })).status, 403);
  });

  test('portal /me lists the granted lead pages with their combined actions', async () => {
    const res = await fetch(`${base}/employee/auth/me`, { headers: { authorization: `Bearer ${token('teamLead')}` } });
    const { employee } = await res.json();
    assert.deepEqual(employee.access.leads, { actions: ['view', 'edit', 'assign'], mode: 'team' });
    assert.deepEqual(employee.access.followups, { actions: ['view'], mode: 'team' });
  });

  test('granting leads: CRM admins can’t; lead admins can, but only actions they hold', async () => {
    const crm = await call('crmAdmin', 'GET', `/employees/${ids.emp_outsider}/access-grants`);
    assert.equal(crm.body.pages.find((p) => p.key === 'leads').grantable, false);
    const r = await call('leadAdmin', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, {
      grants: [{ page: 'leads', actions: ['view', 'edit', 'assign', 'delete'], scope: { mode: 'team' } }],
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.grants.find((x) => x.page === 'leads').actions, ['view', 'edit']);
  });
});

describe('Payroll — explicit, separate grants (View / Sensitive / Process), scoped to employees', () => {
  const p = '/employee-portal/grants/payroll';
  const runIds = (r) => (r.body.runs || []).map((x) => String(x._id)).sort();
  const AMOUNT_KEYS = ['earnings', 'deductions', 'grossEarnings', 'totalDeductions', 'netPay', 'salaryBreakup', 'remarks'];

  test('no access by default: no grant, no role permission → refused everywhere', async () => {
    for (const who of ['bde', 'teamLead', 'grantee']) {
      for (const u of ['/runs', `/runs/${ids.run_bde}`, '/payslips', `/salary-revisions/${ids.emp_bde}`, '/employees', '/settings']) {
        assert.equal((await call(who, 'GET', p + u)).status, 403, `${who} ${u}`);
      }
    }
    // Admin-panel logins without payroll.manage
    for (const who of ['crmAdmin', 'leadAdmin', 'pm']) assert.equal((await call(who, 'GET', '/payroll/runs')).status, 403, who);
  });

  test('direct API: portal tokens with a payroll grant still cannot use the Admin payroll API', async () => {
    for (const who of ['payViewer', 'payManager', 'payProcessor']) {
      assert.equal((await call(who, 'GET', '/payroll/runs')).status, 403, who);
      assert.equal((await call(who, 'PUT', `/payroll/runs/${ids.run_bde}`, { bonus: 1 })).status, 403, who);
    }
  });

  test('View only: status visible, every amount and PDF removed by the server', async () => {
    const r = await call('payViewer', 'GET', `${p}/runs?month=9&year=2026`);
    assert.equal(r.status, 200);
    assert.deepEqual(runIds(r), [ids.run_bde, ids.run_outsider, ids.run_pm, ids.run_payProcessor].sort());
    for (const run of r.body.runs) {
      assert.equal(run.masked, true);
      for (const k of AMOUNT_KEYS) assert.equal(k in run, false, `run.${k}`);
      if (run.payslipId) { assert.equal('pdfUrl' in run.payslipId, false); assert.equal('paymentReference' in run.payslipId, false); }
    }
    const one = await call('payViewer', 'GET', `${p}/runs/${ids.run_bde}`);
    assert.equal(one.body.run.masked, true);
    assert.equal('netPay' in one.body.run, false);
    const slips = await call('payViewer', 'GET', `${p}/payslips`);
    assert.ok(slips.body.payslips.every((s) => s.masked && !('netPay' in s) && !('pdfUrl' in s)));
    assert.equal((await call('payViewer', 'GET', `${p}/settings`)).status, 200);
  });

  test('View only: salary history and every processing action are refused', async () => {
    assert.equal((await call('payViewer', 'GET', `${p}/salary-revisions/${ids.emp_bde}`)).status, 403);
    for (const [m, u, b] of [
      ['PUT', `/runs/${ids.run_bde}`, { bonus: 5000 }], ['POST', `/runs/${ids.run_bde}/approve`], ['POST', `/runs/${ids.run_bde}/hold`],
      ['POST', `/runs/${ids.run_bde}/resume`], ['POST', `/runs/${ids.run_bde}/resend`], ['POST', '/runs/generate', { month: 9, year: 2026 }],
      ['POST', `/payslips/${ids.slip_bde}/mark-paid`, { paymentReference: 'X' }],
      ['POST', '/salary-revisions', { employeeId: ids.emp_bde, ctc: 1, effectiveFrom: '2026-10-01', reason: 'x' }],
      ['PUT', '/settings', { generationDay: 5 }],
    ]) assert.equal((await call('payViewer', m, p + u, b)).status, 403, `${m} ${u}`);
    const unchanged = await mongoose.connection.db.collection('payrollruns').findOne({ _id: new mongoose.Types.ObjectId(ids.run_bde) });
    assert.equal(unchanged.earnings.bonus ?? 0, 0);
  });

  test('Sensitive, direct reports: amounts for the report only; others not found; no processing', async () => {
    const r = await call('payManager', 'GET', `${p}/runs`);
    assert.deepEqual(runIds(r), [ids.run_outsider]);
    assert.equal(r.body.runs[0].netPay, 40200);
    assert.equal(r.body.runs[0].masked, undefined);
    assert.equal((await call('payManager', 'GET', `${p}/runs/${ids.run_bde}`)).status, 404);
    assert.equal((await call('payManager', 'GET', `${p}/salary-revisions/${ids.emp_outsider}`)).status, 200);
    assert.equal((await call('payManager', 'GET', `${p}/salary-revisions/${ids.emp_bde}`)).status, 404);
    assert.equal((await call('payManager', 'PUT', `${p}/runs/${ids.run_outsider}`, { bonus: 1 })).status, 403);
  });

  test('Process, selected department: only that department, never their own payroll', async () => {
    const r = await call('payProcessor', 'GET', `${p}/runs`);
    // BDE (HR department) and PM (role department) are Engineering; their own run is excluded
    assert.deepEqual(runIds(r), [ids.run_bde, ids.run_pm].sort());
    assert.equal((await call('payProcessor', 'GET', `${p}/runs/${ids.run_payProcessor}`)).status, 404);
    assert.equal((await call('payProcessor', 'PUT', `${p}/runs/${ids.run_payProcessor}`, { bonus: 99999 })).status, 404);
    assert.equal((await call('payProcessor', 'PUT', `${p}/runs/${ids.run_outsider}`, { bonus: 1 })).status, 404);

    const edited = await call('payProcessor', 'PUT', `${p}/runs/${ids.run_pm}`, { bonus: 1000 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.run.status, 'UnderReview');
    assert.equal((await call('payProcessor', 'POST', `${p}/runs/${ids.run_pm}/hold`)).status, 200);
    assert.equal((await call('payProcessor', 'POST', `${p}/runs/${ids.run_pm}/resume`)).status, 200);
    assert.equal((await call('payProcessor', 'POST', `${p}/runs/${ids.run_outsider}/approve`)).status, 404);
    assert.equal((await call('payProcessor', 'POST', '/employee-portal/grants/payroll/runs/generate', { month: 9, year: 2026, employeeIds: [ids.emp_outsider] })).status, 403);
    assert.equal((await call('payProcessor', 'POST', `${p}/payslips/${ids.slip_bde}/mark-paid`, { paymentReference: 'UTR-E2E-1' })).status, 200);
    assert.equal((await call('payProcessor', 'PUT', `${p}/settings`, { generationDay: 5 })).status, 403);
  });

  test('granting: only payroll.manage holders; Process needs Sensitive ticked explicitly; never your own', async () => {
    // A CRM admin can't see or change payroll grants
    const crm = await call('crmAdmin', 'GET', `/employees/${ids.emp_outsider}/access-grants`);
    assert.equal(crm.body.pages.find((x) => x.key === 'payroll').grantable, false);
    await call('crmAdmin', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, { grants: [{ page: 'payroll', actions: ['view', 'sensitive', 'process'], scope: { mode: 'all' } }] });
    assert.equal((await call('outsider', 'GET', `${p}/runs`)).status, 403);

    const noSensitive = await call('payrollAdmin', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, { grants: [{ page: 'payroll', actions: ['view', 'process'], scope: { mode: 'all' } }] });
    assert.equal(noSensitive.status, 400);
    assert.match(noSensitive.body.message, /needs "sensitive"/);

    const self = await call('payrollAdmin', 'PUT', `/employees/${ids.emp_payrollAdmin}/access-grants`, { grants: [] });
    assert.equal(self.status, 403);
    assert.equal((await call('payrollAdmin', 'GET', `/employees/${ids.emp_payrollAdmin}/access-grants`)).body.isSelf, true);

    const ok = await call('payrollAdmin', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, { grants: [{ page: 'payroll', actions: ['view'], scope: { mode: 'reports' } }] });
    assert.equal(ok.status, 200);
    assert.equal((await call('outsider', 'GET', `${p}/runs`)).status, 200);
  });

  test('revocation takes effect on the very next request', async () => {
    assert.equal((await call('payProcessor', 'GET', `${p}/runs`)).status, 200);
    const r = await call('payrollAdmin', 'PUT', `/employees/${ids.emp_payProcessor}/access-grants`, { grants: [] });
    assert.equal(r.status, 200);
    assert.equal((await call('payProcessor', 'GET', `${p}/runs`)).status, 403);
    assert.equal((await call('payProcessor', 'PUT', `${p}/runs/${ids.run_bde}`, { bonus: 1 })).status, 403);
    const me = await (await fetch(`${base}/employee/auth/me`, { headers: { authorization: `Bearer ${token('payProcessor')}` } })).json();
    assert.equal(me.employee.access.payroll, undefined);
    const audit = await mongoose.connection.db.collection('auditlogs').findOne({ action: 'ACCESS_GRANTS_UPDATE', 'beforeSnapshot.employeeId': new mongoose.Types.ObjectId(ids.emp_payProcessor) });
    assert.ok(audit, 'revocation audited');
  });

  test('roles unchanged: payroll.manage sees everything with amounts and keeps settings', async () => {
    for (const who of ['super', 'hr', 'payrollAdmin']) {
      const r = await call(who, 'GET', '/payroll/runs?month=9&year=2026');
      assert.equal(r.status, 200, who);
      assert.equal(r.body.runs.length, 4, who);
      assert.ok(r.body.runs.every((x) => !x.masked && typeof x.netPay === 'number'), who);
    }
    assert.equal((await call('payrollAdmin', 'PUT', '/payroll/settings', { generationDay: 10 })).status, 200);
  });
});

describe('Phase 4 — HRMS pages granted per person, scoped to direct reports', () => {
  const e = '/employee-portal/grants/employees';
  const idsOf = (list, pick) => (list || []).map(pick).map(String).sort();
  const reportsIds = () => [ids.emp_grantee, ids.emp_legacy].sort();

  test('Employees: only direct reports, sensitive fields masked without Sensitive', async () => {
    const r = await call('hrLead', 'GET', e);
    assert.equal(r.status, 200);
    assert.deepEqual(idsOf(r.body.employees, (x) => x._id), reportsIds());
    const g = r.body.employees.find((x) => String(x._id) === ids.emp_grantee);
    assert.match(g.panNumber, /^•+234F$/);
    assert.equal('salaryCTC' in g, false);
  });

  test('Employees: editing, creating and deleting stay with the role', async () => {
    assert.equal((await call('hrLead', 'PUT', `${e}/${ids.emp_grantee}`, { phone: '9999999999' })).status, 403);
    assert.equal((await call('hrLead', 'POST', e, { firstName: 'X' })).status, 404); // not on the granted routes at all
    assert.equal((await call('hrLead', 'DELETE', `${e}/${ids.emp_grantee}`)).status, 404);
  });

  test('Leave: only reports’ requests; acting on others or on your own is not found', async () => {
    const r = await call('hrLead', 'GET', `${e}/admin/leave-requests`);
    assert.deepEqual(idsOf(r.body.leaveRequests, (x) => x._id), [ids.leave_grantee]);
    assert.equal((await call('hrLead', 'PUT', `${e}/admin/leave-requests/${ids.leave_bde}/status`, { status: 'Rejected', adminComment: 'x' })).status, 404);
    assert.equal((await call('hrLead', 'PUT', `${e}/admin/leave-requests/${ids.leave_hrLead}/status`, { status: 'Approved' })).status, 404);
    const own = await call('hrLead', 'PUT', `${e}/admin/leave-requests/${ids.leave_grantee}/status`, { status: 'Rejected', adminComment: 'Clash with release' });
    assert.ok(![403, 404].includes(own.status), `in-scope review got ${own.status}`);
  });

  test('Corrections: only reports; others not found', async () => {
    const r = await call('hrLead', 'GET', '/employee-portal/grants/corrections');
    assert.deepEqual(idsOf(r.body.requests, (x) => x._id), [ids.corr_grantee]);
    assert.equal((await call('hrLead', 'PUT', `/employee-portal/grants/corrections/${ids.corr_bde}/status`, { status: 'Rejected', comment: 'x' })).status, 404);
    assert.equal((await call('hrLead', 'PUT', `/employee-portal/grants/corrections/${ids.corr_hrLead}/status`, { status: 'Rejected', comment: 'x' })).status, 404);
  });

  test('Corrections: search by employee name, bulk decision limited to the scope', async () => {
    const g = '/employee-portal/grants/corrections';
    const all = await call('super', 'GET', '/corrections?status=Pending');
    const row = all.body.requests.find((x) => x._id === ids.corr_grantee);
    const byName = await call('super', 'GET', `/corrections?status=Pending&search=${encodeURIComponent(row.employee.firstName)}`);
    assert.ok(byName.body.requests.some((x) => x._id === ids.corr_grantee));
    assert.ok(byName.body.requests.every((x) => x.employee.firstName.toLowerCase().includes(row.employee.firstName.toLowerCase()) || x.employee.lastName.toLowerCase().includes(row.employee.firstName.toLowerCase())));
    assert.equal((await call('super', 'GET', '/corrections?search=zzz-nobody-here')).body.requests.length, 0);
    // The scoped person only finds people inside their scope, even when searching for someone else
    const outsider = all.body.requests.find((x) => x._id === ids.corr_bde);
    const scopedSearch = await call('hrLead', 'GET', `${g}?search=${encodeURIComponent(outsider.employee.firstName)}`);
    assert.ok(!scopedSearch.body.requests.some((x) => x._id === ids.corr_bde));

    const bulk = await call('hrLead', 'PUT', `${g}/bulk-status`, { ids: [ids.corr_grantee, ids.corr_bde], status: 'Rejected', comment: 'Not enough proof' });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.body.done, 1);
    assert.equal(bulk.body.failed, 1);
    const after = (await call('super', 'GET', '/corrections?status=All')).body.requests;
    assert.equal(after.find((x) => x._id === ids.corr_grantee).status, 'Rejected');
    assert.equal(after.find((x) => x._id === ids.corr_bde).status, 'Pending');

    assert.equal((await call('super', 'PUT', '/corrections/bulk-status', { ids: [], status: 'Approved' })).status, 400);
    assert.equal((await call('super', 'PUT', '/corrections/bulk-status', { ids: [ids.corr_bde], status: 'Rejected' })).status, 400); // rejecting needs a comment
    assert.equal((await call('super', 'PUT', '/corrections/bulk-status', { ids: [ids.corr_bde], status: 'Maybe' })).status, 400);
  });

  test('Corrections: a date range becomes one request per working day, approved in bulk', async () => {
    const ess = '/employee-portal/ess/corrections';
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = (back) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); return d; };
    const range = { fromDate: ymd(day(8)), toDate: ymd(day(3)), clockIn: '10:00', clockOut: '18:30', reason: 'Biometric was down' };
    const working = [8, 7, 6, 5, 4, 3].filter((b) => day(b).getDay() !== 0);

    assert.equal((await call('bde', 'POST', `${ess}/attendance/range`, { ...range, toDate: range.fromDate, clockOut: '09:00' })).status, 400); // out before in
    assert.equal((await call('bde', 'POST', `${ess}/attendance/range`, { ...range, fromDate: range.toDate, toDate: range.fromDate })).status, 400); // backwards
    assert.equal((await call('bde', 'POST', `${ess}/attendance/range`, { ...range, fromDate: ymd(day(80)), toDate: ymd(day(40)) })).status, 400); // too long, too old

    const made = await call('bde', 'POST', `${ess}/attendance/range`, range);
    assert.equal(made.status, 201);
    assert.equal(made.body.created, working.length);
    assert.equal(made.body.skipped.length, 6 - working.length); // Sundays only
    const mine = (await call('super', 'GET', '/corrections?status=Pending&kind=Attendance')).body.requests.filter((x) => x.batchId === made.body.batchId);
    assert.equal(mine.length, working.length);

    // Sending the same range again finds every day already pending
    const again = await call('bde', 'POST', `${ess}/attendance/range`, range);
    assert.equal(again.status, 400);
    assert.match(again.body.message, /pending/i);

    const bulk = await call('super', 'PUT', '/corrections/bulk-status', { ids: mine.map((x) => x._id), status: 'Approved' });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.body.done, working.length);
    const Employee = require('../../models/Employee');
    const emp = await Employee.findById(ids.emp_bde, { attendance: 1 }).lean();
    for (const b of working) {
      const rec = emp.attendance.find((a) => new Date(a.date).toDateString() === day(b).toDateString());
      assert.equal(rec?.clockIn, '10:00 AM');
      assert.equal(rec?.regularized, true);
    }
    // Already decided: a second bulk run reports them as not processed instead of re-applying
    const twice = await call('super', 'PUT', '/corrections/bulk-status', { ids: mine.map((x) => x._id), status: 'Approved' });
    assert.equal(twice.body.done, 0);
  });

  test('Bank changes: account numbers masked without Sensitive, approving refused', async () => {
    const r = await call('hrLead', 'GET', `${e}/admin/bank-change-requests`);
    assert.deepEqual(idsOf(r.body.requests, (x) => x._id), [ids.bank_grantee]);
    const req = r.body.requests[0];
    assert.equal(req.masked, true);
    assert.ok(!JSON.stringify(req).includes('999988887777') && !JSON.stringify(req).includes('111122223333'));
    assert.equal((await call('hrLead', 'PUT', `${e}/admin/bank-change-requests/${ids.bank_grantee}/status`, { status: 'Approved' })).status, 403);
    // the role still sees them in full
    const full = await call('super', 'GET', '/employees/admin/bank-change-requests');
    assert.ok(JSON.stringify(full.body.requests).includes('999988887777'));
  });

  test('Holidays: View and Create granted, Delete refused', async () => {
    assert.equal((await call('hrLead', 'GET', `${e}/holidays`)).status, 200);
    const created = await call('hrLead', 'POST', `${e}/holidays`, { name: 'E2E Day', date: '2026-12-24', type: 'Public' });
    assert.equal(created.status, 200);
    assert.equal((await call('hrLead', 'DELETE', `${e}/holidays/${created.body.holiday._id}`)).status, 403);
    // portal logins without the grant can't read the admin calendar
    assert.equal((await call('bde', 'GET', `${e}/holidays`)).status, 403);
  });

  test('Tasks: assign to reports only; changing status needs Edit', async () => {
    assert.equal((await call('hrLead', 'PUT', `${e}/${ids.emp_grantee}`, { newTask: { title: 'Prepare report' } })).status, 200);
    assert.equal((await call('hrLead', 'PUT', `${e}/${ids.emp_bde}`, { newTask: { title: 'Not mine' } })).status, 404);
    assert.equal((await call('hrLead', 'PUT', `${e}/${ids.emp_grantee}`, { taskStatusUpdate: { taskId: '6'.repeat(24), status: 'Completed' } })).status, 403);
    assert.equal((await call('hrLead', 'PUT', `${e}/${ids.emp_grantee}`, { newTask: { title: 'x' }, salaryCTC: 1 })).status, 403);
  });

  test('Attendance and productivity: reports only', async () => {
    const roster = await call('hrLead', 'GET', `${e}/admin/attendance/daily`);
    assert.equal(roster.status, 200);
    assert.ok(roster.body.roster.every((x) => reportsIds().includes(String(x._id))));
    assert.equal((await call('hrLead', 'GET', `${e}/admin/attendance/monthly/${ids.emp_bde}?month=October&year=2026`)).status, 404);
    const prod = await call('hrLead', 'GET', `${e}/manager/productivity`);
    assert.deepEqual(idsOf(prod.body.stats, (x) => x.id), reportsIds());
  });

  test('Performance: goals and reviews for reports only; cycles stay with the role', async () => {
    const pf = '/employee-portal/grants/performance';
    assert.equal((await call('hrLead', 'GET', `${pf}/cycles`)).status, 200);
    const kpis = [{ metricType: 'Revenue', targetValue: 100000, weightage: 100 }];
    assert.equal((await call('hrLead', 'POST', `${pf}/targets`, { cycleId: ids.cycle, employeeId: ids.emp_grantee, kpis })).status, 201);
    assert.equal((await call('hrLead', 'POST', `${pf}/targets`, { cycleId: ids.cycle, employeeId: ids.emp_bde, kpis })).status, 404);
    const matrix = await call('hrLead', 'GET', `${pf}/company-matrix/${ids.cycle}`);
    assert.deepEqual(idsOf(matrix.body.matrix, (x) => x.review.employeeId._id), [ids.emp_grantee]);
    assert.equal((await call('hrLead', 'POST', `${pf}/review/manager/${ids.review_bde}`, { managerRating: 4, managerFeedback: 'x' })).status, 404);
    assert.equal((await call('hrLead', 'POST', `${pf}/cycles`, { title: 'X' })).status, 404); // not grantable
    assert.equal((await call('hrLead', 'POST', `${pf}/sync-actual/${ids.cycle}`)).status, 404);
  });

  test('direct API: the grantee’s portal token is refused by every Admin HR API', async () => {
    for (const [m, u] of [['GET', '/employees'], ['GET', '/employees/admin/leave-requests'], ['GET', '/corrections'],
      ['GET', '/employees/admin/bank-change-requests'], ['GET', `/performance/company-matrix/${ids.cycle}`], ['GET', '/performance/cycles']]) {
      assert.equal((await call('hrLead', m, u)).status, 403, `${m} ${u}`);
    }
    // the employee's own scorecard routes still serve the portal
    assert.equal((await call('hrLead', 'GET', '/performance/active-cycle')).status, 200);
  });

  test('no grant, no access: plain employees are refused on every HR page', async () => {
    for (const u of [e, `${e}/admin/leave-requests`, `${e}/admin/bank-change-requests`, `${e}/admin/attendance/daily`, `${e}/manager/productivity`,
      '/employee-portal/grants/corrections', '/employee-portal/grants/performance/cycles']) {
      assert.equal((await call('bde', 'GET', u)).status, 403, u);
    }
  });

  test('granting HR pages: only what the granter holds in full', async () => {
    // HR holds leave/attendance/tasks/... but not bankchanges.manage or employees.sensitive
    const r = await call('hr', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, {
      grants: [
        { page: 'leave', actions: ['view', 'edit'], scope: { mode: 'reports' } },
        { page: 'employees', actions: ['view', 'sensitive'], scope: { mode: 'reports' } },
        { page: 'bank-changes', actions: ['view'], scope: { mode: 'reports' } },
      ],
    });
    assert.equal(r.status, 200);
    const byPage = Object.fromEntries(r.body.grants.map((x) => [x.page, x.actions]));
    assert.deepEqual(byPage.leave, ['view', 'edit']);
    assert.deepEqual(byPage.employees, ['view']);
    assert.equal(byPage['bank-changes'], undefined);
    const bad = await call('super', 'PUT', `/employees/${ids.emp_outsider}/access-grants`, { grants: [{ page: 'bank-changes', actions: ['view', 'edit'], scope: { mode: 'all' } }] });
    assert.equal(bad.status, 400); // Edit needs Sensitive ticked too
  });

  test('revoking an HR page blocks it on the next request', async () => {
    assert.equal((await call('hrLead', 'GET', `${e}/admin/leave-requests`)).status, 200);
    const keep = (await call('super', 'GET', `/employees/${ids.emp_hrLead}/access-grants`)).body.grants.filter((x) => x.page !== 'leave');
    assert.equal((await call('super', 'PUT', `/employees/${ids.emp_hrLead}/access-grants`, { grants: keep })).status, 200);
    assert.equal((await call('hrLead', 'GET', `${e}/admin/leave-requests`)).status, 403);
    assert.equal((await call('hrLead', 'GET', e)).status, 200); // the other pages stay
  });

  test('roles unchanged: HR and Super Admin keep every employee', async () => {
    const all = await call('hr', 'GET', '/employees/admin/leave-requests');
    assert.equal(all.status, 200);
    assert.ok(all.body.leaveRequests.length >= 3);
    assert.ok((await call('super', 'GET', '/employees')).body.employees.length >= 12);
    assert.equal((await call('super', 'GET', `/performance/company-matrix/${ids.cycle}`)).body.matrix.length, 2);
  });
});

describe('Logins', () => {
  const login = (url, email) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });

  test('portal-only employee is refused by the Admin login, admitted by the portal', async () => {
    assert.equal((await login('/auth/login', 'grantee@e2e.test')).status, 403);
    const res = await login('/employee/auth/login', 'grantee@e2e.test');
    assert.equal(res.status, 200);
    const { employee } = await res.json();
    assert.deepEqual(Object.keys(employee.access).sort(), ['agreements', 'invoices', 'payments']);
    assert.deepEqual(employee.access.invoices, { actions: ['view', 'create'], mode: 'clients' });
  });

  test('Super Admin login still works', async () => {
    assert.equal((await login('/auth/login', 'super@e2e.test')).status, 200);
  });
});

describe('Phase 1 — person-wise grants, scoped to clients', () => {
  const crm = '/employee-portal/crm';

  test('invoices: list shows only the granted client', async () => {
    const r = await call('grantee', 'GET', `${crm}/invoices`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.map((i) => String(i.client_ref._id)), [ids.clientA]);
    const asked = await call('grantee', 'GET', `${crm}/invoices?client_ref=${ids.clientB}`);
    assert.equal(asked.body.data.length, 0);
  });

  test('invoices: another client’s record reads as not found, and its id cannot be used to write', async () => {
    assert.equal((await call('grantee', 'GET', `${crm}/invoices/${ids.invB}`)).status, 404);
    assert.equal((await call('grantee', 'GET', `${crm}/invoices/${ids.invA}`)).status, 200);
    const forB = await call('grantee', 'POST', `${crm}/invoices`, { client_ref: ids.clientB, dueDate: '2026-12-31', lineItems: [{ description: 'x', qty: 1, unitPrice: 1, amount: 1 }], totalAmount: 1 });
    assert.equal(forB.status, 403);
  });

  test('invoices: actions outside the grant are refused', async () => {
    assert.equal((await call('grantee', 'PUT', `${crm}/invoices/${ids.invA}`, { notes: 'x' })).status, 403);
    assert.equal((await call('grantee', 'DELETE', `${crm}/invoices/${ids.invA}`)).status, 403);
  });

  test('invoices: creating for the granted client works', async () => {
    const r = await call('grantee', 'POST', `${crm}/invoices`, { client_ref: ids.clientA, dueDate: '2026-12-31', lineItems: [{ description: 'E2E', qty: 1, unitPrice: 10, amount: 10 }], totalAmount: 10 });
    assert.equal(r.status, 201);
  });

  test('pages that were not granted are refused', async () => {
    for (const u of ['/clients', '/projects', '/retainers', '/tickets', '/projects-staff', '/tickets-staff', '/agreement']) {
      assert.equal((await call('grantee', 'GET', crm + u)).status, 403, u);
    }
  });

  test('client picker lists only the granted client', async () => {
    const r = await call('grantee', 'GET', `${crm}/client-options?page=invoices`);
    assert.deepEqual(r.body.data.map((c) => String(c._id)), [ids.clientA]);
    const none = await call('grantee', 'GET', `${crm}/client-options?page=projects`);
    assert.deepEqual(none.body.data, []);
  });

  test('payments: only the granted client’s proofs; approving another client’s is not found', async () => {
    const list = await call('grantee', 'GET', `${crm}/payments`);
    assert.deepEqual(list.body.data.map((p) => String(p._id)), [ids.proofA]);
    assert.equal((await call('grantee', 'PUT', `${crm}/payments/${ids.proofB}/approve`)).status, 404);
    assert.equal((await call('grantee', 'PUT', `${crm}/payments/${ids.proofB}/reject`, { rejectionReason: 'x' })).status, 404);
    assert.equal((await call('grantee', 'PUT', `${crm}/payments/${ids.proofA}/approve`)).status, 200);
  });

  test('agreements: view-only grant lists its client and cannot edit', async () => {
    const list = await call('grantee', 'GET', `${crm}/agreements`);
    assert.deepEqual(list.body.data.map((c) => String(c._id)), [ids.clientA]);
    assert.equal((await call('grantee', 'PUT', `${crm}/agreements/${ids.clientA}`, { agreementDetails: { domain: 'x.com' } })).status, 403);
  });

  test('the grantee’s portal token still cannot use the Admin APIs for the same data', async () => {
    assert.equal((await call('grantee', 'GET', '/admin/invoices')).status, 403);
    assert.equal((await call('grantee', 'GET', '/admin/payments')).status, 403);
  });

  test('full CRM role (cms.manage) still sees every client, unscoped', async () => {
    const r = await call('crmAdmin', 'GET', '/admin/invoices');
    assert.equal(r.status, 200);
    assert.deepEqual(new Set(r.body.data.map((i) => String(i.client_ref._id))), new Set([ids.clientA, ids.clientB]));
    assert.equal((await call('crmAdmin', 'GET', '/admin/payments')).body.data.length, 2);
  });
});

describe('Granting, legacy grants and migration', () => {
  test('a legacy (pre-migration) grant keeps working through the fallback', async () => {
    const r = await call('legacy', 'GET', '/employee-portal/crm/clients');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.map((c) => String(c._id)), [ids.clientA]);
    assert.equal((await call('legacy', 'GET', `/employee-portal/crm/clients/${ids.clientB}`)).status, 404);
  });

  test('only someone holding a grantable page can manage grants', async () => {
    // HR may hand out exactly the HR pages its role holds (not bank changes: no bankchanges.manage)
    const hr = await call('hr', 'GET', `/employees/${ids.emp_grantee}/access-grants`);
    assert.deepEqual(hr.body.pages.filter((x) => x.grantable).map((x) => x.key),
      ['payroll', 'employees', 'leave', 'attendance', 'corrections', 'holidays', 'tasks', 'productivity', 'performance']);
    assert.equal((await call('pm', 'GET', `/employees/${ids.emp_grantee}/access-grants`)).status, 403);
    const r = await call('crmAdmin', 'GET', `/employees/${ids.emp_grantee}/access-grants`);
    assert.equal(r.status, 200);
    // cms.manage grants every client page; this role's employees.manage adds the Employees page (View only)
    assert.ok(r.body.pages.every((p) => p.grantable === (p.scope === 'client' || p.key === 'employees')));
    assert.deepEqual(r.body.pages.find((p) => p.key === 'employees').grantableActions, ['view']);
    assert.equal(r.body.grants.length, 3);
  });

  test('pages outside the catalog (role-only) cannot be granted', async () => {
    for (const page of ['roles', 'team', 'settings', 'facebook-integration', 'payroll-settings']) {
      const r = await call('crmAdmin', 'PUT', `/employees/${ids.emp_grantee}/access-grants`, { grants: [{ page, actions: ['view'], scope: { mode: 'all' } }] });
      assert.equal(r.status, 400, page);
    }
  });

  test('the migration converts legacy grants once, with a backup', async (t) => {
    // The backup goes to a throwaway folder, so test runs never leave files in scripts/migrations/backups/
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedhunt-e2e-backups-'));
    t.after(() => fs.rmSync(backupDir, { recursive: true, force: true }));
    const run = (args) => new Promise((resolve, reject) => execFile(process.execPath, ['scripts/migrations/migrateCrmGrants.js', ...args], {
      cwd: SERVER_DIR, env: { ...process.env, MONGODB_URI: mongo.getUri('vedhunt_e2e'), MIGRATION_BACKUP_DIR: backupDir }, // never server/.env's database
    }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
    assert.match(await run([]), /1 login\(s\) to migrate/);
    assert.match(await run(['--apply']), /Migrated 1 login\(s\)/);
    assert.match(await run(['--apply']), /Nothing to migrate/);
    const backups = fs.readdirSync(backupDir);
    assert.equal(backups.length, 1, 'exactly one backup was written, in the temporary folder');
    assert.equal(JSON.parse(fs.readFileSync(path.join(backupDir, backups[0]), 'utf8'))[0].email, 'legacy@e2e.test');
    const doc = await mongoose.connection.db.collection('admins').findOne({ email: 'legacy@e2e.test' });
    assert.equal(doc.accessGrants[0].scope.mode, 'clients');
    assert.equal(String(doc.accessGrants[0].scope.clients[0]), ids.clientA);
    const r = await call('legacy', 'GET', '/employee-portal/crm/clients');
    assert.deepEqual(r.body.data.map((c) => String(c._id)), [ids.clientA]);
  });

  test('revoking removes access at once, and old legacy data cannot bring it back', async () => {
    const r = await call('crmAdmin', 'PUT', `/employees/${ids.emp_legacy}/access-grants`, { grants: [] });
    assert.equal(r.status, 200);
    assert.equal((await call('legacy', 'GET', '/employee-portal/crm/clients')).status, 403);
    const doc = await mongoose.connection.db.collection('admins').findOne({ email: 'legacy@e2e.test' });
    assert.deepEqual(doc.accessGrants, []);
    assert.equal(doc.crmGrants, undefined);
  });

  test('every grant change is audited', async () => {
    const n = await mongoose.connection.db.collection('auditlogs').countDocuments({ action: 'ACCESS_GRANTS_UPDATE' });
    assert.ok(n >= 1);
  });
});

describe('Loophole fixes — password vault, account takeover, Super Admin lockout', () => {
  const db = () => mongoose.connection.db;
  const empDoc = (key) => db().collection('employees').findOne({ _id: new mongoose.Types.ObjectId(ids[`emp_${key}`]) });

  before(async () => {
    // Fixture employees need the identity fields the model requires on save
    const { encrypt } = require('../../utils/encryption');
    await db().collection('employees').updateMany({ panNumber: { $exists: false } }, { $set: { panNumber: encrypt('ABCDE1234F'), aadhaarNumber: encrypt('234567890123') } });
    // A password the person chose (login no longer temporary) and a real temporary one
    await db().collection('employees').updateOne({ _id: new mongoose.Types.ObjectId(ids.emp_outsider) }, { $set: { tempPassword: 'ChosenByOutsider1' } });
    await db().collection('employees').updateOne({ _id: new mongoose.Types.ObjectId(ids.emp_legacy) }, { $set: { tempPassword: 'IssuedTemp99' } });
    await db().collection('admins').updateOne({ _id: new mongoose.Types.ObjectId(ids.legacy) }, { $set: { isTemporaryPassword: true } });
  });

  test('vault: a chosen password is never sent; a temporary one only to employees.manage', async () => {
    const all = (await call('hr', 'GET', '/employees')).body.employees;
    const byId = (k) => all.find((x) => String(x._id) === ids[`emp_${k}`]);
    assert.equal('tempPassword' in byId('outsider'), false);
    assert.equal(byId('legacy').tempPassword, 'IssuedTemp99');
    // a granted Employees page (View) never sees it, even for a still-temporary password
    const granted = (await call('hrLead', 'GET', '/employee-portal/grants/employees')).body.employees;
    assert.ok(granted.length > 0 && granted.every((x) => !('tempPassword' in x)));
  });

  test('vault: changing your own password in the Admin panel clears it instead of storing it', async () => {
    await db().collection('employees').updateOne({ _id: new mongoose.Types.ObjectId(ids.emp_pm) }, { $set: { tempPassword: 'old' } });
    const r = await call('pm', 'PUT', '/auth/password', { currentPassword: PASSWORD, newPassword: 'MyOwnSecret77' });
    assert.equal(r.status, 200);
    assert.equal((await empDoc('pm')).tempPassword, undefined);
  });

  test('takeover: HR cannot reset, deactivate, re-email or delete an account with access HR lacks', async () => {
    // PM holds leads.assign (Admin panel) — HR doesn't
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_pm}`, { password: 'Hijack123' })).status, 403);
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_pm}`, { isActive: false })).status, 403);
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_pm}`, { email: 'attacker@e2e.test' })).status, 403);
    assert.equal((await call('hr', 'DELETE', `/employees/${ids.emp_pm}`)).status, 403);
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_pm}/probation`, { action: 'terminate' })).status, 403);
    // an account with page grants HR can't give (CRM) is protected too
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_grantee}`, { password: 'Hijack123' })).status, 403);
    // profile fields are still editable
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_pm}`, { designation: 'Senior PM' })).status, 200);
  });

  test('takeover: HR still manages ordinary employees, but never switches off its own login', async () => {
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_bde}`, { password: 'NewTemp456' })).status, 200);
    assert.equal((await call('hr', 'PUT', `/employees/${ids.emp_hr}`, { isActive: false })).status, 400);
    assert.equal((await call('super', 'PUT', `/employees/${ids.emp_pm}`, { password: 'SuperReset9' })).status, 200);
  });

  test('lockout: Team Management cannot touch a Super Admin or switch itself off', async () => {
    assert.equal((await call('teamAdmin', 'PUT', `/team/${ids.super}`, { isActive: false })).status, 403);
    assert.equal((await call('teamAdmin', 'DELETE', `/team/${ids.super}`)).status, 403);
    assert.equal((await call('teamAdmin', 'PUT', `/team/${ids.editor}`, { isActive: false })).status, 403); // EDITOR holds portfolio.manage
    assert.equal((await call('teamAdmin', 'PUT', `/team/${ids.teamAdmin}`, { isActive: false })).status, 400);
    assert.equal((await call('teamAdmin', 'PUT', `/team/${ids.plainAdmin}`, { isActive: false })).status, 200);
    const sup = await db().collection('admins').findOne({ _id: new mongoose.Types.ObjectId(ids.super) });
    assert.equal(sup.isActive, true);
  });

  test('cleanup script: erases chosen passwords only, then forces those people to pick a new one', async () => {
    const run = (args) => new Promise((resolve, reject) => execFile(process.execPath, ['scripts/migrations/clearPasswordVault.js', ...args], {
      cwd: SERVER_DIR, env: { ...process.env, MONGODB_URI: mongo.getUri('vedhunt_e2e') }, // never server/.env's database
    }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
    assert.match(await run([]), /chosen by the person \(to erase\)/);
    await run(['--apply']);
    assert.equal((await empDoc('outsider')).tempPassword, undefined);
    assert.equal((await empDoc('legacy')).tempPassword, 'IssuedTemp99'); // still temporary → kept
    await run(['--force-reset']);
    const outsider = await db().collection('admins').findOne({ _id: new mongoose.Types.ObjectId(ids.outsider) });
    assert.equal(outsider.isTemporaryPassword, true);
  });
});

// payViewer is a plain BDE outside the team lead's team: the second BD here.
describe('Cross-assignment and lead notes — enforced by the server', () => {
  const ess = '/employee-portal/ess/leads';
  const g = '/employee-portal/grants';
  const helper = 'payViewer';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadDoc = () => mongoose.connection.db.collection('leads').findOne({ _id: oidOf(ids.collabLead) });
  const hasLead = (r) => (r.body.leads || []).some((l) => String(l._id) === ids.collabLead);

  before(async () => {
    // The temp-password test above forces a reset on portal logins
    await mongoose.connection.db.collection('admins').updateMany(
      { _id: { $in: ['bde', helper, 'teamLead', 'pm'].map((k) => oidOf(ids[k])) } },
      { $set: { isTemporaryPassword: false } }
    );
    ids.collabLead =String((await mongoose.connection.db.collection('leads').insertOne({
      fullName: 'CollabLead', phone: '9833333333', email: 'collab@lead.test', status: 'Contacted', leadType: 'Sales',
      assignedTo: oidOf(ids.bde), createdAt: new Date(), updatedAt: new Date(), documents: [], pipelineHistory: [],
    })).insertedId);
  });

  test('before sharing, another BD cannot see, read notes on or change the lead', async () => {
    assert.equal((await call(helper, 'GET', `${ess}/${ids.collabLead}`)).status, 404);
    assert.equal((await call(helper, 'GET', `${ess}/${ids.collabLead}/notes`)).status, 404);
    assert.equal((await call(helper, 'POST', `${ess}/${ids.collabLead}/notes`, { text: 'x' })).status, 404);
    assert.equal((await call(helper, 'PUT', `${ess}/${ids.collabLead}`, { remark: 'x' })).status, 404);
    const list = await call(helper, 'GET', '/employee-portal/ess/leads');
    assert.equal(list.status, 200);
    assert.equal(hasLead(list), false);
  });

  test('only assigners can cross-assign, and only to people in their scope', async () => {
    assert.equal((await call('bde', 'POST', `/leads/${ids.collabLead}/share`, { adminId: ids[helper] })).status, 403);
    assert.equal((await call(helper, 'POST', `${g}/leads/${ids.collabLead}/share`, { adminId: ids[helper] })).status, 403);
    // the team lead assigns within the team (bde, teamLead) only
    assert.equal((await call('teamLead', 'POST', `${g}/leads/${ids.collabLead}/share`, { adminId: ids[helper] })).status, 403);
    assert.equal((await call('super', 'POST', `/leads/${ids.collabLead}/share`, { adminId: ids.bde })).status, 400); // already the owner
  });

  test('Super Admin cross-assigns; the owner is kept and the grant is audited', async () => {
    const r = await call('super', 'POST', `/leads/${ids.collabLead}/share`, { adminId: ids[helper], reason: 'Needs a second caller' });
    assert.equal(r.status, 201);
    assert.equal((await call('super', 'POST', `/leads/${ids.collabLead}/share`, { adminId: ids[helper] })).status, 409);

    const lead = await leadDoc();
    assert.equal(String(lead.assignedTo), ids.bde);
    assert.deepEqual(lead.sharedWith.map((s) => String(s.admin)), [ids[helper]]);
    assert.equal(String(lead.sharedWith[0].grantedBy), ids.super);

    const history = await call('super', 'GET', `/leads/${ids.collabLead}/assignment-history`);
    const log = history.body.data.find((h) => h.mode === 'Cross-Assign');
    assert.equal(String(log.toAdmin._id), ids[helper]);
    assert.equal(String(log.assignedBy._id), ids.super);
    assert.equal(log.reason, 'Needs a second caller');
    assert.ok(log.createdAt);
    const entry = lead.pipelineHistory.find((h) => h.status.startsWith('Cross-assigned to'));
    assert.equal(String(entry.updatedBy), ids.super);

    const detail = await call('super', 'GET', `/leads/${ids.collabLead}`);
    assert.deepEqual(detail.body.data.sharedWith.map((s) => String(s.admin._id)), [ids[helper]]);
  });

  test('the shared BD can now list, open, search and work the lead', async () => {
    const list = await call(helper, 'GET', '/employee-portal/ess/leads');
    assert.equal(list.body.leads.find((l) => String(l._id) === ids.collabLead).isShared, true);
    const ownerList = await call('bde', 'GET', '/employee-portal/ess/leads');
    assert.equal(ownerList.body.leads.find((l) => String(l._id) === ids.collabLead).isShared, false);

    const open = await call(helper, 'GET', `${ess}/${ids.collabLead}`);
    assert.equal(open.status, 200);
    assert.equal(open.body.lead.isOwner, false);
    const search = await call(helper, 'GET', '/employee-portal/ess/leads/search?q=CollabLead');
    assert.equal(search.body.results[0].isMine, true);
    assert.equal(search.body.results[0].phone, '9833333333'); // not masked

    // The lead-level remark is retired: a stale tab sending one is ignored, and a note is what the shared BD writes now
    assert.equal((await call(helper, 'PUT', `${ess}/${ids.collabLead}`, { remark: 'Spoke to the owner' })).status, 200);
    const afterRemark = await leadDoc();
    assert.equal(afterRemark.remark, undefined, 'a remark is never written on the lead');
    assert.ok(!afterRemark.pipelineHistory.some((h) => h.status === 'Remark updated'));

    const note = await call(helper, 'POST', `${ess}/${ids.collabLead}/notes`, { text: 'Spoke to the owner' });
    assert.equal(note.status, 201, JSON.stringify(note.body));
    const entry = (await leadDoc()).pipelineHistory.find((h) => h.status === 'Note added');
    assert.equal(String(entry.updatedBy), ids[helper]);
    assert.equal(entry.note, 'Spoke to the owner');
    // later tests count this lead's notes exactly
    await require('../../models/LeadNote').deleteMany({ lead: ids.collabLead, text: 'Spoke to the owner' });
    await mongoose.connection.db.collection('leads').updateOne(
      { _id: new mongoose.Types.ObjectId(ids.collabLead) },
      { $pull: { pipelineHistory: { status: 'Note added', note: 'Spoke to the owner' } } }
    );
  });

  test('the shared BD still cannot reassign or delete the lead', async () => {
    assert.equal((await call(helper, 'POST', `${g}/leads/${ids.collabLead}/assign`, { assignedTo: ids[helper] })).status, 403);
    assert.equal((await call(helper, 'DELETE', `${g}/leads/${ids.collabLead}`)).status, 403);
    assert.equal(String((await leadDoc()).assignedTo), ids.bde);
  });

  test('private notes: author and all-leads admins only; shared notes: everyone with access', async () => {
    const add = (who, text, visibility) => call(who, 'POST', `${ess}/${ids.collabLead}/notes`, { text, visibility });
    assert.equal((await add('bde', 'OWNER-PRIVATE', 'private')).status, 201);
    assert.equal((await add(helper, 'HELPER-PRIVATE', 'private')).status, 201);
    assert.equal((await add(helper, 'HELPER-SHARED', 'shared')).status, 201);
    assert.equal((await add(helper, '   ', 'shared')).status, 400);

    const texts = async (who, url = `${ess}/${ids.collabLead}/notes`) => {
      const r = await call(who, 'GET', url);
      assert.equal(r.status, 200, `${who} ${url}`);
      return (r.body.notes || r.body.data).map((n) => n.text).sort();
    };
    assert.deepEqual(await texts('bde'), ['HELPER-SHARED', 'OWNER-PRIVATE']);
    assert.deepEqual(await texts(helper), ['HELPER-PRIVATE', 'HELPER-SHARED']);
    assert.deepEqual(await texts('super', `/leads/${ids.collabLead}/notes`), ['HELPER-PRIVATE', 'HELPER-SHARED', 'OWNER-PRIVATE']);
    // team scope is not all-leads: shared notes only
    assert.deepEqual(await texts('teamLead', `${g}/leads/${ids.collabLead}/notes`), ['HELPER-SHARED']);

    // No lead response carries note text, so private notes can't leak sideways
    for (const [who, url] of [['bde', `${ess}/${ids.collabLead}`], [helper, `${ess}/${ids.collabLead}`], ['teamLead', `${g}/leads/${ids.collabLead}`], ['teamLead', `${g}/leads`]]) {
      const body = JSON.stringify((await call(who, 'GET', url)).body);
      assert.ok(!body.includes('PRIVATE'), `${who} saw a private note via ${url}`);
    }

    // Every note records author + time; only shared notes reach the timeline
    const LeadNote = require('../../models/LeadNote');
    const notes = await LeadNote.find({ lead: ids.collabLead }).lean();
    assert.equal(notes.length, 3);
    for (const n of notes) { assert.ok(n.author); assert.ok(n.createdAt); }
    const timeline = (await leadDoc()).pipelineHistory.filter((h) => h.status === 'Note added');
    assert.equal(timeline.length, 1);
    assert.equal(String(timeline[0].updatedBy), ids[helper]);
  });

  test('removing the cross-assignment cuts access on the next request and is audited', async () => {
    assert.equal((await call('super', 'DELETE', `/leads/${ids.collabLead}/share/${ids[helper]}`)).status, 200);
    assert.equal((await call('super', 'DELETE', `/leads/${ids.collabLead}/share/${ids[helper]}`)).status, 404);
    assert.equal((await call(helper, 'GET', `${ess}/${ids.collabLead}`)).status, 404);
    assert.equal((await call(helper, 'GET', `${ess}/${ids.collabLead}/notes`)).status, 404);
    assert.equal(hasLead(await call(helper, 'GET', '/employee-portal/ess/leads')), false);

    const history = await call('super', 'GET', `/leads/${ids.collabLead}/assignment-history`);
    const log = history.body.data.find((h) => h.mode === 'Cross-Unassign');
    assert.equal(String(log.fromAdmin._id), ids[helper]);
    assert.equal(String(log.assignedBy._id), ids.super);
    assert.equal(String((await leadDoc()).assignedTo), ids.bde);
  });

  test('reassigning to a BD the lead was shared with makes them owner and drops the share', async () => {
    assert.equal((await call('super', 'POST', `/leads/${ids.collabLead}/share`, { adminId: ids.pm })).status, 201);
    assert.equal((await call('super', 'POST', `/leads/${ids.collabLead}/assign`, { assignedTo: ids.pm })).status, 200);
    const lead = await leadDoc();
    assert.equal(String(lead.assignedTo), ids.pm);
    assert.deepEqual(lead.sharedWith, []);
  });
});

describe('Bulk reassignment by filter — acceptance: Owner = Priya, Stage = Qualified → Jyoti', () => {
  const g = '/employee-portal/grants';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const qualified = [];
  const contacted = [];
  let lockedId;

  before(async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const bdeRole = await Role.findOne({ name: 'BDE' });
    for (const key of ['priya', 'jyoti']) {
      const a = await Admin.create({ firstName: key === 'priya' ? 'Priya' : 'Jyoti', lastName: 'BD', email: `${key}@e2e.test`, password: PASSWORD, roles: [bdeRole._id] });
      ids[key] = String(a._id);
    }
    const make = async (n, status, owner) => {
      const now = new Date();
      return String((await leadsCol().insertOne({
        leadId: `VH-BULK-${status}-${n}`, fullName: `Bulk ${status} ${n}`, phone: `97000${String(n).padStart(5, '0')}`, email: `bulk${status}${n}@lead.test`,
        status, leadType: 'Sales', interestLevel: 'Warm', leadScore: 40 + n, remark: `Priya remark ${n}`,
        assignedTo: oidOf(ids[owner]), assignedAt: now, createdAt: now, updatedAt: now, documents: [],
        callLogs: [{ touchNumber: 1, calledBy: oidOf(ids[owner]), callDate: now, connected: 'Yes', remark: `call ${n}` }],
        pipelineHistory: [{ status: 'Qualified', date: now, updatedBy: oidOf(ids[owner]), note: `qualified ${n}` }],
      })).insertedId);
    };
    for (let n = 1; n <= 24; n++) qualified.push(await make(n, 'Qualified', 'priya'));
    for (let n = 1; n <= 4; n++) contacted.push(await make(n, 'Contacted', 'priya'));
    ids.jyotiOwn = await make(99, 'Qualified', 'jyoti');
    // Open in someone else's workspace right now, so it can't be moved
    lockedId = qualified[23];
    await leadsCol().updateOne({ _id: oidOf(lockedId) }, { $set: { lockedBy: oidOf(ids.pm), lockedAt: new Date() } });
    // Priya's private note on every qualified lead
    const LeadNote = require('../../models/LeadNote');
    await LeadNote.insertMany(qualified.map((lead) => ({ lead, author: ids.priya, text: 'PRIYA-PRIVATE', visibility: 'private' })));
  });

  test('the filter reports 24 matches across pages; "select all matching" returns exactly those 24', async () => {
    const page = await call('super', 'GET', `/leads?assignedTo=${ids.priya}&status=Qualified&limit=10`);
    assert.equal(page.body.totalLeads, 24);
    assert.equal(page.body.totalPages, 3);
    assert.equal(page.body.data.length, 10);
    const all = await call('super', 'GET', `/leads?assignedTo=${ids.priya}&status=Qualified&idsOnly=true`);
    assert.deepEqual([...all.body.ids].sort(), [...qualified].sort());
  });

  test('new filters combine: interest level and follow-up due date', async () => {
    await leadsCol().updateOne({ _id: oidOf(qualified[0]) }, { $set: { interestLevel: 'Hot Lead', nextFollowUpDate: new Date('2026-11-05T10:00:00Z') } });
    const hot = await call('super', 'GET', `/leads?assignedTo=${ids.priya}&status=Qualified&interestLevel=Hot%20Lead&idsOnly=true`);
    assert.deepEqual(hot.body.ids, [qualified[0]]);
    const due = await call('super', 'GET', `/leads?assignedTo=${ids.priya}&followUpFrom=2026-11-05&followUpTo=2026-11-05&idsOnly=true`);
    assert.deepEqual(due.body.ids, [qualified[0]]);
  });

  test('preview: source, destination, count, and the record that cannot move', async () => {
    const r = await call('super', 'POST', '/leads/bulk-assign/preview', { leadIds: qualified, assignedTo: ids.jyoti, expectedOwner: ids.priya });
    assert.equal(r.status, 200);
    const p = r.body.data;
    assert.equal(p.requested, 24);
    assert.equal(p.eligible, 23);
    assert.deepEqual(p.sources.map((s) => [s.name, s.count]), [['Priya BD', 23]]);
    assert.equal(p.target.name, 'Jyoti BD');
    assert.equal(p.ineligible.length, 1);
    assert.equal(p.ineligible[0]._id, lockedId);
    assert.match(p.ineligible[0].reason, /locked/i);
    // preview changes nothing
    assert.equal(await leadsCol().countDocuments({ assignedTo: oidOf(ids.jyoti) }), 1);
  });

  test('preview refuses non-matching and out-of-scope leads instead of moving them', async () => {
    const r = await call('super', 'POST', '/leads/bulk-assign/preview', { leadIds: [qualified[0], ids.jyotiOwn, 'nope'], assignedTo: ids.jyoti, expectedOwner: ids.priya });
    const why = Object.fromEntries(r.body.data.ineligible.map((x) => [x._id, x.reason]));
    assert.match(why[ids.jyotiOwn], /owner changed/i);
    assert.match(why.nope, /not found/i);
    // team lead: Jyoti isn't in their team; Priya's leads are outside it
    assert.equal((await call('teamLead', 'POST', `${g}/leads/bulk-assign/preview`, { leadIds: qualified, assignedTo: ids.jyoti })).status, 403);
    const scoped = await call('teamLead', 'POST', `${g}/leads/bulk-assign/preview`, { leadIds: [qualified[0], ids.leadBde], assignedTo: ids.teamLead });
    assert.equal(scoped.status, 200);
    assert.match(scoped.body.data.ineligible.find((x) => x._id === qualified[0]).reason, /outside/i);
    // no assign rights, no preview; no destination, no preview
    assert.equal((await call('bde', 'POST', '/leads/bulk-assign/preview', { leadIds: qualified, assignedTo: ids.jyoti })).status, 403);
    assert.equal((await call('super', 'POST', '/leads/bulk-assign/preview', { leadIds: qualified })).status, 400);
  });

  test('confirm: eligible leads move to Jyoti, the locked one is reported, and it does not claim full success', async () => {
    const r = await call('super', 'POST', '/leads/bulk-assign', {
      leadIds: qualified, assignedTo: ids.jyoti, expectedOwner: ids.priya, selection: 'all-matching',
      reason: 'Priya on leave', filters: { chips: ['BD: Priya BD', 'Status: Qualified'] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, false);
    assert.equal(r.body.partial, true);
    assert.equal(r.body.requested, 24);
    assert.equal(r.body.assigned, 23);
    assert.equal(r.body.failed, 1);
    assert.equal(String(r.body.failures[0].lead), lockedId);
    assert.match(r.body.failures[0].reason, /locked/i);
    ids.bulkRun = String(r.body.runId);

    const moved = await leadsCol().find({ _id: { $in: qualified.map(oidOf) } }).toArray();
    for (const lead of moved) {
      const expected = String(lead._id) === lockedId ? ids.priya : ids.jyoti;
      assert.equal(String(lead.assignedTo), expected, lead.leadId);
    }
    // unselected Priya leads (other stage) untouched
    for (const id of contacted) assert.equal(String((await leadsCol().findOne({ _id: oidOf(id) })).assignedTo), ids.priya);
  });

  test('moved leads keep stage, score, remark, call logs and history; Priya notes stay visible to Admin', async () => {
    const lead = await leadsCol().findOne({ _id: oidOf(qualified[4]) });
    assert.equal(lead.status, 'Qualified');
    assert.equal(lead.leadScore, 45);
    assert.equal(lead.remark, 'Priya remark 5');
    assert.equal(lead.callLogs.length, 1);
    assert.equal(String(lead.callLogs[0].calledBy), ids.priya);
    assert.equal(lead.pipelineHistory[0].note, 'qualified 5');

    const notes = await call('super', 'GET', `/leads/${qualified[4]}/notes`);
    assert.deepEqual(notes.body.data.map((n) => [n.text, n.author.name]), [['PRIYA-PRIVATE', 'Priya BD']]);
  });

  test('one assignment-log entry per changed lead, linked to the run, visible to Admin', async () => {
    const AssignmentLog = require('../../models/AssignmentLog');
    const logs = await AssignmentLog.find({ bulkRun: ids.bulkRun }).lean();
    assert.equal(logs.length, 23);
    for (const l of logs) {
      assert.equal(String(l.fromAdmin), ids.priya);
      assert.equal(String(l.toAdmin), ids.jyoti);
      assert.equal(String(l.assignedBy), ids.super);
      assert.equal(l.reason, 'Priya on leave');
    }
    const history = await call('super', 'GET', `/leads/${qualified[4]}/assignment-history`);
    assert.equal(history.body.data[0].fromAdmin.firstName, 'Priya');
    assert.equal(history.body.data[0].toAdmin.firstName, 'Jyoti');
  });

  test('the run records who, when, previous owners, affected leads and failures', async () => {
    const r = await call('super', 'GET', `/leads/bulk-assign/runs/${ids.bulkRun}`);
    assert.equal(r.status, 200);
    const run = r.body.data;
    assert.equal(run.initiatedBy.firstName, 'super');
    assert.equal(run.toAdmin.firstName, 'Jyoti');
    assert.equal(run.expectedOwner.firstName, 'Priya');
    assert.equal(run.selection, 'all-matching');
    assert.deepEqual(run.filters.chips, ['BD: Priya BD', 'Status: Qualified']);
    assert.equal(run.status, 'partial');
    assert.equal(run.requested, 24);
    assert.equal(run.succeeded.length, 23);
    assert.ok(run.succeeded.every((s) => s.fromAdmin.firstName === 'Priya'));
    assert.equal(run.failed.length, 1);
    assert.ok(run.createdAt && run.finishedAt);

    const list = await call('super', 'GET', '/leads/bulk-assign/runs');
    const row = list.body.data.find((x) => String(x._id) === ids.bulkRun);
    assert.equal(row.succeededCount, 23);
    assert.equal(row.failedCount, 1);
    // a scoped assigner sees only the runs they started
    const theirs = await call('teamLead', 'GET', `${g}/leads/bulk-assign/runs`);
    assert.equal(theirs.status, 200);
    assert.ok(!theirs.body.data.some((x) => String(x._id) === ids.bulkRun));
    assert.equal((await call('teamLead', 'GET', `${g}/leads/bulk-assign/runs/${ids.bulkRun}`)).status, 404);
  });

  test('running it again moves nothing twice: already-moved leads are reported, not reassigned', async () => {
    await leadsCol().updateOne({ _id: oidOf(lockedId) }, { $set: { lockedBy: null, lockedAt: null } });
    const r = await call('super', 'POST', '/leads/bulk-assign', { leadIds: qualified, assignedTo: ids.jyoti });
    assert.equal(r.body.assigned, 1); // the formerly locked one
    assert.equal(r.body.failed, 23);
    assert.ok(r.body.failures.every((f) => /already owned/i.test(f.reason)));
    const AssignmentLog = require('../../models/AssignmentLog');
    assert.equal(await AssignmentLog.countDocuments({ lead: oidOf(qualified[4]) }), 1);
  });
});

describe('Raw / Working / Dropped & Hold — action-taken rules', () => {
  const ess = '/employee-portal/ess/leads';
  const g = '/employee-portal/grants';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const L = {};
  const listIds = async (who, url) => {
    const r = await call(who, 'GET', url);
    assert.equal(r.status, 200, url);
    return (r.body.data || []).map((l) => String(l._id));
  };
  const page = (group, who = 'super', base = '') => listIds(who, `${base}/leads?stageGroup=${group}&leadType=All&search=RAWT&limit=100`);
  const essRow = async (who, id) => (await call(who, 'GET', '/employee-portal/ess/leads')).body.leads.find((l) => String(l._id) === id);
  const doc = (key) => leadsCol().findOne({ _id: oidOf(L[key]) });
  const later = new Date(Date.now() + 3 * 864e5).toISOString();

  before(async () => {
    const make = async (key, fields) => {
      const now = new Date();
      L[key] = String((await leadsCol().insertOne({
        fullName: `RAWT ${key}`, phone: '9844444444', email: `rawt-${key}@lead.test`, status: 'New', leadType: 'Sales',
        platform: 'Facebook', createdAt: now, updatedAt: now, documents: [],
        pipelineHistory: [{ status: 'New', date: now, note: 'Lead captured' }],
        assignedTo: oidOf(ids.bde), assignedAt: now, ...fields,
      })).insertedId);
    };
    const yes = { touchNumber: 1, calledBy: oidOf(ids.bde), callDate: new Date(), connected: 'Yes' };
    const no = { touchNumber: 1, calledBy: oidOf(ids.bde), callDate: new Date(), connected: 'No', notConnectedReason: 'Ringing / No Answer' };
    await make('fresh', {});
    await make('unassigned', { assignedTo: null, assignedAt: null });
    await make('notConnected', { connected: 'No', callLogs: [no] });
    await make('contactedNoConnect', { status: 'Contacted' });
    await make('whatsappOnly', { pipelineHistory: [{ status: 'New' }, { status: 'WhatsApp initiated', updatedBy: oidOf(ids.bde) }] });
    await make('connectedYes', { status: 'Contacted', connected: 'Yes', interestLevel: 'Cold', callLogs: [yes] });
    await make('connectedThenNo', { connected: 'No', callLogs: [yes, { ...no, touchNumber: 2 }] });
    await make('legacyConnected', { pipelineHistory: [{ status: 'New' }, { status: 'Call connected' }] });
    await make('qualified', { status: 'Qualified' });
    await make('won', { status: 'Won', connected: 'Yes', callLogs: [yes] });
    await make('lost', { status: 'Lost', notConvertedReason: 'Budget Constraint' });
    await make('dropped', { status: 'Dropped', notConvertedReason: 'Budget Constraint', callLogs: [yes] });
    await make('hold', { status: 'Hold', holdReason: 'Budget next quarter', holdUntil: new Date(later) });
    await make('website', { platform: 'Website', userSource: 'Website' });
    await make('manualOld', { platform: 'Manual' });
    await leadsCol().updateOne({ _id: oidOf(L.manualOld) }, { $unset: { leadType: '' } });
    await make('otherBd', { assignedTo: oidOf(ids.outsider) });
    await make('otherDropped', { assignedTo: oidOf(ids.outsider), status: 'Dropped', notConvertedReason: 'Budget Constraint' });
    for (const k of ['forUnanswered', 'forConnect', 'forHold', 'forOpen']) await make(k, {});
    // portal BDs work again after the temp-password test
    await mongoose.connection.db.collection('admins').updateMany(
      { _id: { $in: ['bde', 'outsider', 'teamLead'].map((k) => oidOf(ids[k])) } }, { $set: { isTemporaryPassword: false } });
    // a BDE allowed to reactivate Dropped / Lost leads
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const role = await Role.create({ name: 'BDE_REACTIVATE', permissions: ['leads.view', 'ess.access', 'followups.view', 'leads.reactivate'], isEmployeeRole: true });
    ids.reactivator = String((await Admin.create({ firstName: 'Re', lastName: 'Activator', email: 'reactivator@e2e.test', password: PASSWORD, roles: [role._id], employeeId: 'VH-E2E-RA' }))._id);
    await mongoose.connection.db.collection('employees').insertOne({
      employeeId: 'VH-E2E-reactivator', adminId: oidOf(ids.reactivator), firstName: 'Re', lastName: 'Activator',
      email: 'reactivator@e2e.test', phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent',
    });
    await make('reactivateMe', { assignedTo: oidOf(ids.reactivator), status: 'Dropped', notConvertedReason: 'Budget Constraint', callLogs: [{ ...yes, calledBy: oidOf(ids.reactivator) }] });
    await make('wonOfReactivator', { assignedTo: oidOf(ids.reactivator), status: 'Won', callLogs: [yes] });
  });

  test('Raw: assigned and no action taken — a bare Contacted status stays here; a call (even unanswered) or WhatsApp takes it out', async () => {
    const raw = await page('raw');
    for (const k of ['fresh', 'contactedNoConnect', 'website', 'manualOld', 'otherBd']) assert.ok(raw.includes(L[k]), `${k} should be raw`);
    for (const k of ['unassigned', 'notConnected', 'whatsappOnly', 'connectedYes', 'connectedThenNo', 'legacyConnected', 'qualified', 'won', 'lost', 'dropped', 'hold']) assert.ok(!raw.includes(L[k]), `${k} should not be raw`);
  });

  test('Working: an action has been taken and still open — Won, Lost, Dropped and Hold leave it', async () => {
    const working = await page('working');
    for (const k of ['notConnected', 'whatsappOnly', 'connectedYes', 'connectedThenNo', 'legacyConnected', 'qualified']) assert.ok(working.includes(L[k]), `${k} should be working`);
    for (const k of ['fresh', 'contactedNoConnect', 'won', 'lost', 'dropped', 'hold', 'unassigned']) assert.ok(!working.includes(L[k]), `${k} should not be working`);
    const raw = await page('raw');
    assert.equal(raw.filter((id) => working.includes(id)).length, 0);
  });

  test('Dropped & Hold page lists exactly those, with owner; Won is kept, just not on these lists', async () => {
    const dh = await page('dropped-hold');
    for (const k of ['dropped', 'hold', 'otherDropped']) assert.ok(dh.includes(L[k]), `${k} should be dropped/hold`);
    for (const k of ['won', 'lost', 'fresh', 'connectedYes']) assert.ok(!dh.includes(L[k]), `${k} should not be dropped/hold`);
    assert.deepEqual(await listIds('super', `/leads?stageGroup=dropped-hold&status=Hold&leadType=All&search=RAWT`), [L.hold]);
    const row = (await call('super', 'GET', '/leads?stageGroup=dropped-hold&leadType=All&search=RAWT%20dropped')).body.data[0];
    assert.equal(row.assignedTo.firstName, 'bde');
    // Won lead still exists with its history (Lead Manager)
    assert.ok((await listIds('super', '/leads?leadType=All&search=RAWT%20won')).includes(L.won));
  });

  test('scoping: BD sees own + shared only; team grant sees the team; the API enforces it', async () => {
    assert.equal((await essRow('bde', L.fresh)).isRaw, true);
    assert.equal((await essRow('bde', L.notConnected)).isRaw, false);
    assert.equal((await essRow('bde', L.connectedYes)).isRaw, false);
    assert.equal(await essRow('bde', L.otherDropped), undefined);
    assert.equal((await essRow('outsider', L.otherDropped)).status, 'Dropped');
    assert.equal((await call('super', 'POST', `/leads/${L.otherBd}/share`, { adminId: ids.bde })).status, 201);
    assert.equal((await essRow('bde', L.otherBd)).isRaw, true);
    const teamDh = await page('dropped-hold', 'teamLead', g);
    assert.ok(teamDh.includes(L.dropped));
    assert.ok(!teamDh.includes(L.otherDropped));
  });

  test('Sales stays the default for older leads without a type', async () => {
    assert.ok((await listIds('super', '/leads?stageGroup=raw&leadType=Sales&search=RAWT&limit=100')).includes(L.manualOld));
    assert.ok(!(await listIds('super', '/leads?stageGroup=raw&leadType=Hiring&search=RAWT&limit=100')).includes(L.manualOld));
  });

  test('opening or locking is not activity', async () => {
    assert.equal((await call('bde', 'GET', `${ess}/${L.forOpen}`)).status, 200);
    assert.equal((await call('super', 'POST', `/leads/${L.forOpen}/lock`)).status, 200);
    const lead = await doc('forOpen');
    assert.equal(lead.lastActivityAt ?? null, null);
    assert.ok((await page('raw')).includes(L.forOpen));
  });

  test('an unanswered call takes the lead out of Raw into Working, with the attempt logged and first contact stamped', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.forUnanswered}`, { connected: 'No', notConnectedReason: 'Ringing / No Answer' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('forUnanswered');
    assert.equal(lead.callLogs.length, 1);
    assert.equal(lead.callLogs[0].notConnectedReason, 'Ringing / No Answer');
    assert.equal(lead.lastActivityType, 'Call logged');
    assert.ok(lead.firstContactAt);
    assert.equal(lead.firstContactType, 'Call logged');
    assert.ok(!(await page('raw')).includes(L.forUnanswered));
    assert.ok((await page('working')).includes(L.forUnanswered));
    assert.equal((await essRow('bde', L.forUnanswered)).isRaw, false);
  });

  test('example: "Connected — requested a strategy discussion" moves it to Working with outcome and timestamp', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.forConnect}`, {
      connected: 'Yes', interestLevel: 'Interested', remark: 'Connected — requested a strategy discussion', nextFollowUpDate: later,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('forConnect');
    assert.equal(lead.connected, 'Yes');
    assert.equal(lead.interestLevel, 'Interested');
    assert.equal(lead.remark, undefined, 'the lead-level remark is no longer written');
    assert.equal(lead.callLogs.at(-1).remark, 'Connected — requested a strategy discussion', 'the call keeps its own text');
    assert.ok(lead.lastActivityAt);
    assert.ok((await page('working')).includes(L.forConnect));
    assert.ok(!(await page('raw')).includes(L.forConnect));
    // sortable by latest activity: the newest action comes first
    const sorted = await listIds('super', '/leads?stageGroup=working&leadType=All&search=RAWT&sortBy=lastActivityAt&sortOrder=desc&limit=100');
    assert.equal(sorted[0], L.forConnect);
    assert.ok((await essRow('bde', L.forConnect)).lastActivityAt);
  });

  test('Hold moves a working lead to Dropped & Hold; reactivating returns it to Working with history kept', async () => {
    assert.equal((await call('bde', 'PUT', `${ess}/${L.forHold}`, { connected: 'Yes', interestLevel: 'Cold' })).status, 200);
    assert.ok((await page('working')).includes(L.forHold));
    const hold = await call('bde', 'PUT', `${ess}/${L.forHold}`, { status: 'Hold', holdReason: 'Budget next quarter', holdUntil: later });
    assert.equal(hold.status, 200, JSON.stringify(hold.body));
    assert.ok((await page('dropped-hold')).includes(L.forHold));
    assert.ok(!(await page('working')).includes(L.forHold));
    const back = await call('bde', 'PUT', `${ess}/${L.forHold}`, { status: 'Contacted' });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.ok((await page('working')).includes(L.forHold));
    const lead = await doc('forHold');
    assert.equal(lead.callLogs.length, 1);
    assert.deepEqual(lead.pipelineHistory.map((h) => h.status).filter((s) => ['Hold', 'Contacted'].includes(s)), ['Hold', 'Contacted']);
  });

  test('a never-connected lead reactivated from Hold returns to Raw', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.hold}`, { status: 'Contacted' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok((await page('raw')).includes(L.hold));
  });

  test('Dropped reactivation needs leads.reactivate (or Super Admin); Won stays Super Admin only', async () => {
    const refused = await call('bde', 'PUT', `${ess}/${L.dropped}`, { status: 'Contacted' });
    assert.equal(refused.status, 403);
    assert.match(refused.body.message, /allowed to reactivate/);
    assert.equal((await doc('dropped')).status, 'Dropped');

    const ok = await call('reactivator', 'PUT', `${ess}/${L.reactivateMe}`, { status: 'Contacted' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const lead = await doc('reactivateMe');
    assert.equal(lead.status, 'Contacted');
    assert.equal(lead.callLogs.length, 1);
    assert.match(lead.pipelineHistory.at(-1).note, /Reactivated \(was Dropped/);
    assert.equal(String(lead.pipelineHistory.at(-1).updatedBy), ids.reactivator);
    assert.ok((await page('working')).includes(L.reactivateMe)); // it had connected before

    const won = await call('reactivator', 'PUT', `${ess}/${L.wonOfReactivator}`, { status: 'Contacted' });
    assert.equal(won.status, 403);
    // and a reactivator still can't edit a closed lead in any other way
    assert.equal((await call('reactivator', 'PUT', `${ess}/${L.reactivateMe}`, { status: 'Dropped', notConvertedReason: 'Budget Constraint' })).status, 200);
    assert.equal((await call('reactivator', 'PUT', `${ess}/${L.reactivateMe}`, { remark: 'edit while dropped' })).status, 403);

    assert.equal((await call('super', 'PUT', `/leads/${L.dropped}`, { status: 'Contacted' })).status, 200);
    assert.ok((await page('working')).includes(L.dropped));
  });
});

describe('Follow-ups — due order, type, row details, filters, scope', () => {
  const ess = '/employee-portal/ess/leads';
  const g = '/employee-portal/grants';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const F = {};
  const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d; };
  const mine = (rows) => rows.filter((r) => Object.values(F).includes(String(r._id)));
  const keyOf = (id) => Object.keys(F).find((k) => F[k] === String(id));
  const list = async (who, qs = '', base = '') => {
    const r = await call(who, 'GET', `${base}/admin/activity/followups?limit=500${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return mine(r.body.data);
  };

  before(async () => {
    const make = async (key, owner, due, fields = {}) => {
      F[key] = String((await leadsCol().insertOne({
        fullName: `FUT ${key}`, businessName: `${key} Pvt Ltd`, phone: '9855555555', email: `fut-${key}@lead.test`,
        status: 'Qualified', leadType: 'Sales', connected: 'Yes', interestLevel: 'Interested',
        assignedTo: oidOf(ids[owner]), nextFollowUpDate: due, createdAt: new Date(), updatedAt: new Date(),
        lastCallAt: at(-2, 10), documents: [], pipelineHistory: [], ...fields,
      })).insertedId);
    };
    await make('pricingToday', 'bde', at(0, 11), { followUpType: 'Pricing Negotiation', nextActionType: 'Call' });
    await make('meetingTomorrow', 'bde', at(1, 10), { followUpType: 'First Meeting', remark: 'Wants a demo first' });
    await make('overduePayment', 'bde', at(-1, 15), { followUpType: 'Payment Follow-up', status: 'Negotiation' });
    await make('tieOlder', 'bde', at(2, 12), { followUpType: 'Onboarding', updatedAt: new Date(Date.now() - 864e5) });
    await make('tieNewer', 'bde', at(2, 12), { followUpType: 'Other', updatedAt: new Date() });
    await make('sharedFromOther', 'outsider', at(3, 9), { followUpType: 'Technical / Strategy Discussion', sharedWith: [{ admin: oidOf(ids.bde), grantedBy: oidOf(ids.super), grantedAt: new Date() }] });
    await make('otherOnly', 'outsider', at(3, 10), { followUpType: 'First Meeting' });
    await make('noType', 'bde', at(4, 10));
    await make('wonWithDate', 'bde', at(1, 9), { status: 'Won', followUpType: 'Onboarding' });
    const LeadNote = require('../../models/LeadNote');
    await LeadNote.create({ lead: F.pricingToday, author: ids.bde, text: 'Bring the revised rate card', visibility: 'shared' });
    await LeadNote.create({ lead: F.sharedFromOther, author: ids.outsider, text: 'OUTSIDER-PRIVATE', visibility: 'private' });
    await mongoose.connection.db.collection('admins').updateMany(
      { _id: { $in: ['bde', 'outsider', 'teamLead'].map((k) => oidOf(ids[k])) } }, { $set: { isTemporaryPassword: false } });
  });

  test('order: overdue first, then by due time; a pricing call today is above a first meeting tomorrow; ties → most recently updated', async () => {
    const order = (await list('super')).map((r) => keyOf(r._id));
    assert.deepEqual(order, ['overduePayment', 'pricingToday', 'meetingTomorrow', 'tieNewer', 'tieOlder', 'sharedFromOther', 'otherOnly', 'noType']);
  });

  test('each row: client, owner, stage, last contact, due, type, latest note, overdue/upcoming status', async () => {
    const rows = await list('super');
    const by = Object.fromEntries(rows.map((r) => [keyOf(r._id), r]));
    assert.equal(by.overduePayment.bucket, 'Overdue');
    assert.equal(by.overduePayment.followUpType, 'Payment Follow-up');
    assert.equal(by.pricingToday.bucket, 'Today');
    assert.equal(by.meetingTomorrow.bucket, 'Upcoming');
    const p = by.pricingToday;
    assert.equal(p.fullName, 'FUT pricingToday');
    assert.equal(p.businessName, 'pricingToday Pvt Ltd');
    assert.equal(p.assignedTo.firstName, 'bde');
    assert.equal(p.status, 'Qualified');
    assert.ok(p.lastContactAt);
    assert.equal(p.nextActionType, 'Call');
    assert.equal(p.latestNote.text, 'Bring the revised rate card');
    assert.equal(by.meetingTomorrow.latestNote.text, 'Wants a demo first'); // an older remark still shows
    assert.equal(by.meetingTomorrow.latestNote.source, 'earlier-remark', 'and is labelled as one');
    assert.equal(by.sharedFromOther.sharedCount, 1);
    assert.equal(by.noType.followUpType ?? '', '');
    // Admin (all-leads) may read the private note
    assert.equal(by.sharedFromOther.latestNote.text, 'OUTSIDER-PRIVATE');
  });

  test('filters: BD (own + cross-assigned), type, due-date range, status', async () => {
    const keys = (rows) => rows.map((r) => keyOf(r._id));
    assert.deepEqual(keys(await list('super', `&by=${ids.bde}`)), ['overduePayment', 'pricingToday', 'meetingTomorrow', 'tieNewer', 'tieOlder', 'sharedFromOther', 'noType']);
    assert.deepEqual(keys(await list('super', '&followUpType=Payment%20Follow-up')), ['overduePayment']);
    assert.deepEqual(keys(await list('super', '&followUpType=Not%20set')), ['noType']);
    const tomorrow = at(1, 0).toLocaleDateString('en-CA');
    assert.deepEqual(keys(await list('super', `&dueFrom=${tomorrow}&dueTo=${tomorrow}`)), ['meetingTomorrow']);
    assert.deepEqual(keys(await list('super', '&bucket=Overdue')), ['overduePayment']);
    assert.deepEqual(keys(await list('super', '&bucket=Today')), ['pricingToday']);
  });

  test('scope: a team grant sees its team (incl. leads shared into it), not other BDs; private notes stay hidden', async () => {
    const rows = await list('teamLead', '', g);
    const keys = rows.map((r) => keyOf(r._id));
    assert.ok(keys.includes('pricingToday'));
    assert.ok(keys.includes('sharedFromOther'));
    assert.ok(!keys.includes('otherOnly'));
    assert.equal(rows.find((r) => keyOf(r._id) === 'sharedFromOther').latestNote, null);
    assert.equal((await call('bde', 'GET', '/admin/activity/followups')).status, 403);
  });

  test('BD portal list carries type and the latest note they may read', async () => {
    const leads = (await call('bde', 'GET', '/employee-portal/ess/leads')).body.leads;
    const row = (k) => leads.find((l) => String(l._id) === F[k]);
    assert.equal(row('pricingToday').followUpType, 'Pricing Negotiation');
    assert.equal(row('pricingToday').latestNote.text, 'Bring the revised rate card');
    assert.equal(row('sharedFromOther').latestNote, null);
    assert.equal(row('otherOnly'), undefined);
  });

  test('scheduling saves the type on the lead and its follow-up task; invalid types are refused', async () => {
    const due = at(5, 16).toISOString();
    // a lead with nothing scheduled yet (moving an existing date needs an outcome first)
    F.scheduleMe = String((await leadsCol().insertOne({
      fullName: 'FUT scheduleMe', phone: '9855555556', status: 'Contacted', leadType: 'Sales', connected: 'Yes', interestLevel: 'Cold',
      assignedTo: oidOf(ids.bde), createdAt: new Date(), updatedAt: new Date(), documents: [], pipelineHistory: [],
    })).insertedId);
    const r = await call('bde', 'PUT', `${ess}/${F.scheduleMe}`, { nextFollowUpDate: due, nextActionType: 'Meeting', followUpType: 'Onboarding' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await leadsCol().findOne({ _id: oidOf(F.scheduleMe) })).followUpType, 'Onboarding');
    const FollowUpTask = require('../../models/FollowUpTask');
    const task = await FollowUpTask.findOne({ lead: F.scheduleMe, type: 'Primary', status: 'Pending' }).lean();
    assert.equal(task.followUpType, 'Onboarding');
    // same date, new type → the open task follows
    assert.equal((await call('bde', 'PUT', `${ess}/${F.scheduleMe}`, { followUpType: 'Pricing Negotiation' })).status, 200);
    assert.equal((await FollowUpTask.findById(task._id).lean()).followUpType, 'Pricing Negotiation');
    assert.equal((await call('bde', 'PUT', `${ess}/${F.scheduleMe}`, { followUpType: 'Coffee' })).status, 400);
  });

  test('completing a follow-up records the next one with its type', async () => {
    const r = await call('bde', 'POST', `${ess}/${F.pricingToday}/follow-up/complete`, {
      connected: 'Yes', interestLevel: 'Interested', result: 'Agreed the price, sending onboarding pack',
      nextFollowUpDate: at(6, 11).toISOString(), nextActionType: 'Meeting', followUpType: 'Onboarding',
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await leadsCol().findOne({ _id: oidOf(F.pricingToday) });
    assert.equal(lead.followUpType, 'Onboarding');
    assert.equal(lead.remark, undefined, 'the outcome is not saved as a lead-level remark');
    assert.equal(lead.callLogs.at(-1).remark, 'Agreed the price, sending onboarding pack', 'the follow-up outcome is the call remark');
    // the next follow-up carries the outcome text as its note
    const FollowUpTask = require('../../models/FollowUpTask');
    const next = await FollowUpTask.findOne({ lead: oidOf(F.pricingToday), status: 'Pending' }).sort({ createdAt: -1 });
    assert.equal(next.note, 'Agreed the price, sending onboarding pack');
  });
});

describe('Lead Activity — Admin and BD, consistent duration and outcome', () => {
  const ess = '/employee-portal/ess/leads';
  const g = '/employee-portal/grants';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const A = {};
  const min = 60000;
  const t0 = new Date(Date.now() - 2 * 864e5);
  const rowsFor = async (who, url) => {
    const r = await call(who, 'GET', url);
    assert.equal(r.status, 200, `${url} ${JSON.stringify(r.body)}`);
    return r.body.data.filter((row) => Object.values(A).includes(String(row.leadId)));
  };
  const adminRows = (qs = '') => rowsFor('super', `/admin/activity/calls?limit=100${qs}`);
  const bdRows = (who, qs = '') => rowsFor(who, `/employee-portal/ess/lead-activity?limit=100${qs}`);
  const key = (row) => Object.keys(A).find((k) => A[k] === String(row.leadId));

  before(async () => {
    const make = async (k, owner, callLogs, fields = {}) => {
      A[k] = String((await leadsCol().insertOne({
        fullName: `LAT ${k}`, businessName: `${k} Traders`, phone: `98666${String(Object.keys(A).length).padStart(5, '0')}`, email: `lat-${k}@lead.test`,
        status: 'Contacted', leadType: 'Sales', assignedTo: oidOf(ids[owner]), createdAt: t0, updatedAt: t0, documents: [], pipelineHistory: [], callLogs, ...fields,
      })).insertedId);
    };
    const start = t0;
    const end = new Date(t0.getTime() + 5 * min);
    await make('own', 'bde', [
      { touchNumber: 1, calledBy: oidOf(ids.bde), callDate: start, callStartTime: start, callEndTime: end, callDuration: 5, loggedAt: new Date(t0.getTime() + 6 * min),
        connected: 'Yes', interestLevel: 'Warm', leadStage: 'Contacted', remark: 'Asked for a proposal',
        nextFollowUpDate: new Date(t0.getTime() + 864e5), nextActionType: 'Call', followUpType: 'Pricing Negotiation' },
      // legacy: an untimed call that copied the previous timer and duration
      { touchNumber: 2, calledBy: oidOf(ids.bde), callDate: new Date(t0.getTime() + 60 * min), callStartTime: start, callEndTime: end, callDuration: 5,
        loggedAt: new Date(t0.getTime() + 60 * min), connected: 'No', notConnectedReason: 'Number Busy', leadStage: 'Contacted', remark: 'Busy' },
    ]);
    await make('shared', 'outsider', [
      { touchNumber: 1, calledBy: oidOf(ids.outsider), callDate: t0, loggedAt: t0, connected: 'Yes', interestLevel: 'Hot Lead', leadStage: 'Qualified', remark: 'Hot one' },
    ], { status: 'Qualified', sharedWith: [{ admin: oidOf(ids.bde), grantedBy: oidOf(ids.super), grantedAt: new Date() }] });
    await make('other', 'outsider', [
      { touchNumber: 1, calledBy: oidOf(ids.outsider), callDate: t0, loggedAt: t0, connected: 'No', notConnectedReason: 'Switched Off', leadStage: 'Contacted', remark: 'Off' },
    ]);
    await make('live', 'bde', [], { status: 'New' });
    await mongoose.connection.db.collection('admins').updateMany(
      { _id: { $in: ['bde', 'outsider', 'teamLead'].map((k) => oidOf(ids[k])) } }, { $set: { isTemporaryPassword: false } });
  });

  test('rows carry every required column, linked to the lead', async () => {
    const rows = await adminRows();
    const first = rows.find((r) => key(r) === 'own' && r.touchNumber === 1);
    assert.ok(first.date);
    assert.equal(first.by.firstName, 'bde');
    assert.equal(first.leadName, 'LAT own');
    assert.equal(first.businessName, 'own Traders');
    assert.equal(first.outcome, 'Connected');
    assert.equal(first.outcomeDetail, 'Warm');
    assert.equal(first.nextAction.followUpType, 'Pricing Negotiation');
    assert.equal(first.nextAction.actionType, 'Call');
    assert.equal(first.leadStage, 'Contacted');
    assert.equal(first.duration, 5);
    assert.equal(first.remark, 'Asked for a proposal');
    assert.equal(String(first.leadId), A.own);
  });

  test('duration: an untimed call never repeats the previous call\'s duration', async () => {
    const second = (await adminRows()).find((r) => key(r) === 'own' && r.touchNumber === 2);
    assert.equal(second.outcome, 'Not connected');
    assert.equal(second.outcomeDetail, 'Number Busy');
    assert.equal(second.duration, null);
    assert.equal(second.nextAction, null);
  });

  test('Admin sees all; BD sees own + cross-assigned; team grant sees its team', async () => {
    assert.deepEqual([...new Set((await adminRows()).map(key))].sort(), ['other', 'own', 'shared']);
    assert.deepEqual([...new Set((await bdRows('bde')).map(key))].sort(), ['own', 'shared']);
    assert.deepEqual([...new Set((await bdRows('outsider')).map(key))].sort(), ['other', 'shared']);
    assert.deepEqual([...new Set((await rowsFor('teamLead', `${g}/admin/activity/calls?limit=100`)).map(key))].sort(), ['own', 'shared']);
  });

  test('filters: date range, caller, status, stage, client', async () => {
    const keys = (rows) => rows.map((r) => `${key(r)}#${r.touchNumber}`).sort();
    assert.deepEqual(keys(await adminRows(`&by=${ids.outsider}`)), ['other#1', 'shared#1']);
    assert.deepEqual(keys(await adminRows('&result=Connected')), ['own#1', 'shared#1']);
    assert.deepEqual(keys(await adminRows('&result=Not%20Connected')), ['other#1', 'own#2']);
    assert.deepEqual(keys(await adminRows('&stage=Qualified')), ['shared#1']);
    assert.deepEqual(keys(await adminRows('&client=own%20Traders')), ['own#1', 'own#2']);
    assert.deepEqual(keys(await bdRows('bde', '&client=LAT%20shared')), ['shared#1']);
    const day = t0.toLocaleDateString('en-CA');
    assert.deepEqual(keys(await adminRows(`&dateFrom=${day}&dateTo=${day}`)), ['other#1', 'own#1', 'own#2', 'shared#1']);
    const tomorrow = new Date(t0.getTime() + 864e5).toLocaleDateString('en-CA');
    assert.deepEqual(keys(await adminRows(`&dateFrom=${tomorrow}&dateTo=${tomorrow}`)), []);
    assert.deepEqual(keys(await bdRows('bde', `&by=${ids.outsider}`)), ['shared#1']);
  });

  test('logging calls live: a timed call gets its duration; the next untimed one does not inherit it', async () => {
    const started = new Date(Date.now() - 4 * min);
    assert.equal((await call('bde', 'PUT', `${ess}/${A.live}`, { callStartTime: started, callDate: started })).status, 200);
    assert.equal((await call('bde', 'PUT', `${ess}/${A.live}`, { callEndTime: new Date(), callDuration: 4 })).status, 200);
    const later = new Date(Date.now() + 2 * 864e5).toISOString();
    const r1 = await call('bde', 'PUT', `${ess}/${A.live}`, { connected: 'Yes', interestLevel: 'Interested', nextFollowUpDate: later, nextActionType: 'Meeting', followUpType: 'First Meeting', remark: 'Connected — requested a strategy discussion' });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    let lead = await leadsCol().findOne({ _id: oidOf(A.live) });
    assert.equal(lead.callLogs[0].callDuration, 4);
    assert.equal(lead.callLogs[0].followUpType, 'First Meeting');

    // outcome logged outside the same-call window, with no new timer
    // (move that whole call into the past: timer 40–36 min ago, logged 30 min ago)
    const past = (m) => new Date(Date.now() - m * min);
    await leadsCol().updateOne({ _id: oidOf(A.live) }, { $set: {
      callStartTime: past(40), callEndTime: past(36),
      'callLogs.0.callStartTime': past(40), 'callLogs.0.callEndTime': past(36), 'callLogs.0.loggedAt': past(30),
    } });
    const r2 = await call('bde', 'PUT', `${ess}/${A.live}`, { connected: 'No', notConnectedReason: 'Number Busy' });
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    lead = await leadsCol().findOne({ _id: oidOf(A.live) });
    assert.equal(lead.callLogs.length, 2);
    assert.equal(lead.callLogs[1].callDuration, null);

    const rows = (await bdRows('bde')).filter((r) => key(r) === 'live').sort((a, b) => a.touchNumber - b.touchNumber);
    assert.deepEqual(rows.map((r) => [r.outcome, r.duration]), [['Connected', 4], ['Not connected', null]]);
    assert.equal(rows[0].remark, 'Connected — requested a strategy discussion');
  });

  test('access: no portal login on the admin API; BD needs leads.view', async () => {
    assert.equal((await call('bde', 'GET', '/admin/activity/calls')).status, 403);
    assert.equal((await call('payrollAdmin', 'GET', '/employee-portal/ess/lead-activity')).status === 200, false);
  });
});

describe('BDE Calling Performance — metrics, IST periods, BD and Admin views', () => {
  const D = '2026-09-15';
  const ist = (day, hm) => new Date(`${day}T${hm}:00+05:30`);
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const qs = `?period=custom&from=${D}&to=${D}`;

  before(async () => {
    const bde = oidOf(ids.bde);
    const log = (hm, fields) => ({ calledBy: bde, callDate: ist(D, hm), loggedAt: ist(D, hm), ...fields });
    await leadsCol().insertOne({
      fullName: 'PERF one', phone: '9877700001', status: 'Contacted', leadType: 'Sales', assignedTo: bde, createdAt: new Date(), updatedAt: new Date(), documents: [],
      callLogs: [
        { ...log('10:05', { connected: 'Yes', interestLevel: 'Warm' }), touchNumber: 1, callStartTime: ist(D, '10:00'), callEndTime: ist(D, '10:04') },
        // untimed: copied the previous timer — no duration
        { ...log('11:00', { connected: 'No', notConnectedReason: 'Number Busy' }), touchNumber: 2, callStartTime: ist(D, '10:00'), callEndTime: ist(D, '10:04') },
        { ...log('12:07', { connected: 'Yes', interestLevel: 'Hot Lead' }), touchNumber: 3, callStartTime: ist(D, '12:00'), callEndTime: ist(D, '12:06') },
      ],
    });
    await leadsCol().insertOne({
      fullName: 'PERF two', phone: '9877700002', status: 'Contacted', leadType: 'Sales', assignedTo: bde, createdAt: new Date(), updatedAt: new Date(), documents: [],
      callLogs: [
        { calledBy: bde, callDate: ist('2026-09-14', '23:50'), loggedAt: ist('2026-09-14', '23:50'), connected: 'Yes', interestLevel: 'Warm', touchNumber: 1 }, // day before (IST)
        { ...log('13:00', { connected: 'Yes', interestLevel: 'Cold' }), touchNumber: 2 },
        { ...log('23:50', { connected: 'No', notConnectedReason: 'Switched Off' }), touchNumber: 3 }, // still D in IST (18:20 UTC)
        { calledBy: bde, callDate: ist('2026-09-16', '00:10'), loggedAt: ist('2026-09-16', '00:10'), connected: 'No', touchNumber: 4 }, // next day (IST)
      ],
    });
    const FollowUpTask = require('../../models/FollowUpTask');
    const lead = (await leadsCol().findOne({ fullName: 'PERF one' }))._id;
    await FollowUpTask.collection.insertMany([
      { lead, assignedTo: bde, createdBy: bde, dueDate: ist(D, '11:00'), status: 'Completed', completedAt: ist(D, '11:30'), type: 'Primary' },
      { lead, assignedTo: bde, createdBy: bde, dueDate: ist(D, '17:00'), status: 'Pending', type: 'Parallel' },
      { lead, assignedTo: bde, createdBy: bde, dueDate: ist('2026-09-20', '10:00'), status: 'Completed', completedAt: ist(D, '15:00'), type: 'Parallel' },
      { lead, assignedTo: bde, createdBy: bde, dueDate: ist(D, '18:00'), status: 'Cancelled', type: 'Parallel' },
    ]);
    await mongoose.connection.db.collection('admins').updateOne({ _id: bde }, { $set: { isTemporaryPassword: false } });
  });

  const expected = {
    calls: 5, connected: 3, notConnected: 2, connectRate: 60, leadsWorked: 2,
    timedCalls: 2, talkMinutes: 10, avgCallMinutes: 5,
    followUpsDue: 2, followUpsDueCompleted: 1, followUpsCompleted: 2,
  };
  const pick = (o) => Object.fromEntries(Object.keys(expected).map((k) => [k, o[k]]));

  test('BD sees their own metrics for the period; the range is that IST day', async () => {
    const r = await call('bde', 'GET', `/employee-portal/ess/my-calls${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(pick(r.body), expected);
    assert.equal(r.body.range.timeZone, 'Asia/Kolkata');
    assert.equal(new Date(r.body.range.start).toISOString(), '2026-09-14T18:30:00.000Z');
    assert.equal(new Date(r.body.range.end).toISOString(), '2026-09-15T18:29:59.999Z');
  });

  test('Admin sees every BDE row plus organisation totals for the same period', async () => {
    const r = await call('super', 'GET', `/admin/activity/team-performance${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const row = r.body.members.find((m) => String(m.adminId) === ids.bde);
    assert.deepEqual(pick(row), expected);
    assert.ok(r.body.members.length >= 2);
    assert.deepEqual(pick(r.body.totals), expected); // nobody else called that day
    assert.equal(r.body.range.timeZone, 'Asia/Kolkata');
  });

  test('daily / weekly / monthly presets and validation', async () => {
    for (const period of ['today', 'week', 'month']) {
      const r = await call('bde', 'GET', `/employee-portal/ess/my-calls?period=${period}`);
      assert.equal(r.status, 200);
      assert.ok(new Date(r.body.range.start) <= new Date(r.body.range.end));
    }
    assert.equal((await call('bde', 'GET', '/employee-portal/ess/my-calls?period=custom&from=2026-09-20&to=2026-09-10')).status, 400);
  });

  test('BD view is always their own; the team view needs Admin access', async () => {
    const other = await call('outsider', 'GET', `/employee-portal/ess/my-calls${qs}`);
    assert.equal(other.body.calls, 0);
    assert.equal((await call('bde', 'GET', `/admin/activity/team-performance${qs}`)).status, 403);
  });

  test('call log rows use the same duration rule', async () => {
    const r = await call('bde', 'GET', `/employee-portal/ess/my-calls/calls${qs}`);
    const durations = r.body.calls.filter((c) => c.fullName === 'PERF one').map((c) => [c.touchNumber, c.duration]).sort();
    assert.deepEqual(durations, [[1, 4], [2, null], [3, 6]]);
  });
});

describe('Lead Assignment Logs — events, people, dates, filters', () => {
  const D = '2026-08-10';
  const ist = (day, hm) => new Date(`${day}T${hm}:00+05:30`);
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const L = {};
  const logs = async (qs) => {
    const r = await call('super', 'GET', `/leads/assignments/all?limit=100&lead=LOGT${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
  };
  const events = (rows) => rows.map((r) => r.event);

  before(async () => {
    const leads = mongoose.connection.db.collection('leads');
    L.lead = (await leads.insertOne({ leadId: 'VH-LOGT-1', fullName: 'LOGT Alpha', phone: '9888800001', status: 'Contacted', leadType: 'Sales',
      assignedTo: oidOf(ids.pm), createdAt: new Date(), updatedAt: new Date(), documents: [], pipelineHistory: [] })).insertedId;
    const entry = (when, fields) => ({ lead: L.lead, assignedBy: oidOf(ids.super), mode: 'Manual', reason: '', fromAdmin: null, toAdmin: null, createdAt: when, updatedAt: when, ...fields });
    await mongoose.connection.db.collection('assignmentlogs').insertMany([
      entry(ist('2026-08-09', '23:50'), { toAdmin: oidOf(ids.bde) }), // day before (IST)
      entry(ist(D, '10:00'), { toAdmin: oidOf(ids.bde), mode: 'Auto-RoundRobin', assignedBy: null }),
      entry(ist(D, '11:00'), { fromAdmin: oidOf(ids.bde), toAdmin: oidOf(ids.pm), reason: 'BD on leave' }),
      entry(ist(D, '12:00'), { fromAdmin: oidOf(ids.pm), toAdmin: oidOf(ids.pm) }),
      entry(ist(D, '13:00'), { mode: 'Cross-Assign', toAdmin: oidOf(ids.outsider), leadOwner: oidOf(ids.pm), reason: 'Second caller' }),
      entry(ist(D, '14:00'), { mode: 'Cross-Unassign', fromAdmin: oidOf(ids.outsider), leadOwner: oidOf(ids.pm) }),
      entry(ist(D, '23:50'), { fromAdmin: oidOf(ids.pm), toAdmin: null, reason: 'Back to pool' }), // still D (18:20 UTC)
      entry(ist('2026-08-11', '00:10'), { toAdmin: oidOf(ids.bde) }), // next day (IST)
    ]);
  });

  test('date range covers whole IST days; every event is labelled, newest first', async () => {
    const rows = await logs(`&dateFrom=${D}&dateTo=${D}`);
    assert.deepEqual(events(rows), ['Unassigned', 'Access removed', 'Cross-assigned', 'Reassigned', 'Reassigned', 'Assigned']);
    assert.equal((await logs('')).length, 8);
  });

  test('each entry carries lead, previous owner, new owner / collaborator, actor, time and reason', async () => {
    const rows = await logs(`&dateFrom=${D}&dateTo=${D}`);
    const re = rows.find((r) => r.reason === 'BD on leave');
    assert.equal(re.lead.leadId, 'VH-LOGT-1');
    assert.equal(re.lead.fullName, 'LOGT Alpha');
    assert.equal(re.fromAdmin.firstName, 'bde');
    assert.equal(re.toAdmin.firstName, 'pm');
    assert.equal(re.assignedBy.firstName, 'super');
    assert.ok(re.createdAt);
    const cross = rows.find((r) => r.event === 'Cross-assigned');
    assert.equal(cross.toAdmin.firstName, 'outsider');
    assert.equal(cross.leadOwner.firstName, 'pm');
    assert.equal(cross.reason, 'Second caller');
    const removed = rows.find((r) => r.event === 'Access removed');
    assert.equal(removed.fromAdmin.firstName, 'outsider');
    assert.equal(rows.find((r) => r.mode === 'Auto-RoundRobin').assignedBy, null);
  });

  test('employee filter by role: previous owner, new owner / collaborator, actor, any', async () => {
    const q = (emp, role) => logs(`&dateFrom=${D}&dateTo=${D}&employee=${ids[emp]}&role=${role}`).then(events);
    assert.deepEqual(await q('outsider', 'any'), ['Access removed', 'Cross-assigned']);
    assert.deepEqual(await q('outsider', 'from'), ['Access removed']);
    assert.deepEqual(await q('outsider', 'to'), ['Cross-assigned']);
    assert.deepEqual(await q('pm', 'from'), ['Unassigned', 'Reassigned']);
    assert.deepEqual(await q('pm', 'to'), ['Reassigned', 'Reassigned']);
    assert.equal((await q('pm', 'any')).length, 5); // incl. as owner of the shared lead
    assert.equal((await q('super', 'actor')).length, 5); // round-robin had no actor
  });

  test('event and lead filters; bad dates refused; audit permission required', async () => {
    assert.deepEqual(events(await logs(`&event=cross-assigned`)), ['Cross-assigned']);
    assert.deepEqual(events(await logs(`&event=access-removed`)), ['Access removed']);
    assert.equal((await logs(`&event=assigned`)).length, 3);
    const byId = await call('super', 'GET', '/leads/assignments/all?lead=VH-LOGT');
    assert.equal(byId.body.totalLogs, 8);
    assert.equal((await call('super', 'GET', '/leads/assignments/all?lead=nobody-like-this')).body.totalLogs, 0);
    assert.equal((await call('super', 'GET', '/leads/assignments/all?dateFrom=not-a-date')).status, 400);
    assert.equal((await call('pm', 'GET', '/leads/assignments/all')).status, 403);
  });

  test('a live cross-assignment and removal record the lead owner', async () => {
    assert.equal((await call('super', 'POST', `/leads/${L.lead}/share`, { adminId: ids.bde, reason: 'Help close' })).status, 201);
    assert.equal((await call('super', 'DELETE', `/leads/${L.lead}/share/${ids.bde}`)).status, 200);
    const today = new Date().toLocaleDateString('en-CA');
    const rows = await logs(`&dateFrom=${today}&dateTo=${today}`);
    assert.deepEqual(events(rows), ['Access removed', 'Cross-assigned']);
    for (const r of rows) assert.equal(r.leadOwner.firstName, 'pm');
    assert.equal(rows[1].reason, 'Help close');
  });
});

describe('BD-wise Daily Call Performance', () => {
  const ist = (day, hm) => new Date(`${day}T${hm}:00+05:30`);
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const DAYS = ['2026-07-06', '2026-07-07', '2026-07-08'];
  const qs = '?period=custom&from=2026-07-06&to=2026-07-08';
  const L = {};

  before(async () => {
    const callBy = (who, day, hm, connected) => ({ calledBy: oidOf(ids[who]), callDate: ist(day, hm), loggedAt: ist(day, hm), connected, ...(connected === 'Yes' ? { interestLevel: 'Warm' } : { notConnectedReason: 'Number Busy' }) });
    const make = async (key, owner, callLogs, extra = {}) => {
      L[key] = (await leadsCol().insertOne({ fullName: `DAILY ${key}`, phone: '9899900000', status: 'Contacted', leadType: 'Sales',
        assignedTo: oidOf(ids[owner]), createdAt: new Date(), updatedAt: new Date(), documents: [], callLogs, ...extra })).insertedId;
    };
    await make('X', 'bde', [
      callBy('bde', '2026-07-05', '23:50', 'Yes'), // day before the range (IST)
      callBy('bde', '2026-07-06', '10:00', 'Yes'),
      callBy('bde', '2026-07-06', '11:00', 'No'), // same lead again — still a call
      callBy('bde', '2026-07-06', '23:50', 'Yes'), // 18:20 UTC — still 6 Jul in IST
      callBy('bde', '2026-07-07', '00:10', 'No'), // 6 Jul 18:40 UTC — 7 Jul in IST
    ]);
    // the outsider's lead, shared with the BDE: each call counts for whoever made it
    await make('Y', 'outsider', [
      callBy('bde', '2026-07-07', '12:00', 'Yes'),
      callBy('outsider', '2026-07-07', '13:00', 'No'),
    ], { sharedWith: [{ admin: oidOf(ids.bde), grantedBy: oidOf(ids.super), grantedAt: new Date() }] });
    // the BDE's lead, called by the outsider: counts for the outsider
    await make('Z', 'bde', [callBy('outsider', '2026-07-08', '09:00', 'Yes')]);
    await mongoose.connection.db.collection('admins').updateMany(
      { _id: { $in: ['bde', 'outsider', 'teamLead'].map((k) => oidOf(ids[k])) } }, { $set: { isTemporaryPassword: false } });
  });

  const cell = (calls, connected, uniqueLeads, connectRate, collaboratorCalls = 0) => ({ calls, connected, notConnected: calls - connected, connectRate, uniqueLeads, collaboratorCalls });

  test('Admin: per BDE per IST day — every attempt counted, credited to the caller', async () => {
    const r = await call('super', 'GET', `/admin/activity/team-performance/daily${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.days, DAYS);
    const row = (who) => r.body.members.find((m) => String(m.adminId) === ids[who]);
    assert.deepEqual(row('bde').days, {
      '2026-07-06': cell(3, 2, 1, 66.67),
      '2026-07-07': cell(2, 1, 2, 50, 1),
      '2026-07-08': cell(0, 0, 0, null),
    });
    assert.deepEqual(row('bde').total, cell(5, 3, 2, 60, 1));
    assert.deepEqual(row('outsider').days, {
      '2026-07-06': cell(0, 0, 0, null),
      '2026-07-07': cell(1, 0, 1, 0),
      '2026-07-08': cell(1, 1, 1, 100, 1),
    });
    // organisation: calls add up; unique leads are distinct across BDEs
    assert.deepEqual(r.body.totals.days, {
      '2026-07-06': cell(3, 2, 1, 66.67),
      '2026-07-07': cell(3, 1, 2, 33.33, 1),
      '2026-07-08': cell(1, 1, 1, 100, 1),
    });
    assert.deepEqual(r.body.totals.total, cell(7, 4, 3, 57.14, 2));
    assert.equal(r.body.range.timeZone, 'Asia/Kolkata');
  });

  test('daily cells match the raw call logs exactly', async () => {
    const r = await call('super', 'GET', `/admin/activity/team-performance/daily${qs}`);
    const istDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const leads = await leadsCol().find({ 'callLogs.0': { $exists: true } }, { callLogs: 1 }).toArray();
    for (const m of r.body.members) {
      for (const day of DAYS) {
        const logs = leads.flatMap((l) => (l.callLogs || []).map((c) => ({ ...c, lead: String(l._id) })))
          .filter((c) => String(c.calledBy) === String(m.adminId) && istDay(c.loggedAt || c.callDate) === day);
        const connected = logs.filter((c) => c.connected === 'Yes').length;
        assert.equal(m.days[day].calls, logs.length, `${m.name} ${day} calls`);
        assert.equal(m.days[day].connected, connected, `${m.name} ${day} connected`);
        assert.equal(m.days[day].uniqueLeads, new Set(logs.map((c) => c.lead)).size, `${m.name} ${day} unique`);
      }
    }
  });

  test('BDE sees only their own daily numbers, identical to the Admin view of them', async () => {
    const mine = await call('bde', 'GET', `/employee-portal/ess/my-calls/daily${qs}`);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal(mine.body.members.length, 1);
    assert.equal(String(mine.body.members[0].adminId), ids.bde);
    const admin = (await call('super', 'GET', `/admin/activity/team-performance/daily${qs}`)).body.members.find((m) => String(m.adminId) === ids.bde);
    assert.deepEqual(mine.body.members[0].days, admin.days);
    assert.deepEqual(mine.body.members[0].total, admin.total);
  });

  test('permissions: no team view for a BDE; a manager sees only direct reports', async () => {
    assert.equal((await call('bde', 'GET', `/admin/activity/team-performance/daily${qs}`)).status, 403);
    const own = await call('bde', 'GET', `/employee-portal/ess/team-performance/daily${qs}`);
    assert.equal(own.status, 200);
    assert.deepEqual(own.body.members, []);
    const team = await call('teamLead', 'GET', `/employee-portal/ess/team-performance/daily${qs}`);
    assert.equal(team.status, 200);
    assert.deepEqual(team.body.members.map((m) => String(m.adminId)), [ids.bde]);
  });

  test('periods: presets work; today is one IST day; long or reversed ranges are refused', async () => {
    const today = await call('super', 'GET', '/admin/activity/team-performance/daily?period=today');
    assert.equal(today.status, 200);
    assert.deepEqual(today.body.days, [new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })]);
    for (const period of ['week', 'month']) assert.equal((await call('super', 'GET', `/admin/activity/team-performance/daily?period=${period}`)).status, 200);
    assert.equal((await call('super', 'GET', '/admin/activity/team-performance/daily?period=custom&from=2026-01-01&to=2026-06-30')).status, 400);
    assert.equal((await call('super', 'GET', '/admin/activity/team-performance/daily?period=custom&from=2026-07-08&to=2026-07-06')).status, 400);
  });

  test('the existing dashboard is unchanged for the same period', async () => {
    const r = await call('super', 'GET', `/admin/activity/team-performance${qs}`);
    assert.equal(r.status, 200);
    const bde = r.body.members.find((m) => String(m.adminId) === ids.bde);
    assert.equal(bde.calls, 5);
    assert.equal(bde.connected, 3);
    assert.equal(bde.notConnected, 2);
    assert.equal(bde.connectRate, 60);
    assert.equal(bde.leadsWorked, 2);
    assert.equal(r.body.totals.calls, 7);
  });
});

describe('BDE-wise Lead Status and Pending Calls (PRD 6.1)', () => {
  const ist = (day, hm) => new Date(`${day}T${hm}:00+05:30`);
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const team = '/admin/activity/team-performance';
  const mine = '/employee-portal/ess/my-calls';
  const L = {};
  const call1 = { touchNumber: 1, callDate: new Date(), loggedAt: new Date(), connected: 'Yes', interestLevel: 'Warm' };

  before(async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const bdeRole = await Role.findOne({ name: 'BDE' });
    for (const key of ['boardA', 'boardB']) {
      ids[key] = String((await Admin.create({ firstName: key, lastName: 'BD', email: `${key}@e2e.test`, password: PASSWORD, roles: [bdeRole._id], employeeId: `VH-E2E-${key}` }))._id);
      await mongoose.connection.db.collection('employees').insertOne({
        employeeId: `VH-E2E-${key}`, adminId: oidOf(ids[key]), firstName: key, lastName: 'BD', email: `${key}@e2e.test`,
        phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent',
      });
    }
    const make = async (key, owner, fields = {}) => {
      L[key] = String((await leadsCol().insertOne({
        fullName: `BOARD ${key}`, phone: '9811100000', status: 'New', leadType: 'Sales', assignedTo: owner ? oidOf(ids[owner]) : null,
        assignedAt: ist('2026-10-01', '10:00'), createdAt: ist('2026-10-01', '09:00'), updatedAt: new Date(), documents: [], pipelineHistory: [], ...fields,
      })).insertedId);
    };
    await make('pending1', 'boardA');
    await make('pending2', 'boardA', { assignedAt: ist('2026-10-01', '23:50') }); // still 1 Oct in IST
    await make('pending3', 'boardA', { assignedAt: ist('2026-10-02', '00:10') }); // 2 Oct in IST
    await make('called', 'boardA', { status: 'Contacted', callLogs: [{ ...call1, calledBy: oidOf(ids.boardA) }] });
    await make('hold', 'boardA', { status: 'Hold' });
    await make('qualified', 'boardA', { status: 'Qualified', proposalValue: 20000, callLogs: [{ ...call1, calledBy: oidOf(ids.boardA) }] });
    await make('won', 'boardA', { status: 'Won', dealCloseValue: 5000 });
    await make('lost', 'boardA', { status: 'Lost' });
    await make('dropped', 'boardA', { status: 'Dropped' });
    await make('hiring', 'boardA', { leadType: 'Hiring' }); // not a Sales lead
    await make('bShared', 'boardB', { assignedAt: ist('2026-10-01', '12:00'), sharedWith: [{ admin: oidOf(ids.boardA), grantedBy: oidOf(ids.super), grantedAt: new Date() }] });
    await make('bLost', 'boardB', { status: 'Lost' });
  });

  const counts = (r) => ({ open: r.open, hold: r.hold, won: r.won, lost: r.lost, dropped: r.dropped, total: r.total });

  test('Admin lead status: per owner, Open includes Hold, shared lead counted once (for its owner)', async () => {
    const r = await call('super', 'GET', `${team}/lead-status`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const row = (k) => r.body.rows.find((x) => x.owner === ids[k]);
    assert.deepEqual(counts(row('boardA')), { open: 6, hold: 1, won: 1, lost: 1, dropped: 1, total: 9 });
    assert.equal(row('boardA').openValue, 20000);
    assert.equal(row('boardA').wonValue, 5000);
    assert.equal(row('boardA').collaborating, 1);
    assert.deepEqual(counts(row('boardB')), { open: 1, hold: 0, won: 0, lost: 1, dropped: 0, total: 2 });
    assert.equal(row('boardB').collaborating, 0);
  });

  test('Admin totals reconcile to every Sales lead (owners + non-BDE owners + Unassigned)', async () => {
    const r = await call('super', 'GET', `${team}/lead-status`);
    const sum = (k) => r.body.rows.reduce((s, x) => s + x[k], 0);
    const salesLeads = await leadsCol().countDocuments({ leadType: { $in: ['Sales', null] } });
    assert.equal(r.body.totals.total, salesLeads);
    assert.equal(sum('total'), salesLeads);
    for (const k of ['open', 'won', 'lost', 'dropped']) assert.equal(r.body.totals[k], sum(k));
    assert.ok(r.body.rows.some((x) => x.unassigned));
  });

  test('BD lead status: own leads, and shared leads separately (not in their totals)', async () => {
    const r = await call('boardA', 'GET', `${mine}/lead-status`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const [own, shared] = r.body.rows;
    assert.deepEqual(counts(own), { open: 6, hold: 1, won: 1, lost: 1, dropped: 1, total: 9 });
    assert.deepEqual(counts(shared), { open: 1, hold: 0, won: 0, lost: 0, dropped: 0, total: 1 });
    assert.equal(r.body.totals.total, 9);
  });

  test('Pending calls: owner × IST assignment date, called / closed / Hold leads excluded', async () => {
    const r = await call('super', 'GET', `${team}/pending-calls`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const owner = (k) => r.body.owners.find((o) => o.owner === ids[k]);
    assert.deepEqual(owner('boardA').days, { '2026-10-01': 2, '2026-10-02': 1 });
    assert.equal(owner('boardA').total, 3);
    assert.deepEqual(owner('boardB').days, { '2026-10-01': 1 });

    const bd = await call('boardA', 'GET', `${mine}/pending-calls`);
    const [own, shared] = bd.body.owners;
    assert.deepEqual(own.days, { '2026-10-01': 2, '2026-10-02': 1 });
    assert.deepEqual(shared.days, { '2026-10-01': 1 });
    assert.equal(bd.body.total, 3); // shared lead is its owner's pending call
  });

  test('drill-down: every count opens exactly those leads, within scope', async () => {
    const ids_ = (r) => r.body.leads.map((l) => String(l._id)).sort();
    const open = await call('super', 'GET', `${team}/board-leads?owner=${ids.boardA}&bucket=open`);
    assert.deepEqual(ids_(open), ['pending1', 'pending2', 'pending3', 'called', 'hold', 'qualified'].map((k) => L[k]).sort());
    const day = await call('super', 'GET', `${team}/board-leads?owner=${ids.boardA}&bucket=pending&day=2026-10-01`);
    assert.deepEqual(ids_(day), [L.pending1, L.pending2].sort());
    const collab = await call('super', 'GET', `${team}/board-leads?owner=${ids.boardA}&bucket=collaborating`);
    assert.deepEqual(ids_(collab), [L.bShared]);
    assert.equal((await call('super', 'GET', `${team}/board-leads?owner=unassigned&bucket=total`)).status, 200);

    const bdShared = await call('boardA', 'GET', `${mine}/board-leads?owner=shared&bucket=pending`);
    assert.deepEqual(ids_(bdShared), [L.bShared]);
    const bdWon = await call('boardA', 'GET', `${mine}/board-leads?owner=own&bucket=won`);
    assert.deepEqual(ids_(bdWon), [L.won]);
    // a BD can't drill into another BD's leads; a BD has no team view
    assert.equal((await call('boardA', 'GET', `${mine}/board-leads?owner=${ids.boardB}&bucket=total`)).status, 404);
    assert.equal((await call('boardA', 'GET', `${team}/lead-status`)).status, 403);
    // a manager only sees their reports
    const mgr = await call('teamLead', 'GET', '/employee-portal/ess/team-performance/lead-status');
    assert.deepEqual(mgr.body.rows.map((x) => x.owner), [ids.bde]);
    assert.equal((await call('teamLead', 'GET', `/employee-portal/ess/team-performance/board-leads?owner=${ids.boardA}&bucket=total`)).status, 404);
  });

  test('calling a pending lead takes it off the Pending view at once', async () => {
    const r = await call('boardA', 'PUT', `/employee-portal/ess/leads/${L.pending3}`, { connected: 'No', notConnectedReason: 'Number Busy' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const bd = await call('boardA', 'GET', `${mine}/pending-calls`);
    assert.deepEqual(bd.body.owners[0].days, { '2026-10-01': 2 });
  });
});

describe('Management dashboard — BD accountability connect rate', () => {
  // Same days as the BD-wise daily fixtures: bde made 5 calls (3 connected),
  // one on the outsider's shared lead; outsider made 2 (1 connected), one on bde's lead
  const qs = '?dateFrom=2026-07-06&dateTo=2026-07-08';
  const get = async () => {
    const r = await call('super', 'GET', `/admin/activity/bd-accountability${qs}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
  };
  const rowOf = (rows, id) => rows.find((r) => String(r.bd._id) === String(id));

  test('connect rate = connected calls ÷ calls made, credited to the caller', async () => {
    const rows = await get();
    const bde = rowOf(rows, ids.bde);
    assert.equal(bde.callsMade, 5);
    assert.equal(bde.connectedCalls, 3);
    assert.equal(bde.connectRate, 60);
    const outsider = rowOf(rows, ids.outsider);
    assert.equal(outsider.callsMade, 2);
    assert.equal(outsider.connectedCalls, 1);
    assert.equal(outsider.connectRate, 50);
  });

  test('matches BDE Calling Performance for the same BD and period', async () => {
    const perf = await call('super', 'GET', '/admin/activity/team-performance?period=custom&from=2026-07-06&to=2026-07-08');
    const rows = await get();
    for (const who of ['bde', 'outsider']) {
      const p = perf.body.members.find((m) => String(m.adminId) === ids[who]);
      const a = rowOf(rows, ids[who]);
      assert.equal(a.callsMade, p.calls, who);
      assert.equal(a.connectedCalls, p.connected, who);
      assert.equal(a.connectRate, p.connectRate, who);
    }
  });

  test('every active BD is listed from the live roster — zeros and "no calls" included', async () => {
    const rows = await get();
    const idle = rowOf(rows, ids.boardB);
    assert.ok(idle, 'a BD with no activity in the period is still listed');
    assert.equal(idle.callsMade, 0);
    assert.equal(idle.connectRate, null);

    // add a BD: appears without any code change; deactivate: drops off
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const bdeRole = await Role.findOne({ name: 'BDE' });
    const fresh = await Admin.create({ firstName: 'Newly', lastName: 'Hired', email: 'newly.hired@e2e.test', password: PASSWORD, roles: [bdeRole._id] });
    assert.ok(rowOf(await get(), fresh._id));
    await Admin.updateOne({ _id: fresh._id }, { $set: { isActive: false } });
    assert.equal(rowOf(await get(), fresh._id), undefined);
  });

  test('still Admin-only', async () => {
    assert.equal((await call('bde', 'GET', `/admin/activity/bd-accountability${qs}`)).status, 403);
  });
});


describe('Remarks retired — Notes are the record', () => {
  const ess = '/employee-portal/ess/leads';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const L = {};
  const later = new Date(Date.now() + 3 * 864e5).toISOString();

  before(async () => {
    const make = async (key, fields) => {
      const now = new Date();
      L[key] = String((await leadsCol().insertOne({
        fullName: `NOREM ${key}`, phone: '9855555555', email: `norem-${key}@lead.test`, status: 'New', leadType: 'Sales',
        platform: 'Facebook', createdAt: now, updatedAt: now, documents: [],
        pipelineHistory: [{ status: 'New', date: now, note: 'Lead captured' }],
        assignedTo: oidOf(ids.bde), assignedAt: now, ...fields,
      })).insertedId);
    };
    await make('plain', {});
    await make('stale', {});
    await make('legacy', { remark: 'Spoke to the client in March', status: 'Contacted' });
    await make('card', {});
    await make('cardPrivate', {});
    await make('exportA', {});
    await make('exportLegacy', { remark: 'only an old remark' });
  });

  const doc = (key) => leadsCol().findOne({ _id: oidOf(L[key]) });

  test('a remark sent on its own (a stale browser tab) is ignored: nothing saved, no history, not an action', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.stale}`, { remark: 'typed in an old tab' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('stale');
    assert.equal(lead.remark, undefined);
    assert.equal(lead.lastActivityAt ?? null, null);
    assert.ok(!lead.pipelineHistory.some((h) => h.status === 'Remark updated'));
    const raw = await call('super', 'GET', `/leads?stageGroup=raw&leadType=All&search=NOREM&limit=100`);
    assert.ok(raw.body.data.some((l) => String(l._id) === L.stale), 'still Raw: a remark is not an action');
  });

  test('a call outcome keeps its text on that call only; an older lead remark is not copied onto later calls', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.legacy}`, { connected: 'No', notConnectedReason: 'Ringing / No Answer' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('legacy');
    assert.equal(lead.remark, 'Spoke to the client in March', 'the old remark is untouched');
    assert.equal(lead.callLogs.at(-1).remark, '', 'it is not stamped onto the new call');

    const withText = await call('bde', 'PUT', `${ess}/${L.legacy}`, { connected: 'Yes', interestLevel: 'Warm', remark: 'Asked for a callback Friday', nextFollowUpDate: later, nextActionType: 'Call', followUpType: 'Other' });
    assert.equal(withText.status, 200, JSON.stringify(withText.body));
    const after = await doc('legacy');
    assert.equal(after.remark, 'Spoke to the client in March');
    assert.equal(after.callLogs.at(-1).remark, 'Asked for a callback Friday');
  });

  test('an older remark is still shown, read-only, on the lead for its owner and for Admin', async () => {
    const mine = await call('bde', 'GET', `${ess}/${L.legacy}`);
    assert.equal(mine.body.lead.remark, 'Spoke to the client in March');
    const admin = await call('super', 'GET', `/leads/${L.legacy}`);
    assert.equal(admin.body.data.remark, 'Spoke to the client in March');
  });

  test('the card Note button posts a real note, which counts as working the lead', async () => {
    const r = await call('bde', 'POST', `${ess}/${L.card}/notes`, { text: 'Left a voicemail', visibility: 'shared' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const lead = await doc('card');
    assert.equal(lead.remark, undefined);
    assert.equal(lead.firstContactType, 'Note');
    const notes = await call('super', 'GET', `/leads/${L.card}/notes`);
    assert.equal(notes.body.data[0].text, 'Left a voicemail');
    assert.equal(notes.body.data[0].visibility, 'shared');
  });

  test('a private note from the card is hidden from other BDs and visible to Admin', async () => {
    assert.equal((await call('bde', 'POST', `${ess}/${L.cardPrivate}/notes`, { text: 'only me', visibility: 'private' })).status, 201);
    const admin = await call('super', 'GET', `/leads/${L.cardPrivate}/notes`);
    assert.equal(admin.body.data.length, 1);
    assert.equal(admin.body.data[0].visibility, 'private');
  });

  test('CSV export carries each lead\'s latest note, falling back to an old remark', async () => {
    await call('bde', 'POST', `${ess}/${L.exportA}/notes`, { text: 'first note' });
    await call('bde', 'POST', `${ess}/${L.exportA}/notes`, { text: 'newest note' });
    const r = await call('super', 'GET', '/leads?export=true&leadType=All&search=NOREM');
    assert.equal(r.status, 200);
    const by = (key) => r.body.data.find((l) => String(l._id) === L[key]);
    assert.equal(by('exportA').latestNote.text, 'newest note');
    assert.equal(by('exportLegacy').latestNote, null);
    assert.equal(by('exportLegacy').remark, 'only an old remark', 'the client falls back to this for the export cell');
  });
});

describe('Lead import — note column becomes shared notes', () => {
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const sheet = (rows, header = 'Full Name,Phone,Email,Status,Latest note,City') => Buffer.from([header, ...rows].join('\n'));
  const run = async (buffer, name = 'import.csv') => {
    const { prepareImport, runImport } = require('../../services/leadImport');
    const prepared = await prepareImport(buffer, name);
    return runImport(prepared, name, { id: ids.super });
  };
  const noteTexts = async (leadId) => (await require('../../models/LeadNote').find({ lead: leadId }).sort({ createdAt: 1 })).map((n) => n.text);

  test('a new lead gets its sheet note as a shared note by the importer, and stays in Raw', async () => {
    const out = await run(sheet(['Imported One,9811100001,imp1@x.com,,Met at the expo,Pune']));
    assert.equal(out.imported, 1, JSON.stringify(out));
    const lead = await leadsCol().findOne({ email: 'imp1@x.com' });
    assert.equal(lead.remark, undefined, 'never written as a lead-level remark');
    const LeadNote = require('../../models/LeadNote');
    const note = await LeadNote.findOne({ lead: lead._id });
    assert.equal(note.text, 'Met at the expo');
    assert.equal(note.visibility, 'shared');
    assert.equal(String(note.author), ids.super);
    assert.equal(lead.firstContactAt ?? null, null, 'an imported note is not a BD working the lead');
    assert.ok(lead.pipelineHistory.some((h) => h.status === 'Note imported'));
  });

  test('re-importing the same sheet adds no duplicate note', async () => {
    const rows = ['Imported Two,9811100002,imp2@x.com,,Wants pricing,Delhi'];
    await run(sheet(rows));
    const lead = await leadsCol().findOne({ email: 'imp2@x.com' });
    const again = await run(sheet(rows));
    assert.equal(again.imported, 0);
    assert.equal(again.unchanged, 1, JSON.stringify(again));
    assert.deepEqual(await noteTexts(lead._id), ['Wants pricing']);
  });

  test('an existing lead gets a new note appended; its fields and older notes stay', async () => {
    await run(sheet(['Imported Three,9811100003,imp3@x.com,,first,Goa']));
    const lead = await leadsCol().findOne({ email: 'imp3@x.com' });
    const out = await run(sheet(['Imported Three,9811100003,imp3@x.com,,second,Goa']));
    assert.equal(out.updated, 1, JSON.stringify(out));
    assert.deepEqual(await noteTexts(lead._id), ['first', 'second']);
    assert.equal((await leadsCol().findOne({ _id: lead._id })).remark, undefined);
  });

  test('the old "Remark" header still imports, as a note', async () => {
    const out = await run(sheet(['Imported Four,9811100004,imp4@x.com,,legacy header,Agra'], 'Full Name,Phone,Email,Status,Remark,City'));
    assert.equal(out.imported, 1);
    const lead = await leadsCol().findOne({ email: 'imp4@x.com' });
    assert.deepEqual(await noteTexts(lead._id), ['legacy header']);
  });

  test('an exported file (Latest note column) round-trips: the same notes are not added twice', async () => {
    await run(sheet(['Imported Five,9811100005,imp5@x.com,,Called twice,Surat']));
    const lead = await leadsCol().findOne({ email: 'imp5@x.com' });
    const out = await run(sheet(['Imported Five,9811100005,imp5@x.com,New,Called twice,Surat']));
    assert.equal(out.imported + out.updated, 0, JSON.stringify(out));
    assert.deepEqual(await noteTexts(lead._id), ['Called twice']);
  });

  test('importing does not touch call-level remarks on existing leads', async () => {
    const id = (await leadsCol().insertOne({
      fullName: 'Has Calls', phone: '9811100006', phoneNormalized: '9811100006', email: 'imp6@x.com', emailNormalized: 'imp6@x.com',
      status: 'Contacted', leadType: 'Sales', platform: 'Facebook', createdAt: new Date(), updatedAt: new Date(), documents: [], pipelineHistory: [],
      callLogs: [{ touchNumber: 1, calledBy: oidOf(ids.bde), callDate: new Date(), connected: 'Yes', remark: 'call-level text' }],
    })).insertedId;
    await run(sheet(['Has Calls,9811100006,imp6@x.com,,sheet note,']));
    const lead = await leadsCol().findOne({ _id: id });
    assert.equal(lead.callLogs[0].remark, 'call-level text');
    assert.deepEqual(await noteTexts(id), ['sheet note']);
  });
});


describe('Call note — optional text on the call record', () => {
  const ess = '/employee-portal/ess/leads';
  const oidOf = (id) => new mongoose.Types.ObjectId(id);
  const leadsCol = () => mongoose.connection.db.collection('leads');
  const L = {};
  const later = new Date(Date.now() + 3 * 864e5).toISOString();
  const outcome = { connected: 'No', notConnectedReason: 'Ringing / No Answer' };
  const helper = 'payViewer'; // another BD, shared into the lead below

  before(async () => {
    const make = async (key, fields = {}) => {
      const now = new Date();
      L[key] = String((await leadsCol().insertOne({
        fullName: `CALLNOTE ${key}`, phone: '9866666666', email: `callnote-${key}@lead.test`, status: 'New', leadType: 'Sales',
        platform: 'Facebook', createdAt: now, updatedAt: now, documents: [],
        pipelineHistory: [{ status: 'New', date: now, note: 'Lead captured' }],
        assignedTo: oidOf(ids.bde), assignedAt: now, ...fields,
      })).insertedId);
    };
    for (const key of ['without', 'with', 'edit', 'noCall', 'shared', 'amend', 'long']) await make(key);
  });

  const doc = (key) => leadsCol().findOne({ _id: oidOf(L[key]) });
  const bdRow = async (key) => (await call('bde', 'GET', `/employee-portal/ess/lead-activity?limit=100&client=CALLNOTE%20${key}`)).body.data;

  test('the note is optional: an outcome saves without one', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.without}`, outcome);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('without');
    assert.equal(lead.callLogs.length, 1);
    assert.equal(lead.callLogs[0].remark, '');
    const rows = await bdRow('without');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].remark, '', 'an empty note shows as an empty Remark / note cell');
  });

  test('a note typed with the outcome is saved on that call and shows in Lead Activity', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.with}`, { ...outcome, callNote: '  Phone was off, will retry after lunch  ' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('with');
    assert.equal(lead.callLogs[0].remark, 'Phone was off, will retry after lunch', 'trimmed');
    assert.equal(lead.remark, undefined, 'and never saved as a lead-level remark');
    // BD portal and Admin both see it in the Remark / note column
    assert.equal((await bdRow('with'))[0].remark, 'Phone was off, will retry after lunch');
    const admin = await call('super', 'GET', '/admin/activity/calls?limit=100&client=CALLNOTE%20with');
    assert.equal(admin.body.data[0].remark, 'Phone was off, will retry after lunch');
  });

  test('a note added afterwards edits the latest call: no new call, same touch number', async () => {
    await call('bde', 'PUT', `${ess}/${L.edit}`, outcome);
    const before = await doc('edit');
    const r = await call('bde', 'PUT', `${ess}/${L.edit}`, { callNote: 'Left a voicemail' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const lead = await doc('edit');
    assert.equal(lead.callLogs.length, 1, 'still one call');
    assert.equal(lead.touchNumber, before.touchNumber);
    assert.equal(lead.callLogs[0].remark, 'Left a voicemail');
    assert.equal(lead.callLogs[0].connected, 'No', 'the outcome itself is untouched');
    // and it can be changed or cleared again
    await call('bde', 'PUT', `${ess}/${L.edit}`, { callNote: '' });
    assert.equal((await doc('edit')).callLogs[0].remark, '');
  });

  test('it only changes the latest call; earlier calls keep their notes', async () => {
    await call('bde', 'PUT', `${ess}/${L.edit}`, { connected: 'Yes', interestLevel: 'Cold', callNote: 'second call text', callStartTime: new Date(Date.now() - 3600e3).toISOString(), callEndTime: new Date(Date.now() - 3000e3).toISOString() });
    const lead = await doc('edit');
    assert.equal(lead.callLogs.length, 2);
    await call('bde', 'PUT', `${ess}/${L.edit}`, { callNote: 'edited latest' });
    const after = await doc('edit');
    assert.equal(after.callLogs.length, 2);
    assert.equal(after.callLogs[0].remark, '');
    assert.equal(after.callLogs[1].remark, 'edited latest');
  });

  test('a note with no call logged yet is refused, with a clear reason', async () => {
    const r = await call('bde', 'PUT', `${ess}/${L.noCall}`, { callNote: 'nothing to attach to' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Log a call outcome first/);
    assert.equal((await doc('noCall')).callLogs, undefined);
  });

  test('only the person who made the call (or a Super Admin) can change its note', async () => {
    await call('bde', 'PUT', `${ess}/${L.shared}`, { ...outcome, callNote: 'owner call' });
    assert.equal((await call('super', 'POST', `/leads/${L.shared}/share`, { adminId: ids[helper] })).status, 201);
    const other = await call(helper, 'PUT', `${ess}/${L.shared}`, { callNote: 'overwritten' });
    assert.equal(other.status, 403, JSON.stringify(other.body));
    assert.match(other.body.message, /Only the person who made the call/);
    assert.equal((await doc('shared')).callLogs[0].remark, 'owner call');
    const admin = await call('super', 'PUT', `/leads/${L.shared}`, { callNote: 'admin edit' });
    assert.equal(admin.status, 200, JSON.stringify(admin.body));
    assert.equal((await doc('shared')).callLogs[0].remark, 'admin edit');
  });

  test('re-saving the same call without a note keeps the note it has', async () => {
    const start = new Date(Date.now() - 600e3).toISOString();
    const end = new Date(Date.now() - 300e3).toISOString();
    await call('bde', 'PUT', `${ess}/${L.amend}`, { ...outcome, callStartTime: start, callEndTime: end, callNote: 'kept' });
    const again = await call('bde', 'PUT', `${ess}/${L.amend}`, { connected: 'No', notConnectedReason: 'Number Busy', callStartTime: start, callEndTime: end });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const lead = await doc('amend');
    assert.equal(lead.callLogs.length, 1, 'amended, not duplicated');
    assert.equal(lead.callLogs[0].notConnectedReason, 'Number Busy');
    assert.equal(lead.callLogs[0].remark, 'kept');
  });

  test('notes are capped at 1000 characters', async () => {
    await call('bde', 'PUT', `${ess}/${L.long}`, { ...outcome, callNote: 'x'.repeat(1500) });
    assert.equal((await doc('long')).callLogs[0].remark.length, 1000);
  });

  test('a call note is not an action by itself: it does not change what list the lead is on', async () => {
    const lead = await doc('edit');
    assert.equal(lead.lastActivityType, 'Call logged');
    const stamp = String(lead.lastActivityAt);
    await call('bde', 'PUT', `${ess}/${L.edit}`, { callNote: 'again' });
    assert.equal(String((await doc('edit')).lastActivityAt), stamp, 'last-activity time is only moved by real activity');
  });
});
