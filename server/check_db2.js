require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  
  // Create dummy
  const admin = await Admin.create({
    firstName: 'Test',
    lastName: 'Admin',
    email: 'testdelete@gmail.com',
    password: 'password123',
    roles: []
  });

  const emp = await Employee.create({
    employeeId: 'TEST-01',
    adminId: admin._id,
    firstName: 'Test',
    lastName: 'Admin',
    email: 'testdelete@gmail.com',
    phone: '1234567890',
    roleDept: 'Test',
    joinDate: new Date(),
    salaryCTC: 10000,
    panNumber: 'TESTP1234T',
    aadhaarNumber: '123456789012'
  });

  console.log('Created Emp ID:', emp._id);
  console.log('Admin ID from Emp:', emp.adminId);

  // Now emulate DELETE route
  const employee = await Employee.findById(emp._id);
  console.log('Found employee:', employee._id, 'with adminId:', employee.adminId);

  const deletedAdmin = await Admin.findByIdAndDelete(employee.adminId);
  console.log('Deleted admin result:', deletedAdmin ? 'Success' : 'Fail or null');

  const deletedEmp = await Employee.findByIdAndDelete(employee._id);
  console.log('Deleted emp result:', deletedEmp ? 'Success' : 'Fail or null');

  // Check if they exist
  const adminCheck = await Admin.findById(admin._id);
  console.log('Admin check after delete:', adminCheck ? 'Exists' : 'Deleted');

  process.exit(0);
}).catch(console.error);
