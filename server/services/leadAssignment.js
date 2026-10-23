const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const Settings = require('../models/Settings');
const AssignmentRule = require('../models/AssignmentRule');
const AssignmentLog = require('../models/AssignmentLog');
const FollowUpTask = require('../models/FollowUpTask');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { findLeadRaw } = require('../utils/leadLookup');
const { sendPushToAdmin } = require('../utils/pushNotify');

// A lead still being worked counts against a BD's workload; these are done.
const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];

const LEAD_PERMISSIONS = ['leads.view', 'leads.viewAll'];

/**
 * Everyone a lead can be manually assigned to: active BDEs, anyone whose role
 * gives lead access (Role Management), and anyone granted the Leads page.
 */
async function assignableAdminFilter() {
  const bdeRole = await getBDERole();
  const leadRoles = await Role.find({ permissions: { $in: LEAD_PERMISSIONS } }).select('_id');
  return {
    isActive: true,
    $or: [
      { roles: { $in: [bdeRole._id, ...leadRoles.map((r) => r._id)] } },
      { accessGrants: { $elemMatch: { page: 'leads', actions: 'view' } } },
    ],
  };
}

/** The round-robin default pool: BDEs not opted out, plus anyone opted in. */
async function autoAssignPoolFilter() {
  const bdeRole = await getBDERole();
  return {
    isActive: true,
    $or: [
      { roles: bdeRole._id, autoAssignEligible: { $ne: false } },
      { autoAssignEligible: true },
    ],
  };
}

/** Find-or-create the BDE role, same idiom as employeeRoutes.js's getEmployeeRole(). */
async function getBDERole() {
  let role = await Role.findOne({ name: 'BDE' });
  if (!role) {
    role = await Role.create({
      name: 'BDE',
      description: 'Business Development Executive — views and works only their own assigned leads.',
      permissions: ['leads.view'],
      isSystem: false
    });
  }
  return role;
}

async function activeLeadCount(adminId) {
  return Lead.countDocuments({ assignedTo: adminId, status: { $nin: TERMINAL_STATUSES } });
}

/**
 * The only place that writes lead.assignedTo/assignedAt/bd. Every assignment
 * path (manual or round-robin) funnels through here so the audit log and
 * notification are never skipped.
 *
 * Writes through the raw driver rather than lead.save() — some legacy Lead
 * documents have a String _id instead of ObjectId (see utils/leadLookup.js),
 * and .save()'s internal version-checked update silently fails to match
 * those, throwing a spurious VersionError. This accepts either a Mongoose
 * document or a plain object (from findLeadRaw) for the same reason.
 *
 * @param {object} leadRef   a Lead document or plain object (_id, assignedTo, fullName, service, platform)
 * @param {ObjectId|null} toAdmin      new owner, or null to unassign
 * @param {ObjectId|null} assignedBy   who performed this; null = system/round-robin
 * @param {'Manual'|'Auto-RoundRobin'} mode
 * @param {string} [reason]
 * @param {ObjectId} [bulkRun]        BulkAssignmentRun this change belongs to
 * @returns {object} plain object reflecting the lead's new assignment state
 */
async function applyAssignment(leadRef, { toAdmin, assignedBy = null, mode, reason = '', bulkRun = null }) {
  const leadPlain = typeof leadRef.toObject === 'function' ? leadRef.toObject() : leadRef;
  const fromAdmin = leadPlain.assignedTo || null;
  const toAdminId = toAdmin || null;
  const toAdminObjectId = toAdminId ? new mongoose.Types.ObjectId(toAdminId) : null;
  const assignedAt = toAdminId ? new Date() : null;

  let assignedToDoc = null;
  let bdName = '';
  if (toAdminId) {
    assignedToDoc = await Admin.findById(toAdminId).select('firstName lastName email isActive');
    // Assigning to an account that no longer exists strands the lead: it shows
    // as assigned, appears in nobody's queue, and its notification lands in a
    // mailbox that cannot be opened. Deleting a BD used to leave their id
    // behind in AssignmentRule.bdPool and every subsequent round-robin hit it.
    if (!assignedToDoc || !assignedToDoc.isActive) {
      const err = new Error(`Cannot assign lead to ${toAdminId} — no active Admin account with that id.`);
      err.status = 400;
      throw err;
    }
    // firstName/lastName aren't guaranteed on every Admin account (the
    // original legacy seed account predates those fields being required) —
    // fall back to email rather than storing "undefined undefined".
    const name = `${assignedToDoc.firstName || ''} ${assignedToDoc.lastName || ''}`.trim();
    bdName = name || assignedToDoc.email || '';
  }

  const updateFields = { assignedTo: toAdminObjectId, assignedAt, bd: bdName, updatedAt: new Date() };
  // Clear SLA tracking if lead is now assigned
  if (toAdminId) {
    updateFields.unassignedSlaDeadline = null;
  }

  const db = mongoose.connection.db;
  // A BD who becomes the owner no longer needs a separate shared-access entry
  const update = { $set: updateFields };
  if (toAdminObjectId) update.$pull = { sharedWith: { admin: toAdminObjectId } };
  await db.collection('leads').updateOne({ _id: leadPlain._id }, update);

  // The lead's status, call logs, notes and pipeline history live on the lead
  // itself and are untouched by a reassignment. Pending follow-up tasks belong
  // to the previous owner, so hand those to the new one — otherwise the old BD
  // keeps getting reminders and the new BD never sees them. Completed and
  // cancelled tasks stay as history.
  if (toAdminObjectId && fromAdmin && mongoose.isValidObjectId(leadPlain._id)) {
    await FollowUpTask.updateMany(
      { lead: leadPlain._id, status: 'Pending', assignedTo: fromAdmin },
      { $set: { assignedTo: toAdminObjectId } }
    );
  }

  await AssignmentLog.create({
    lead: leadPlain._id,
    fromAdmin,
    toAdmin: toAdminObjectId,
    assignedBy,
    mode,
    reason,
    bulkRun
  });

  if (toAdminId) {
    const title = 'New lead assigned to you';
    const message = `${leadPlain.fullName} — ${leadPlain.service || leadPlain.platform}`;
    // BDs work exclusively from the Employee Portal (see PORTAL_ONLY_ROLES
    // in server/routes/auth.js) — the admin panel isn't reachable for them.
    const link = `/employee/dashboard?tab=leads&leadId=${leadPlain._id}`;
    await Notification.create({ recipient: toAdminId, type: 'lead_assigned', title, message, link, lead: leadPlain._id });
    await sendPushToAdmin(toAdminId, { title, body: message, link });
  }

  return {
    ...leadPlain,
    assignedTo: assignedToDoc
      ? { _id: assignedToDoc._id, firstName: assignedToDoc.firstName, lastName: assignedToDoc.lastName, email: assignedToDoc.email }
      : null,
    assignedAt,
    bd: bdName
  };
}

/**
 * Admin-initiated assign/reassign/unassign. No workload-limit check — an
 * admin overriding capacity is the point of "Manual" mode.
 */
async function manualAssign({ leadId, toAdmin, assignedBy, reason, bulkRun = null }) {
  const lead = await findLeadRaw(leadId);
  if (!lead) return null;

  // Lock Enforcement (Temporary protection during active handling)
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  if (lead.lockedBy && String(lead.lockedBy) !== String(assignedBy)) {
    if (lead.lockedAt && (Date.now() - new Date(lead.lockedAt).getTime()) < LOCK_TIMEOUT_MS) {
      const err = new Error('Lead is currently locked by another user for active handling.');
      err.status = 409;
      throw err;
    }
  }

  return applyAssignment(lead, { toAdmin, assignedBy, mode: 'Manual', reason, bulkRun });
}

/**
 * Picks the next eligible BD for a newly-created lead per the active
 * AssignmentRules, respecting per-rule workload limits. Never throws — a
 * failure here must not cost us the lead itself.
 */
async function autoAssignLead(lead) {
  try {
    const settings = await Settings.findOne({ key: 'lead_assignment' });
    if (!settings?.value?.autoAssignEnabled) return null;

    const rules = await AssignmentRule.find({ active: true }).sort({ priority: 1, createdAt: 1 });
    // Lazily resolved only if some rule actually needs it (most deployments
    // have one rule) — see the empty-bdPool branch below.
    let allActiveBDs = null;

    for (const rule of rules) {
      const serviceMatches = !rule.matchService || rule.matchService.toLowerCase() === String(lead.service || '').toLowerCase();
      const sourceMatches = !rule.matchSource || rule.matchSource.toLowerCase() === String(lead.platform || '').toLowerCase();
      if (!serviceMatches || !sourceMatches) continue;

      // An explicit bdPool curates a fixed subset (e.g. "only these two BDs
      // handle enterprise leads"). Leaving it empty instead means "every
      // active BD" resolved fresh on each assignment — so removing a BD's
      // account (or hiring a new one) takes effect immediately, with nothing
      // in this rule to go stale. This is why an empty pool used to just skip
      // the rule; that state was never useful, so repurposing it is safe.
      let pool = rule.bdPool;
      if (!pool.length) {
        if (!allActiveBDs) {
          allActiveBDs = (await Admin.find(await autoAssignPoolFilter()).sort({ _id: 1 }).select('_id')).map((a) => a._id);
        }
        pool = allActiveBDs;
      }
      if (!pool.length) continue;

      for (let i = 0; i < pool.length; i++) {
        const idx = (rule.cursor + i) % pool.length;
        const bdId = pool[idx];

        // A curated pool can still list someone since deleted/deactivated —
        // skip past them rather than stranding the lead on a dead account.
        const bd = await Admin.findById(bdId).select('isActive').lean();
        if (!bd || !bd.isActive) {
          logger.warn(`Assignment rule "${rule.name}" lists BD ${bdId}, which is not an active Admin — skipping.`);
          continue;
        }

        if (rule.maxActiveLeads != null) {
          const count = await activeLeadCount(bdId);
          if (count >= rule.maxActiveLeads) continue;
        }

        rule.cursor = (idx + 1) % pool.length;
        await rule.save();

        return applyAssignment(lead, { toAdmin: bdId, assignedBy: null, mode: 'Auto-RoundRobin', reason: `Matched rule "${rule.name}"` });
      }
      // Every BD in this rule's pool is at capacity — fall through to the
      // next rule rather than leaving a matched lead unassigned outright.
    }

    return null; // no matching rule, or every eligible BD is at capacity
  } catch (err) {
    logger.error(`Auto-assign failed for lead ${lead._id}:`, err);
    return null;
  }
}

module.exports = { getBDERole, assignableAdminFilter, autoAssignPoolFilter,activeLeadCount, applyAssignment, manualAssign, autoAssignLead, TERMINAL_STATUSES };
