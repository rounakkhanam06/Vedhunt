// Employee-scope checks for routes behind requirePageAccess on an HR page
// (Payroll today). A grant's scope becomes a list of Employee ids:
//   reports     → employees whose reportingManager is me
//   departments → employees in the chosen departments (Employee.department,
//                 or the role department roleDept where HR hasn't set one)
//   all         → every employee
// A grant never covers the person's own record — nobody processes or reads
// their own salary through a grant. Role access (req.pageScope === null) is
// unchanged: no limit.
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const departmentMatch = (departments) => ({
  $or: [
    { department: { $in: departments } },
    { department: { $in: [null, ''] }, roleDept: { $in: departments } },
  ],
});

/** null for no limit, else the Employee ids (ObjectIds) the scope covers. */
async function scopedEmployeeIds(req, scope = req.pageScope) {
  if (!scope) return null;
  const key = JSON.stringify(scope);
  if (req._employeeScope?.key === key) return req._employeeScope.ids;

  const me = await Employee.findOne({ adminId: req.user._id }, { _id: 1 }).lean();
  let filter;
  if (scope.mode === 'reports') filter = me ? { reportingManager: me._id } : { _id: { $in: [] } };
  else if (scope.mode === 'departments') filter = departmentMatch(scope.departments || []);
  else if (scope.mode === 'all') filter = {};
  else filter = { _id: { $in: [] } };
  if (me) filter = { $and: [filter, { _id: { $ne: me._id } }] };

  const ids = (await Employee.find(filter, { _id: 1 }).lean()).map((e) => e._id);
  req._employeeScope = { key, ids };
  return ids;
}

/** True when the employee (id or populated doc) is inside the scope. */
const employeeInScope = (ids, employee) =>
  !ids || ids.some((id) => String(id) === String(employee?._id || employee));

/** Department names for the grant editor: the department, else the role department. */
async function departmentNames() {
  const rows = await Employee.find({}, { department: 1, roleDept: 1 }).lean();
  return [...new Set(rows.map((r) => (r.department || '').trim() || (r.roleDept || '').trim()).filter(Boolean))].sort();
}

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

module.exports = { scopedEmployeeIds, employeeInScope, departmentNames, isValidId };
