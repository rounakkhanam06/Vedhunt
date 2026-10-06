// Read models for the Employee Portal's lead screens: a lightweight list,
// global search, and the "today" agenda. Kept separate from the write path
// (services/leadLifecycle.js) — nothing here changes a lead.
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const FollowUpTask = require('../models/FollowUpTask');
const { normalizePhone } = require('../utils/normalize');

// Everything the Raw/Working/Follow-up cards and the BD dashboard read.
// Heavy arrays (rawPayload, callLogs, pipelineHistory, documents) stay out.
const LIST_FIELDS = [
  'leadId', 'fbLeadId', 'fullName', 'phone', 'email', 'service', 'platform', 'status', 'interestLevel',
  'nextFollowUpDate', 'nextActionType', 'assignedAt', 'createdAt', 'updatedAt', 'closedDate',
  'dealValue', 'dealCloseValue', 'proposalValue', 'paymentStatus', 'amountPaid', 'userSource', 'remark',
  'businessName', 'website', 'leadPriority', 'connected', 'touchNumber',
];
const listProjection = Object.fromEntries(LIST_FIELDS.map((f) => [f, 1]));

async function listAssignedLeads(adminId) {
  return Lead.aggregate([
    { $match: { assignedTo: adminId } },
    { $sort: { createdAt: -1 } },
    { $project: { ...listProjection, lastActivity: { $arrayElemAt: ['$pipelineHistory', -1] } } },
  ]);
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 4 ? `•••••${digits.slice(-4)}` : '••••';
};
const maskEmail = (email) => {
  const [user, domain] = String(email || '').split('@');
  return domain ? `${user.slice(0, 2)}•••@${domain}` : '';
};

/**
 * Searches by Vedhunt Lead ID, Meta Lead ID, name, phone, email, business
 * name or website. Everyone searches their own leads; roles holding
 * leads.viewAll search the whole database, but another BD's lead comes back
 * masked and read-only (ownership/editing stays with the assignee).
 */
async function searchLeads(user, rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 100);
  if (q.length < 2) return [];
  const pattern = new RegExp(escapeRegex(q), 'i');
  const or = [
    { leadId: new RegExp(`^${escapeRegex(q)}`, 'i') },
    { fbLeadId: new RegExp(`^${escapeRegex(q)}`) },
    { fullName: pattern }, { email: pattern }, { businessName: pattern }, { website: pattern },
  ];
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 4) {
    const phone = new RegExp(escapeRegex(digits.length > 10 ? normalizePhone(digits) : digits));
    or.push({ phoneNormalized: phone }, { altPhoneNormalized: phone });
  }

  const canSearchAll = user.permissions?.includes('*') || user.permissions?.includes('leads.viewAll');
  const filter = canSearchAll ? { $or: or } : { $or: or, assignedTo: user._id };
  const leads = await Lead.find(filter, { ...listProjection, assignedTo: 1 }).sort({ createdAt: -1 }).limit(20).lean();

  const otherOwnerIds = [...new Set(leads
    .filter((l) => l.assignedTo && String(l.assignedTo) !== String(user._id))
    .map((l) => String(l.assignedTo)))];
  const owners = otherOwnerIds.length
    ? await Admin.find({ _id: { $in: otherOwnerIds } }, { firstName: 1, lastName: 1 }).lean()
    : [];
  const ownerName = new Map(owners.map((o) => [String(o._id), `${o.firstName} ${o.lastName}`.trim()]));

  return leads.map((lead) => {
    const isMine = String(lead.assignedTo) === String(user._id);
    if (isMine) return { ...lead, isMine: true };
    return {
      _id: lead._id,
      leadId: lead.leadId,
      fbLeadId: lead.fbLeadId,
      fullName: lead.fullName,
      businessName: lead.businessName,
      status: lead.status,
      service: lead.service,
      platform: lead.platform,
      createdAt: lead.createdAt,
      phone: maskPhone(lead.phone),
      email: maskEmail(lead.email),
      ownerName: lead.assignedTo ? ownerName.get(String(lead.assignedTo)) || 'Another BD' : 'Unassigned',
      isMine: false,
    };
  });
}

function endOfToday(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Today's agenda: open follow-up actions (due today or overdue) and assigned
 * tasks due today or overdue. `tasks` is the employee's Employee.tasks list.
 */
async function todayAgenda(user, tasks = []) {
  const end = endOfToday();
  const now = new Date();
  const canFollowUp = user.permissions?.includes('*') || user.permissions?.includes('followups.view');

  const followUps = canFollowUp
    ? await FollowUpTask.find({ assignedTo: user._id, status: 'Pending', dueDate: { $lte: end } })
      .sort({ dueDate: 1 })
      .limit(100)
      .populate('lead', 'leadId fullName phone status')
      .lean()
    : [];

  const items = [
    ...followUps.filter((t) => t.lead).map((t) => ({
      kind: 'followup',
      id: String(t._id),
      title: `${t.actionType || 'Follow-up'} · ${t.lead.fullName}`,
      actionType: t.actionType || 'Follow-up',
      note: t.note || '',
      dueAt: t.dueDate,
      overdue: new Date(t.dueDate) < now,
      leadRef: String(t.lead._id),
      leadId: t.lead.leadId,
    })),
    ...tasks
      .filter((t) => t.dueDate && !['Completed', 'Cancelled'].includes(t.status) && new Date(t.dueDate) <= end)
      .map((t) => {
        // Task due dates are calendar days — overdue only once that day has passed.
        const dueDay = new Date(t.dueDate); dueDay.setHours(23, 59, 59, 999);
        return {
          kind: 'task',
          id: String(t._id),
          title: t.title,
          actionType: 'Task',
          priority: t.priority || 'Normal',
          status: t.status,
          dueAt: t.dueDate,
          overdue: dueDay < now,
        };
      }),
  ].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  return {
    items,
    dueToday: items.filter((i) => !i.overdue).length,
    overdue: items.filter((i) => i.overdue).length,
  };
}

module.exports = { listAssignedLeads, searchLeads, todayAgenda, LIST_FIELDS };
