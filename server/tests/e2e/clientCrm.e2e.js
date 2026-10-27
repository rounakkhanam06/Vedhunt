/**
 * End-to-end check of the Client Portal CRM foundations against the REAL
 * server (server.js) backed by a throwaway in-memory MongoDB — nothing here
 * touches the database in server/.env.
 *
 *   npm run test:e2e
 *
 * Covers: atomic payment approval, derived overdue / balance, UTR and amount
 * checks on proofs, retainer hours from work logs, work-log client links,
 * the onboarding go-live gate, the portfolio KPIs and the audit trail.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER_DIR = path.resolve(__dirname, '../..');
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
const JWT_SECRET = 'e2e-test-secret';

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
  JWT_CLIENT_SECRET: '',
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
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
});

const adminToken = () => jwt.sign({ id: ids.super }, JWT_SECRET, { expiresIn: '1h' });
const clientToken = (key) => jwt.sign({ id: ids[key], tv: 0 }, JWT_SECRET, { expiresIn: '1h' });

const request = async (token, method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
};
const admin = (method, url, body) => request(adminToken(), method, url, body);
const asClient = (key, method, url, body) => request(clientToken(key), method, url, body);

const DAY = 864e5;
const inv = (client, total, dueInDays, extra = {}) => require('../../models/Invoice').create({
  client_ref: client, dueDate: new Date(Date.now() + dueInDays * DAY), totalAmount: total, subtotal: total, taxPercent: 0, taxAmount: 0,
  lineItems: [{ description: 'Retainer', qty: 1, unitPrice: total, amount: total }], ...extra,
});
const proof = (invoice, client, amount, utr) => require('../../models/PaymentProof').create({
  invoice_ref: invoice, client_ref: client, amountPaid: amount, utrNumber: utr, paymentDate: new Date(), status: 'Pending',
});

async function seed() {
  const Role = require('../../models/Role');
  const Admin = require('../../models/Admin');
  const Client = require('../../models/Client');
  const Retainer = require('../../models/Retainer');
  const Settings = require('../../models/Settings');
  const { DEFAULT_EMPLOYEE_ROLES } = require('../../utils/employeeRoles');

  await Settings.create([
    { key: 'employee_roles_seeded', value: DEFAULT_EMPLOYEE_ROLES.map((r) => r.name) },
    { key: 'permission_migration', value: { version: 1 } },
  ]);
  const superRole = await Role.create({ name: 'SUPER_ADMIN', permissions: ['*'] });
  const su = await Admin.create({ firstName: 'Super', lastName: 'Admin', email: 'super@e2e.test', password: 'Passw0rd!e2e', roles: [superRole._id] });
  ids.super = String(su._id);

  // One at a time — clientId is generated from the previous one
  const mk = async (key, name, extra = {}) => {
    const c = await Client.create({
      businessName: name, contactName: 'Owner Person', email: `${key}@example.com`, phone: '+919800000001',
      password: 'ClientPass1', isTemporaryPassword: false, ...extra,
    });
    ids[key] = String(c._id);
    return c;
  };
  const alpha = await mk('alpha', 'Alpha Ltd');
  const beta = await mk('beta', 'Beta Ltd');
  const gamma = await mk('gamma', 'Gamma Ltd');
  await mk('delta', 'Delta Ltd', { isActive: false });

  const now = new Date();
  const retainer = (client, amount, hours, extra = {}) => Retainer.create({
    client_ref: client._id, packageName: 'Performance Retainer', monthlyAmount: amount, supportHoursPerMonth: hours,
    contractStartDate: new Date(now.getFullYear(), 0, 1), contractEndDate: new Date(now.getFullYear() + 1, 0, 1), ...extra,
  });
  ids.retAlpha = String((await retainer(alpha, 15000, 10, { hoursUsedThisMonth: 4 }))._id);
  ids.retBeta = String((await retainer(beta, 45000, 20, { billingCycle: 'Quarterly' }))._id); // 15000 / month
  ids.retGamma = String((await retainer(gamma, 30000, 10))._id);
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('vedhunt_crm_e2e');
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
  if (process.env.E2E_SERVER_LOG) require('fs').writeFileSync(process.env.E2E_SERVER_LOG, serverLog);
  server?.kill();
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('payments — approval credits an invoice exactly once', () => {
  test('two reviewers approving the same proof together credit it once', async () => {
    const invoice = await inv(ids.alpha, 1000, 10);
    const p = await proof(invoice._id, ids.alpha, 600, 'UTRRACE00000001');
    const [a, b] = await Promise.all([
      admin('PUT', `/admin/payments/${p._id}/approve`),
      admin('PUT', `/admin/payments/${p._id}/approve`),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 400]);
    const after = await require('../../models/Invoice').findById(invoice._id).lean();
    assert.equal(after.paidAmount, 600);
    assert.notEqual(after.paymentStatus, 'Paid');
  });

  test('a second proof that settles the balance marks the invoice Paid', async () => {
    const Invoice = require('../../models/Invoice');
    const invoice = await inv(ids.alpha, 1000, 10);
    const p1 = await proof(invoice._id, ids.alpha, 600, 'UTRSETTLE0000001');
    const p2 = await proof(invoice._id, ids.alpha, 400, 'UTRSETTLE0000002');
    assert.equal((await admin('PUT', `/admin/payments/${p1._id}/approve`)).status, 200);
    assert.equal((await admin('PUT', `/admin/payments/${p2._id}/approve`)).status, 200);
    const after = await Invoice.findById(invoice._id).lean();
    assert.equal(after.paidAmount, 1000);
    assert.equal(after.paymentStatus, 'Paid');
    assert.ok(after.paidOn);
  });

  test('approving or rejecting an already-decided proof is refused', async () => {
    const invoice = await inv(ids.alpha, 500, 10);
    const p = await proof(invoice._id, ids.alpha, 100, 'UTRDECIDED000001');
    assert.equal((await admin('PUT', `/admin/payments/${p._id}/reject`, { rejectionReason: 'Blurry' })).status, 200);
    assert.equal((await admin('PUT', `/admin/payments/${p._id}/approve`)).status, 400);
    assert.equal((await admin('PUT', `/admin/payments/${p._id}/reject`, { rejectionReason: 'Again' })).status, 400);
    assert.equal((await require('../../models/Invoice').findById(invoice._id).lean()).paidAmount, 0);
  });

  test('every decision leaves an audit entry with who, what and the record', async () => {
    const AuditLog = require('../../models/AuditLog');
    const approve = await AuditLog.findOne({ action: 'PAYMENT_APPROVE' }).lean();
    assert.ok(approve, 'PAYMENT_APPROVE logged');
    assert.equal(approve.actorType, 'Admin');
    assert.equal(approve.actorName, 'Super Admin');
    assert.ok(approve.recordId);
    assert.equal(approve.outcome, 'success');
    assert.ok(await AuditLog.findOne({ action: 'PAYMENT_REJECT' }).lean(), 'PAYMENT_REJECT logged');
  });
});

describe('payments — client submissions are checked', () => {
  test('amount must be positive and within the outstanding balance', async () => {
    const invoice = await inv(ids.beta, 1000, 10);
    const body = (amountPaid, utr) => ({ invoice_ref: String(invoice._id), amountPaid, utrNumber: utr });
    assert.equal((await asClient('beta', 'POST', '/client/payments', body(0, 'UTRSUBMIT0000001'))).status, 400);
    assert.equal((await asClient('beta', 'POST', '/client/payments', body(1500, 'UTRSUBMIT0000002'))).status, 400);
    assert.equal((await asClient('beta', 'POST', '/client/payments', body(400, 'UTRSUBMIT0000003'))).status, 201);
  });

  test('the same UTR cannot back two live proofs', async () => {
    const invoice = await inv(ids.beta, 1000, 10);
    const body = { invoice_ref: String(invoice._id), amountPaid: 100, utrNumber: 'UTRSUBMIT0000003' };
    assert.equal((await asClient('beta', 'POST', '/client/payments', body)).status, 409);
  });

  test('a fully paid invoice takes no more proofs', async () => {
    const invoice = await inv(ids.beta, 1000, 10, { paidAmount: 1000, paymentStatus: 'Paid' });
    const res = await asClient('beta', 'POST', '/client/payments', { invoice_ref: String(invoice._id), amountPaid: 10, utrNumber: 'UTRSUBMIT0000009' });
    assert.equal(res.status, 400);
  });

  test("a client cannot pay against another client's invoice", async () => {
    const invoice = await inv(ids.alpha, 1000, 10);
    const res = await asClient('beta', 'POST', '/client/payments', { invoice_ref: String(invoice._id), amountPaid: 10, utrNumber: 'UTRSUBMIT0000010' });
    assert.equal(res.status, 404);
  });
});

describe('invoices — overdue and balance are derived', () => {
  before(async () => {
    ids.invOverdue = String((await inv(ids.gamma, 2000, -10, { paidAmount: 500 }))._id);
    ids.invPaidLate = String((await inv(ids.gamma, 800, -20, { paidAmount: 800, paymentStatus: 'Paid' }))._id);
    ids.invFuture = String((await inv(ids.gamma, 700, 15))._id);
  });

  test('the Overdue filter returns only unpaid-past-due invoices, with balance and days', async () => {
    const res = await admin('GET', `/admin/invoices?status=Overdue&client_ref=${ids.gamma}`);
    assert.equal(res.status, 200);
    const list = res.body.data;
    assert.equal(list.length, 1);
    assert.equal(String(list[0]._id), ids.invOverdue);
    assert.equal(list[0].paymentStatus, 'Overdue');
    assert.equal(list[0].balance, 1500);
    assert.equal(list[0].daysOverdue, 10);
  });

  test('the Unpaid filter excludes overdue and paid invoices', async () => {
    const res = await admin('GET', `/admin/invoices?status=Unpaid&client_ref=${ids.gamma}`);
    assert.deepEqual(res.body.data.map((i) => String(i._id)), [ids.invFuture]);
  });

  test('the client portal shows the same overdue split', async () => {
    const res = await asClient('gamma', 'GET', '/client/invoices');
    assert.equal(res.status, 200);
    assert.equal(res.body.summary.Overdue, 1);
    assert.equal(res.body.summary.Paid, 1);
    assert.equal(res.body.summary.Unpaid, 1);
    const overdue = res.body.data.find((i) => String(i._id) === ids.invOverdue);
    assert.equal(overdue.paymentStatus, 'Overdue');
    assert.equal(overdue.balance, 1500);
  });
});

describe('retainer hours come from linked work logs', () => {
  test('with no linked time the typed value is used and labelled manual', async () => {
    const res = await admin('GET', `/admin/retainers/${ids.retAlpha}`);
    assert.equal(res.body.data.hoursSource, 'manual');
    assert.equal(res.body.data.hoursUsedThisMonth, 4);
  });

  test('billable logs for the client replace the typed number; non-billable and other clients do not count', async () => {
    const WorkLog = require('../../models/WorkLog');
    const date = new Date();
    const log = (client, minutes, billable) => ({
      employeeId: new mongoose.Types.ObjectId(), date, startTime: date, duration: minutes, project: 'P', task: 'T',
      activityType: 'Campaign Optimisation', isBillable: billable, client_ref: client,
    });
    await WorkLog.create([log(ids.alpha, 90, true), log(ids.alpha, 30, true), log(ids.alpha, 600, false), log(ids.beta, 300, true)]);

    const res = await admin('GET', `/admin/retainers/${ids.retAlpha}`);
    assert.equal(res.body.data.hoursSource, 'worklogs');
    assert.equal(res.body.data.hoursUsedLogged, 2);
    assert.equal(res.body.data.hoursUsedThisMonth, 2);
    assert.equal(res.body.data.hoursRemaining, 8);
    assert.equal(res.body.data.hoursOverage, 0);

    // The client sees the same figure on their portal
    const mine = await asClient('alpha', 'GET', '/client/retainers');
    assert.equal(mine.body.data[0].hoursUsedThisMonth, 2);
    assert.equal(mine.body.data[0].hoursSource, 'worklogs');
  });

  test('time beyond the included hours is reported as overage', async () => {
    const WorkLog = require('../../models/WorkLog');
    const date = new Date();
    await WorkLog.create({
      employeeId: new mongoose.Types.ObjectId(), date, startTime: date, duration: 12 * 60, project: 'P', task: 'T',
      activityType: 'Campaign Optimisation', isBillable: true, client_ref: ids.alpha,
    });
    const res = await admin('GET', `/admin/retainers/${ids.retAlpha}`);
    assert.equal(res.body.data.hoursUsedLogged, 14);
    assert.equal(res.body.data.hoursOverage, 4);
    assert.equal(res.body.data.hoursRemaining, 0);
  });
});

describe('work-log links — the timer checks client, project and ticket agree', () => {
  test('a project or ticket from a different client is refused; matching ones imply the client', async () => {
    const { resolveLinks } = require('../../services/workTimer');
    const Project = require('../../models/Project');
    const SupportTicket = require('../../models/SupportTicket');
    const projectA = await Project.create({ client_ref: ids.alpha, projectName: 'Alpha site' });
    const ticketB = await SupportTicket.create({ client_ref: ids.beta, subject: 'Pixel', description: 'Broken', category: 'Bug Report' });

    const mismatch = await resolveLinks({ client_ref: ids.beta, project_ref: String(projectA._id) });
    assert.equal(mismatch.ok, false);
    assert.equal((await resolveLinks({ client_ref: ids.alpha, ticket_ref: String(ticketB._id) })).ok, false);
    assert.equal((await resolveLinks({ client_ref: 'nope' })).ok, false);

    const implied = await resolveLinks({ project_ref: String(projectA._id) });
    assert.equal(implied.ok, true);
    assert.equal(String(implied.refs.client_ref), ids.alpha);
    assert.equal((await resolveLinks({})).ok, true); // internal work has no client
  });

  test('technical time on a ticket is the sum of the work logs linked to it', async () => {
    const WorkLog = require('../../models/WorkLog');
    const SupportTicket = require('../../models/SupportTicket');
    const ticket = await SupportTicket.create({ client_ref: ids.alpha, subject: 'CAPI', description: 'Duplicate events', category: 'Bug Report' });
    const date = new Date();
    const log = (minutes) => ({ employeeId: new mongoose.Types.ObjectId(), date, startTime: date, duration: minutes, project: 'P', task: 'T', activityType: 'Technical', client_ref: ids.alpha, ticket_ref: ticket._id });
    await WorkLog.create([log(45), log(30)]);
    const res = await admin('GET', `/admin/tickets/${ticket._id}`);
    assert.equal(res.body.data.technicalMinutes, 75);
  });

  test('root cause is internal: saved by staff, never returned to the client', async () => {
    const SupportTicket = require('../../models/SupportTicket');
    const ticket = await SupportTicket.create({ client_ref: ids.alpha, subject: 'Tag', description: 'Missing', category: 'Bug Report' });
    const put = await admin('PUT', `/admin/tickets/${ticket._id}`, { rootCause: 'GTM container was unpublished' });
    assert.equal(put.status, 200);
    assert.equal((await admin('GET', `/admin/tickets/${ticket._id}`)).body.data.rootCause, 'GTM container was unpublished');
    const mine = await asClient('alpha', 'GET', `/client/tickets/${ticket._id}`);
    assert.equal(mine.status, 200);
    assert.equal(JSON.stringify(mine.body).includes('GTM container'), false);
  });
});

describe('work timer — staff log only against clients they are linked to', () => {
  const makeStaff = async (key) => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const Employee = require('../../models/Employee');
    const role = (await Role.findOne({ name: 'STAFF_E2E' })) || (await Role.create({ name: 'STAFF_E2E', permissions: ['ess.access'], isEmployeeRole: true }));
    const a = await Admin.create({ firstName: key, lastName: 'Staff', email: `${key}@e2e.test`, password: 'Passw0rd!e2e', roles: [role._id], employeeId: `VH-T-${key}` });
    const today = new Date();
    const doc = await Employee.collection.insertOne({
      employeeId: `VH-T-${key}`, adminId: a._id, firstName: key, lastName: 'Staff', email: `${key}@e2e.test`, phone: '9800000000',
      roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent',
      attendance: [{ date: today, clockIn: today }],
    });
    ids[`adm_${key}`] = String(a._id);
    ids[`emp_${key}`] = String(doc.insertedId);
  };
  const timer = () => require('../../services/workTimer');
  const START = { project: 'Campaign', task: 'Optimise', activityType: 'Client Work' };

  before(async () => {
    await makeStaff('linked');
    await makeStaff('stranger');
    await makeStaff('teammate');
    const Client = require('../../models/Client');
    const Project = require('../../models/Project');
    await Client.updateOne({ _id: ids.alpha }, { $set: { 'profile.accountManager': ids.emp_linked } });
    const proj = await Project.create({ client_ref: ids.beta, projectName: 'Beta site', teamMembers: [ids.emp_teammate] });
    ids.projBeta = String(proj._id);
  });

  test('the picker lists only the clients the person is linked to', async () => {
    const { linkableClientsFor } = require('../../services/employeeClients');
    assert.deepEqual((await linkableClientsFor(ids.adm_linked)).map((c) => String(c._id)), [ids.alpha]);
    assert.deepEqual(await linkableClientsFor(ids.adm_stranger), []);
    const team = await linkableClientsFor(ids.adm_teammate);
    assert.deepEqual(team.map((c) => String(c._id)), [ids.beta]);
    assert.deepEqual(team[0].projects.map((p) => String(p._id)), [ids.projBeta]);
  });

  test('the API refuses a client the person is not linked to', async () => {
    const r = await timer().startTimer(ids.adm_stranger, { ...START, client_ref: ids.alpha });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    // A project of someone else's client is refused the same way (it implies the client)
    const p = await timer().startTimer(ids.adm_linked, { ...START, project_ref: ids.projBeta });
    assert.equal(p.ok, false);
    assert.equal(p.status, 403);
  });

  test('a linked person can start, and the stopped session carries client, outcome and billable time', async () => {
    const WorkLog = require('../../models/WorkLog');
    const started = await timer().startTimer(ids.adm_linked, { ...START, client_ref: ids.alpha });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(String(started.activeTimer.client_ref), ids.alpha);
    // pretend the session ran for 30 minutes
    const Employee = require('../../models/Employee');
    await Employee.collection.updateOne({ adminId: new mongoose.Types.ObjectId(ids.adm_linked) }, { $set: { 'activeTimer.startTime': new Date(Date.now() - 30 * 60000) } });
    const stopped = await timer().stopTimer(ids.adm_linked, { outcome: 'Cut CPL by pausing two weak ad sets', visibility: 'Client' });
    assert.equal(stopped.ok, true, JSON.stringify(stopped));
    const log = await WorkLog.findById(stopped.workLog._id).lean();
    assert.equal(String(log.client_ref), ids.alpha);
    assert.equal(log.isBillable, true);
    assert.equal(log.outcome, 'Cut CPL by pausing two weak ad sets');
    assert.equal(log.visibility, 'Client');
    assert.ok(log.duration >= 29);
  });

  test('a project teammate can link the project and the client follows from it', async () => {
    const started = await timer().startTimer(ids.adm_teammate, { ...START, project_ref: ids.projBeta });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(String(started.activeTimer.client_ref), ids.beta);
    assert.equal(String(started.activeTimer.project_ref), ids.projBeta);
  });

  test('internal work needs no client', async () => {
    const r = await timer().startTimer(ids.adm_stranger, { ...START, activityType: 'Internal Meeting' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.activeTimer.client_ref, null);
  });
});

describe('onboarding — the go-live gate', () => {
  before(async () => {
    const res = await admin('PUT', `/admin/clients/${ids.alpha}`, {
      profile: { services: ['Performance Marketing'], platforms: ['Meta'], onboardingDate: '2026-05-26' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('the checklist is built from the client services and platforms', async () => {
    const res = await admin('GET', `/admin/clients/${ids.alpha}/onboarding`);
    assert.equal(res.status, 200);
    const keys = res.body.data.items.map((i) => i.key);
    assert.ok(keys.includes('meta_pixel_capi'));
    assert.ok(!keys.includes('google_tracking'), 'no Google steps for a Meta-only client');
    assert.equal(res.body.data.readyForGoLive, false);
  });

  test('going live is refused and names every blocking step', async () => {
    const res = await admin('POST', `/admin/clients/${ids.alpha}/onboarding/go-live`, {});
    assert.equal(res.status, 409);
    assert.ok(res.body.blockers.length >= 5);
    assert.ok(res.body.blockers.some((b) => b.key === 'contract_signed'));
  });

  test('a step needing evidence cannot be completed without remarks; Not Applicable needs a reason', async () => {
    const put = (key, body) => admin('PUT', `/admin/clients/${ids.alpha}/onboarding/items/${key}`, body);
    assert.equal((await put('contract_signed', { status: 'Completed' })).status, 400);
    assert.equal((await put('meta_access', { status: 'Not Applicable' })).status, 400);
    assert.equal((await put('contract_signed', { status: 'Completed', remarks: 'Signed copy received by email on 12 Oct' })).status, 200);
  });

  test('an exception is allowed only with a written reason, and is recorded', async () => {
    const short = await admin('POST', `/admin/clients/${ids.alpha}/onboarding/go-live`, { exception: { reason: 'rush' } });
    assert.equal(short.status, 409);
    const ok = await admin('POST', `/admin/clients/${ids.alpha}/onboarding/go-live`, {
      exception: { reason: 'Client approved launching before creative sign-off' }, platformLinks: ['https://business.facebook.com/x'],
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.goLive.isLive, true);
    assert.ok(ok.body.data.goLive.exception.waivedItems.length >= 4);
    const AuditLog = require('../../models/AuditLog');
    const entry = await AuditLog.findOne({ action: 'CAMPAIGN_GO_LIVE_EXCEPTION' }).lean();
    assert.ok(entry);
    assert.match(entry.afterSnapshot.exception.reason, /creative sign-off/);
    // …and it cannot be done twice
    assert.equal((await admin('POST', `/admin/clients/${ids.alpha}/onboarding/go-live`, {})).status, 409);
  });

  test('a client with every step done goes live with no exception', async () => {
    await admin('PUT', `/admin/clients/${ids.beta}`, { profile: { services: ['Website Development'], platforms: [] } });
    const put = (key, body) => admin('PUT', `/admin/clients/${ids.beta}/onboarding/items/${key}`, body);
    assert.equal((await admin('GET', `/admin/clients/${ids.beta}/onboarding`)).body.data.items.length, 3);
    await put('contract_signed', { status: 'Completed', remarks: 'Signed copy emailed 12-Oct' });
    await put('advance_payment', { status: 'Completed', remarks: 'UTR verified in the bank statement' });
    await put('website_access', { status: 'Not Applicable', naReason: 'Static site hosted by us' });
    const res = await admin('POST', `/admin/clients/${ids.beta}/onboarding/go-live`, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.goLive.exception.waivedItems.length, 0);
  });

  test('profile edits are validated and audited', async () => {
    const bad = await admin('PUT', `/admin/clients/${ids.gamma}`, { profile: { onboardingDate: '2026-06-04', adAccountLiveDate: '2026-05-26' } });
    assert.equal(bad.status, 400);
    const ok = await admin('PUT', `/admin/clients/${ids.gamma}`, { profile: { sectors: ['Fitness'], monthlyAdBudget: 100000 } });
    assert.equal(ok.status, 200);
    const AuditLog = require('../../models/AuditLog');
    const entry = await AuditLog.findOne({ action: 'CLIENT_PROFILE_UPDATE', recordId: /VH-CL/ }).sort({ createdAt: -1 }).lean();
    assert.ok(entry);
  });

  test('a contact name with dots and hyphens is accepted', async () => {
    const res = await admin('PUT', `/admin/clients/${ids.gamma}`, { contactName: "Dr. A. K. O'Rao-Singh" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });
});

describe('campaign strategy — versioned, client sees only what is approved', () => {
  const v1 = { objective: 'More website purchases at healthy AOV', targetAudience: 'Men 20-45, Tier 1/2', competitorReference: 'Mudgar Club, SatvaFit', changeNote: 'Initial brief' };
  const save = (body) => admin('POST', `/admin/clients/${ids.delta}/strategy`, body);

  test('saving creates numbered versions and refuses empty or unchanged saves', async () => {
    assert.equal((await save({})).status, 400);
    const first = await save(v1);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.data.version, 1);
    assert.equal(first.body.data.authorName, 'Super Admin');
    assert.equal((await save(v1)).status, 400, 'identical content is not a new version');
    const second = await save({ ...v1, objective: 'ROAS above 4x on Meta + Google', changeNote: 'Raised the target' });
    assert.equal(second.body.data.version, 2);
  });

  test('the history lists newest first and says which fields each version changed', async () => {
    const res = await admin('GET', `/admin/clients/${ids.delta}/strategy`);
    assert.deepEqual(res.body.data.map((v) => v.version), [2, 1]);
    assert.deepEqual(res.body.data[0].changedFields, ['objective']);
    assert.ok(res.body.data[1].changedFields.length >= 2, 'the first version introduced every field');
  });

  test('nothing is visible to the client until a version is approved for sharing', async () => {
    const res = await asClient('delta', 'GET', '/client/strategy');
    assert.equal(res.status, 401, 'Delta is a suspended account in this fixture');
    // use an active client with the same flow
    const ok = await admin('POST', `/admin/clients/${ids.gamma}/strategy`, v1);
    assert.equal(ok.status, 201);
    assert.equal((await asClient('gamma', 'GET', '/client/strategy')).body.data, null);
  });

  test('a shared version shows client-safe fields only; later drafts stay hidden', async () => {
    assert.equal((await admin('PUT', `/admin/clients/${ids.gamma}/strategy/1/share`, { shared: true })).status, 200);
    await admin('POST', `/admin/clients/${ids.gamma}/strategy`, { ...v1, objective: 'Internal draft: change of direction' });

    const mine = await asClient('gamma', 'GET', '/client/strategy');
    assert.equal(mine.body.data.version, 1);
    assert.equal(mine.body.data.objective, v1.objective);
    const raw = JSON.stringify(mine.body);
    assert.equal(raw.includes('Mudgar Club'), false, 'competitor notes are internal');
    assert.equal(raw.includes('Initial brief'), false, 'change notes are internal');
    assert.equal(raw.includes('Super Admin'), false, 'authorship is internal');
    assert.equal(raw.includes('change of direction'), false, 'an unshared draft is never exposed');
  });

  test('sharing a newer version replaces it; hiding it falls back to the last shared one', async () => {
    await admin('PUT', `/admin/clients/${ids.gamma}/strategy/2/share`, { shared: true });
    assert.equal((await asClient('gamma', 'GET', '/client/strategy')).body.data.version, 2);
    await admin('PUT', `/admin/clients/${ids.gamma}/strategy/2/share`, { shared: false });
    assert.equal((await asClient('gamma', 'GET', '/client/strategy')).body.data.version, 1);
  });

  test("one client never sees another client's strategy", async () => {
    assert.equal((await asClient('alpha', 'GET', '/client/strategy')).body.data, null);
  });

  test('saving and sharing are audited', async () => {
    const AuditLog = require('../../models/AuditLog');
    assert.ok(await AuditLog.findOne({ action: 'STRATEGY_VERSION_CREATE' }).lean());
    assert.ok(await AuditLog.findOne({ action: 'STRATEGY_SHARE' }).lean());
    assert.ok(await AuditLog.findOne({ action: 'STRATEGY_UNSHARE' }).lean());
  });
});

describe('client overview — the landing page', () => {
  before(async () => {
    const Project = require('../../models/Project');
    await Project.create({
      client_ref: ids.gamma, projectName: 'Gamma store', internalNotes: 'SECRET margin note', status: 'Active',
      milestones: [
        { title: 'Design', status: 'Completed', targetDate: new Date('2026-09-01') },
        { title: 'Build', status: 'In Progress', targetDate: new Date('2026-11-15'), internalDescription: 'SECRET cost detail' },
      ],
    });
    const SupportTicket = require('../../models/SupportTicket');
    await SupportTicket.create({ client_ref: ids.gamma, subject: 'Need pixel access', description: 'Please share', category: 'Bug Report', status: 'Pending Client' });
  });

  test('summarises billing, projects, retainer, tickets and strategy for the signed-in client', async () => {
    const res = await asClient('gamma', 'GET', '/client/overview');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const d = res.body.data;
    assert.equal(d.billing.overdueInvoices, 1);
    assert.equal(d.billing.overdueAmount, 1500);
    assert.equal(d.billing.oldestOverdueDays, 10);
    assert.equal(d.billing.nextDue.balance, 700);
    assert.equal(d.projects[0].projectName, 'Gamma store');
    assert.equal(d.projects[0].progress, 50);
    assert.equal(d.projects[0].nextMilestone.title, 'Build');
    assert.equal(d.retainer.included, 10);
    assert.equal(d.tickets.awaitingClient, 1);
    assert.equal(d.strategy.version, 1);
  });

  test('actions put the overdue invoice first, then the ticket waiting on the client', async () => {
    const { actions } = (await asClient('gamma', 'GET', '/client/overview')).body.data;
    assert.deepEqual(actions.map((a) => a.key).slice(0, 2), ['overdue', 'ticket-reply']);
    assert.ok(actions.every((a) => a.tab));
  });

  test('chart data: invoiced vs collected by month, milestones per project, hours pacing', async () => {
    const d = (await asClient('gamma', 'GET', '/client/overview')).body.data;
    assert.equal(d.charts.billingTrend.length, 6);
    const thisMonth = d.charts.billingTrend[5];
    assert.equal(thisMonth.invoiced, 2000 + 800 + 700); // gamma's three invoices were issued now
    assert.equal(thisMonth.paid, 0, 'nothing verified yet — invoiced value is not cash collected');
    assert.equal(d.projects[0].milestonesDone, 1);
    assert.equal(d.projects[0].milestonesTotal, 2);
    assert.equal(d.charts.hoursTrend, null, 'no logged time yet, so no pacing line');

    // alpha has linked, billable work logs and verified payments this month
    const a = (await asClient('alpha', 'GET', '/client/overview')).body.data;
    assert.ok(a.charts.hoursTrend.days.length >= 1);
    assert.equal(a.charts.hoursTrend.included, 10);
    const last = a.charts.hoursTrend.days.at(-1);
    assert.equal(last.cumulative, a.retainer.used);
    assert.ok(a.charts.billingTrend[5].paid >= 1600);
  });

  test('nothing internal is exposed', async () => {
    const raw = JSON.stringify((await asClient('gamma', 'GET', '/client/overview')).body);
    for (const secret of ['SECRET', 'internalNotes', 'internalDescription', 'projectManager', 'teamMembers', 'renewalNotes', 'competitor']) {
      assert.equal(raw.includes(secret), false, `leaked ${secret}`);
    }
  });

  test('each client sees only their own figures, and a client with no activity gets empty sections', async () => {
    const beta = (await asClient('beta', 'GET', '/client/overview')).body.data;
    assert.equal(beta.billing.overdueInvoices, 0);
    assert.deepEqual(beta.projects.map((p) => p.projectName).filter((n) => n === 'Gamma store'), []);
    assert.equal(beta.strategy, null);
  });

  test('requires a client login', async () => {
    assert.equal((await request(null, 'GET', '/client/overview')).status, 401);
    assert.equal((await admin('GET', '/client/overview')).status, 401, 'an admin token is not a client token');
  });
});

describe('client notifications — the bell', () => {
  const list = async (who = 'beta') => (await asClient(who, 'GET', '/client/notifications')).body;
  const ofType = (body, type) => body.notifications.filter((n) => n.type === type);
  let baseline;

  before(async () => { baseline = (await list()).notifications.length; });

  test('an invoice from staff reaches the client bell, unread, with a link to billing — once it is sent', async () => {
    const res = await admin('POST', '/admin/invoices', {
      client_ref: ids.beta, dueDate: new Date(Date.now() + 10 * DAY).toISOString(), totalAmount: 5000,
      lineItems: [{ description: 'Retainer', qty: 1, unitPrice: 5000, amount: 5000 }],
      billing: { address: '12 MG Road, Pune', placeOfSupply: 'Maharashtra' },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await list()).notifications.length, baseline, 'saving alone tells the client nothing');
    const sent = await admin('POST', `/admin/invoices/${res.body.data._id}/send`, { type: 'Tax Invoice', date: '2026-07-03' });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const body = await list();
    const n = ofType(body, 'invoice_created')[0];
    assert.ok(n, 'invoice_created notification exists');
    assert.match(n.title, /VH-INV-/);
    assert.equal(n.read, false);
    assert.equal(n.link, '/client/dashboard?tab=billing');
    assert.equal(body.unreadCount, body.notifications.filter((x) => !x.read).length);
    assert.equal(body.notifications.length, baseline + 1);
    ids.notifInvoice = res.body.data._id;
  });

  test('approving and rejecting a payment proof each notify the client', async () => {
    const ok = await proof(ids.notifInvoice, ids.beta, 1000, 'UTRNOTIFY0000001');
    const bad = await proof(ids.notifInvoice, ids.beta, 500, 'UTRNOTIFY0000002');
    assert.equal((await admin('PUT', `/admin/payments/${ok._id}/approve`)).status, 200);
    assert.equal((await admin('PUT', `/admin/payments/${bad._id}/reject`, { rejectionReason: 'Screenshot unreadable' })).status, 200);
    const body = await list();
    assert.equal(ofType(body, 'payment_approved').length, 1);
    const rejected = ofType(body, 'payment_rejected')[0];
    assert.match(rejected.message, /Screenshot unreadable/);
  });

  test('a staff reply and a status change on a ticket notify the client', async () => {
    const SupportTicket = require('../../models/SupportTicket');
    const ticket = await SupportTicket.create({ client_ref: ids.beta, subject: 'Pixel not firing', description: 'Help', category: 'Bug Report' });
    assert.equal((await admin('POST', `/admin/tickets/${ticket._id}/messages`, { text: 'We are looking into it.' })).status, 200);
    assert.equal((await admin('PUT', `/admin/tickets/${ticket._id}`, { status: 'Pending Client' })).status, 200);
    const body = await list();
    assert.match(ofType(body, 'ticket_reply')[0].message, /We are looking into it/);
    assert.match(ofType(body, 'ticket_status')[0].title, /Pending Client/);
    // an internal status the client does not need (In Progress) stays silent
    const before = (await list()).notifications.length;
    await admin('PUT', `/admin/tickets/${ticket._id}`, { status: 'In Progress' });
    assert.equal((await list()).notifications.length, before);
  });

  test('changing the agreement terms asks the client to re-sign', async () => {
    const res = await admin('PUT', `/admin/clients/${ids.beta}`, { agreementDetails: { monthlyFee: 21000, gstAmount: 3780, totalPayable: 24780 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.agreementResignRequired, true);
    assert.equal(ofType(await list(), 'agreement_updated').length, 1);
  });

  test('marking one read lowers the unread count; mark-all clears it', async () => {
    const before = await list();
    const first = before.notifications.find((n) => !n.read);
    const one = await asClient('beta', 'PUT', `/client/notifications/${first._id}/read`);
    assert.equal(one.status, 200);
    const mid = await list();
    assert.equal(mid.unreadCount, before.unreadCount - 1);
    assert.equal((await asClient('beta', 'PUT', '/client/notifications/read-all')).status, 200);
    const after = await list();
    assert.equal(after.unreadCount, 0);
    assert.ok(after.notifications.every((n) => n.read));
  });

  test("a client sees only their own notifications and cannot mark someone else's", async () => {
    const mine = (await list('beta')).notifications[0];
    const gammaList = (await list('gamma')).notifications;
    assert.ok(gammaList.every((n) => String(n._id) !== String(mine._id)));
    assert.equal((await asClient('gamma', 'PUT', `/client/notifications/${mine._id}/read`)).status, 404);
    assert.equal((await asClient('beta', 'PUT', '/client/notifications/not-an-id/read')).status, 400);
    assert.equal((await request(null, 'GET', '/client/notifications')).status, 401);
  });

  test('a suspended client is not sent notifications', async () => {
    const ClientNotification = require('../../models/ClientNotification');
    const before = await ClientNotification.countDocuments({ client: ids.delta });
    const res = await admin('POST', '/admin/invoices', {
      client_ref: ids.delta, dueDate: new Date(Date.now() + 5 * DAY).toISOString(), totalAmount: 100,
      lineItems: [{ description: 'x', qty: 1, unitPrice: 100, amount: 100 }],
      billing: { address: '1 Test Street', placeOfSupply: 'Maharashtra' },
    });
    assert.equal(res.status, 201);
    assert.equal((await admin('POST', `/admin/invoices/${res.body.data._id}/send`, { type: 'Proforma Invoice', date: '2026-07-03' })).status, 200);
    assert.equal(await ClientNotification.countDocuments({ client: ids.delta }), before);
    // leave Delta as it was — later tests expect it to have no invoices
    await require('../../models/Invoice').deleteMany({ client_ref: ids.delta });
  });
});

describe('client notification emails — only the switched-on events are emailed', () => {
  const sent = [];
  let notify;
  const ClientNotification = () => require('../../models/ClientNotification');

  before(async () => {
    // Capture outgoing mail instead of sending it; clientNotify calls mailer.sendEmail at send time
    require('../../utils/sendEmail').sendEmail = async (o) => { sent.push(o); };
    notify = require('../../services/clientNotify');
    // Make sure the clients this block uses are active and have an email
    await require('../../models/Client').updateOne({ _id: ids.beta }, { $set: { isActive: true } });
  });
  const tick = () => new Promise((r) => setTimeout(r, 30)); // mail is fired in the background
  const fresh = async (fn) => { sent.length = 0; await fn(); await tick(); return [...sent]; };
  const ticket = (status) => ({ client_ref: ids.beta, ticketId: 'VH-TK-9999', subject: 'Pixel', status });

  test('defaults: an invoice email goes out, and the bell notification is stored too', async () => {
    const before = await ClientNotification().countDocuments({ client: ids.beta });
    const mail = await fresh(() => notify.notifyInvoiceCreated({ client_ref: ids.beta, invoiceId: 'VH-INV-X', totalAmount: 100, dueDate: new Date() }));
    assert.equal(mail.length, 1);
    assert.match(mail[0].subject, /New invoice/);
    assert.equal(await ClientNotification().countDocuments({ client: ids.beta }), before + 1);
  });

  test('defaults: confirmations and replies are bell-only — notification stored, no email', async () => {
    const before = await ClientNotification().countDocuments({ client: ids.beta });
    const mail = await fresh(async () => {
      await notify.notifyPaymentApproved({ client_ref: ids.beta, amountPaid: 100, utrNumber: 'U' }, { invoiceId: 'VH-INV-X', paymentStatus: 'Paid' });
      await notify.notifyTicketReply(ticket('Open'), 'Support', 'We fixed it');
      await notify.notifyTicketStatus(ticket('Resolved'));
    });
    assert.equal(mail.length, 0);
    assert.equal(await ClientNotification().countDocuments({ client: ids.beta }), before + 3);
  });

  test('a ticket waiting for the client is emailed, a resolved one is not', async () => {
    assert.equal((await fresh(() => notify.notifyTicketStatus(ticket('Pending Client')))).length, 1);
    assert.equal((await fresh(() => notify.notifyTicketStatus(ticket('Closed')))).length, 0);
  });

  test('a rejected payment and an agreement to sign are emailed', async () => {
    assert.equal((await fresh(() => notify.notifyPaymentRejected({ client_ref: ids.beta, amountPaid: 1, rejectionReason: 'Blurry' }, { invoiceId: 'X' }))).length, 1);
    assert.equal((await fresh(() => notify.notifyAgreementUpdated(ids.beta))).length, 1);
  });

  test('the switches can be read and changed by an admin, and take effect immediately', async () => {
    const got = await admin('GET', '/admin/settings/client-email-notifications');
    assert.equal(got.status, 200);
    assert.equal(got.body.events.length, 12);
    assert.equal(got.body.policy.payment_approved, false);

    const put = await admin('PUT', '/admin/settings/client-email-notifications', { policy: { payment_approved: true, invoice_created: false } });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.policy.payment_approved, true);

    const approved = await fresh(() => notify.notifyPaymentApproved({ client_ref: ids.beta, amountPaid: 1, utrNumber: 'U' }, { invoiceId: 'X', paymentStatus: 'Paid' }));
    assert.equal(approved.length, 1, 'now emailed');
    const invoice = await fresh(() => notify.notifyInvoiceCreated({ client_ref: ids.beta, invoiceId: 'X', totalAmount: 1, dueDate: new Date() }));
    assert.equal(invoice.length, 0, 'now bell-only');
    assert.equal((await ClientNotification().countDocuments({ client: ids.beta, type: 'invoice_created' })) > 0, true, 'the bell still gets it');
  });

  test('bad input is refused and nobody without a staff login can change the switches', async () => {
    assert.equal((await admin('PUT', '/admin/settings/client-email-notifications', { policy: { invoice_created: 'yes' } })).status, 400);
    assert.equal((await admin('PUT', '/admin/settings/client-email-notifications', { policy: 'all' })).status, 400);
    assert.equal((await request(null, 'PUT', '/admin/settings/client-email-notifications', { policy: {} })).status, 401);
    assert.equal((await asClient('beta', 'PUT', '/admin/settings/client-email-notifications', { policy: { invoice_created: true } })).status, 401);
  });
});

describe('KYC — GST, PAN, Aadhaar, photo and brand authorisation', () => {
  const GSTIN = '27AALCV0172E1ZD';
  const PAN = 'AALCV0172E';
  const AADHAAR = '234567890124'; // passes the Verhoeff check
  const jpg = (n = 200, fill = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, fill)]);
  const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);
  const pdf = () => Buffer.from(`%PDF-1.4\n${'x'.repeat(120)}`);
  const exe = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 3)]);

  const put = async (who, item, { value, bytes, name = 'document.jpg' } = {}) => {
    const form = new FormData();
    if (value !== undefined) form.append('value', value);
    if (bytes) form.append('file', new Blob([bytes]), name);
    const res = await fetch(`${base}/client/kyc/${item}`, { method: 'PUT', headers: { authorization: `Bearer ${clientToken(who)}` }, body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const mine = async (who) => (await asClient(who, 'GET', '/client/kyc')).body.data;
  const item = (data, key) => data.items.find((i) => i.key === key);
  const review = (client, key, body) => admin('PUT', `/admin/clients/${client}/kyc/${key}/review`, body);

  test('a new client starts with nothing submitted: four required items and one optional', async () => {
    const d = await mine('alpha');
    assert.equal(d.overall.status, 'not_started');
    assert.deepEqual(d.items.map((i) => [i.key, i.required]), [['gst', true], ['pan', true], ['aadhaar', true], ['photo', true], ['brand_authorisation', false]]);
    assert.ok(d.items.every((i) => i.status === 'Not Submitted' && !i.hasFile));
  });

  test('bad numbers, missing files and disguised files are all refused', async () => {
    assert.equal((await put('alpha', 'gst', { value: '27AALCV0172E1ZE', bytes: jpg() })).status, 400, 'wrong GSTIN check digit');
    assert.equal((await put('alpha', 'gst', { value: GSTIN })).status, 400, 'no document');
    const disguised = await put('alpha', 'gst', { value: GSTIN, bytes: exe(), name: 'certificate.jpg' });
    assert.equal(disguised.status, 400, 'an executable renamed to .jpg');
    assert.equal((await put('alpha', 'pan', { value: 'NOTAPAN', bytes: jpg() })).status, 400);
    assert.equal((await put('alpha', 'aadhaar', { value: '234567890123', bytes: jpg() })).status, 400, 'wrong Aadhaar check digit');
    assert.equal((await put('alpha', 'photo', { bytes: pdf(), name: 'me.pdf' })).status, 400, 'a photo must be an image');
    assert.equal((await put('alpha', 'gst', { value: GSTIN, bytes: Buffer.alloc(6 * 1024 * 1024, 7) })).status, 400, 'over 5MB');
    assert.equal((await mine('alpha')).overall.status, 'not_started', 'nothing was saved by the failures');
  });

  test('GST, PAN, Aadhaar, photo are accepted; staff are alerted', async () => {
    assert.equal((await put('alpha', 'gst', { value: ` ${GSTIN.toLowerCase()} `, bytes: pdf(), name: 'gst.pdf' })).status, 200);
    assert.equal((await put('alpha', 'pan', { value: PAN, bytes: jpg(300), name: 'pan.jpg' })).status, 200);
    assert.equal((await put('alpha', 'aadhaar', { value: '2345 6789 0124', bytes: png(), name: 'aadhaar.png' })).status, 200);
    const photo = await put('alpha', 'photo', { bytes: jpg(400, 9), name: 'me.jpg' });
    assert.equal(photo.status, 200, JSON.stringify(photo.body));
    const d = await mine('alpha');
    assert.equal(d.overall.status, 'in_review');
    assert.deepEqual(d.overall.missing, []);
    assert.ok(await require('../../models/Notification').findOne({ type: 'kyc_submitted' }).lean(), 'a reviewer was notified');
  });

  test('the client sees masked numbers only — and the database holds no full Aadhaar or plain PAN', async () => {
    const d = await mine('alpha');
    assert.equal(item(d, 'gst').displayValue, GSTIN);
    assert.equal(item(d, 'pan').displayValue, 'XXXXX0172E');
    assert.equal(item(d, 'aadhaar').displayValue, 'XXXX XXXX 0124');
    // (A GSTIN contains the PAN by design and the client typed it, so the PAN is checked on its own item)
    assert.equal(JSON.stringify(item(d, 'pan')).includes(PAN), false, 'the PAN item shows only the masked PAN');
    const raw = JSON.stringify(d);
    for (const secret of [AADHAAR, '2345 6789', '567890124', 'valueEnc']) assert.equal(raw.includes(secret), false, `response leaked ${secret}`);

    const record = await require('../../models/ClientKyc').findOne({ client_ref: ids.alpha }).select('+items.pan.valueEnc').lean();
    const stored = JSON.stringify(record);
    assert.ok(record.items.pan.valueEnc && !record.items.pan.valueEnc.includes(PAN), 'PAN is stored encrypted');
    assert.equal(JSON.stringify(record.items.pan).includes(PAN), false, 'no plain PAN on the PAN item');
    assert.equal(stored.includes('234567890124'), false, 'the full Aadhaar number is never stored');
    assert.equal(stored.includes('567890124'), false);
    assert.match(stored, /"last4":"0124"/);
  });

  test('uploaded documents are private: the owner and reviewers get the exact bytes, never cached', async () => {
    const own = await fetch(`${base}/client/kyc/photo/file`, { headers: { authorization: `Bearer ${clientToken('alpha')}` } });
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('content-type'), 'image/jpeg');
    assert.match(own.headers.get('cache-control'), /no-store/);
    assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await own.arrayBuffer()), jpg(400, 9));

    const staff = await fetch(`${base}/admin/clients/${ids.alpha}/kyc/pan/file`, { headers: { authorization: `Bearer ${adminToken()}` } });
    assert.equal(staff.status, 200);
    assert.deepEqual(Buffer.from(await staff.arrayBuffer()), jpg(300));
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'KYC_DOCUMENT_VIEW' }).lean(), 'viewing an identity document is audited');

    // another client has uploaded nothing, so there is nothing of Alpha's they can reach; no login = no access
    assert.equal((await asClient('beta', 'GET', '/client/kyc/photo/file')).status, 404);
    assert.equal((await request(null, 'GET', '/client/kyc/photo/file')).status, 401);
    assert.equal((await request(null, 'GET', `/admin/clients/${ids.alpha}/kyc/pan/file`)).status, 401);
    assert.equal((await asClient('beta', 'GET', `/admin/clients/${ids.alpha}/kyc/pan/file`)).status, 401, 'a client token is not staff access');
  });

  test('staff see the PAN in full and the Aadhaar masked; a PAN that disagrees with the GSTIN is flagged', async () => {
    const d = (await admin('GET', `/admin/clients/${ids.alpha}/kyc`)).body.data;
    assert.equal(item(d, 'pan').fullValue, PAN);
    assert.equal(item(d, 'pan').holderType, 'Company');
    assert.equal(item(d, 'aadhaar').displayValue, 'XXXX XXXX 0124');
    assert.equal(JSON.stringify(d).includes('567890124'), false);
    assert.deepEqual(d.flags, [], 'PAN matches the GSTIN');

    // Beta submits the same GSTIN with a different PAN
    assert.equal((await put('beta', 'gst', { value: GSTIN, bytes: pdf() })).status, 200);
    assert.equal((await put('beta', 'pan', { value: 'ABCPE1234F', bytes: jpg() })).status, 200);
    const flags = (await admin('GET', `/admin/clients/${ids.beta}/kyc`)).body.data.flags.map((f) => f.key).sort();
    assert.deepEqual(flags, ['gst_reused', 'pan_gst_mismatch']);
  });

  test('rejecting needs a reason; the client is told, sees the reason, and can resubmit', async () => {
    assert.equal((await review(ids.alpha, 'photo', { decision: 'reject' })).status, 400);
    assert.equal((await review(ids.alpha, 'photo', { decision: 'maybe' })).status, 400);
    const rej = await review(ids.alpha, 'photo', { decision: 'reject', reason: 'Face is cut off — retake it' });
    assert.equal(rej.status, 200, JSON.stringify(rej.body));

    const d = await mine('alpha');
    assert.equal(d.overall.status, 'action_needed');
    assert.equal(item(d, 'photo').status, 'Rejected');
    assert.equal(item(d, 'photo').rejectionReason, 'Face is cut off — retake it');
    const bell = (await asClient('alpha', 'GET', '/client/notifications')).body.notifications;
    assert.ok(bell.some((n) => n.type === 'kyc_rejected' && /Face is cut off/.test(n.message)), 'bell notification');

    const overview = (await asClient('alpha', 'GET', '/client/overview')).body.data;
    assert.equal(overview.actions[0].key === 'kyc-rejected' || overview.actions.some((a) => a.key === 'kyc-rejected'), true);
    assert.equal(overview.kyc.status, 'action_needed');

    const ClientKycFile = require('../../models/ClientKycFile');
    const before = await ClientKycFile.countDocuments({ client_ref: ids.alpha, item: 'photo' });
    const again = await put('alpha', 'photo', { bytes: jpg(500, 5), name: 'retake.jpg' });
    assert.equal(again.status, 200);
    assert.equal(item(again.body.data, 'photo').status, 'Submitted');
    assert.equal(item(again.body.data, 'photo').rejectionReason, '', 'the old reason is cleared');
    assert.equal(await ClientKycFile.countDocuments({ client_ref: ids.alpha, item: 'photo' }), before, 'the replaced document is deleted, not piled up');
  });

  test('verifying all four required items completes KYC; verified items are locked', async () => {
    for (const key of ['gst', 'pan', 'aadhaar']) assert.equal((await review(ids.alpha, key, { decision: 'verify' })).status, 200);
    assert.equal((await mine('alpha')).overall.status, 'in_review', 'the photo is still waiting');
    assert.equal((await review(ids.alpha, 'photo', { decision: 'verify' })).status, 200);

    const d = await mine('alpha');
    assert.equal(d.overall.status, 'verified');
    assert.equal(d.overall.requiredVerified, 4);
    const bell = (await asClient('alpha', 'GET', '/client/notifications')).body.notifications;
    assert.ok(bell.some((n) => n.type === 'kyc_verified' && /KYC complete/.test(n.title)), 'a completion notification');

    assert.equal((await put('alpha', 'pan', { value: PAN, bytes: jpg() })).status, 409, 'a verified item cannot be changed by the client');
    assert.equal((await review(ids.alpha, 'pan', { decision: 'reject', reason: 'changed my mind' })).status, 409, 'and cannot be re-reviewed');
    assert.equal((await mine('alpha')).overall.status, 'verified');
  });

  test('the optional brand authorisation does not hold up verification', async () => {
    const brand = await put('alpha', 'brand_authorisation', { value: 'Mudgarvale', bytes: pdf(), name: 'letter.pdf' });
    assert.equal(brand.status, 200);
    assert.equal((await mine('alpha')).overall.status, 'verified');
    assert.equal(item(await mine('alpha'), 'brand_authorisation').displayValue, 'Mudgarvale');
  });

  test('reviewing needs staff access; the audit trail records who decided, without the numbers', async () => {
    assert.equal((await asClient('beta', 'PUT', `/admin/clients/${ids.beta}/kyc/gst/review`, { decision: 'verify' })).status, 401);
    const AuditLog = require('../../models/AuditLog');
    const verify = await AuditLog.findOne({ action: 'KYC_VERIFY' }).lean();
    assert.equal(verify.actorName, 'Super Admin');
    const trail = JSON.stringify(await AuditLog.find({ resource: 'ClientKyc' }).lean());
    for (const secret of [PAN, '234567890124', 'ABCPE1234F']) assert.equal(trail.includes(secret), false, `audit log leaked ${secret}`);
    assert.ok(await AuditLog.findOne({ action: 'KYC_SUBMIT', actorType: 'Client' }).lean(), 'client submissions are audited too');
  });

  test('a client who has done nothing is nudged on the Overview', async () => {
    const o = (await asClient('gamma', 'GET', '/client/overview')).body.data;
    assert.equal(o.kyc.status, 'not_started');
    assert.ok(o.actions.some((a) => a.key === 'kyc-missing' && a.tab === 'kyc'));
    assert.equal((await mine('alpha')).overall.status, 'verified');
    assert.equal((await asClient('alpha', 'GET', '/client/overview')).body.data.actions.some((a) => a.key.startsWith('kyc')), false, 'verified clients are not nudged');
  });
});

describe('portfolio — KPIs and ordering come from the linked records', () => {
  test('default order is highest monthly recurring fee first, quarterly plans compared per month', async () => {
    const res = await admin('GET', '/admin/portfolio');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const names = res.body.data.map((r) => r.businessName);
    // Gamma 30,000/mo > Alpha 15,000 = Beta 45,000/quarter (15,000/mo, name tie-break) > Delta (no plan)
    assert.deepEqual(names, ['Gamma Ltd', 'Alpha Ltd', 'Beta Ltd', 'Delta Ltd']);
    assert.equal(res.body.data[0].monthlyRecurringFee, 30000);
    assert.equal(res.body.data[2].monthlyRecurringFee, 15000);
    assert.equal(res.body.data[3].monthlyRecurringFee, null);
  });

  test('KPI cards: totals, active/inactive, MRR of active clients only, receivables, defaulters', async () => {
    const { kpis } = (await admin('GET', '/admin/portfolio')).body;
    assert.equal(kpis.totalClients, 4);
    assert.equal(kpis.activeClients, 3);
    assert.equal(kpis.inactiveClients, 1);
    assert.equal(kpis.monthlyRecurringRevenue, 60000);
    assert.equal(kpis.paymentDefaulters, 1); // Gamma's overdue invoice
    assert.equal(kpis.overdueReceivables, 1500);
    assert.ok(kpis.outstandingReceivables >= 1500 + 700);
  });

  test('defaulters are derived from overdue balances, with days overdue per client', async () => {
    const res = await admin('GET', '/admin/portfolio?billing=overdue');
    assert.deepEqual(res.body.data.map((r) => r.businessName), ['Gamma Ltd']);
    assert.equal(res.body.data[0].finance.daysOverdue, 10);
    assert.equal(res.body.data[0].finance.overdueAmount, 1500);
  });

  test('Active / Inactive filters follow the real flags', async () => {
    assert.deepEqual((await admin('GET', '/admin/portfolio?status=inactive')).body.data.map((r) => r.businessName), ['Delta Ltd']);
    assert.equal((await admin('GET', '/admin/portfolio?status=active')).body.data.length, 3);
  });

  test('top clients by revenue ranks verified collections, not invoice value', async () => {
    const { topByRevenue } = (await admin('GET', '/admin/portfolio')).body;
    assert.equal(topByRevenue[0].businessName, 'Alpha Ltd'); // 600 + 1000 approved above
    assert.equal(topByRevenue[0].collected, 1600);
  });

  test('a client with no invoices shows "--" (null) collection, not 0% or a crash', async () => {
    const res = await admin('GET', '/admin/portfolio?search=Delta');
    assert.equal(res.body.data[0].finance.collectionPercent, null);
  });
});

describe('client decisions (Oct 2026): hold, exceptions, work log, extra hours, ad performance', () => {
  const portal = (who, method, url, body) => request(jwt.sign({ id: ids[who] }, JWT_SECRET, { expiresIn: '1h' }), method, `/employee-portal/crm${url}`, body);
  const pad = (n) => String(n).padStart(2, '0');
  const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const firstOfMonth = dayStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const firstOfLastMonth = dayStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  before(async () => {
    const Client = require('../../models/Client');
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const Employee = require('../../models/Employee');
    const eps = await Client.create({ businessName: 'Epsilon Ltd', contactName: 'Eps Owner', email: 'epsilon@example.com', phone: '+919800000009', password: 'ClientPass1', isTemporaryPassword: false });
    ids.epsilon = String(eps._id);
    const pmRole = await Role.create({ name: 'PROJECT MANAGER', permissions: ['ess.access'], isEmployeeRole: true });
    const bdeRole = await Role.create({ name: 'BDE', permissions: ['ess.access'], isEmployeeRole: true });
    const grant = [{ page: 'clients', actions: ['view', 'edit'], scope: { mode: 'clients', clients: [eps._id] } }];
    for (const [key, role] of [['pmUser', pmRole], ['bdeUser', bdeRole]]) {
      const a = await Admin.create({ firstName: key, lastName: 'Staff', email: `${key}@e2e.test`, password: 'Passw0rd!e2e', roles: [role._id], employeeId: `VH-D-${key}`, accessGrants: grant });
      ids[key] = String(a._id);
      await Employee.collection.insertOne({ employeeId: `VH-D-${key}`, adminId: a._id, firstName: key, lastName: 'Staff', email: `${key}@e2e.test`, phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent' });
    }
    await admin('PUT', `/admin/clients/${ids.epsilon}`, { profile: { services: ['Website Development'], platforms: [], monthlyAdBudget: 31000 } });
  });

  // ── 4. Launch exceptions: Admins and Project Managers with access to the client ──
  test('a Project Manager with access to the client can approve a go-live exception; a BDE with the same access cannot', async () => {
    assert.equal((await portal('pmUser', 'GET', `/clients/${ids.epsilon}/onboarding`)).status, 200);
    const bde = await portal('bdeUser', 'POST', `/clients/${ids.epsilon}/onboarding/go-live`, { exception: { reason: 'Client wants to launch before the contract is countersigned' } });
    assert.equal(bde.status, 409);
    assert.match(bde.body.message, /authorised/);
    const pm = await portal('pmUser', 'POST', `/clients/${ids.epsilon}/onboarding/go-live`, { exception: { reason: 'Client wants to launch before the contract is countersigned' } });
    assert.equal(pm.status, 200, JSON.stringify(pm.body));
    assert.equal(pm.body.data.goLive.isLive, true);
  });

  test('a Project Manager cannot act on a client outside their access', async () => {
    assert.equal((await portal('pmUser', 'POST', `/clients/${ids.gamma}/onboarding/go-live`, { exception: { reason: 'Not my client at all, should be refused' } })).status, 404);
  });

  // ── 3. Client status: Active ↔ Hold, manual ──
  test('staff can put a client on hold with a reason; the client is told and can still log in', async () => {
    assert.equal((await admin('POST', `/admin/clients/${ids.epsilon}/hold`, {})).status, 400, 'a reason is required');
    const held = await admin('POST', `/admin/clients/${ids.epsilon}/hold`, { reason: 'Invoice VH-INV-1 unpaid for 30 days' });
    assert.equal(held.status, 200, JSON.stringify(held.body));
    assert.equal((await admin('POST', `/admin/clients/${ids.epsilon}/hold`, { reason: 'again please' })).status, 409);

    const me = await asClient('epsilon', 'GET', '/client/auth/me');
    assert.equal(me.status, 200, 'a client on hold can still log in to pay');
    assert.equal(me.body.client.serviceStatus, 'Hold');
    const overview = (await asClient('epsilon', 'GET', '/client/overview')).body.data;
    assert.equal(overview.actions[0].key, 'account-hold');
    assert.match(overview.actions[0].detail, /unpaid/);
    assert.ok((await asClient('epsilon', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'account_hold'));
  });

  test('the portfolio counts and filters clients on hold, and leaves them out of recurring revenue', async () => {
    const all = (await admin('GET', '/admin/portfolio')).body;
    assert.equal(all.kpis.holdClients, 1);
    const held = (await admin('GET', '/admin/portfolio?status=hold')).body.data;
    assert.deepEqual(held.map((r) => r.businessName), ['Epsilon Ltd']);
    assert.match(held[0].holdReason, /unpaid/);
  });

  test('releasing the hold makes the client active again; it is audited both ways', async () => {
    assert.equal((await admin('POST', `/admin/clients/${ids.epsilon}/release`)).status, 200);
    assert.equal((await admin('POST', `/admin/clients/${ids.epsilon}/release`)).status, 409);
    assert.equal((await asClient('epsilon', 'GET', '/client/auth/me')).body.client.serviceStatus, 'Active');
    const AuditLog = require('../../models/AuditLog');
    assert.ok(await AuditLog.findOne({ action: 'CLIENT_HOLD' }).lean());
    assert.ok(await AuditLog.findOne({ action: 'CLIENT_RELEASE' }).lean());
  });

  // ── 5. Work hours visibility ──
  test('the client sees time by activity and project — no employee names or internal notes', async () => {
    const WorkLog = require('../../models/WorkLog');
    const Project = require('../../models/Project');
    const proj = await Project.create({ client_ref: ids.epsilon, projectName: 'Epsilon store' });
    const d = new Date();
    const log = (min, activityType, extra = {}) => ({
      employeeId: new mongoose.Types.ObjectId(), date: d, startTime: d, duration: min, project: 'internal label', task: 'SECRET task note',
      activityType, isBillable: true, client_ref: ids.epsilon, remarks: 'SECRET remark', ...extra,
    });
    await WorkLog.create([
      log(90, 'Google Ads', { project_ref: proj._id }),
      log(60, 'Google Ads', { project_ref: proj._id, outcome: 'Paused two weak ad sets', visibility: 'Client' }),
      log(30, 'Graphic Design', { outcome: 'SECRET internal outcome' }),
    ]);
    const res = await asClient('epsilon', 'GET', '/client/work?period=this_month');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const w = res.body.data;
    assert.equal(w.totalHours, 3);
    assert.deepEqual(w.byActivity.map((x) => [x.name, x.hours]), [['Google Ads', 2.5], ['Graphic Design', 0.5]]);
    assert.equal(w.byProject[0].name, 'Epsilon store');
    assert.ok(w.entries.some((e) => e.outcome === 'Paused two weak ad sets'), 'client-visible outcome is shown');
    const raw = JSON.stringify(res.body);
    for (const secret of ['SECRET', 'employeeId', 'remarks', 'pmUser']) assert.equal(raw.includes(secret), false, `leaked ${secret}`);
    assert.equal((await asClient('epsilon', 'GET', '/client/work?period=custom&from=2026-10-10&to=2026-10-01')).status, 400);
    assert.equal((await asClient('alpha', 'GET', '/client/work?period=this_month')).body.data.byProject.some((p) => p.name === 'Epsilon store'), false);
  });

  // ── 6. Extra retainer hours beyond the allocation ──
  test('hours beyond the plan are tracked month by month', async () => {
    const Retainer = require('../../models/Retainer');
    const ret = await Retainer.create({
      client_ref: ids.epsilon, packageName: 'Starter', monthlyAmount: 10000, supportHoursPerMonth: 1,
      contractStartDate: new Date(now.getFullYear() - 1, 0, 1), contractEndDate: new Date(now.getFullYear() + 1, 0, 1),
    });
    const r = (await admin('GET', `/admin/retainers/${ret._id}`)).body.data;
    const thisMonth = r.history.at(-1);
    assert.equal(r.history.length, 6);
    assert.equal(thisMonth.used, 3);
    assert.equal(thisMonth.included, 1);
    assert.equal(thisMonth.extra, 2);
    assert.equal(thisMonth.partial, true);
    assert.equal(r.hoursOverage, 2);
    const mine = (await asClient('epsilon', 'GET', '/client/retainers')).body.data[0];
    assert.equal(mine.history.at(-1).extra, 2, 'the client sees the same extra hours');
  });

  // ── 2 + 7. Manual ad spend / campaign performance ──
  test('staff enter daily rows; bad and duplicate rows are refused', async () => {
    const add = (body) => admin('POST', `/admin/clients/${ids.epsilon}/ad-performance`, body);
    const row = { day: firstOfMonth, platform: 'Meta', campaignName: 'Diwali Sale', objective: 'Sales', resultType: 'Purchases', spend: 1000, impressions: 20000, clicks: 400, results: 10, revenue: 5000, notes: 'SECRET internal note' };
    const first = await add(row);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    ids.adRow = first.body.data._id;
    assert.equal((await add({ ...row, campaignName: '  diwali   sale ' })).status, 409, 'same day + platform + campaign is a duplicate');
    assert.equal((await add({ ...row, clicks: 30000 })).status, 400);
    assert.equal((await add({ ...row, day: '2999-01-01' })).status, 400);
    assert.equal((await add({ ...row, platform: 'Google', campaignName: 'Search - Brand', spend: 500, impressions: 5000, clicks: 250, results: 5, revenue: null })).status, 201);
    assert.equal((await add({ ...row, platform: 'Google', campaignName: 'Hidden test', spend: 99999, hidden: true })).status, 201);
    assert.equal((await add({ ...row, day: firstOfLastMonth, spend: 1200, impressions: 24000, clicks: 300, results: 6, revenue: 3000 })).status, 201);
  });

  test('the client report: totals from sums, comparison with last month, hidden rows and notes excluded', async () => {
    const res = await asClient('epsilon', 'GET', '/client/performance?period=this_month&group=day');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const r = res.body.data;
    assert.equal(r.totals.spend, 1500, 'the hidden 99,999 row is not counted');
    assert.equal(r.totals.clicks, 650);
    assert.equal(r.totals.ctr, 2.6); // 650 / 25,000
    assert.equal(r.totals.costPerResult, 100); // 1500 / 15
    assert.equal(r.totals.roas, 3.33); // 5000 / 1500 (one row had no revenue)
    assert.equal(r.comparison.spend.previous, 1200);
    assert.equal(r.comparison.spend.pct, 25);
    assert.equal(r.comparison.costPerResult.good, true, 'cost per result fell from 200 to 100');
    assert.equal(r.series.length, r.current.days);
    assert.equal(r.byCampaign.length, 2);
    const raw = JSON.stringify(r);
    for (const secret of ['SECRET', 'Hidden test', 'enteredByName', 'notes']) assert.equal(raw.includes(secret), false, `leaked ${secret}`);
    assert.equal(r.budget.monthlyBudget, 31000);
    assert.equal(r.budget.spentThisMonth, 1500);
  });

  test('week and month views, platform filter, and CSV export', async () => {
    const week = (await asClient('epsilon', 'GET', '/client/performance?period=last_30_days&group=week')).body.data;
    assert.ok(week.series.length >= 4 && week.series.length <= 6);
    assert.equal(week.series.reduce((s, b) => s + b.spend, 0), week.totals.spend);
    const month = (await asClient('epsilon', 'GET', '/client/performance?period=last_30_days&group=month')).body.data;
    assert.ok(month.series.length >= 1 && month.series.length <= 2);
    assert.equal((await asClient('epsilon', 'GET', '/client/performance?period=this_month&platform=Google')).body.data.totals.spend, 500);

    const csv = await fetch(`${base}/client/performance/export.csv?period=this_month`, { headers: { authorization: `Bearer ${clientToken('epsilon')}` } });
    assert.equal(csv.status, 200);
    const text = await csv.text();
    assert.match(text.split('\n')[0], /^day,platform,campaignName/);
    assert.equal(text.includes('SECRET'), false);
    assert.equal(text.includes('Hidden test'), false);
  });

  test('staff see hidden rows and notes; edits and deletes are audited; other clients see nothing', async () => {
    const staff = (await admin('GET', `/admin/clients/${ids.epsilon}/ad-performance?period=this_month`)).body.data;
    assert.equal(staff.totals.spend, 101499);
    assert.ok(staff.rows.some((r) => r.notes === 'SECRET internal note'));
    const upd = await admin('PUT', `/admin/clients/${ids.epsilon}/ad-performance/${ids.adRow}`, { results: 20 });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    assert.equal(upd.body.data.results, 20);
    assert.equal(upd.body.data.spend, 1000);
    const AuditLog = require('../../models/AuditLog');
    assert.ok(await AuditLog.findOne({ action: 'AD_PERFORMANCE_UPDATE' }).lean());
    assert.equal((await admin('DELETE', `/admin/clients/${ids.epsilon}/ad-performance/${ids.adRow}`)).status, 200);
    assert.equal((await asClient('epsilon', 'GET', '/client/performance?period=this_month')).body.data.totals.spend, 500);
    assert.equal((await asClient('alpha', 'GET', '/client/performance?period=this_month')).body.data.totals.spend, 0);
    assert.equal((await portal('bdeUser', 'GET', `/clients/${ids.alpha}/ad-performance`)).status, 404, 'scoped staff only see their clients');
  });
});

describe('Super Admin rules: automatic hold and extra-hours billing', () => {
  const policyPut = (token, body) => request(token, 'PUT', '/admin/settings/client-policies', body);
  const runHold = () => admin('POST', '/admin/settings/client-policies/run-auto-hold');
  const mkClient = async (key, name) => {
    const c = await require('../../models/Client').create({ businessName: name, contactName: 'Pol Owner', email: `${key}@example.com`, phone: '+919800000012', password: 'ClientPass1', isTemporaryPassword: false });
    ids[key] = String(c._id);
    return c;
  };
  const stateOf = (key) => require('../../models/Client').findById(ids[key]).lean();

  before(async () => {
    await mkClient('zetaLate', 'Zeta Late');       // 40 days overdue, 20,000
    await mkClient('zetaRecent', 'Zeta Recent');   // 5 days overdue
    await mkClient('zetaSmall', 'Zeta Small');     // 40 days overdue but only 300
    await mkClient('zetaManual', 'Zeta Manual');   // manually held, nothing overdue
    await inv(ids.zetaLate, 20000, -40);
    await inv(ids.zetaRecent, 20000, -5);
    await inv(ids.zetaSmall, 300, -40);
  });

  test('only a Super Admin can read or change the rules', async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const role = await Role.create({ name: 'CRM_E2E_POLICY', permissions: ['cms.manage'] });
    const a = await Admin.create({ firstName: 'Crm', lastName: 'Admin', email: 'crm-policy@e2e.test', password: 'Passw0rd!e2e', roles: [role._id] });
    const crmToken = jwt.sign({ id: a._id }, JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await request(crmToken, 'GET', '/admin/settings/client-policies')).status, 403);
    assert.equal((await policyPut(crmToken, { autoHold: { enabled: true, daysOverdue: 5 } })).status, 403);
    assert.equal((await request(null, 'GET', '/admin/settings/client-policies')).status, 401);
    assert.equal((await asClient('alpha', 'PUT', '/admin/settings/client-policies', {})).status, 401);
    const got = (await admin('GET', '/admin/settings/client-policies')).body;
    assert.equal(got.autoHold.enabled, false);
    assert.equal(got.extraHours.mode, 'track_only');
  });

  test('with the rule off, the job changes nothing', async () => {
    const r = (await runHold()).body;
    assert.equal(r.enabled, false);
    assert.deepEqual(r.held, []);
    assert.equal((await stateOf('zetaLate')).serviceStatus, 'Active');
  });

  test('bad settings are refused and saving is audited', async () => {
    assert.equal((await policyPut(adminToken(), { autoHold: { enabled: true, daysOverdue: 0 } })).status, 400);
    assert.equal((await policyPut(adminToken(), { extraHours: { mode: 'bill', ratePerHour: 0 } })).status, 400);
    assert.equal((await policyPut(adminToken(), {})).status, 400);
    const ok = await policyPut(adminToken(), { autoHold: { enabled: true, daysOverdue: 30, minOverdueAmount: 1000, autoRelease: true } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'CLIENT_POLICY_UPDATE' }).lean());
  });

  test('switched on: only clients past the days AND the amount go on hold, and they are told', async () => {
    const r = (await runHold()).body;
    assert.deepEqual(r.held, [ids.zetaLate]);
    const late = await stateOf('zetaLate');
    assert.equal(late.serviceStatus, 'Hold');
    assert.equal(late.holdSource, 'auto');
    assert.match(late.holdReason, /20,000.*40 days/);
    assert.equal((await stateOf('zetaRecent')).serviceStatus, 'Active', 'not late enough');
    assert.equal((await stateOf('zetaSmall')).serviceStatus, 'Active', 'below the minimum amount');
    assert.ok((await asClient('zetaLate', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'account_hold'));
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'CLIENT_HOLD', actorType: 'System' }).lean());
    assert.deepEqual((await runHold()).body.held, [], 'a second run does not hold again');
  });

  test('a manual hold is never lifted by the rule; an automatic one lifts once nothing is overdue', async () => {
    assert.equal((await admin('POST', `/admin/clients/${ids.zetaManual}/hold`, { reason: 'Contract dispute, do not release' })).status, 200);
    await runHold();
    assert.equal((await stateOf('zetaManual')).serviceStatus, 'Hold', 'manual hold survives the pass');

    const Invoice = require('../../models/Invoice');
    await Invoice.updateMany({ client_ref: ids.zetaLate }, { $set: { paidAmount: 20000, paymentStatus: 'Paid' } });
    const r = (await runHold()).body;
    assert.deepEqual(r.released, [ids.zetaLate]);
    const late = await stateOf('zetaLate');
    assert.equal(late.serviceStatus, 'Active');
    assert.equal(late.holdSource, undefined);
  });

  test('with auto-release off, an automatic hold stays until staff release it', async () => {
    const Invoice = require('../../models/Invoice');
    await Invoice.updateMany({ client_ref: ids.zetaLate }, { $set: { paidAmount: 0, paymentStatus: 'Unpaid' } });
    await policyPut(adminToken(), { autoHold: { enabled: true, daysOverdue: 30, minOverdueAmount: 1000, autoRelease: false } });
    assert.deepEqual((await runHold()).body.held, [ids.zetaLate]);
    await Invoice.updateMany({ client_ref: ids.zetaLate }, { $set: { paidAmount: 20000, paymentStatus: 'Paid' } });
    assert.deepEqual((await runHold()).body.released, []);
    assert.equal((await stateOf('zetaLate')).serviceStatus, 'Hold');
    assert.equal((await admin('POST', `/admin/clients/${ids.zetaLate}/release`)).status, 200);
    await policyPut(adminToken(), { autoHold: { enabled: false, daysOverdue: 30, minOverdueAmount: 1000, autoRelease: true } });
  });

  // ── extra hours ──
  const lastMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 15, 12); };
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  test('extra hours: tracked only until billing is switched on; then previewed and invoiced once', async () => {
    const Retainer = require('../../models/Retainer');
    const WorkLog = require('../../models/WorkLog');
    await mkClient('eta', 'Eta Retainer');
    const ret = await Retainer.create({ client_ref: ids.eta, packageName: 'Growth', monthlyAmount: 20000, supportHoursPerMonth: 2, contractStartDate: new Date(new Date().getFullYear() - 1, 0, 1), contractEndDate: new Date(new Date().getFullYear() + 1, 0, 1) });
    const when = lastMonth();
    await WorkLog.create({ employeeId: new mongoose.Types.ObjectId(), date: when, startTime: when, duration: 5 * 60, project: 'P', task: 'T', activityType: 'Google Ads', isBillable: true, client_ref: ids.eta });
    const month = keyOf(when);

    assert.equal((await admin('GET', `/admin/retainers/${ret._id}/extra-hours?month=${month}`)).status, 409, 'track-only: no billing');
    assert.equal((await policyPut(adminToken(), { extraHours: { mode: 'bill', ratePerHour: 1000, freeHours: 0.5, roundTo: 0.5, gstPercent: 18 } })).status, 200);

    const prev = (await admin('GET', `/admin/retainers/${ret._id}/extra-hours?month=${month}`)).body.data;
    assert.deepEqual([prev.used, prev.included, prev.extraHours, prev.billableHours, prev.amount, prev.gst, prev.total], [5, 2, 3, 2.5, 2500, 450, 2950]);
    assert.equal((await admin('GET', `/admin/retainers/${ret._id}/extra-hours?month=${keyOf(new Date())}`)).status, 400, 'the running month cannot be billed');
    assert.equal((await admin('GET', `/admin/retainers/${ret._id}/extra-hours?month=bad`)).status, 400);

    const made = await admin('POST', `/admin/retainers/${ret._id}/extra-hours-invoice`, { month });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const invoice = await require('../../models/Invoice').findById(made.body.data._id).lean();
    assert.equal(invoice.totalAmount, 2950);
    assert.equal(invoice.taxAmount, 450);
    assert.equal(invoice.extraHours.month, month);
    assert.equal(String(invoice.client_ref), ids.eta);
    assert.ok((await asClient('eta', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'invoice_created'));
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'EXTRA_HOURS_INVOICE' }).lean());

    assert.equal((await admin('POST', `/admin/retainers/${ret._id}/extra-hours-invoice`, { month })).status, 409, 'a month is invoiced once');
    assert.equal((await admin('GET', `/admin/retainers/${ret._id}/extra-hours?month=${month}`)).body.data.alreadyInvoiced.startsWith('VH-INV'), true);
    ids.etaRet = String(ret._id);
  });

  test('two simultaneous requests still create only one invoice', async () => {
    const Retainer = require('../../models/Retainer');
    const WorkLog = require('../../models/WorkLog');
    await mkClient('theta', 'Theta Retainer');
    const ret = await Retainer.create({ client_ref: ids.theta, packageName: 'Growth', monthlyAmount: 20000, supportHoursPerMonth: 1, contractStartDate: new Date(new Date().getFullYear() - 1, 0, 1), contractEndDate: new Date(new Date().getFullYear() + 1, 0, 1) });
    const when = lastMonth();
    await WorkLog.create({ employeeId: new mongoose.Types.ObjectId(), date: when, startTime: when, duration: 4 * 60, project: 'P', task: 'T', activityType: 'Google Ads', isBillable: true, client_ref: ids.theta });
    const month = keyOf(when);
    const [a, b] = await Promise.all([1, 2].map(() => admin('POST', `/admin/retainers/${ret._id}/extra-hours-invoice`, { month })));
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await require('../../models/Invoice').countDocuments({ 'extraHours.retainer_ref': ret._id }), 1);
  });

  test('hours inside the free allowance create no invoice', async () => {
    await policyPut(adminToken(), { extraHours: { mode: 'bill', ratePerHour: 1000, freeHours: 10, roundTo: 0.5, gstPercent: 18 } });
    const Retainer = require('../../models/Retainer');
    const WorkLog = require('../../models/WorkLog');
    await mkClient('iota', 'Iota Retainer');
    const ret = await Retainer.create({ client_ref: ids.iota, packageName: 'Growth', monthlyAmount: 20000, supportHoursPerMonth: 1, contractStartDate: new Date(new Date().getFullYear() - 1, 0, 1), contractEndDate: new Date(new Date().getFullYear() + 1, 0, 1) });
    const when = lastMonth();
    await WorkLog.create({ employeeId: new mongoose.Types.ObjectId(), date: when, startTime: when, duration: 3 * 60, project: 'P', task: 'T', activityType: 'Google Ads', isBillable: true, client_ref: ids.iota });
    const r = await admin('POST', `/admin/retainers/${ret._id}/extra-hours-invoice`, { month: keyOf(when) });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /free allowance/);
    await policyPut(adminToken(), { extraHours: { mode: 'track_only', ratePerHour: 0, freeHours: 0, roundTo: 0.5, gstPercent: 18 } });
  });
});

describe('recurring invoices: schedule, drafts, correction and approval', () => {
  const pad = (n) => String(n).padStart(2, '0');
  const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const todayStr = dayStr(today);
  const daysAgo = (n) => dayStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
  const mk = async (key, name, { retainer = true, email } = {}) => {
    const Client = require('../../models/Client');
    const c = await Client.create({ businessName: name, contactName: 'Sched Owner', email: email || `${key}@example.com`, phone: '+919800000013', password: 'ClientPass1', isTemporaryPassword: false });
    ids[key] = String(c._id);
    if (retainer) {
      await require('../../models/Retainer').create({
        client_ref: c._id, packageName: 'Performance Retainer', monthlyAmount: 15000, supportHoursPerMonth: 10,
        contractStartDate: new Date(today.getFullYear() - 1, 0, 1), contractEndDate: new Date(today.getFullYear() + 1, 0, 1),
      });
    }
    return c;
  };
  const schedule = (key, body) => admin('PUT', `/admin/clients/${ids[key]}/billing-schedule`, { active: true, billingDay: today.getDate(), startDate: todayStr, ...body });
  const run = async () => (await admin('POST', '/admin/invoice-drafts-run')).body;
  const drafts = async (status = 'open') => (await admin('GET', `/admin/invoice-drafts?status=${status}`)).body;
  const draftOf = async (key) => (await drafts('')).data.find((d) => d.client._id === ids[key]);

  before(async () => {
    await mk('kappa', 'Kappa Billing');
    await mk('lambda', 'Lambda No Retainer', { retainer: false });
    await mk('mu', 'Mu Inactive');
    await mk('nu', 'Nu Future');
  });

  test('a schedule is validated, saved, audited, and shows the upcoming dates', async () => {
    assert.equal((await schedule('kappa', { billingDay: 0 })).status, 400);
    assert.equal((await schedule('kappa', { startDate: '2026-02-30' })).status, 400);
    const ok = await schedule('kappa', { dueDays: 10 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const got = (await admin('GET', `/admin/clients/${ids.kappa}/billing-schedule`)).body.data;
    assert.equal(got.schedule.dueDays, 10);
    assert.equal(got.defaultDueDays, 7);
    assert.equal(got.upcoming[0].invoiceDate, todayStr);
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'BILLING_SCHEDULE_UPDATE' }).lean());
    await schedule('lambda');
    await admin('PUT', `/admin/clients/${ids.mu}/billing-schedule`, { active: false, billingDay: today.getDate(), startDate: todayStr });
    await schedule('nu', { startDate: dayStr(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())) });
  });

  test('the job drafts what is due: advance period, full fee + GST, due date; nothing reaches the client', async () => {
    const r = await run();
    assert.equal(r.created, 1);
    assert.equal(r.needAttention, 1, 'the client with no retainer is flagged, not skipped');
    const d = await draftOf('kappa');
    assert.equal(d.status, 'Pending Approval');
    assert.equal(d.invoiceDate, todayStr);
    assert.equal(d.lineItems.length, 1);
    assert.deepEqual([d.subtotal, d.taxAmount, d.totalAmount], [15000, 2700, 17700]);
    assert.ok(d.periodEnd > d.periodStart, 'the period runs to the day before the next invoice');
    const dueIn = Math.round((new Date(d.dueDate) - new Date(`${todayStr}T00:00:00`)) / 864e5);
    assert.ok(dueIn >= 10 && dueIn <= 11, `due 10 days after (got ${dueIn})`);
    assert.ok(await require('../../models/Notification').findOne({ type: 'invoice_drafts' }).lean(), 'staff are told');

    // a draft is not an invoice: invisible to the client and not money owed
    assert.equal((await asClient('kappa', 'GET', '/client/invoices')).body.summary.total, 0);
    assert.equal((await asClient('kappa', 'GET', '/client/overview')).body.data.billing.outstanding, 0);
    assert.equal((await admin('GET', `/admin/invoices?client_ref=${ids.kappa}`)).body.data.length, 0);
  });

  test('running the job again creates nothing new; inactive, future and suspended schedules are ignored', async () => {
    const again = await run();
    assert.equal(again.created + again.needAttention, 0);
    assert.equal((await draftOf('mu')), undefined, 'switched-off schedule');
    assert.equal((await draftOf('nu')), undefined, 'starts next month');
    assert.equal(await require('../../models/InvoiceDraft').countDocuments({ client_ref: ids.kappa }), 1);
  });

  test('a draft that cannot be built is kept with its reasons and cannot be approved until fixed', async () => {
    const d = await draftOf('lambda');
    assert.equal(d.status, 'Needs Attention');
    assert.match(d.problems[0], /No active monthly retainer/);
    const refused = await admin('POST', `/admin/invoice-drafts/${d._id}/approve`);
    assert.equal(refused.status, 409);
    assert.match(refused.body.message, /Fix this first/);
    assert.equal((await admin('PUT', `/admin/invoice-drafts/${d._id}`, { lineItems: [] })).status, 400);

    // correct it by hand: add the line
    const fixed = await admin('PUT', `/admin/invoice-drafts/${d._id}`, { lineItems: [{ description: 'Setup retainer — manual', unitPrice: 8000 }], note: 'Retainer not entered yet' });
    assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
    assert.equal(fixed.body.data.status, 'Pending Approval');
    assert.equal(fixed.body.data.totalAmount, 9440);
    assert.equal(fixed.body.data.corrected, true);
  });

  test('"Rebuild" picks up a retainer added after the draft was made', async () => {
    const Retainer = require('../../models/Retainer');
    await mk('xi', 'Xi Late Retainer', { retainer: false });
    await schedule('xi');
    await run();
    const d = await draftOf('xi');
    assert.equal(d.status, 'Needs Attention');
    await Retainer.create({ client_ref: ids.xi, packageName: 'Added Later', monthlyAmount: 12000, supportHoursPerMonth: 5, contractStartDate: new Date(today.getFullYear() - 1, 0, 1), contractEndDate: new Date(today.getFullYear() + 1, 0, 1) });
    const r = await admin('POST', `/admin/invoice-drafts/${d._id}/rebuild`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'Pending Approval');
    assert.equal(r.body.data.subtotal, 12000);
  });

  test('a correction before approval flows through to the real invoice, which the client then sees', async () => {
    const d = await draftOf('kappa');
    const fixed = await admin('PUT', `/admin/invoice-drafts/${d._id}`, { lineItems: [{ description: 'Performance Retainer — corrected', unitPrice: 14000 }], dueDate: dayStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)) });
    assert.equal(fixed.status, 200);
    assert.equal(fixed.body.data.totalAmount, 16520);
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'INVOICE_DRAFT_CORRECT' }).lean());

    const [a, b] = await Promise.all([1, 2].map(() => admin('POST', `/admin/invoice-drafts/${d._id}/approve`)));
    assert.deepEqual([a.status, b.status].sort(), [200, 409], 'two approvers create one invoice');
    assert.equal(await require('../../models/Invoice').countDocuments({ client_ref: ids.kappa }), 1);

    // Approved, but not sent: the client sees nothing until staff send it as a Proforma / Tax Invoice
    assert.equal((await asClient('kappa', 'GET', '/client/invoices')).body.summary.total, 0);
    assert.equal((await asClient('kappa', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'invoice_created'), false);
    const stored = await require('../../models/Invoice').findOne({ client_ref: ids.kappa }).lean();
    assert.equal(stored.unsent, true);
    assert.equal((await admin('PUT', `/admin/invoices/${stored._id}`, { billing: { address: '5 Park Street, Kolkata', placeOfSupply: 'West Bengal' } })).status, 200);
    assert.equal((await admin('POST', `/admin/invoices/${stored._id}/send`, { type: 'Tax Invoice', date: todayStr })).status, 200);

    const mine = (await asClient('kappa', 'GET', '/client/invoices')).body;
    assert.equal(mine.summary.total, 1);
    assert.equal(mine.data[0].totalAmount, 16520);
    assert.match(mine.data[0].lineItems[0].description, /corrected/);
    assert.ok((await asClient('kappa', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'invoice_created'));
    assert.equal(stored.scheduled.invoiceDate, todayStr);
    assert.equal((await draftOf('kappa')).status, 'Approved');
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'INVOICE_DRAFT_APPROVE' }).lean());

    assert.equal((await admin('PUT', `/admin/invoice-drafts/${d._id}`, { note: 'too late' })).status, 409, 'an approved draft is locked; the invoice itself can still be edited');
    assert.equal((await run()).created, 0, 'the job does not draft an approved date again');
  });

  test('skipping needs a reason, and a skipped date is not drafted again', async () => {
    const d = await draftOf('xi');
    assert.equal((await admin('POST', `/admin/invoice-drafts/${d._id}/skip`, { reason: 'no' })).status, 400);
    const ok = await admin('POST', `/admin/invoice-drafts/${d._id}/skip`, { reason: 'Client paid this month offline' });
    assert.equal(ok.status, 200);
    assert.equal((await draftOf('xi')).status, 'Skipped');
    assert.equal((await run()).created, 0);
    assert.equal((await admin('POST', `/admin/invoice-drafts/${d._id}/approve`)).status, 409);
  });

  test('a suspended client is not invoiced; the missed-run catch-up is limited to a week', async () => {
    await mk('omicron', 'Omicron Suspended');
    await schedule('omicron');
    await require('../../models/Client').updateOne({ _id: ids.omicron }, { $set: { isActive: false } });
    await mk('pi', 'Pi Old Start');
    await schedule('pi', { startDate: daysAgo(20), billingDay: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 20).getDate() });
    await mk('rho', 'Rho Recent Start');
    await schedule('rho', { startDate: daysAgo(3), billingDay: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).getDate() });
    await run();
    assert.equal(await draftOf('omicron'), undefined);
    assert.equal(await draftOf('pi'), undefined, 'a 20-day-old date is not back-filled');
    assert.equal((await draftOf('rho')).invoiceDate, daysAgo(3), 'a missed run catches up within the week');
  });

  test('Super Admin default for days to pay and GST can be changed and are used for new drafts', async () => {
    const bad = await request(adminToken(), 'PUT', '/admin/settings/client-policies', { billing: { defaultDueDays: 0, gstPercent: 18 } });
    assert.equal(bad.status, 400);
    const ok = await request(adminToken(), 'PUT', '/admin/settings/client-policies', { billing: { defaultDueDays: 10, gstPercent: 12 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.billing.gstPercent, 12);
    await mk('sigma', 'Sigma Policy');
    await schedule('sigma', { dueDays: undefined });
    await run();
    const d = await draftOf('sigma');
    assert.equal(d.taxPercent, 12);
    assert.equal(d.taxAmount, 1800);
    assert.equal((await admin('GET', `/admin/clients/${ids.sigma}/billing-schedule`)).body.data.schedule.dueDays, 10);
    await request(adminToken(), 'PUT', '/admin/settings/client-policies', { billing: { defaultDueDays: 7, gstPercent: 18 } });
  });

  test('a person limited to some clients only sees and acts on those clients\u2019 drafts', async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const Employee = require('../../models/Employee');
    const role = await Role.create({ name: 'BDE_SCHED', permissions: ['ess.access'], isEmployeeRole: true });
    const a = await Admin.create({
      firstName: 'Sched', lastName: 'Limited', email: 'sched-limited@e2e.test', password: 'Passw0rd!e2e', roles: [role._id], employeeId: 'VH-S-1',
      accessGrants: [{ page: 'invoices', actions: ['view', 'edit', 'create'], scope: { mode: 'clients', clients: [ids.rho] } }],
    });
    await Employee.collection.insertOne({ employeeId: 'VH-S-1', adminId: a._id, firstName: 'Sched', lastName: 'Limited', email: 'sched-limited@e2e.test', phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent' });
    const token = jwt.sign({ id: a._id }, JWT_SECRET, { expiresIn: '1h' });
    const list = (await request(token, 'GET', '/employee-portal/crm/invoice-drafts?status=open')).body.data;
    assert.ok(list.length >= 1 && list.every((x) => x.client._id === ids.rho));
    const other = await draftOf('lambda');
    assert.equal((await request(token, 'POST', `/employee-portal/crm/invoice-drafts/${other._id}/skip`, { reason: 'not my client at all' })).status, 404);
    assert.equal((await request(token, 'POST', '/employee-portal/crm/invoice-drafts-run')).status, 403, 'generating needs all clients');
  });
});

describe('recurring invoices: a start date that has already passed', () => {
  const pad = (n) => String(n).padStart(2, '0');
  const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const ago = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

  before(async () => {
    const c = await require('../../models/Client').create({ businessName: 'Tau Past Start', contactName: 'Tau Owner', email: 'tau@example.com', phone: '+919800000014', password: 'ClientPass1', isTemporaryPassword: false });
    ids.tau = String(c._id);
    await require('../../models/Retainer').create({ client_ref: c._id, packageName: 'Performance Retainer', monthlyAmount: 15000, supportHoursPerMonth: 10, contractStartDate: new Date(today.getFullYear() - 1, 0, 1), contractEndDate: new Date(today.getFullYear() + 1, 0, 1) });
    await admin('PUT', `/admin/clients/${ids.tau}/billing-schedule`, { active: true, billingDay: ago(9).getDate(), startDate: dayStr(ago(9)) });
  });

  test('the daily job leaves a date older than a week alone, and the schedule lists it as missed', async () => {
    await admin('POST', '/admin/invoice-drafts-run');
    assert.equal(await require('../../models/InvoiceDraft').countDocuments({ client_ref: ids.tau }), 0);
    const info = (await admin('GET', `/admin/clients/${ids.tau}/billing-schedule`)).body.data;
    assert.deepEqual(info.missed.map((m) => m.invoiceDate), [dayStr(ago(9))]);
    assert.ok(info.missed[0].end > info.missed[0].start);
  });

  test('staff can create the draft for the missed date; it then waits for approval like any other', async () => {
    const r = await admin('POST', `/admin/clients/${ids.tau}/billing-schedule/draft`, { invoiceDate: dayStr(ago(9)) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'Pending Approval');
    assert.equal(r.body.data.totalAmount, 17700);
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'INVOICE_DRAFT_CREATE_NOW' }).lean());
    assert.equal((await asClient('tau', 'GET', '/client/invoices')).body.summary.total, 0, 'still invisible to the client');
    const info = (await admin('GET', `/admin/clients/${ids.tau}/billing-schedule`)).body.data;
    assert.deepEqual(info.missed, [], 'it is no longer missed');
  });

  test('a date that already has a draft, a future date, and a date off the schedule are all refused', async () => {
    const post = (invoiceDate) => admin('POST', `/admin/clients/${ids.tau}/billing-schedule/draft`, { invoiceDate });
    assert.equal((await post(dayStr(ago(9)))).status, 409);
    assert.equal((await post(dayStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)))).status, 400);
    assert.equal((await post(dayStr(ago(10)))).status, 400, 'not one of the scheduled dates');
    assert.equal((await post('2026-02-30')).status, 400);
    assert.equal((await asClient('tau', 'POST', `/admin/clients/${ids.tau}/billing-schedule/draft`, { invoiceDate: dayStr(ago(9)) })).status, 401);
  });
});

describe('onboarding — the client can follow progress and see shared proof', () => {
  const step = (client, key, body) => admin('PUT', `/admin/clients/${ids[client]}/onboarding/items/${key}`, body);
  const mine = async (who) => (await asClient(who, 'GET', '/client/onboarding')).body.data;
  const find = (data, key) => data.items.find((i) => i.key === key);

  before(async () => {
    const c = await require('../../models/Client').create({ businessName: 'Upsilon Setup', contactName: 'Ups Owner', email: 'upsilon@example.com', phone: '+919800000015', password: 'ClientPass1', isTemporaryPassword: false });
    ids.upsilon = String(c._id);
    await admin('PUT', `/admin/clients/${ids.upsilon}`, { profile: { services: ['Performance Marketing'], platforms: ['Meta'] } });
    await admin('GET', `/admin/clients/${ids.upsilon}/onboarding`); // creates the checklist
  });

  test('before any checklist exists there is nothing to show', async () => {
    assert.equal(await mine('gamma'), null);
  });

  test('the client sees every step as a plain status, with nothing internal', async () => {
    await step('upsilon', 'contract_signed', { status: 'Completed', remarks: 'SECRET internal remark' });
    await step('upsilon', 'advance_payment', { status: 'In Progress', remarks: 'SECRET chasing finance' });
    await step('upsilon', 'meta_access', { status: 'Blocked', blocker: 'SECRET client ignoring emails' });
    const d = await mine('upsilon');
    assert.equal(find(d, 'contract_signed').state, 'done');
    assert.equal(find(d, 'advance_payment').state, 'in_progress');
    assert.equal(find(d, 'meta_access').state, 'blocked');
    assert.equal(find(d, 'website_access').state, 'not_started');
    const raw = JSON.stringify(d);
    for (const s of ['SECRET', 'remarks', 'blocker', 'owner', 'exception', 'proof']) assert.equal(raw.includes(s), false, `leaked ${s}`);
  });

  test('a message for the client turns a step into "waiting on you", notifies them, and shows on their Overview', async () => {
    const r = await step('upsilon', 'meta_access', { clientMessage: 'Please add business@vedhunt.in as an admin on your Meta Business Manager' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = await mine('upsilon');
    const meta = find(d, 'meta_access');
    assert.equal(meta.state, 'waiting_on_you');
    assert.match(meta.message, /business@vedhunt\.in/);
    assert.equal(d.summary.waitingOnYou, 1);
    assert.ok((await asClient('upsilon', 'GET', '/client/notifications')).body.notifications.some((n) => n.type === 'onboarding_request' && /Meta/.test(n.title)));
    const overview = (await asClient('upsilon', 'GET', '/client/overview')).body.data;
    assert.ok(overview.actions.some((a) => a.key === 'onboarding-waiting' && a.tab === 'onboarding'));

    // saving the same message again does not notify twice
    const count = (await asClient('upsilon', 'GET', '/client/notifications')).body.notifications.filter((n) => n.type === 'onboarding_request').length;
    await step('upsilon', 'meta_access', { clientMessage: 'Please add business@vedhunt.in as an admin on your Meta Business Manager' });
    assert.equal((await asClient('upsilon', 'GET', '/client/notifications')).body.notifications.filter((n) => n.type === 'onboarding_request').length, count);
  });

  test('once the step is done the request disappears', async () => {
    await step('upsilon', 'meta_access', { status: 'Completed', remarks: 'Access granted 26 Oct' });
    const meta = find(await mine('upsilon'), 'meta_access');
    assert.equal(meta.state, 'done');
    assert.equal(meta.message, '');
    const overview = (await asClient('upsilon', 'GET', '/client/overview')).body.data;
    assert.equal(overview.actions.some((a) => a.key === 'onboarding-waiting'), false);
  });

  test('going live is shown to the client without the exception details; clients only see their own checklist', async () => {
    await admin('POST', `/admin/clients/${ids.upsilon}/onboarding/go-live`, { exception: { reason: 'SECRET: launching before the remaining steps are finished' } });
    const d = await mine('upsilon');
    assert.equal(d.live, true);
    assert.ok(d.liveDate);
    assert.equal(JSON.stringify(d).includes('SECRET'), false);
    assert.equal(await mine('beta') === null || !JSON.stringify(await mine('beta')).includes('Upsilon'), true);
    assert.equal((await request(null, 'GET', '/client/onboarding')).status, 401);
  });

  test('every message change is in the audit trail', async () => {
    const AuditLog = require('../../models/AuditLog');
    const entries = await AuditLog.find({ action: 'ONBOARDING_ITEM_UPDATE' }).lean();
    assert.ok(entries.some((e) => /business@vedhunt\.in/.test(e.afterSnapshot?.clientMessage || '')));
  });
});

describe('Won leads whose client account could not be created are recorded for an admin', () => {
  process.env.RESEND_API_KEY = ''; // this process must never send a real welcome email
  const Lead = () => require('../../models/Lead');
  const Client = () => require('../../models/Client');
  const Issue = () => require('../../models/ClientCreationIssue');
  const convert = (lead) => require('../../services/clientProvisioning').convertWonLeadToClient(lead, new mongoose.Types.ObjectId(ids.super));
  const wonLead = async (key, fields) => {
    const r = await mongoose.connection.db.collection('leads').insertOne({
      fullName: 'Won Person', phone: '9811100000', email: `${key}@lead.test`, status: 'Won', businessName: `${key} Biz`, dealCloseValue: 50000,
      createdAt: new Date(), updatedAt: new Date(), documents: [], pipelineHistory: [], ...fields,
    });
    ids[`lead_${key}`] = String(r.insertedId);
    return Lead().findById(r.insertedId).lean();
  };
  const issueOf = (key) => Issue().findOne({ lead_ref: ids[`lead_${key}`] }).lean();
  // notices received by one staff member (each holder of the client-desk permission gets their own copy)
  const noticeCount = () => require('../../models/Notification').countDocuments({ type: 'client_creation_issue', recipient: ids.super });
  const historyOf = async (key) => (await Lead().findById(ids[`lead_${key}`]).lean()).pipelineHistory.map((h) => h.status);

  test('a good lead gets an account and no issue is recorded', async () => {
    const lead = await wonLead('good');
    const client = await convert(lead);
    assert.ok(client?.clientId);
    assert.equal(await issueOf('good'), null);
    assert.ok((await historyOf('good')).includes('Converted to Client'));
  });

  test('a bad phone number is recorded with the exact cause, on the lead, and staff are told once', async () => {
    const before = await noticeCount();
    const lead = await wonLead('badphone', { phone: '12345' });
    assert.equal(await convert(lead), null, 'no account, and no thrown error');
    const issue = await issueOf('badphone');
    assert.equal(issue.status, 'Open');
    assert.equal(issue.reasons[0].code, 'invalid_phone');
    assert.match(issue.reasons[0].message, /Phone: .*10-15 digits/);
    assert.equal(await Client().exists({ leadRef: lead._id }), null);
    assert.ok((await historyOf('badphone')).includes('Client account not created'));
    assert.equal(await noticeCount(), before + 1);

    // the same failure again does not pile up notes, notices or records
    await convert(lead);
    const again = await issueOf('badphone');
    assert.equal(again.attempts, 2);
    assert.equal(await Issue().countDocuments({ lead_ref: lead._id }), 1);
    assert.equal((await historyOf('badphone')).filter((s) => s === 'Client account not created').length, 1);
    assert.equal(await noticeCount(), before + 1);
  });

  test('several problems are all listed (missing email, short name)', async () => {
    const lead = await wonLead('multi', { email: '', fullName: 'A', businessName: '' });
    await convert(lead);
    const codes = (await issueOf('multi')).reasons.map((r) => r.code).sort();
    assert.ok(codes.includes('invalid_email'));
    assert.ok(codes.includes('invalid_name') || codes.includes('invalid_business_name'));
    assert.ok(codes.length >= 2);
  });

  test('an email already used by a live client is a skip that needs a person, naming that client', async () => {
    const lead = await wonLead('dupe', { email: 'alpha@example.com' });
    assert.equal(await convert(lead), null);
    const issue = await issueOf('dupe');
    assert.equal(issue.reasons[0].code, 'email_in_use');
    assert.match(issue.reasons[0].message, /VH-CL-/);
    assert.equal(String(issue.existingClient), ids.alpha);
  });

  test('an email used by a DELETED client says to restore it', async () => {
    await Client().updateOne({ _id: ids.delta }, { $set: { deletedAt: new Date() } });
    const lead = await wonLead('archived', { email: 'delta@example.com' });
    await convert(lead);
    assert.equal((await issueOf('archived')).reasons[0].code, 'client_archived');
    await Client().updateOne({ _id: ids.delta }, { $unset: { deletedAt: 1 } });
  });

  test('the list shows the open issues with lead details; clients and anonymous callers cannot see them', async () => {
    const res = await admin('GET', '/admin/client-creation-issues');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.openCount >= 4);
    const row = res.body.data.find((r) => r.lead._id === ids.lead_badphone);
    assert.equal(row.lead.phone, '12345');
    assert.equal(row.reasons[0].code, 'invalid_phone');
    assert.equal((await asClient('alpha', 'GET', '/admin/client-creation-issues')).status, 401);
    assert.equal((await request(null, 'GET', '/admin/client-creation-issues')).status, 401);
  });

  test('retry still fails while the lead is wrong, and succeeds once the lead is corrected', async () => {
    const issue = await issueOf('badphone');
    const still = await admin('POST', `/admin/client-creation-issues/${issue._id}/retry`);
    assert.equal(still.status, 200);
    assert.equal(still.body.created, false);
    await Lead().updateOne({ _id: ids.lead_badphone }, { $set: { phone: '9811100001' } });
    const ok = await admin('POST', `/admin/client-creation-issues/${issue._id}/retry`);
    assert.equal(ok.body.created, true, JSON.stringify(ok.body));
    const closed = await issueOf('badphone');
    assert.equal(closed.status, 'Resolved');
    assert.ok(closed.client_ref);
    assert.equal(await Client().countDocuments({ leadRef: ids.lead_badphone }), 1);
    assert.equal((await admin('POST', `/admin/client-creation-issues/${issue._id}/retry`)).status, 409, 'a closed issue cannot be retried');
  });

  test('create with corrected details: bad values are refused with the reason; good ones create the account', async () => {
    const issue = await issueOf('multi');
    const bad = await admin('POST', `/admin/client-creation-issues/${issue._id}/create`, { email: 'not-an-email', contactName: 'Multi Person', businessName: 'Multi Biz' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /Email/);
    const ok = await admin('POST', `/admin/client-creation-issues/${issue._id}/create`, { email: 'multi-fixed@example.com', contactName: 'Multi Person', businessName: 'Multi Biz' });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const made = await Client().findOne({ email: 'multi-fixed@example.com' }).lean();
    assert.equal(String(made.leadRef), ids.lead_multi);
    assert.equal((await issueOf('multi')).status, 'Resolved');
    assert.ok((await historyOf('multi')).includes('Converted to Client'));
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'CLIENT_CREATION_MANUAL' }).lean());
    assert.equal((await admin('POST', `/admin/client-creation-issues/${issue._id}/create`, { email: 'second@example.com' })).status, 409, 'closed issues cannot create a second account');
  });

  test('link to an existing account: refuses a bad id, links, and refuses an account linked to another lead', async () => {
    const issue = await issueOf('dupe');
    const link = (client_id) => admin('POST', `/admin/client-creation-issues/${issue._id}/link`, { client_id });
    assert.equal((await link('nope')).status, 400);
    assert.equal((await link(ids.beta)).status, 200, 'beta has no lead link, so it can be linked');
    assert.equal(String((await Client().findById(ids.beta).lean()).leadRef), ids.lead_dupe);
    assert.equal((await issueOf('dupe')).status, 'Resolved');
    const other = await issueOf('archived');
    const clash = await admin('POST', `/admin/client-creation-issues/${other._id}/link`, { client_id: ids.beta });
    assert.equal(clash.status, 409, 'beta is now linked to a different lead');
  });

  test('dismissing needs a reason and is recorded', async () => {
    const issue = await issueOf('archived');
    assert.equal((await admin('POST', `/admin/client-creation-issues/${issue._id}/dismiss`, { reason: 'no' })).status, 400);
    assert.equal((await admin('POST', `/admin/client-creation-issues/${issue._id}/dismiss`, { reason: 'Customer did not go ahead' })).status, 200);
    const d = await issueOf('archived');
    assert.equal(d.status, 'Dismissed');
    assert.equal(d.resolution, 'Customer did not go ahead');
    assert.ok((await admin('GET', '/admin/client-creation-issues?status=Dismissed')).body.data.length >= 1);
  });

  test('scan finds Won leads that never got an account, ignores others, and does not duplicate on a second run', async () => {
    await wonLead('old1', { phone: '99' }); // imported as Won, bad phone
    await wonLead('old2'); // imported as Won, perfectly fine data: the conversion simply never ran
    const open = await mongoose.connection.db.collection('leads').insertOne({ fullName: 'Still Open', phone: '9811100077', email: 'open@lead.test', status: 'Working', createdAt: new Date(), updatedAt: new Date(), documents: [] });
    const first = await admin('POST', '/admin/client-creation-issues/scan');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.ok((await issueOf('old1')).reasons.some((r) => r.code === 'invalid_phone'));
    assert.equal((await issueOf('old2')).reasons[0].code, 'not_attempted');
    assert.equal(await Issue().countDocuments({ lead_ref: open.insertedId }), 0, 'a lead that is not Won is ignored');
    const issuesBefore = await Issue().countDocuments();
    await admin('POST', '/admin/client-creation-issues/scan');
    assert.equal(await Issue().countDocuments(), issuesBefore);
    const old2 = await issueOf('old2');
    assert.equal((await admin('POST', `/admin/client-creation-issues/${old2._id}/retry`)).body.created, true, 'the never-ran lead is fixed by a retry');
  });

  test('a person limited to some clients cannot use these tools', async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const Employee = require('../../models/Employee');
    const role = await Role.create({ name: 'BDE_CCI', permissions: ['ess.access'], isEmployeeRole: true });
    const a = await Admin.create({ firstName: 'Cci', lastName: 'Limited', email: 'cci-limited@e2e.test', password: 'Passw0rd!e2e', roles: [role._id], employeeId: 'VH-CCI-1', accessGrants: [{ page: 'clients', actions: ['view', 'edit', 'create'], scope: { mode: 'clients', clients: [ids.alpha] } }] });
    await Employee.collection.insertOne({ employeeId: 'VH-CCI-1', adminId: a._id, firstName: 'Cci', lastName: 'Limited', email: 'cci-limited@e2e.test', phone: '9800000000', roleDept: 'Test', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent' });
    const token = jwt.sign({ id: a._id }, JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await request(token, 'GET', '/employee-portal/crm/client-creation-issues')).status, 403);
    assert.equal((await request(token, 'POST', '/employee-portal/crm/client-creation-issues/scan')).status, 403);
  });
});

describe('invoice documents — one layout, sent as a Proforma Invoice or a Tax Invoice', () => {
  const Invoice = () => require('../../models/Invoice');
  const pages = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  const pdf = async (token, url) => {
    const res = await fetch(base + url, { headers: { authorization: `Bearer ${token}` } });
    return { status: res.status, type: res.headers.get('content-type'), disposition: res.headers.get('content-disposition'), buffer: Buffer.from(await res.arrayBuffer()) };
  };
  const sendAs = (id, type, date) => admin('POST', `/admin/invoices/${id}/send`, { type, date });
  const make = async (extra = {}) => {
    const res = await admin('POST', '/admin/invoices', {
      client_ref: ids.docClient, dueDate: new Date(Date.now() + 7 * DAY).toISOString(), issueDate: '2026-07-03',
      lineItems: [
        { description: 'Performance marketing\nMeta Ads Management\nGoogle Ads', qty: 1, unitPrice: 5932.5, amount: 5932.5, sac: '998361' },
        { description: 'Creative support', qty: 2, unitPrice: 1000, amount: 2000 },
      ],
      subtotal: 7932.5, taxPercent: 18, taxAmount: 1427.85, totalAmount: 9360.35,
      billing: { name: 'Femelo', address: 'D-5 block, Noida, Uttar Pradesh - 201318', placeOfSupply: 'Uttar Pradesh' },
      ...extra,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data._id;
  };

  before(async () => {
    const c = await require('../../models/Client').create({
      businessName: 'Doc Client', contactName: 'Owner Person', email: 'docclient@example.com', phone: '+919800000009',
      password: 'ClientPass1', isTemporaryPassword: false,
    });
    ids.docClient = String(c._id);
  });

  test('a saved invoice is hidden from the client and is not owed until it is sent', async () => {
    const id = await make({ dueDate: new Date(Date.now() - 20 * DAY).toISOString() });
    assert.equal((await Invoice().findById(id).lean()).unsent, true);
    assert.equal((await asClient('docClient', 'GET', '/client/invoices')).body.summary.total, 0);
    assert.equal((await asClient('docClient', 'GET', `/client/invoices/${id}`)).status, 404);
    assert.equal((await pdf(clientToken('docClient'), `/client/invoices/${id}/pdf`)).status, 404);
    assert.equal((await asClient('docClient', 'GET', '/client/overview')).body.data.billing.overdueInvoices, 0, 'unsent is not overdue');

    assert.equal((await sendAs(id, 'Tax Invoice', '2026-07-03')).status, 200);
    assert.equal((await asClient('docClient', 'GET', '/client/invoices')).body.summary.total, 1);
    assert.equal((await asClient('docClient', 'GET', '/client/overview')).body.data.billing.overdueInvoices, 1);
    const mine = (await asClient('docClient', 'GET', `/client/invoices/${id}`)).body.data;
    assert.equal(mine.documents[0].type, 'Tax Invoice');
    assert.equal(mine.documents[0].sentByName, undefined, 'who sent it stays internal');
  });

  test('staff can look at the PDF before sending; it is one page', async () => {
    const id = await make();
    const tax = await pdf(adminToken(), `/admin/invoices/${id}/document?type=${encodeURIComponent('Tax Invoice')}&date=2026-07-03`);
    assert.equal(tax.status, 200);
    assert.match(tax.type, /application\/pdf/);
    assert.equal(tax.buffer.subarray(0, 4).toString(), '%PDF');
    assert.equal(pages(tax.buffer), 1);
    const pro = await pdf(adminToken(), `/admin/invoices/${id}/document?type=${encodeURIComponent('Proforma Invoice')}`);
    assert.equal(pro.status, 200);
    assert.equal(pages(pro.buffer), 1);
    assert.equal((await Invoice().findById(id).lean()).unsent, true, 'looking does not send');
    assert.equal((await pdf(adminToken(), '/admin/invoices/not-an-id/document')).status, 400);
  });

  test('sending needs a date, a billing address and a place of supply', async () => {
    const noBilling = await make({ billing: undefined });
    assert.equal((await sendAs(noBilling, 'Tax Invoice', '2026-07-03')).status, 400);
    const id = await make();
    assert.equal((await sendAs(id, 'Tax Invoice', undefined)).status, 400, 'date missing');
    assert.equal((await sendAs(id, 'Tax Invoice', '2026-02-31')).status, 400, 'not a real date');
    assert.equal((await sendAs(id, 'Credit Note', '2026-07-03')).status, 400);
    assert.equal((await Invoice().findById(id).lean()).documents.length, 0);
  });

  test('numbers: each type has its own series, a number is kept on resend, the date can change', async () => {
    const a = await make();
    const b = await make();
    const t1 = (await sendAs(a, 'Tax Invoice', '2026-07-03')).body.data.document.number;
    const t2 = (await sendAs(b, 'Tax Invoice', '2026-07-04')).body.data.document.number;
    assert.equal(t2, t1 + 1);

    const again = await sendAs(a, 'Tax Invoice', '2026-07-09');
    assert.equal(again.body.data.document.number, t1, 'same number on resend');
    assert.equal(new Date(again.body.data.document.date).getDate(), 9, 'the date typed last is kept');
    assert.match(again.body.message, /again/);

    // the same invoice can also go out as a proforma, from the proforma series
    const p = (await sendAs(a, 'Proforma Invoice', '2026-07-03')).body.data.document.number;
    const stored = await Invoice().findById(a).lean();
    assert.deepEqual(stored.documents.map((d) => d.type).sort(), ['Proforma Invoice', 'Tax Invoice']);
    assert.ok(p >= 33, 'continues the proforma series');
    const info = (await admin('GET', '/admin/invoice-documents/info')).body.data;
    assert.equal(info.next.taxInvoice, t2 + 1);
    assert.ok(info.next.proforma > p);
    assert.ok(info.states.some((s) => s.name === 'Maharashtra' && s.code === '27'));
  });

  test('the client downloads the sent document: a PDF, and an older invoice keeps the simple layout', async () => {
    const id = await make();
    await sendAs(id, 'Proforma Invoice', '2026-07-03');
    const res = await pdf(clientToken('docClient'), `/client/invoices/${id}/pdf`);
    assert.equal(res.status, 200);
    assert.match(res.disposition, /Proforma-Invoice-\d+\.pdf/);
    assert.equal(pages(res.buffer), 1);

    const legacy = await inv(ids.docClient, 500, 5);
    const old = await pdf(clientToken('docClient'), `/client/invoices/${legacy._id}/pdf`);
    assert.equal(old.status, 200);
    assert.match(old.disposition, /Invoice-VH-INV/);
  });

  test('billing is validated, defaults come from the last invoice, and documents cannot be written by hand', async () => {
    const bad = await admin('POST', '/admin/invoices', {
      client_ref: ids.docClient, dueDate: new Date(Date.now() + DAY).toISOString(), totalAmount: 100,
      lineItems: [{ description: 'x', qty: 1, unitPrice: 100, amount: 100 }], billing: { gstin: '27AALCV0172E1ZX' },
    });
    assert.equal(bad.status, 400);
    const id = await make({ billing: { address: '1 Road', placeOfSupply: 'Goa', gstin: '27aalcv0172e1zd' } });
    assert.equal((await Invoice().findById(id).lean()).billing.gstin, '27AALCV0172E1ZD', 'normalised');
    assert.equal((await admin('PUT', `/admin/invoices/${id}`, { billing: { placeOfSupply: 'Atlantis' } })).status, 400);

    await admin('PUT', `/admin/invoices/${id}`, { unsent: false, documents: [{ type: 'Tax Invoice', number: 999, date: new Date() }] });
    const after = await Invoice().findById(id).lean();
    assert.equal(after.unsent, true);
    assert.equal(after.documents.length, 0);

    const defaults = (await admin('GET', `/admin/invoice-documents/billing-defaults/${ids.docClient}`)).body.data;
    assert.equal(defaults.name.length > 0, true);
    assert.equal(defaults.address.length > 0, true, "the last invoice's address is offered");
    assert.equal((await admin('GET', '/admin/invoice-documents/billing-defaults/not-an-id')).status, 404);
  });

  test('a tax invoice cannot be deleted (the number would leave a gap); a proforma-only invoice can', async () => {
    const taxed = await make();
    await sendAs(taxed, 'Tax Invoice', '2026-07-03');
    assert.equal((await admin('DELETE', `/admin/invoices/${taxed}`)).status, 409);
    const proforma = await make();
    await sendAs(proforma, 'Proforma Invoice', '2026-07-03');
    assert.equal((await admin('DELETE', `/admin/invoices/${proforma}`)).status, 200);
  });

  test('the send is audited', async () => {
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'INVOICE_SEND' }).lean());
  });
});

describe('lead proforma — raised directly, or from a final proposal, and sent from the lead', () => {
  let leadId;
  const S = '/admin/sales';
  const items = [{ service: 'Performance Marketing – Meta Ads Management', sac: '998361', uom: 'Month', qty: 1, rate: 20000, gstPercent: 18 }];
  const details = { clientName: 'Mumbai Shopper', contactPerson: 'Sahil', email: 'sahil@example.com', phone: '+917400100000', address: '1 Linking Road, Mumbai', placeOfSupply: 'Maharashtra' };
  const timeline = async () => (await mongoose.connection.db.collection('leads').findOne({ _id: leadId })).pipelineHistory || [];

  before(async () => {
    leadId = (await mongoose.connection.db.collection('leads').insertOne({
      leadId: 'VH-261015-901', fullName: 'Sahil chaudhary', phone: '9811100901', email: 'sahil@example.com', status: 'Working',
      pipelineHistory: [], createdAt: new Date(), updatedAt: new Date(),
    })).insertedId;
  });

  test('a direct proforma needs no proposal text, prints DRAFT until final, then gets a number', async () => {
    const made = await admin('POST', `${S}/leads/${leadId}/proposals`, { kind: 'Proforma', details, items });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const p = made.body.proposal;
    assert.equal(p.kind, 'Proforma');
    assert.equal(p.title, 'Proforma Invoice');
    assert.equal(p.sequence, undefined, 'does not use up a proposal number');

    const draftPdf = await fetch(`${base}${S}/proposals/${p._id}/pdf`, { headers: { authorization: `Bearer ${adminToken()}` } });
    assert.equal(draftPdf.status, 200);
    assert.match(draftPdf.headers.get('content-disposition'), /Proforma-draft\.pdf/);
    assert.equal((await admin('GET', `${S}/proposals/${p._id}/proforma`)).status, 400, 'no number before final');
    assert.equal((await admin('POST', `${S}/proposals/${p._id}/share`, { channel: 'WhatsApp', recipient: '+917400100000' })).status, 400, 'cannot send a draft');

    const fin = await admin('POST', `${S}/proposals/${p._id}/finalize`);
    assert.equal(fin.status, 200, JSON.stringify(fin.body));
    assert.ok(fin.body.proposal.proformaNumber >= 33);
    assert.ok((await timeline()).some((h) => h.status === 'Proforma invoice generated'));
    assert.equal((await admin('PUT', `${S}/proposals/${p._id}`, { kind: 'Proforma', details, items })).status, 400, 'final is locked');

    const sent = await admin('POST', `${S}/proposals/${p._id}/share`, { channel: 'WhatsApp', recipient: '+917400100000' });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.match(sent.body.whatsappText, new RegExp(`Proforma Invoice No\\. ${fin.body.proposal.proformaNumber}`));
    assert.equal(sent.body.proposal.shares[0].document, 'Proforma');
    assert.ok((await timeline()).some((h) => h.status === 'Proforma invoice shared via WhatsApp'));
  });

  test('a proposal still needs its text; once final, its proforma can be sent from the same place', async () => {
    assert.equal((await admin('POST', `${S}/leads/${leadId}/proposals`, { details, items })).status, 400, 'requirement and scope');
    const made = await admin('POST', `${S}/leads/${leadId}/proposals`, { details: { ...details, requirement: 'Leads', scope: 'Meta ads' }, items });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const id = made.body.proposal._id;
    assert.match(made.body.proposal.proposalNumber, /^VH-PROP-/);
    assert.equal((await admin('POST', `${S}/proposals/${id}/finalize`)).status, 200);

    const sent = await admin('POST', `${S}/proposals/${id}/share`, { channel: 'WhatsApp', recipient: '+917400100000', document: 'Proforma' });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const no = sent.body.proposal.proformaNumber;
    assert.ok(no);
    assert.match(sent.body.whatsappText, /Proforma Invoice No\./);
    // the proforma number is kept: opening it later gives the same one
    assert.equal((await admin('GET', `${S}/proposals/${id}/proforma`)).status, 200);
    assert.equal((await require('../../models/Proposal').findById(id).lean()).proformaNumber, no);

    const proposalShare = await admin('POST', `${S}/proposals/${id}/share`, { channel: 'WhatsApp', recipient: '+917400100000' });
    assert.equal(proposalShare.status, 200);
    assert.match(proposalShare.body.whatsappText, /Proposal: VH-PROP-/);
    assert.deepEqual(proposalShare.body.proposal.shares.map((s) => s.document), ['Proforma', 'Proposal']);
  });

  test('a new version of a direct proforma stays a proforma and gets its own number when final', async () => {
    const first = (await require('../../models/Proposal').findOne({ lead: leadId, kind: 'Proforma' }).lean());
    const rev = await admin('POST', `${S}/leads/${leadId}/proposals`, { basedOn: String(first._id), details, items: [{ ...items[0], rate: 25000 }] });
    assert.equal(rev.status, 201, JSON.stringify(rev.body));
    assert.equal(rev.body.proposal.kind, 'Proforma');
    assert.equal(rev.body.proposal.version, 2);
    const fin = await admin('POST', `${S}/proposals/${rev.body.proposal._id}/finalize`);
    assert.ok(fin.body.proposal.proformaNumber > first.proformaNumber);
    assert.equal((await require('../../models/Proposal').findById(first._id).lean()).status, 'Superseded');
  });
});

describe('client register — the spreadsheet view of the client list', () => {
  const reg = async (query) => (await admin('GET', `/admin/client-register?${query}`)).body.data;
  const rowOf = (data, key) => data.rows.find((r) => String(r._id) === ids[key]);

  before(async () => {
    const Client = require('../../models/Client');
    const Invoice = require('../../models/Invoice');
    const PaymentProof = require('../../models/PaymentProof');
    const Retainer = require('../../models/Retainer');
    const mk = async (key, name, extra = {}) => {
      const c = await Client.create({ businessName: name, contactName: 'Party Person', email: `${key}@example.com`, phone: '+919800000077', password: 'ClientPass1', isTemporaryPassword: false, ...extra });
      ids[key] = String(c._id);
    };
    await mk('regMonthly', 'Register Monthly Co', { profile: { domains: ['https://mudgar.example/', 'https://second.example/'], onboardingDate: new Date(2026, 6, 1) } });
    await mk('regOneTime', 'Register OneTime Co');
    await mk('regNone', 'Register Nothing Co');

    // two retainers on one client (two domains): package is their sum
    await Retainer.create({ client_ref: ids.regMonthly, packageName: 'Meta Ads', monthlyAmount: 25000, supportHoursPerMonth: 5, contractStartDate: new Date(2026, 6, 1), contractEndDate: new Date(2027, 6, 1) });
    await Retainer.create({ client_ref: ids.regMonthly, packageName: 'Second domain', monthlyAmount: 15000, supportHoursPerMonth: 5, contractStartDate: new Date(2026, 7, 1), contractEndDate: new Date(2027, 7, 1) });

    const due = new Date(2026, 6, 10);
    // paid ₹29,500: ₹10,000 by a verified proof in July, the rest marked paid by staff in September
    const a = await Invoice.create({ client_ref: ids.regMonthly, dueDate: due, subtotal: 25000, taxPercent: 18, taxAmount: 4500, totalAmount: 29500, paidAmount: 29500, paymentStatus: 'Paid', paidOn: new Date(2026, 8, 5), lineItems: [{ description: 'Jul', qty: 1, unitPrice: 25000, amount: 25000 }] });
    await PaymentProof.create({ invoice_ref: a._id, client_ref: ids.regMonthly, amountPaid: 10000, utrNumber: 'UTRREG000000001', paymentDate: new Date(2026, 6, 12), status: 'Approved', verifiedAt: new Date(2026, 6, 12) });
    // partly paid in the previous financial year (Feb 2026), the rest still owed
    await Invoice.create({ client_ref: ids.regMonthly, dueDate: new Date(2026, 1, 10), subtotal: 10000, taxPercent: 18, taxAmount: 1800, totalAmount: 11800, paidAmount: 5000, paidOn: new Date(2026, 1, 20), lineItems: [{ description: 'Feb', qty: 1, unitPrice: 10000, amount: 10000 }] });
    // saved but not sent: never counted
    await Invoice.create({ client_ref: ids.regMonthly, dueDate: due, subtotal: 99999, taxPercent: 0, taxAmount: 0, totalAmount: 99999, paidAmount: 99999, unsent: true, lineItems: [{ description: 'Unsent', qty: 1, unitPrice: 99999, amount: 99999 }] });

    await Invoice.create({ client_ref: ids.regOneTime, dueDate: due, subtotal: 11250, taxPercent: 18, taxAmount: 2025, totalAmount: 13275, paidAmount: 8500, paidOn: new Date(2026, 3, 15), lineItems: [{ description: 'Website', qty: 1, unitPrice: 11250, amount: 11250 }] });
  });

  test('a monthly client: package from its retainers, received split by the month it came in', async () => {
    const data = await reg('fy=2026&search=Register');
    assert.equal(data.fyLabel, 'FY 2026-27');
    assert.deepEqual([data.months[0].label, data.months[11].label], ['Apr-26', 'Mar-27']);
    const r = rowOf(data, 'regMonthly');
    assert.equal(r.party, 'Party Person');
    assert.deepEqual(r.domains, ['https://mudgar.example/', 'https://second.example/']);
    assert.equal(r.billingType, 'Monthly');
    assert.equal(r.serviceStatus, 'Active');
    assert.deepEqual([r.packageAmount, r.gstAmount, r.totalAmount], [40000, 7200, 47200]);
    assert.equal(r.received, 34500, 'both sent invoices, not the unsent one');
    assert.equal(r.balance, 6800);
    const at = (label) => r.months[data.months.findIndex((m) => m.label === label)];
    assert.equal(at('Jul-26'), 10000, 'the verified proof');
    assert.equal(at('Sep-26'), 19500, 'the rest, marked paid by staff');
    assert.equal(r.fyTotal, 29500);
  });

  test('the months of every year add up to Received — nothing counted twice or lost', async () => {
    const prev = rowOf(await reg('fy=2025&search=Register'), 'regMonthly');
    const cur = rowOf(await reg('fy=2026&search=Register'), 'regMonthly');
    assert.equal(prev.fyTotal, 5000, 'Feb 2026 belongs to FY 2025-26');
    assert.equal(prev.fyTotal + cur.fyTotal, cur.received);
  });

  test('a client with no retainer is One Time; one with nothing billed has empty figures', async () => {
    const data = await reg('fy=2026&search=Register');
    const one = rowOf(data, 'regOneTime');
    assert.equal(one.billingType, 'One Time');
    assert.equal(one.serviceStatus, 'Active', 'In-Active only once offboarded');
    assert.deepEqual([one.packageAmount, one.gstAmount, one.totalAmount, one.received, one.balance], [11250, 2025, 13275, 8500, 4775]);
    const none = rowOf(data, 'regNone');
    assert.equal(none.billingType, null);
    assert.equal(none.received, 0);
    assert.equal(none.fyTotal, 0);
  });

  test('the totals row is the sum of the rows', async () => {
    const data = await reg('fy=2026&search=Register');
    const money = data.rows.filter((r) => r.months);
    for (const key of ['packageAmount', 'received', 'balance', 'fyTotal']) {
      assert.equal(data.totals[key], Math.round(money.reduce((s, r) => s + (r[key] || 0), 0) * 100) / 100, key);
    }
    data.totals.months.forEach((v, i) => assert.equal(v, Math.round(money.reduce((s, r) => s + r.months[i], 0) * 100) / 100));
  });

  test('offboarding makes a client In-Active without blocking their login; it can be undone', async () => {
    assert.equal((await admin('POST', `/admin/clients/${ids.regMonthly}/offboard`, { reason: 'no' })).status, 400, 'needs a reason');
    const off = await admin('POST', `/admin/clients/${ids.regMonthly}/offboard`, { reason: 'Contract ended on 30 Sep' });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body.activeRetainers, 2, 'warns that retainers still run');
    assert.equal((await admin('POST', `/admin/clients/${ids.regMonthly}/offboard`, { reason: 'Contract ended on 30 Sep' })).status, 409);

    const r = rowOf(await reg('fy=2026&search=Register'), 'regMonthly');
    assert.equal(r.serviceStatus, 'In-Active');
    assert.equal(r.offboardReason, 'Contract ended on 30 Sep');
    assert.equal(r.received, 34500, 'money history is kept');
    assert.equal((await asClient('regMonthly', 'GET', '/client/invoices')).status, 200, 'login still works');
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'CLIENT_OFFBOARD' }).lean());

    assert.equal((await admin('POST', `/admin/clients/${ids.regMonthly}/onboard-again`)).status, 200);
    assert.equal(rowOf(await reg('fy=2026&search=Register'), 'regMonthly').serviceStatus, 'Active');
    assert.equal((await admin('POST', `/admin/clients/${ids.regMonthly}/onboard-again`)).status, 409);
  });
});

describe('portal preview — a Super Admin views the Client / Employee Portal as that person, read-only', () => {
  const asPreview = async (token, method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', 'x-preview-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body: json, cache: res.headers.get('cache-control') };
  };
  let clientPreview;
  let employeeId;
  let limitedToken;

  before(async () => {
    const Role = require('../../models/Role');
    const Admin = require('../../models/Admin');
    const Employee = require('../../models/Employee');
    const role = await Role.create({ name: 'BDE_PREVIEW', permissions: ['ess.access', 'leads.view'], isEmployeeRole: true });
    const a = await Admin.create({ firstName: 'Priya', lastName: 'Preview', email: 'priya-preview@e2e.test', password: 'Passw0rd!e2e', roles: [role._id], employeeId: 'VH-PRV-1', isTemporaryPassword: true });
    employeeId = (await Employee.collection.insertOne({ employeeId: 'VH-PRV-1', adminId: a._id, firstName: 'Priya', lastName: 'Preview', email: 'priya-preview@e2e.test', phone: '9800000001', roleDept: 'Sales', joinDate: new Date(), salaryCTC: 1, employmentStatus: 'Permanent' })).insertedId;
    // an admin who is not a Super Admin
    const crmRole = await Role.create({ name: 'CRM_ONLY_PREVIEW', permissions: ['cms.manage'] });
    const limited = await Admin.create({ firstName: 'Crm', lastName: 'Only', email: 'crm-only-preview@e2e.test', password: 'Passw0rd!e2e', roles: [crmRole._id] });
    limitedToken = jwt.sign({ id: limited._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  test('a Super Admin opens the client portal as that client and sees their data', async () => {
    const res = await admin('POST', `/admin/portal-preview/client/${ids.docClient}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    clientPreview = res.body.data.token;
    assert.equal(res.body.data.name, 'Doc Client');

    const me = await asPreview(clientPreview, 'GET', '/client/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.client.businessName, 'Doc Client');
    assert.equal(me.body.preview.kind, 'client');
    assert.match(me.cache, /no-store/, 'never cached publicly');
    const invoices = await asPreview(clientPreview, 'GET', '/client/invoices');
    assert.equal(invoices.status, 200);
    assert.ok(invoices.body.summary.total > 0, 'the proforma / tax invoices the client was sent');
    assert.ok(await require('../../models/AuditLog').findOne({ action: 'PORTAL_PREVIEW' }).lean());
  });

  test('the preview is read-only and is not an Admin panel login', async () => {
    const note = await asPreview(clientPreview, 'PUT', '/client/auth/profile', { contactName: 'Hacker Name' });
    assert.equal(note.status, 403);
    assert.equal(note.body.preview, true);
    assert.equal((await asPreview(clientPreview, 'POST', '/client/payments', {})).status, 403);
    assert.equal((await require('../../models/Client').findById(ids.docClient).lean()).contactName, 'Owner Person');

    // as a bearer token it is refused by the admin panel and by the other portal
    assert.equal((await request(clientPreview, 'GET', '/admin/clients')).status, 401);
    assert.equal((await asPreview(clientPreview, 'GET', '/employee/auth/me')).status, 401);
  });

  test('the employee portal preview shows the portal as set up, even with a temporary password', async () => {
    const res = await admin('POST', `/admin/portal-preview/employee/${employeeId}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const me = await asPreview(res.body.data.token, 'GET', '/employee/auth/me');
    assert.equal(me.status, 200, JSON.stringify(me.body));
    assert.equal(me.body.employee.employeeId, 'VH-PRV-1');
    assert.equal(me.body.employee.isTemporaryPassword, false);
    assert.equal(me.body.preview.kind, 'employee');
    assert.equal((await asPreview(res.body.data.token, 'GET', '/employee-portal/ess/leads')).status, 200);
    assert.equal((await asPreview(res.body.data.token, 'POST', '/employee/auth/reset-temp-password', { newPassword: 'Xx12345678!' })).status, 403);
    assert.equal((await request(res.body.data.token, 'GET', '/admin/clients')).status, 401, 'never an admin login');
  });

  test('only a Super Admin can open a preview, and it ends when they stop being one', async () => {
    assert.equal((await request(limitedToken, 'POST', `/admin/portal-preview/client/${ids.docClient}`)).status, 403);
    assert.equal((await admin('POST', '/admin/portal-preview/client/not-an-id')).status, 404);
    assert.equal((await admin('POST', `/admin/portal-preview/client/${ids.delta}`)).status, 409, 'a suspended client has no portal');

    // a preview token made for someone who is not (or no longer) a Super Admin is refused
    const forged = jwt.sign({ id: ids.docClient, tv: 0, preview: { kind: 'client', by: String(new mongoose.Types.ObjectId()) } }, JWT_SECRET, { expiresIn: '5m' });
    assert.equal((await asPreview(forged, 'GET', '/client/auth/me')).status, 401);
  });
});
