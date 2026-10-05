// In-app (bell) + push notifications for staff — admins and employees are
// both Admin records, so they share models/Notification.js. The admin bell
// reads /api/notifications, the Employee Portal bell /ess/notifications.
// Never throws: a notification problem must not fail the triggering action.
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const Notification = require('../models/Notification');
const { sendPushToAdmin } = require('../utils/pushNotify');
const logger = require('../utils/logger');

async function notifyStaff(recipientId, { type, title, message, link }) {
  if (!recipientId) return null;
  try {
    const n = await Notification.create({ recipient: recipientId, type, title, message, link });
    sendPushToAdmin(recipientId, { title, body: message, link }).catch(() => {});
    return n;
  } catch (err) {
    logger.error(`Staff notification failed (${type}):`, err.message);
    return null;
  }
}

// Everyone active whose role carries `permission` (or the '*' wildcard)
async function staffWithPermission(permission, { exclude = [] } = {}) {
  const roles = await Role.find({ permissions: { $in: [permission, '*'] } }).select('_id').lean();
  if (!roles.length) return [];
  const excluded = exclude.filter(Boolean).map(String);
  const admins = await Admin.find({ roles: { $in: roles.map((r) => r._id) }, isActive: true }).select('_id').lean();
  return admins.map((a) => a._id).filter((id) => !excluded.includes(String(id)));
}

async function notifyPermissionHolders(permission, payload, { exclude } = {}) {
  try {
    const ids = await staffWithPermission(permission, { exclude });
    await Promise.all(ids.map((id) => notifyStaff(id, payload)));
    return ids.length;
  } catch (err) {
    logger.error(`Notify ${permission} holders failed (${payload.type}):`, err.message);
    return 0;
  }
}

// Employees work tickets in the Employee Portal, admins in the Support Desk
async function ticketLinkFor(adminId) {
  const a = await Admin.findById(adminId).select('employeeId roles').populate('roles', 'isEmployeeRole permissions').lean();
  const isPortalUser = Boolean(a?.employeeId) || (a?.roles || []).some((r) => r.isEmployeeRole || (r.permissions || []).includes('ess.access'));
  return isPortalUser ? '/employee/dashboard?tab=tickets' : '/admin/support-desk';
}

// Ticket activity from the client side → the assignee, or the client-desk
// admins (cms.manage) while nobody is assigned.
async function notifyTicketStaff(ticket, { type, title, message }) {
  try {
    if (ticket.assignedTo) {
      const assignee = ticket.assignedTo._id || ticket.assignedTo;
      return notifyStaff(assignee, { type, title, message, link: await ticketLinkFor(assignee) });
    }
    return notifyPermissionHolders('cms.manage', { type, title, message, link: '/admin/support-desk' });
  } catch (err) {
    logger.error(`Ticket staff notification failed (${type}):`, err.message);
    return null;
  }
}

async function notifyTicketAssigned(ticket, assigneeId) {
  if (!assigneeId) return null;
  return notifyStaff(assigneeId, {
    type: 'ticket_assigned',
    title: `Ticket ${ticket.ticketId || ''} assigned to you`.replace('  ', ' '),
    message: `${ticket.priority || 'Medium'} priority · ${String(ticket.subject || '').slice(0, 120)}`,
    link: await ticketLinkFor(assigneeId),
  });
}

module.exports = { notifyStaff, notifyPermissionHolders, staffWithPermission, notifyTicketStaff, notifyTicketAssigned, ticketLinkFor };
