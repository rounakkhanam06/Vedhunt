const Admin = require('../models/Admin');
const Role = require('../models/Role');
const Notification = require('../models/Notification');
const { sendPushToAdmin } = require('./pushNotify');
const logger = require('./logger');

// Permissions are stored on Roles, not on Admin documents, so "managers" are
// the active admins holding a role with full access or with sight of all leads.
const MANAGER_PERMISSIONS = ['*', 'leads.viewAll'];

async function getLeadManagerIds() {
  const roles = await Role.find({ permissions: { $in: MANAGER_PERMISSIONS } }).select('_id').lean();
  if (!roles.length) return [];
  const admins = await Admin.find({ roles: { $in: roles.map((r) => r._id) }, isActive: { $ne: false } })
    .select('_id')
    .lean();
  return admins.map((a) => a._id);
}

/**
 * Bell notification + web push to every lead manager. Never throws — a failed
 * alert must not fail the request that triggered it.
 */
async function notifyLeadManagers({ type, title, message, link, lead, exclude = [] }) {
  try {
    const skip = new Set(exclude.filter(Boolean).map(String));
    const ids = (await getLeadManagerIds()).filter((id) => !skip.has(String(id)));
    if (!ids.length) return 0;
    await Notification.insertMany(ids.map((recipient) => ({ recipient, type, title, message, link, lead })));
    await Promise.allSettled(ids.map((id) => sendPushToAdmin(id, { title, body: message, link })));
    return ids.length;
  } catch (err) {
    logger.error('notifyLeadManagers failed:', err);
    return 0;
  }
}

/**
 * "New lead" alert for any incoming lead (website form, Google/Facebook lead
 * ads). Skips the BD it was auto-assigned to — they get "assigned to you".
 */
async function alertNewLead(lead) {
  try {
    const Lead = require('../models/Lead');
    const fresh = await Lead.findById(lead._id).select('assignedTo').lean().catch(() => null);
    const isQuote = /quote/i.test(String(lead.source || ''));
    const via = lead.platform && lead.platform !== 'Website' ? ` · ${lead.platform}` : '';
    return await notifyLeadManagers({
      type: 'new_lead',
      title: isQuote ? 'New quote request' : 'New lead received',
      message: `${lead.fullName} — ${lead.service || 'General enquiry'}${lead.businessName ? ` (${lead.businessName})` : ''}${via}`,
      link: `/admin/leads?leadId=${lead._id}`,
      lead: lead._id,
      exclude: [fresh?.assignedTo],
    });
  } catch (err) {
    logger.error('alertNewLead failed:', err);
    return 0;
  }
}

module.exports = { notifyLeadManagers, getLeadManagerIds, alertNewLead };
