const mongoose = require('mongoose');
const { validateLeadTransition, TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { findLeadRaw } = require('../utils/leadLookup');
const { convertWonLeadToClient } = require('./clientProvisioning');
const FollowUpTask = require('../models/FollowUpTask');
const { derivePriority } = require('../utils/serviceQualification');
const { getLeadScoringSettings, computeLeadScore } = require('./leadScoring');
const logger = require('../utils/logger');

/**
 * The one place every lead update (admin panel and Employee Portal alike)
 * goes through, so the state machine in utils/leadStateMachine.js is enforced
 * identically regardless of who edits the lead. Writes through the raw driver
 * (same reason as findLeadRaw — some legacy leads have a String _id that
 * breaks Mongoose's version-checked .save()).
 *
 * @param {string} leadId
 * @param {object} updates          proposed field changes, already whitelisted by the caller
 * @param {object} actor            { id: ObjectId, isSuperAdmin?: boolean } — who is making this change
 * @param {object} [extraFilter]    e.g. { assignedTo: actor.id } to scope the Employee Portal to its own leads
 * @returns {{ ok: true, lead: object } | { ok: false, status: number, message: string }}
 */
async function applyLeadUpdate(leadId, updates, actor, extraFilter = {}) {
  const existingLead = await findLeadRaw(leadId, extraFilter);
  if (!existingLead) {
    return { ok: false, status: 404, message: 'Lead not found' };
  }

  // 1. Lock Enforcement (Temporary protection during active handling)
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  if (existingLead.lockedBy && String(existingLead.lockedBy) !== String(actor.id)) {
    if (existingLead.lockedAt && (Date.now() - new Date(existingLead.lockedAt).getTime()) < LOCK_TIMEOUT_MS) {
      return { ok: false, status: 409, message: 'Lead is currently locked by another user for active handling.' };
    }
  }

  // 2. Closed State Read-Only Enforcement
  if (TERMINAL_STATUSES.includes(existingLead.status)) {
    if (!actor.isSuperAdmin) {
      return { ok: false, status: 403, message: 'Cannot update a closed lead. Contact a Super Admin for authorized corrections.' };
    }
  }

  const error = validateLeadTransition(existingLead, updates);
  if (error) {
    return { ok: false, status: 400, message: error };
  }

  const now = new Date();
  const pipelineEntries = [];

  if (updates.status && updates.status !== existingLead.status) {
    let note = '';
    if (updates.status === 'Won') note = `Closed with value ₹${updates.dealCloseValue ?? existingLead.dealCloseValue ?? 0}`;
    else if (updates.status === 'Lost' || updates.status === 'Dropped') note = `Reason: ${updates.notConvertedReason || existingLead.notConvertedReason || ''}`;
    else if (updates.status === 'Hold') note = `Reason: ${updates.holdReason || ''}`;
    pipelineEntries.push({ status: updates.status, date: now, updatedBy: actor.id, note });

    if (updates.status === 'Won' || updates.status === 'Lost' || updates.status === 'Dropped') {
      updates.closedDate = updates.closedDate || now;
    }
  }

  if (updates.connected && updates.connected !== existingLead.connected) {
    pipelineEntries.push({
      status: updates.connected === 'Yes' ? 'Call connected' : 'Call not connected',
      date: now,
      updatedBy: actor.id,
      note: updates.connected === 'No' ? (updates.notConnectedReason || '') : ''
    });
  }

  if (updates.interestLevel && updates.interestLevel !== existingLead.interestLevel) {
    pipelineEntries.push({ status: `Interest set: ${updates.interestLevel}`, date: now, updatedBy: actor.id, note: '' });
  }

  const reschedulingFollowUp =
    'nextFollowUpDate' in updates &&
    updates.nextFollowUpDate &&
    String(updates.nextFollowUpDate) !== String(existingLead.nextFollowUpDate || '');
  if (reschedulingFollowUp && existingLead.nextFollowUpDate) {
    pipelineEntries.push({
      status: 'Follow-up rescheduled',
      date: now,
      updatedBy: actor.id,
      note: `From ${new Date(existingLead.nextFollowUpDate).toLocaleString()} to ${new Date(updates.nextFollowUpDate).toLocaleString()}`
    });
  }

  // A call outcome is being recorded whenever `connected` is present in this
  // update — append it to the append-only callLogs array rather than only
  // updating the scalar "latest call" fields, so history is never lost.
  const push = {};
  if (pipelineEntries.length > 0) push.pipelineHistory = { $each: pipelineEntries };

  let touchNumberUpdate;
  if ('connected' in updates && updates.connected) {
    const touchNumber = (existingLead.touchNumber || 0) + 1;
    touchNumberUpdate = touchNumber;
    const resultingStage = updates.status || existingLead.status;
    const resultingNotConnectedReason = updates.connected === 'No' ? (updates.notConnectedReason || '') : '';
    const callDateUsed = updates.callDate || existingLead.callDate || now;

    // Age @ Call — how many days old the lead was as of its most recent call.
    // Recomputed on every logged call outcome, never hand-entered.
    if (existingLead.createdAt) {
      updates.leadAgeAtCall = Math.max(
        0,
        Math.floor((new Date(callDateUsed).getTime() - new Date(existingLead.createdAt).getTime()) / 86400000)
      );
    }

    // Auto-classified, not asked of the BD — keeps the outcome capture a
    // one-tap flow instead of one more required field.
    let callType = 'Follow-up';
    if (touchNumber === 1) callType = 'First Call';
    else if (resultingNotConnectedReason === 'Asked to Call Later') callType = 'Callback';
    else if (resultingStage === 'Proposal Sent') callType = 'Proposal';
    else if (resultingStage === 'Negotiation') callType = 'Negotiation';

    push.callLogs = {
      $each: [{
        touchNumber,
        calledBy: actor.id,
        callDate: callDateUsed,
        callStartTime: updates.callStartTime || existingLead.callStartTime,
        callEndTime: updates.callEndTime || existingLead.callEndTime,
        callDuration: updates.callDuration ?? existingLead.callDuration,
        connected: updates.connected,
        notConnectedReason: resultingNotConnectedReason,
        interestLevel: updates.connected === 'Yes' ? (updates.interestLevel || existingLead.interestLevel || '') : '',
        remark: updates.remark ?? existingLead.remark ?? '',
        leadStage: resultingStage,
        callType
      }]
    };
    if (!existingLead.firstCallAt) updates.firstCallAt = now;
  }

  // Rescheduling (or clearing, on a real outcome) the follow-up restarts the
  // reminder/escalation cycle — see services/followUpEngine.js.
  if ('nextFollowUpDate' in updates) {
    updates.followUpReminderSentAt = null;
    updates.followUpDueNotifiedAt = null;
    updates.followUpOverdueBDNotifiedAt = null;
    updates.followUpOverdueManagerNotifiedAt = null;
    updates.followUpBreached = false;
    updates.followUpBreachedAt = null;
  }

  // Lead Priority is auto-derived, never client-settable (not in
  // LEAD_UPDATE_FIELDS) — recomputed whenever a qualification save touches
  // any of its three inputs, against the merged (existing + incoming) state.
  const PRIORITY_INPUT_FIELDS = ['timeline', 'decisionMaker', 'projectBudget', 'monthlyMarketingBudget'];
  if (PRIORITY_INPUT_FIELDS.some((f) => f in updates)) {
    updates.leadPriority = derivePriority({
      decisionMaker: 'decisionMaker' in updates ? updates.decisionMaker : existingLead.decisionMaker,
      timeline: 'timeline' in updates ? updates.timeline : existingLead.timeline,
      projectBudget: 'projectBudget' in updates ? updates.projectBudget : existingLead.projectBudget,
      monthlyMarketingBudget: 'monthlyMarketingBudget' in updates ? updates.monthlyMarketingBudget : existingLead.monthlyMarketingBudget
    });
  }

  // Lead Score — a configurable, supplementary signal only (see
  // services/leadScoring.js); never influences leadPriority above, and
  // never client-settable. Recomputed on every save against the same
  // merged state, including the call-log entry this very update might be
  // pushing (not yet reflected in existingLead.callLogs).
  try {
    const scoringSettings = await getLeadScoringSettings();
    const mergedCallLogs = push.callLogs
      ? [...(existingLead.callLogs || []), ...push.callLogs.$each]
      : (existingLead.callLogs || []);
    updates.leadScore = computeLeadScore({
      servicesRequired: 'servicesRequired' in updates ? updates.servicesRequired : existingLead.servicesRequired,
      projectBudget: 'projectBudget' in updates ? updates.projectBudget : existingLead.projectBudget,
      monthlyMarketingBudget: 'monthlyMarketingBudget' in updates ? updates.monthlyMarketingBudget : existingLead.monthlyMarketingBudget,
      decisionMaker: 'decisionMaker' in updates ? updates.decisionMaker : existingLead.decisionMaker,
      timeline: 'timeline' in updates ? updates.timeline : existingLead.timeline,
      connected: 'connected' in updates ? updates.connected : existingLead.connected,
      status: updates.status || existingLead.status,
      proposalSentDate: 'proposalSentDate' in updates ? updates.proposalSentDate : existingLead.proposalSentDate,
      interestLevel: 'interestLevel' in updates ? updates.interestLevel : existingLead.interestLevel,
      notConvertedReason: 'notConvertedReason' in updates ? updates.notConvertedReason : existingLead.notConvertedReason,
      callLogs: mergedCallLogs
    }, scoringSettings);
  } catch (err) {
    // Scoring must never block a lead update from saving.
    logger.error(`Lead score computation failed for lead ${existingLead._id}:`, err);
  }

  if (touchNumberUpdate) updates.touchNumber = touchNumberUpdate;
  updates.updatedAt = now;

  const updateQuery = { $set: updates };
  if (Object.keys(push).length > 0) updateQuery.$push = push;

  const db = mongoose.connection.db;
  const result = await db.collection('leads').findOneAndUpdate(
    { _id: existingLead._id },
    updateQuery,
    { returnDocument: 'after' }
  );
  const updatedLead = result?.value || result;

  // Keep the lead's Primary FollowUpTask in sync with nextFollowUpDate —
  // every reschedule/clear/first-time-set gets a durable Task row (see
  // models/FollowUpTask.js) without changing the existing call-outcome-driven
  // UI/validation at all. Never blocks or fails the lead update itself.
  if ('nextFollowUpDate' in updates) {
    try {
      const result_ = updates.remark
        || (updates.connected === 'No' ? updates.notConnectedReason
          : updates.connected === 'Yes' ? `Connected — ${updates.interestLevel || existingLead.interestLevel || ''}`
            : (updates.status && updates.status !== existingLead.status ? `Moved to ${updates.status}` : 'Updated'));
      await FollowUpTask.updateMany(
        { lead: existingLead._id, type: 'Primary', status: 'Pending' },
        { $set: { status: 'Completed', result: result_, completedAt: now, completedBy: actor.id } }
      );
      if (updates.nextFollowUpDate) {
        await FollowUpTask.create({
          lead: existingLead._id,
          assignedTo: existingLead.assignedTo || actor.id,
          createdBy: actor.id,
          dueDate: updates.nextFollowUpDate,
          note: updates.remark || '',
          type: 'Primary',
          status: 'Pending'
        });
      }
    } catch (err) {
      logger.error(`Primary FollowUpTask sync failed for lead ${existingLead._id}:`, err);
    }
  }

  if (updates.status === 'Won' && existingLead.status !== 'Won') {
    try {
      await convertWonLeadToClient(updatedLead, actor.id);
    } catch (err) {
      // A Client-provisioning failure must not roll back or hide the Won
      // sale itself — log it and leave conversion to a manual admin action.
      logger.error(`Won->Client conversion failed for lead ${updatedLead._id}:`, err);
    }
  }

  return { ok: true, lead: updatedLead };
}

module.exports = { applyLeadUpdate, TERMINAL_STATUSES };
