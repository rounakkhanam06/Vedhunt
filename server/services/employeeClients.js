// Clients a staff member may log work against from the Employee Portal timer.
// Only clients they are actually linked to — account manager or dedicated
// team on the client profile, project manager / contributor on one of the
// client's projects, or an assigned support ticket — so the picker never
// exposes the whole client list (Client Portal CRM §14: "view assigned client").
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const Project = require('../models/Project');
const SupportTicket = require('../models/SupportTicket');

const OPEN_TICKET = { $nin: ['Resolved', 'Closed'] };

async function linkableClientsFor(adminId) {
  const employee = await Employee.findOne({ adminId }, '_id').lean();
  if (!employee) return [];

  const [profileClients, projects, tickets] = await Promise.all([
    Client.find({
      deletedAt: null,
      $or: [{ 'profile.accountManager': employee._id }, { 'profile.dedicatedTeam.employee': employee._id }],
    }, '_id').lean(),
    Project.find({
      status: { $in: ['Active', 'On Hold'] },
      $or: [{ projectManager: employee._id }, { teamMembers: employee._id }],
    }, 'client_ref projectName projectId').lean(),
    SupportTicket.find({ assignedTo: adminId, status: OPEN_TICKET }, 'client_ref ticketId subject').lean(),
  ]);

  const clientIds = new Set([
    ...profileClients.map((c) => String(c._id)),
    ...projects.map((p) => String(p.client_ref)),
    ...tickets.map((t) => String(t.client_ref)),
  ]);
  if (!clientIds.size) return [];

  // Any project of those clients the person can log to is one they belong to; a
  // profile-linked person (account manager / team) may log to all of the client's active projects
  const profileSet = new Set(profileClients.map((c) => String(c._id)));
  const clientProjects = await Project.find(
    { client_ref: { $in: [...profileSet] }, status: { $in: ['Active', 'On Hold'] } },
    'client_ref projectName projectId'
  ).lean();
  const allProjects = new Map([...projects, ...clientProjects].map((p) => [String(p._id), p]));

  const clients = await Client.find({ _id: { $in: [...clientIds] }, deletedAt: null }, 'clientId businessName').sort({ businessName: 1 }).lean();
  return clients.map((c) => ({
    _id: c._id,
    clientId: c.clientId,
    businessName: c.businessName,
    projects: [...allProjects.values()].filter((p) => String(p.client_ref) === String(c._id))
      .map((p) => ({ _id: p._id, projectId: p.projectId, projectName: p.projectName })),
    tickets: tickets.filter((t) => String(t.client_ref) === String(c._id))
      .map((t) => ({ _id: t._id, ticketId: t.ticketId, subject: t.subject })),
  }));
}

/** Ids of the clients this staff member may log work against (the same set the picker shows). */
async function linkableClientIds(adminId) {
  return new Set((await linkableClientsFor(adminId)).map((c) => String(c._id)));
}

module.exports = { linkableClientsFor, linkableClientIds };
