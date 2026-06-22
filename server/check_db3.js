require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Employee = require('./models/Employee');
const crypto = require('crypto');
const { encrypt } = require('./utils/encryption');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');

  try {
    const payload = {
      firstName: "Jagrarti", 
      lastName: "Dod", 
      email: "jagrati45@gmail.com", 
      phone: "7887666566",
      aadhaarNumber: "867555544244",
      employmentType: "Billable",
      joinDate: "2026-06-25",
      panNumber: "ABCDE1234T",
      roleDept: "MERN Developer",
      salaryCTC: 500000
    };

    const strFirstName = String(payload.firstName || '');
    const strLastName = String(payload.lastName || '');
    const strEmail = String(payload.email || '');
    const strPhone = String(payload.phone || '');
    const strRoleDept = String(payload.roleDept || '');

    const parsedJoinDate = new Date(payload.joinDate);
    const panUpper = String(payload.panNumber || '').trim().toUpperCase();
    const aadhaarClean = String(payload.aadhaarNumber || '').trim();

    const employeeId = `VH-EMP-999`;
    const tempPassword = crypto.randomBytes(4).toString('hex');

    const admin = new Admin({
      firstName: strFirstName.trim(),
      lastName: strLastName.trim(),
      email: strEmail.trim().toLowerCase(),
      password: tempPassword,
      isTemporaryPassword: true,
      employeeId
    });

    console.log('Validating admin...');
    await admin.validate();

    const employee = new Employee({
      employeeId,
      adminId: new mongoose.Types.ObjectId(),
      firstName: strFirstName.trim(),
      lastName: strLastName.trim(),
      email: strEmail.trim().toLowerCase(),
      phone: strPhone.trim(),
      tempPassword: tempPassword,
      roleDept: strRoleDept.trim(),
      employmentType: payload.employmentType || 'Billable',
      joinDate: parsedJoinDate,
      salaryCTC: payload.salaryCTC,
      panNumber: encrypt(panUpper),
      aadhaarNumber: encrypt(aadhaarClean),
      bankDetails: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
      attendance: [], tasks: [], timesheet: [], payslips: [], performance: []
    });

    console.log('Validating employee...');
    await employee.validate();

    console.log('All valid!');
  } catch (err) {
    console.error('ERROR OCCURRED:', err);
  }

  process.exit(0);
}).catch(console.error);
