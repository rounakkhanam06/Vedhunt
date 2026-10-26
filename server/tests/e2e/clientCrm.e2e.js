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

  test('a step needing evidence cannot be completed without it; Not Applicable needs a reason', async () => {
    const put = (key, body) => admin('PUT', `/admin/clients/${ids.alpha}/onboarding/items/${key}`, body);
    assert.equal((await put('contract_signed', { status: 'Completed' })).status, 400);
    assert.equal((await put('meta_access', { status: 'Not Applicable' })).status, 400);
    assert.equal((await put('contract_signed', { status: 'Completed', evidenceLink: 'https://drive.test/signed.pdf' })).status, 200);
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
    await put('advance_payment', { status: 'Completed', evidenceLink: 'https://pay.test/utr' });
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

  test('a new invoice from staff reaches the client bell, unread, with a link to billing', async () => {
    const res = await admin('POST', '/admin/invoices', {
      client_ref: ids.beta, dueDate: new Date(Date.now() + 10 * DAY).toISOString(), totalAmount: 5000,
      lineItems: [{ description: 'Retainer', qty: 1, unitPrice: 5000, amount: 5000 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
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
    });
    assert.equal(res.status, 201);
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
    assert.equal(got.body.events.length, 7);
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
