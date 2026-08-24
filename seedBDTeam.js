/**
 * One-off seeder: creates the initial BD (Business Development) team so the
 * Lead Assignment Engine has a roster to assign/round-robin against. The
 * app itself never hardcodes these names — it always reads the BD list live
 * from the DB (Admins holding the BDE role); this script is just how that
 * list gets its first four members.
 *
 * Idempotent — safe to re-run; skips anyone whose email already has an
 * Admin account.
 *
 *   node seedBDTeam.js
 */
require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');
const Admin = require('./server/models/Admin');
const Employee = require('./server/models/Employee');
const Role = require('./server/models/Role');
const { encrypt } = require('./server/utils/encryption');

const TEAM = [
  { firstName: 'Amit', lastName: 'Choudhary', email: 'amit.choudhary@vedhunt.in', phone: '9800000001', panNumber: 'AAAAA0001A', aadhaarNumber: '234567890001' },
  { firstName: 'Rahul', lastName: 'Pandey', email: 'rahul.pandey@vedhunt.in', phone: '9800000002', panNumber: 'AAAAA0002A', aadhaarNumber: '234567890002' },
  { firstName: 'Nikhil', lastName: 'Bhatade', email: 'nikhil.bhatade@vedhunt.in', phone: '9800000003', panNumber: 'AAAAA0003A', aadhaarNumber: '234567890003' },
  { firstName: 'Madhushree', lastName: 'Parab', email: 'madhushree.parab@vedhunt.in', phone: '9800000004', panNumber: 'AAAAA0004A', aadhaarNumber: '234567890004' }
];

async function getOrCreateRole(name, description, permissions) {
  let role = await Role.findOne({ name });
  if (!role) {
    role = await Role.create({ name, description, permissions, isSystem: name === 'EMPLOYEE' });
  }
  return role;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const employeeRole = await getOrCreateRole('EMPLOYEE', 'Default role for employees. Access limited to ESS portal.', ['ess.access']);
  const bdeRole = await getOrCreateRole('BDE', 'Business Development Executive — views and works only their own assigned leads.', ['leads.view']);

  const lastEmployee = await Employee.findOne({}, 'employeeId').sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastEmployee?.employeeId?.startsWith('VH-EMP-')) {
    const lastNum = parseInt(lastEmployee.employeeId.split('-')[2], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  for (const person of TEAM) {
    const existing = await Admin.findOne({ email: person.email });
    if (existing) {
      console.log(`Skipping ${person.firstName} ${person.lastName} — ${person.email} already exists.`);
      continue;
    }

    const employeeId = `VH-EMP-${String(nextNum).padStart(3, '0')}`;
    nextNum++;

    const tempPassword = crypto.randomBytes(4).toString('hex');

    const admin = await Admin.create({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      password: tempPassword,
      roles: [employeeRole._id, bdeRole._id],
      isTemporaryPassword: true,
      employeeId
    });

    await Employee.create({
      employeeId,
      adminId: admin._id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      tempPassword,
      roleDept: 'Business Development Executive',
      employmentType: 'Billable',
      joinDate: new Date(),
      salaryCTC: 300000,
      panNumber: encrypt(person.panNumber),
      aadhaarNumber: encrypt(person.aadhaarNumber),
      bankDetails: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
      attendance: [], tasks: [], timesheet: [], payslips: [], performance: []
    });

    console.log(`Created ${person.firstName} ${person.lastName} | ${person.email} | ID: ${employeeId} | Temp password: ${tempPassword}`);
  }

  console.log('\nDone. Each new BD can log in at /admin/login with their email + temp password above, and will be prompted to set a real password.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('BD team seeding crashed:', err);
  process.exit(1);
});
