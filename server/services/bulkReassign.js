// Bulk reassignment of a confirmed selection of leads to one new owner (or
// the unassigned pool). Kept apart from cross-assignment
// (services/leadCollaboration.js), which adds a BD without changing the owner.
//
//   checkSelection → what the preview shows: per-lead eligibility + reasons
//   runBulkReassign → re-checks every lead at confirm time, moves the eligible
//                     ones through manualAssign (AssignmentLog per lead) and
//                     records the whole run in BulkAssignmentRun
//
// Only ownership changes. Status, call logs, notes, remarks, score and
// history stay on the lead; pending follow-ups move with it (applyAssignment).
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const BulkAssignmentRun = require('../models/BulkAssignmentRun');
const { manualAssign } = require('./leadAssignment');
const { hasActiveCallByOther } = require('./leadLifecycle');
const logger = require('../utils/logger');

const MAX_BULK = 5000;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const fullName = (a) => (a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Unknown' : 'Unassigned');

/** Unique, valid ObjectIds from the request, or an error message. */
function parseLeadIds(leadIds) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { error: 'No leads selected.' };
  const unique = [...new Set(leadIds.map(String))];
  if (unique.length > MAX_BULK) return { error: `Select at most ${MAX_BULK} leads at a time.` };
  return { ids: unique };
}

/**
 * Every selected lead with whether it can move and why not.
 * @param scopeFilter   leads the person may reassign (leadFilter, shared: false)
 * @param target        destination Admin id, or null to unassign
 * @param expectedOwner owner the selection was filtered by, or null
 */
async function checkSelection({ ids, scopeFilter, target, expectedOwner, actorId }) {
  const col = mongoose.connection.db.collection('leads');
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const projection = { leadId: 1, fullName: 1, assignedTo: 1, status: 1, lockedBy: 1, lockedAt: 1, callStartTime: 1, callEndTime: 1, callStartedBy: 1 };
  // Legacy leads may carry string _ids, so look both forms up
  const all = await col.find({ _id: { $in: [...objectIds, ...ids] } }, { projection }).toArray();
  const inScope = new Set((await col.find({ _id: { $in: all.map((l) => l._id) }, ...scopeFilter }, { projection: { _id: 1 } }).toArray()).map((l) => String(l._id)));
  const byId = new Map(all.map((l) => [String(l._id), l]));

  const results = ids.map((id) => {
    const lead = byId.get(id);
    if (!lead) return { id, eligible: false, reason: 'Lead not found (it may have been deleted).' };
    const base = { id, lead };
    if (!inScope.has(id)) return { ...base, eligible: false, reason: 'Outside the leads you can reassign.' };
    const owner = lead.assignedTo ? String(lead.assignedTo) : null;
    if (expectedOwner && owner !== String(expectedOwner)) return { ...base, eligible: false, reason: 'Owner changed since you filtered.' };
    if (owner === (target ? String(target) : null)) return { ...base, eligible: false, reason: target ? 'Already owned by the new BD.' : 'Already unassigned.' };
    if (lead.lockedBy && String(lead.lockedBy) !== String(actorId) && lead.lockedAt && Date.now() - new Date(lead.lockedAt).getTime() < LOCK_TIMEOUT_MS) {
      return { ...base, eligible: false, reason: 'Open in someone’s workspace right now (locked).' };
    }
    if (hasActiveCallByOther(lead, actorId)) return { ...base, eligible: false, reason: 'A call is in progress on this lead.' };
    return { ...base, eligible: true };
  });

  const ownerIds = [...new Set(all.map((l) => l.assignedTo && String(l.assignedTo)).filter(Boolean))];
  const owners = await Admin.find({ _id: { $in: ownerIds } }, { firstName: 1, lastName: 1, email: 1 }).lean();
  const ownerName = new Map(owners.map((o) => [String(o._id), fullName(o)]));
  return { results, ownerName };
}

const leadSummary = (r, ownerName) => ({
  _id: r.id,
  leadId: r.lead?.leadId || '',
  fullName: r.lead?.fullName || '',
  status: r.lead?.status || '',
  owner: r.lead?.assignedTo ? ownerName.get(String(r.lead.assignedTo)) || 'Unknown' : 'Unassigned',
  ...(r.reason && { reason: r.reason }),
});

/** Preview: counts per current owner, destination, and every lead that can't move. */
async function previewBulkReassign(opts) {
  const { results, ownerName } = await checkSelection(opts);
  const eligible = results.filter((r) => r.eligible);
  const sources = {};
  for (const r of eligible) {
    const key = r.lead.assignedTo ? String(r.lead.assignedTo) : 'unassigned';
    sources[key] = sources[key] || { _id: key === 'unassigned' ? null : key, name: key === 'unassigned' ? 'Unassigned' : ownerName.get(key) || 'Unknown', count: 0 };
    sources[key].count++;
  }
  const target = opts.target ? await Admin.findById(opts.target, { firstName: 1, lastName: 1, email: 1 }).lean() : null;
  return {
    requested: results.length,
    eligible: eligible.length,
    sources: Object.values(sources).sort((a, b) => b.count - a.count),
    target: { _id: opts.target || null, name: fullName(target) },
    ineligible: results.filter((r) => !r.eligible).map((r) => leadSummary(r, ownerName)),
  };
}

/** Confirmed run: re-check, move the eligible leads, record everything. */
async function runBulkReassign(opts, { filters = {}, selection = 'manual', reason = '' } = {}) {
  const { results } = await checkSelection(opts);
  const run = await BulkAssignmentRun.create({
    initiatedBy: opts.actorId,
    toAdmin: opts.target || null,
    expectedOwner: opts.expectedOwner || null,
    filters,
    selection: selection === 'all-matching' ? 'all-matching' : 'manual',
    reason,
    requested: results.length,
  });

  const succeeded = [];
  const failed = results.filter((r) => !r.eligible).map((r) => ({ lead: r.lead?._id || r.id, leadId: r.lead?.leadId || '', fullName: r.lead?.fullName || '', reason: r.reason }));
  // One bad lead must not abort the rest, so failures are collected per lead
  for (const r of results.filter((x) => x.eligible)) {
    try {
      const moved = await manualAssign({
        leadId: r.lead._id,
        toAdmin: opts.target || null,
        assignedBy: opts.actorId,
        reason: reason || (opts.target ? 'Bulk Reassignment' : 'Bulk Unassigned'),
        bulkRun: run._id,
      });
      if (moved) succeeded.push({ lead: r.lead._id, leadId: r.lead.leadId || '', fromAdmin: r.lead.assignedTo || null });
      else failed.push({ lead: r.lead._id, leadId: r.lead.leadId || '', fullName: r.lead.fullName || '', reason: 'Lead not found (it may have been deleted).' });
    } catch (err) {
      logger.error(`Bulk reassign of lead ${r.lead._id} failed:`, err);
      failed.push({ lead: r.lead._id, leadId: r.lead.leadId || '', fullName: r.lead.fullName || '', reason: err.message || 'Could not reassign.' });
    }
  }

  run.succeeded = succeeded;
  run.failed = failed;
  run.status = failed.length === 0 ? 'completed' : succeeded.length === 0 ? 'failed' : 'partial';
  run.finishedAt = new Date();
  await run.save();
  return run;
}

/** A run with names, for the completion summary and later inspection. */
async function loadRun(runId, filter = {}) {
  if (!mongoose.isValidObjectId(runId)) return null;
  return BulkAssignmentRun.findOne({ _id: runId, ...filter })
    .populate('initiatedBy', 'firstName lastName email')
    .populate('toAdmin', 'firstName lastName email')
    .populate('expectedOwner', 'firstName lastName email')
    .populate('succeeded.fromAdmin', 'firstName lastName email')
    .lean();
}

module.exports = { parseLeadIds, previewBulkReassign, runBulkReassign, loadRun, MAX_BULK };
