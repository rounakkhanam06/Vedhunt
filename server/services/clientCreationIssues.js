// Making a failed "Won lead → client account" visible and fixable.
// Before this, a failure was only written to the server log and the lead just
// looked Won with no client behind it. Now every failure (and every deliberate
// skip that needs a person) becomes an open issue with the exact cause, staff are
// notified once, the lead's own history says what happened, and an admin can
// retry, create the account with corrected details, link an existing client, or
// dismiss it with a reason.
const Client = require('../models/Client');
const Lead = require('../models/Lead');
const ClientCreationIssue = require('../models/ClientCreationIssue');
const { notifyPermissionHolders } = require('./staffNotify');
const { normalizePhone } = require('../utils/normalize');
const logger = require('../utils/logger');

const nameOf = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || 'staff';

// ── Working out the cause ───────────────────────────────────────────────────
/** What the account would be created from, taken from the lead (optionally corrected by staff). */
function detailsFromLead(lead, overrides = {}) {
  const pick = (k, fallback) => (overrides[k] !== undefined ? String(overrides[k] ?? '').trim() : fallback);
  return {
    businessName: pick('businessName', String(lead.businessName || lead.fullName || '').trim()),
    contactName: pick('contactName', String(lead.fullName || '').trim()),
    email: pick('email', String(lead.email || '').toLowerCase().trim()).toLowerCase(),
    phone: overrides.phone !== undefined ? String(overrides.phone ?? '').trim() : normalizePhone(lead.phone),
  };
}

const FIELD_CODE = { businessName: 'invalid_business_name', contactName: 'invalid_name', email: 'invalid_email', phone: 'invalid_phone' };
const FIELD_LABEL = { businessName: 'Business name', contactName: 'Contact name', email: 'Email', phone: 'Phone' };

/**
 * Check the details against the real Client rules (so this can never drift from
 * what creation actually enforces) and against existing accounts.
 * @returns { reasons: [{code,message}], existingClient: Client|null }
 */
async function diagnose(details) {
  const reasons = [];
  const probe = new Client({ ...details, phone: details.phone || undefined, password: 'probe-password' });
  const err = probe.validateSync();
  for (const [field, e] of Object.entries(err?.errors || {})) {
    if (field === 'password') continue;
    reasons.push({ code: FIELD_CODE[field] || 'invalid_field', message: `${FIELD_LABEL[field] || field}: ${e.message}` });
  }

  let existingClient = null;
  if (details.email) {
    existingClient = await Client.findOne({ email: details.email.toLowerCase().trim() }).select('clientId businessName email deletedAt leadRef').lean();
    if (existingClient?.deletedAt) {
      reasons.push({ code: 'client_archived', message: `A deleted client account (${existingClient.clientId}, ${existingClient.businessName}) already uses this email. Restore it from Client Accounts, or use a different email.` });
    } else if (existingClient) {
      reasons.push({ code: 'email_in_use', message: `A client account (${existingClient.clientId}, ${existingClient.businessName}) already uses this email but is not linked to this lead. Link it if it is the same customer, or create a new account with a different email.` });
    }
  }
  return { reasons, existingClient };
}

/** Human text for an error that is not a data problem (database down, unexpected bug …). */
const unexpected = (err) => ({ code: 'error', message: `Unexpected error while creating the account: ${String(err?.message || err).slice(0, 200)}` });

// ── Recording ───────────────────────────────────────────────────────────────
const sameReasons = (a = [], b = []) => a.length === b.length && a.every((r, i) => r.code === b[i].code && r.message === b[i].message);

/**
 * Open (or refresh) the issue for a lead. Staff are told and the lead's history
 * is annotated only when the issue is new or its cause changed — repeated
 * failed attempts don't spam either.
 */
async function recordIssue(lead, reasons, { existingClient = null, source = 'won', actorAdminId = null } = {}) {
  const previous = await ClientCreationIssue.findOne({ lead_ref: lead._id }).lean();
  const wasOpen = previous?.status === 'Open';
  const changed = !wasOpen || !sameReasons(previous.reasons, reasons);

  const issue = await ClientCreationIssue.findOneAndUpdate(
    { lead_ref: lead._id },
    {
      $set: { status: 'Open', reasons, existingClient: existingClient?._id || undefined, source, lastAttemptAt: new Date() },
      $inc: { attempts: 1 }, // the first failed try counts as attempt 1
      $unset: { resolvedAt: 1, resolvedBy: 1, resolvedByName: 1, resolution: 1, client_ref: 1 },
    },
    { upsert: true, new: true }
  );

  if (changed) {
    const first = reasons[0]?.message || 'unknown cause';
    await Lead.updateOne(
      { _id: lead._id },
      { $push: { pipelineHistory: { status: 'Client account not created', date: new Date(), updatedBy: actorAdminId || undefined, note: `${reasons.map((r) => r.message).join(' • ')}`.slice(0, 500) } } }
    ).catch((e) => logger.error('Could not annotate lead history:', e.message));
    await notifyPermissionHolders('cms.manage', {
      type: 'client_creation_issue',
      title: `Client account not created — ${lead.businessName || lead.fullName || 'a Won lead'}`,
      message: first.slice(0, 200),
      link: '/admin/clients',
    });
  }
  return issue;
}

/** Close an open issue because an account now exists. */
async function resolveIssue(leadId, client, { resolution, user } = {}) {
  return ClientCreationIssue.findOneAndUpdate(
    { lead_ref: leadId, status: 'Open' },
    { $set: { status: 'Resolved', resolvedAt: new Date(), resolvedBy: user?._id, resolvedByName: user ? nameOf(user) : 'Automatic', resolution: resolution || 'Client account created', client_ref: client._id } },
    { new: true }
  );
}

// ── Finding existing problems ───────────────────────────────────────────────
/**
 * Find Won leads that have no client account and record why. Safe to run any
 * time: leads that already have an account, or already have an open issue with
 * the same cause, are left alone.
 * @returns { checked, withAccount, issues: number (new or refreshed) }
 */
async function scanWonLeads() {
  const leads = await Lead.find({ status: 'Won' }).select('fullName businessName email phone').lean();
  const linked = new Map((await Client.find({ leadRef: { $in: leads.map((l) => l._id) } }).select('leadRef').lean()).map((c) => [String(c.leadRef), c]));
  const result = { checked: leads.length, withAccount: 0, issues: 0 };
  for (const lead of leads) {
    const account = linked.get(String(lead._id));
    if (account) {
      result.withAccount += 1;
      await resolveIssue(lead._id, account, { resolution: 'An account is linked to this lead' });
      continue;
    }
    const { reasons, existingClient } = await diagnose(detailsFromLead(lead));
    await recordIssue(lead, reasons.length ? reasons : [{ code: 'not_attempted', message: 'No account was created and no data problem was found — the conversion probably never ran (for example the lead was imported as Won). Press Retry.' }], { existingClient, source: 'scan' });
    result.issues += 1;
  }
  return result;
}

module.exports = { detailsFromLead, diagnose, unexpected, recordIssue, resolveIssue, scanWonLeads, nameOf };
