// Who approves an employee's requests (leave, attendance regularization,
// timesheet corrections): their reporting manager when one is set and
// active, otherwise HR — anyone holding team.manage. HR can always act on
// any request from the Admin panel, so a manager being away never blocks it.
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const { notifyStaff, notifyPermissionHolders } = require('./staffNotify');
const logger = require('../utils/logger');

const TEAM_LINK = '/employee/dashboard?tab=team';

/** The reporting manager's active login (Admin id), or null. */
async function managerLoginFor(employee) {
  if (!employee?.reportingManager) return null;
  const manager = await Employee.findById(employee.reportingManager, { adminId: 1 }).lean();
  if (!manager?.adminId) return null;
  const login = await Admin.findOne({ _id: manager.adminId, isActive: true }, { _id: 1 }).lean();
  return login?._id || null;
}

/**
 * Notifies whoever should decide on a new request.
 * @param {object} employee the requester (needs reportingManager)
 * @param {object} payload  { type, title, message }
 * @param {string} hrLink   where HR reviews it in the Admin panel
 */
async function notifyApprover(employee, payload, hrLink) {
  try {
    const managerId = await managerLoginFor(employee);
    if (managerId && String(managerId) !== String(employee.adminId)) {
      await notifyStaff(managerId, { ...payload, link: TEAM_LINK });
    } else {
      await notifyPermissionHolders('team.manage', { ...payload, link: hrLink }, { exclude: [employee.adminId] });
    }
  } catch (err) {
    logger.error('Approval notification failed:', err.message);
  }
}

/** The requester's Employee ids this login manages directly. */
async function directReportIds(adminId) {
  const me = await Employee.findOne({ adminId }, { _id: 1 }).lean();
  if (!me) return [];
  const reports = await Employee.find({ reportingManager: me._id }, { _id: 1 }).lean();
  return reports.map((r) => r._id);
}

/** True when `adminId` is the reporting manager of `employeeId`. */
async function isReportingManagerOf(adminId, employeeId) {
  const ids = await directReportIds(adminId);
  return ids.some((id) => String(id) === String(employeeId));
}

module.exports = { notifyApprover, directReportIds, isReportingManagerOf, managerLoginFor };
