require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  
  const admins = await Admin.find({ isTemporaryPassword: true });
  for (const admin of admins) {
    const emp = await Employee.findOne({ adminId: admin._id });
    if (!emp) {
      console.log(`Orphan admin found: ${admin.email}. Deleting...`);
      await Admin.findByIdAndDelete(admin._id);
    }
  }

  console.log('Cleanup complete.');
  process.exit(0);
}).catch(console.error);
