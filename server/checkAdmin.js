const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('./models/Admin');
const Role = require('./models/Role');

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await Admin.findOne({ email: 'vedhunt@gmail.com' }).populate('roles');
    if (!admin) {
      console.log('Admin not found');
    } else {
      console.log('Admin found:', admin.email);
      console.log('Roles:', JSON.stringify(admin.roles, null, 2));
      
      const permissionsSet = new Set();
      admin.roles.forEach(role => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => permissionsSet.add(perm));
        }
      });
      console.log('Flattened Permissions:', Array.from(permissionsSet));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkAdmin();
