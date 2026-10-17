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

  test('the migration converts legacy grants once, with a backup', async () => {
    const run = (args) => new Promise((resolve, reject) => execFile(process.execPath, ['scripts/migrations/migrateCrmGrants.js', ...args], {
      cwd: SERVER_DIR, env: { ...process.env, MONGODB_URI: mongo.getUri('vedhunt_e2e') }, // never server/.env's database
    }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
    assert.match(await run([]), /1 login\(s\) to migrate/);
    assert.match(await run(['--apply']), /Migrated 1 login\(s\)/);
    assert.match(await run(['--apply']), /Nothing to migrate/);
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
