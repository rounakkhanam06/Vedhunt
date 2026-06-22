require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  const admins = await Admin.find({}, 'email roles isTemporaryPassword');
  console.log('Admins:', admins);
  
  const employees = await Employee.find({}, 'email adminId');
  console.log('Employees:', employees);

  process.exit(0);
}).catch(console.error);
