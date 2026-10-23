// Cross-assignment (extra BDs on a lead) and lead notes, shared by the Admin
// panel routes (controllers/leadController.js) and the Employee Portal
// (routes/employeePortalRoutes.js). Callers resolve the lead inside their own
// scope first; everything here records who did what and when:
//   share / unshare → Lead.sharedWith + AssignmentLog + pipelineHistory
//   notes           → LeadNote (append-only, author + createdAt)
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const AssignmentLog = require('../models/AssignmentLog');
const LeadNote = require('../models/LeadNote');
const Notification = require('../models/Notification');
const { sendPushToAdmin } = require('../utils/pushNotify');
const { seesAllLeadNotes } = require('../utils/leadScope');
const { actionStamp } = require('../utils/leadActivity');
const logger = require('../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const fullName = (a) => `${a?.firstName || ''} ${a?.lastName || ''}`.trim() || a?.email || 'Unknown';

/** sharedWith with names, for lead responses. */
async function sharedWithDetails(lead) {
  const entries = lead.sharedWith || [];
  if (!entries.length) return [];
  const people = await Admin.find(
    { _id: { $in: entries.flatMap((e) => [e.admin, e.grantedBy].filter(Boolean)) } },
    { firstName: 1, lastName: 1, email: 1 }
  ).lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  return entries.map((e) => ({
    admin: { _id: e.admin, name: fullName(byId.get(String(e.admin))) },
    grantedBy: e.grantedBy ? { _id: e.grantedBy, name: fullName(byId.get(String(e.grantedBy))) } : null,
    grantedAt: e.grantedAt,
  }));
}

/** Give `adminId` access to `lead` alongside its owner. */
async function shareLead(lead, adminId, actorId, reason = '') {
  if (!mongoose.isValidObjectId(adminId)) return { ok: false, status: 400, message: 'Pick a BD to share with.' };
  const target = await Admin.findById(adminId).select('firstName lastName email isActive').lean();
  if (!target || !target.isActive) return { ok: false, status: 400, message: 'That BD account does not exist or is inactive.' };
  if (!lead.assignedTo) return { ok: false, status: 400, message: 'Assign the lead to an owner before sharing it.' };
  if (String(lead.assignedTo) === String(adminId)) return { ok: false, status: 400, message: 'This BD already owns the lead.' };

  const now = new Date();
  const name = fullName(target);
  const result = await mongoose.connection.db.collection('leads').updateOne(
    { _id: lead._id, 'sharedWith.admin': { $ne: oid(adminId) } },
    {
      $push: {
        sharedWith: { admin: oid(adminId), grantedBy: actorId ? oid(actorId) : null, grantedAt: now },
        pipelineHistory: { status: `Cross-assigned to ${name}`, date: now, updatedBy: actorId ? oid(actorId) : null, note: reason },
      },
      $set: { updatedAt: now },
    }
  );
  if (!result.modifiedCount) return { ok: false, status: 409, message: 'The lead is already shared with this BD.' };

  await AssignmentLog.create({ lead: lead._id, fromAdmin: null, toAdmin: adminId, assignedBy: actorId, mode: 'Cross-Assign', reason });

  try {
    const title = 'Lead shared with you';
    const message = `${lead.fullName} — ${lead.service || lead.platform || ''}`;
    const link = `/employee/dashboard?tab=leads&leadId=${lead._id}`;
    await Notification.create({ recipient: adminId, type: 'lead_shared', title, message, link, lead: lead._id });
    await sendPushToAdmin(adminId, { title, body: message, link });
  } catch (err) {
    logger.error(`Lead share notification failed for lead ${lead._id}:`, err);
  }
  return { ok: true };
}

/** Remove `adminId`'s shared access; the owner is untouched. */
async function unshareLead(lead, adminId, actorId, reason = '') {
  if (!mongoose.isValidObjectId(adminId)) return { ok: false, status: 400, message: 'Invalid BD id.' };
  const target = await Admin.findById(adminId).select('firstName lastName email').lean();
  const now = new Date();
  const result = await mongoose.connection.db.collection('leads').updateOne(
    { _id: lead._id, 'sharedWith.admin': oid(adminId) },
    {
      $pull: { sharedWith: { admin: oid(adminId) } },
      $push: { pipelineHistory: { status: `Cross-assignment removed: ${fullName(target)}`, date: now, updatedBy: actorId ? oid(actorId) : null, note: reason } },
      $set: { updatedAt: now },
    }
  );
  if (!result.modifiedCount) return { ok: false, status: 404, message: 'The lead is not shared with this BD.' };

  await AssignmentLog.create({ lead: lead._id, fromAdmin: adminId, toAdmin: null, assignedBy: actorId, mode: 'Cross-Unassign', reason });
  return { ok: true };
}

/** Notes `user` may read: shared ones, their own private ones, or all for admins. */
async function listNotes(leadId, user) {
  const filter = { lead: leadId };
  if (!seesAllLeadNotes(user)) filter.$or = [{ visibility: 'shared' }, { author: user._id }];
  const notes = await LeadNote.find(filter).sort({ createdAt: -1 }).populate('author', 'firstName lastName email').lean();
  return notes.map((n) => ({
    _id: n._id,
    text: n.text,
    visibility: n.visibility,
    createdAt: n.createdAt,
    author: n.author ? { _id: n.author._id, name: fullName(n.author) } : null,
    isMine: String(n.author?._id) === String(user._id),
  }));
}

async function addNote(lead, user, { text, visibility }) {
  const body = String(text || '').trim();
  if (!body) return { ok: false, status: 400, message: 'Write a note first.' };
  if (body.length > 5000) return { ok: false, status: 400, message: 'Notes are limited to 5000 characters.' };
  const vis = visibility === 'private' ? 'private' : 'shared';

  const note = await LeadNote.create({ lead: lead._id, author: user._id, text: body, visibility: vis });
  // Any note counts as acting on the lead (it leaves Raw Leads)
  await mongoose.connection.db.collection('leads').updateOne({ _id: lead._id }, { $set: actionStamp(lead, user._id, 'Note') });
  // Shared notes also show on the lead timeline everyone with access sees; a
  // private note's existence stays private.
  if (vis === 'shared') {
    const now = new Date();
    await mongoose.connection.db.collection('leads').updateOne(
      { _id: lead._id },
      { $push: { pipelineHistory: { status: 'Note added', date: now, updatedBy: oid(user._id), note: body.slice(0, 200) } }, $set: { updatedAt: now } }
    );
  }
  return { ok: true, note: { _id: note._id, text: note.text, visibility: note.visibility, createdAt: note.createdAt, author: { _id: user._id, name: fullName(user) }, isMine: true } };
}

module.exports = { sharedWithDetails, shareLead, unshareLead, listNotes, addNote };
