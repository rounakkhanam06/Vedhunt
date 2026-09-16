const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await Employee.updateMany(
    { employmentStatus: 'Probation' },
    { $set: { 'leaveBalances.CL': 0, 'leaveBalances.SL': 0, 'leaveBalances.PL': 0 } }
  );
  console.log('Migrated probation employees:', result.modifiedCount);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
