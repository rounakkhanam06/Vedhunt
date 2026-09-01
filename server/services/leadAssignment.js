const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const Settings = require('../models/Settings');
const AssignmentRule = require('../models/AssignmentRule');
const AssignmentLog = require('../models/AssignmentLog');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { findLeadRaw } = require('../utils/leadLookup');

// A lead still being worked counts against a BD's workload; these are done.
const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];

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
 * @returns {object} plain object reflecting the lead's new assignment state
 */
async function applyAssignment(leadRef, { toAdmin, assignedBy = null, mode, reason = '' }) {
  const leadPlain = typeof leadRef.toObject === 'function' ? leadRef.toObject() : leadRef;
  const fromAdmin = leadPlain.assignedTo || null;
  const toAdminId = toAdmin || null;
  const toAdminObjectId = toAdminId ? new mongoose.Types.ObjectId(toAdminId) : null;
  const assignedAt = toAdminId ? new Date() : null;

  let assignedToDoc = null;
  let bdName = '';
  if (toAdminId) {
    assignedToDoc = await Admin.findById(toAdminId).select('firstName lastName email');
    // firstName/lastName aren't guaranteed on every Admin account (the
    // original legacy seed account predates those fields being required) —
    // fall back to email rather than storing "undefined undefined".
    if (assignedToDoc) {
      const name = `${assignedToDoc.firstName || ''} ${assignedToDoc.lastName || ''}`.trim();
      bdName = name || assignedToDoc.email || '';
    }
  }

  const updateFields = { assignedTo: toAdminObjectId, assignedAt, bd: bdName, updatedAt: new Date() };
  // Clear SLA tracking if lead is now assigned
  if (toAdminId) {
    updateFields.unassignedSlaDeadline = null;
  }

  const db = mongoose.connection.db;
  await db.collection('leads').updateOne(
    { _id: leadPlain._id },
    { $set: updateFields }
  );

  await AssignmentLog.create({
    lead: leadPlain._id,
    fromAdmin,
    toAdmin: toAdminObjectId,
    assignedBy,
    mode,
    reason
  });

  if (toAdminId) {
    await Notification.create({
      recipient: toAdminId,
      type: 'lead_assigned',
      title: 'New lead assigned to you',
      message: `${leadPlain.fullName} — ${leadPlain.service || leadPlain.platform}`,
      // BDs work exclusively from the Employee Portal (see PORTAL_ONLY_ROLES
      // in server/routes/auth.js) — the admin panel isn't reachable for them.
      link: `/employee/dashboard?tab=leads&leadId=${leadPlain._id}`,
      lead: leadPlain._id
    });
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
async function manualAssign({ leadId, toAdmin, assignedBy, reason }) {
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

  return applyAssignment(lead, { toAdmin, assignedBy, mode: 'Manual', reason });
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

    for (const rule of rules) {
      const serviceMatches = !rule.matchService || rule.matchService.toLowerCase() === String(lead.service || '').toLowerCase();
      const sourceMatches = !rule.matchSource || rule.matchSource.toLowerCase() === String(lead.platform || '').toLowerCase();
      if (!serviceMatches || !sourceMatches) continue;
      if (!rule.bdPool.length) continue;

      for (let i = 0; i < rule.bdPool.length; i++) {
        const idx = (rule.cursor + i) % rule.bdPool.length;
        const bdId = rule.bdPool[idx];

        if (rule.maxActiveLeads != null) {
          const count = await activeLeadCount(bdId);
          if (count >= rule.maxActiveLeads) continue;
        }

        rule.cursor = (idx + 1) % rule.bdPool.length;
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

module.exports = { getBDERole, activeLeadCount, applyAssignment, manualAssign, autoAssignLead, TERMINAL_STATUSES };
