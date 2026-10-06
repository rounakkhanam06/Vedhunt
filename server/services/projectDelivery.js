// Project delivery: who owns a project (Project Manager + team), milestone
// progress, escalations, and the delivery KPIs built on them. Shared by the
// Admin panel (Projects) and the Employee Portal (My Projects, My Performance).
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const { ESCALATION_SEVERITIES } = require('../models/Project');
const { notifyStaff, notifyPermissionHolders } = require('./staffNotify');
const logger = require('../utils/logger');

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const actorName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff';
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// ── Assignment (admin) ────────────────────────────────────────────────────

/**
 * Validates a PM / team-member selection against real employees.
 * Returns { projectManager, teamMembers } with only the keys that were sent.
 */
async function cleanAssignment(body = {}) {
  const out = {};
  if (body.projectManager !== undefined) {
    if (!body.projectManager) out.projectManager = null;
    else if (!isId(body.projectManager) || !(await Employee.exists({ _id: body.projectManager }))) return { error: 'Choose a valid Project Manager.' };
    else out.projectManager = body.projectManager;
  }
  if (body.teamMembers !== undefined) {
    const ids = [...new Set((Array.isArray(body.teamMembers) ? body.teamMembers : []).map(String))];
    if (ids.some((id) => !isId(id))) return { error: 'Invalid team member.' };
    if (ids.length > 50) return { error: 'A project can have at most 50 team members.' };
    const found = await Employee.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) return { error: 'One or more team members no longer exist.' };
    out.teamMembers = ids;
  }
  if (out.projectManager && out.teamMembers) out.teamMembers = out.teamMembers.filter((id) => id !== String(out.projectManager));
  return { value: out };
}

/** Tells newly added PM / team members about the project. Never fails the save. */
async function notifyNewAssignees(project, before = { projectManager: null, teamMembers: [] }) {
  try {
    const was = new Set([String(before.projectManager || ''), ...(before.teamMembers || []).map(String)]);
    const added = [project.projectManager, ...(project.teamMembers || [])].filter((id) => id && !was.has(String(id)));
    if (!added.length) return;
    const employees = await Employee.find({ _id: { $in: added } }, { adminId: 1 }).lean();
    await Promise.all(employees.filter((e) => e.adminId).map((e) => notifyStaff(e.adminId, {
      type: 'project_assigned',
      title: String(e._id) === String(project.projectManager) ? `You are Project Manager: ${project.projectName}` : `Added to project: ${project.projectName}`,
      message: project.projectId || '',
      link: '/employee/dashboard?tab=projects',
    })));
  } catch (err) {
    logger.error('Project assignment notification failed:', err.message);
  }
}

// ── Employee view ─────────────────────────────────────────────────────────

async function employeeFor(adminId) {
  return Employee.findOne({ adminId }, { _id: 1, firstName: 1, lastName: 1 }).lean();
}

/** Projects I manage or am on, with my role on each. Escalations only for the PM and team. */
async function listMyProjects(adminId) {
  const me = await employeeFor(adminId);
  if (!me) return fail(404, 'Employee not found');
  const projects = await Project.find({ $or: [{ projectManager: me._id }, { teamMembers: me._id }] })
    .select('+escalations -internalNotes')
    .populate('client_ref', 'businessName contactName')
    .populate('projectManager', 'firstName lastName designation')
    .populate('teamMembers', 'firstName lastName designation')
    .sort({ status: 1, expectedEndDate: 1 })
    .lean();
  return ok({
    projects: projects.map((p) => ({
      ...p,
      myRole: String(p.projectManager?._id) === String(me._id) ? 'Project Manager' : 'Team Member',
      overdue: !['Completed', 'Cancelled'].includes(p.status) && p.expectedEndDate && endOfDay(p.expectedEndDate) < new Date(),
    })),
  });
}

/** Loads a project the caller manages (or, with allowMember, is on). */
async function loadForEmployee(adminId, projectId, { allowMember = false } = {}) {
  if (!isId(projectId)) return { error: fail(400, 'Invalid project ID') };
  const me = await employeeFor(adminId);
  if (!me) return { error: fail(404, 'Employee not found') };
  const project = await Project.findById(projectId).select('+escalations');
  if (!project) return { error: fail(404, 'Project not found') };
  const isPm = String(project.projectManager) === String(me._id);
  const isMember = (project.teamMembers || []).some((id) => String(id) === String(me._id));
  if (!isPm && !(allowMember && isMember)) {
    return { error: fail(403, allowMember ? 'You are not on this project.' : 'Only the Project Manager can do this.') };
  }
  return { project, me, isPm };
}

const MILESTONE_STATUSES = ['Pending', 'In Progress', 'Completed'];

async function updateMilestoneStatus(adminId, projectId, milestoneId, status) {
  if (!MILESTONE_STATUSES.includes(status)) return fail(400, 'Invalid milestone status.');
  const { project, error } = await loadForEmployee(adminId, projectId);
  if (error) return error;
  const milestone = project.milestones.id(milestoneId);
  if (!milestone) return fail(404, 'Milestone not found');
  milestone.status = status;
  await project.save(); // recomputes progress + stamps completedOn
  return ok({ message: `Milestone marked ${status}.`, overallProgress: project.overallProgress });
}

// ── Escalations (admin or PM/team) ────────────────────────────────────────

async function addEscalation(project, user, body = {}) {
  const note = String(body.note || '').trim();
  if (!note) return fail(400, 'Describe the escalation.');
  const severity = ESCALATION_SEVERITIES.includes(body.severity) ? body.severity : 'Medium';
  const source = body.source === 'Internal' ? 'Internal' : 'Client';
  project.escalations.push({ note: note.slice(0, 1000), severity, source, raisedBy: user._id, raisedByName: actorName(user) });
  await project.save();

  // The PM always hears about it; High/Critical also go to management (team.manage).
  try {
    const pm = project.projectManager ? await Employee.findById(project.projectManager, { adminId: 1 }).lean() : null;
    const payload = { type: 'project_escalation', title: `${severity} escalation: ${project.projectName}`, message: note.slice(0, 140) };
    if (pm?.adminId && String(pm.adminId) !== String(user._id)) await notifyStaff(pm.adminId, { ...payload, link: '/employee/dashboard?tab=projects' });
    if (['High', 'Critical'].includes(severity)) await notifyPermissionHolders('team.manage', { ...payload, link: '/admin/projects' }, { exclude: [user._id] });
  } catch (err) {
    logger.error('Escalation notification failed:', err.message);
  }
  return ok({ escalation: project.escalations[project.escalations.length - 1], message: 'Escalation logged.' });
}

async function resolveEscalation(project, user, escalationId, resolution) {
  const escalation = project.escalations.id(escalationId);
  if (!escalation) return fail(404, 'Escalation not found');
  if (escalation.status === 'Resolved') return fail(400, 'This escalation is already resolved.');
  const text = String(resolution || '').trim();
  if (!text) return fail(400, 'Describe how it was resolved.');
  Object.assign(escalation, { status: 'Resolved', resolution: text.slice(0, 1000), resolvedAt: new Date(), resolvedBy: user._id, resolvedByName: actorName(user) });
  await project.save();
  return ok({ escalation, message: 'Escalation resolved.' });
}

// ── KPIs ──────────────────────────────────────────────────────────────────

/**
 * Delivery KPIs over [from, to] for the projects matching `filter`
 * ({ projectManager } for a PM, {} for company-wide).
 */
async function deliveryGroup(filter, from, to, title) {
  const projects = await Project.find(filter, { status: 1, expectedEndDate: 1, completedAt: 1, milestones: 1, escalations: 1 })
    .select('+escalations').lean();
  return computeDeliveryGroup(projects, from, to, title);
}

/** Pure part of deliveryGroup — the KPI maths over already-loaded projects. */
function computeDeliveryGroup(projects, from, to, title, now = new Date()) {
  const active = projects.filter((p) => p.status === 'Active');
  const completed = projects.filter((p) => p.completedAt && p.completedAt >= from && p.completedAt <= to);
  const onTime = completed.filter((p) => !p.expectedEndDate || p.completedAt <= endOfDay(p.expectedEndDate));
  const overdue = projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status) && p.expectedEndDate && endOfDay(p.expectedEndDate) < now);
  const milestones = projects.flatMap((p) => p.milestones || []).filter((m) => m.completedOn && m.completedOn >= from && m.completedOn <= to);
  const milestonesOnTime = milestones.filter((m) => !m.targetDate || m.completedOn <= endOfDay(m.targetDate));
  const escalations = projects.flatMap((p) => p.escalations || []);
  const raised = escalations.filter((e) => e.raisedAt >= from && e.raisedAt <= to);
  const resolved = escalations.filter((e) => e.resolvedAt && e.resolvedAt >= from && e.resolvedAt <= to);
  const avgHours = resolved.length
    ? Math.round((resolved.reduce((s, e) => s + (e.resolvedAt - e.raisedAt), 0) / resolved.length / 3600000) * 10) / 10
    : null;
  const metric = (key, label, value, format = 'count', hint) => ({ key, label, value, format, ...(hint ? { hint } : {}) });
  return {
    title,
    items: [
      metric('activeProjects', 'Active projects', active.length),
      metric('projectsCompleted', 'Projects completed', completed.length),
      metric('projectsOnTime', 'Projects on time', pct(onTime.length, completed.length), 'pct', `${onTime.length} of ${completed.length} by the expected end date`),
      metric('overdueProjects', 'Overdue projects', overdue.length, 'count', 'Open right now'),
      metric('milestonesOnTime', 'Milestones on time', pct(milestonesOnTime.length, milestones.length), 'pct', `${milestonesOnTime.length} of ${milestones.length} completed`),
      metric('escalationsRaised', 'Client escalations', raised.length, 'count', 'Raised in period'),
      metric('openEscalations', 'Open escalations', escalations.filter((e) => e.status === 'Open').length, 'count', 'Open right now'),
      metric('escalationResolution', 'Avg. resolution time', avgHours, 'hours'),
    ],
  };
}

/** Project counts for someone on teams but not managing (for the Technology scorecard). */
async function memberGroup(employeeId) {
  const projects = await Project.find({ teamMembers: employeeId }, { status: 1, expectedEndDate: 1 }).lean();
  const now = new Date();
  return {
    title: 'My Projects',
    items: [
      { key: 'projectsInvolved', label: 'Projects involved', value: projects.length, format: 'count' },
      { key: 'activeInvolved', label: 'Active', value: projects.filter((p) => p.status === 'Active').length, format: 'count' },
      {
        key: 'overdueInvolved', label: 'Overdue', format: 'count', hint: 'Open right now',
        value: projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status) && p.expectedEndDate && endOfDay(p.expectedEndDate) < now).length,
      },
    ],
  };
}

module.exports = {
  cleanAssignment, notifyNewAssignees, listMyProjects, loadForEmployee, updateMilestoneStatus,
  addEscalation, resolveEscalation, deliveryGroup, computeDeliveryGroup, memberGroup,
};
