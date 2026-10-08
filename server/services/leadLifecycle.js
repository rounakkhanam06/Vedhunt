const mongoose = require('mongoose');
const { validateLeadTransition, normalizeDateFields, isSameInstant, TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { findLeadRaw } = require('../utils/leadLookup');
const { convertWonLeadToClient } = require('./clientProvisioning');
const FollowUpTask = require('../models/FollowUpTask');
const { derivePriority } = require('../utils/serviceQualification');
const { getLeadScoringSettings, computeLeadScore } = require('./leadScoring');
const logger = require('../utils/logger');

// Update fields validateLeadTransition never reads — they can't move a lead
// through the pipeline, so an update made only of these skips it.
const NON_GATING_FIELDS = [
  'remark', 'city', 'country', 'callStartTime', 'callEndTime', 'callDuration', 'callDate',
  'dealValue', 'paymentStatus', 'budget', 'timeline', 'decisionMaker', 'currentVendor', 'requirementSummary',
  'businessName', 'website', 'servicesRequired', 'businessType', 'projectBudget', 'monthlyMarketingBudget'
];

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

  const dateError = normalizeDateFields(updates);
  if (dateError) {
    return { ok: false, status: 400, message: dateError };
  }

  // A remark, qualification or call-timer save changes nothing the state
  // machine gates — validating the merged lead would block it on any
  // unrelated pre-existing gap (e.g. a legacy Warm lead with no follow-up).
  const touchesPipeline = Object.keys(updates).some((field) => !NON_GATING_FIELDS.includes(field));
  const error = touchesPipeline
    ? validateLeadTransition(existingLead, updates, { isSuperAdmin: !!actor.isSuperAdmin })
    : null;
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

    // Super Admin reopening a closed lead (validated in leadStateMachine.js).
    // The old outcome's close date/reason no longer describe the lead —
    // they're kept in this history note instead. A Won lead's Client
    // account is left as-is; re-winning reuses it (convertWonLeadToClient
    // looks it up by leadRef).
    if (TERMINAL_STATUSES.includes(existingLead.status) && !TERMINAL_STATUSES.includes(updates.status)) {
      const was = existingLead.status === 'Won'
        ? `Won, ₹${existingLead.dealCloseValue ?? 0}`
        : `${existingLead.status}, reason: ${existingLead.notConvertedReason || '—'}`;
      note = [`Reopened by Super Admin (was ${was})`, note].filter(Boolean).join(' · ');
      updates.closedDate = null;
      if (existingLead.status !== 'Won') updates.notConvertedReason = '';
    }
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
    !isSameInstant(updates.nextFollowUpDate, existingLead.nextFollowUpDate);
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
    updates.lastCallAt = now;
  }

  // The call-outcome widgets resend the current nextFollowUpDate on every
  // save — only a real change should restart reminders or rotate the task.
  const followUpChanged =
    'nextFollowUpDate' in updates && !isSameInstant(updates.nextFollowUpDate, existingLead.nextFollowUpDate);

  // Rescheduling (or clearing, on a real outcome) the follow-up restarts the
  // reminder/escalation cycle — see services/followUpEngine.js.
  if (followUpChanged) {
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
  if (followUpChanged) {
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
          actionType: updatedLead?.nextActionType || '',
          type: 'Primary',
          status: 'Pending'
        });
      }
    } catch (err) {
      logger.error(`Primary FollowUpTask sync failed for lead ${existingLead._id}:`, err);
    }
  } else if ('nextActionType' in updates && updates.nextActionType !== existingLead.nextActionType) {
    // Same date, different kind of action — keep the open Primary task in step.
    await FollowUpTask.updateMany(
      { lead: existingLead._id, type: 'Primary', status: 'Pending' },
      { $set: { actionType: updates.nextActionType || '' } }
    ).catch((err) => logger.error(`Primary FollowUpTask action sync failed for lead ${existingLead._id}:`, err));
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

// Outcomes after which a lead needs a stage decision (Lost/Dropped), not another follow-up.
const NO_NEXT_ACTION_INTEREST_LEVELS = ['Not Interested', 'Wrong / Junk Lead'];

/**
 * Completing a scheduled follow-up: an outcome (reached or not, plus interest
 * level / reason) and a result note are always required, and if the lead
 * stays active the next action (type + date) must be scheduled in the same
 * step — so a follow-up can never just vanish. Runs through applyLeadUpdate,
 * which closes the Primary FollowUpTask with the result and opens the next.
 */
async function completeFollowUp(leadId, input, actor, extraFilter = {}) {
  const result = String(input.result || '').trim();
  if (!result) return { ok: false, status: 400, message: 'Describe the outcome of this follow-up.' };
  if (!['Yes', 'No'].includes(input.connected)) {
    return { ok: false, status: 400, message: 'Select whether you reached the lead.' };
  }
  const lead = await findLeadRaw(leadId, extraFilter);
  if (!lead) return { ok: false, status: 404, message: 'Lead not found' };

  const closingOutcome = input.connected === 'Yes' && NO_NEXT_ACTION_INTEREST_LEVELS.includes(input.interestLevel);
  const staysActive = ![...TERMINAL_STATUSES, 'Hold'].includes(lead.status) && !closingOutcome;
  if (staysActive && (!input.nextFollowUpDate || !input.nextActionType)) {
    return { ok: false, status: 400, message: 'This lead is still active — choose the next action and its date.' };
  }

  const updates = {
    connected: input.connected,
    remark: result.slice(0, 1000),
    nextFollowUpDate: input.nextFollowUpDate || null,
    nextActionType: input.nextFollowUpDate ? (input.nextActionType || '') : '',
    ...(input.connected === 'Yes' ? { interestLevel: input.interestLevel } : { notConnectedReason: input.notConnectedReason }),
  };
  return applyLeadUpdate(leadId, updates, actor, extraFilter);
}

/**
 * Appends an activity event (WhatsApp initiated, proposal generated/shared...)
 * to a lead's timeline without touching its stage — so it deliberately skips
 * the state machine. `set` may carry plain data fields only (never status or
 * follow-up fields, which must go through applyLeadUpdate).
 *
 * @returns the updated lead, or null when no lead matched (incl. extraFilter)
 */
async function appendLeadActivity(leadId, { status, note = '', actorId }, extraFilter = {}, set = {}) {
  const existingLead = await findLeadRaw(leadId, extraFilter);
  if (!existingLead) return null;
  const now = new Date();
  const result = await mongoose.connection.db.collection('leads').findOneAndUpdate(
    { _id: existingLead._id },
    {
      $set: { ...set, updatedAt: now },
      $push: { pipelineHistory: { status, date: now, updatedBy: actorId, note } }
    },
    { returnDocument: 'after' }
  );
  return result?.value || result;
}

module.exports = { applyLeadUpdate, completeFollowUp, appendLeadActivity, TERMINAL_STATUSES };
