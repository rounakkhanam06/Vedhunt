/**
 * READ-ONLY audit: checks the live database for the exact classes of
 * Admin/Employee/Role inconsistency that routes/team.js, routes/employeeRoutes.js
 * and routes/auth.js now guard against going forward. This script makes no
 * writes — it only reports what it finds.
 *
 *   node server/scripts/auditEmployeeAdminSync.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const Role = require('../models/Role');

function idStr(v) {
  if (v === undefined || v === null) return '';
  return v.toString();
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Running read-only checks...\n');

  const admins = await Admin.find({}).populate('roles');
  const employees = await Employee.find({});

  const adminById = new Map(admins.map(a => [idStr(a._id), a]));
  const employeeByAdminId = new Map(employees.map(e => [idStr(e.adminId), e]));
  const employeeByEmployeeId = new Map(employees.map(e => [e.employeeId, e]));

  // 1. Employee docs whose adminId doesn't resolve to any Admin document.
  const orphanedEmployees = employees.filter(e => !adminById.has(idStr(e.adminId)));

  // 2. Admin docs that carry an employeeId (created via Employee Manager /
  //    seedBDTeam) but have no matching Employee document.
  const orphanedAdminLogins = admins.filter(a => a.employeeId && !employeeByEmployeeId.has(a.employeeId));

  // 3. "Employee" accounts (employeeId set) that hold NO isEmployeeRole role —
  //    per current routes/auth.js logic these can log into the Admin panel,
  //    which breaks the "HRMS employees never reach the admin panel" rule.
  const employeeAccountsWithAdminRole = admins.filter(a => {
    if (!a.employeeId) return false;
    const roles = a.roles || [];
    const hasAdminRole = roles.some(r => r && !r.isEmployeeRole);
    return hasAdminRole || roles.length === 0;
  });

  // 4. Pure admin accounts (no employeeId) that nonetheless hold an
  //    isEmployeeRole role with no linked Employee HR profile — these would
  //    be blocked from the Admin panel by routes/auth.js but have no
  //    Employee Portal profile either (dead-end account).
  const adminsWithEmployeeRoleNoProfile = admins.filter(a => {
    if (a.employeeId) return false;
    const roles = a.roles || [];
    const hasEmployeeRole = roles.some(r => r && r.isEmployeeRole);
    const hasAdminRole = roles.some(r => r && !r.isEmployeeRole);
    return hasEmployeeRole && !hasAdminRole;
  });

  // 5. Duplicate emails across Employee documents (Employee.email has no
  //    unique index, unlike Admin.email).
  const emailCounts = new Map();
  employees.forEach(e => {
    const key = (e.email || '').toLowerCase();
    emailCounts.set(key, (emailCounts.get(key) || 0) + 1);
  });
  const duplicateEmployeeEmails = [...emailCounts.entries()].filter(([, c]) => c > 1);

  // 6. Roles currently in use that are flagged isEmployeeRole but include
  //    the '*' wildcard (should be impossible after the rbacController fix,
  //    but check pre-existing data).
  const roles = await Role.find({});
  const badWildcardEmployeeRoles = roles.filter(r => r.isEmployeeRole && r.permissions.includes('*'));

  console.log(`Admins: ${admins.length} | Employees: ${employees.length} | Roles: ${roles.length}\n`);

  const report = (title, items, describe) => {
    console.log(`--- ${title}: ${items.length} ---`);
    items.forEach(i => console.log('  ' + describe(i)));
    console.log('');
  };

  report('Orphaned Employee docs (no matching Admin login)', orphanedEmployees,
    e => `${e.employeeId} | ${e.email} | Employee._id=${e._id} | adminId=${e.adminId}`);

  report('Orphaned Admin logins (employeeId set, no Employee doc)', orphanedAdminLogins,
    a => `${a.email} | Admin._id=${a._id} | employeeId=${a.employeeId}`);

  report('HRMS employee accounts that could currently log into the Admin panel', employeeAccountsWithAdminRole,
    a => `${a.email} | Admin._id=${a._id} | employeeId=${a.employeeId} | roles=${(a.roles || []).map(r => r.name).join(',') || 'NONE'}`);

  report('Pure admin accounts holding an employee-only role with no HR profile', adminsWithEmployeeRoleNoProfile,
    a => `${a.email} | Admin._id=${a._id} | roles=${(a.roles || []).map(r => r.name).join(',')}`);

  report('Duplicate Employee emails', duplicateEmployeeEmails,
    ([email, count]) => `${email} — ${count} Employee docs`);

  report('Roles flagged isEmployeeRole with "*" permission (must not exist)', badWildcardEmployeeRoles,
    r => `${r.name} (${r._id})`);

  const totalIssues = orphanedEmployees.length + orphanedAdminLogins.length +
    employeeAccountsWithAdminRole.length + adminsWithEmployeeRoleNoProfile.length +
    duplicateEmployeeEmails.length + badWildcardEmployeeRoles.length;

  console.log(totalIssues === 0 ? 'No inconsistencies found.' : `${totalIssues} total issue(s) found — see above.`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
