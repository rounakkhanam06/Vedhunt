const mongoose = require('mongoose');
const { validateLeadTransition, TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { findLeadRaw } = require('../utils/leadLookup');
const { convertWonLeadToClient } = require('./clientProvisioning');
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
    if (updates.status === 'Won') note = `Closed with value ₹${updates.dealValue ?? existingLead.dealValue ?? 0}`;
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
        callDate: updates.callDate || existingLead.callDate || now,
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
