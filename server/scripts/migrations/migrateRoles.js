require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const logger = require('../utils/logger');

const migrateRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for Role Migration');

    // Create Super Admin role
    let superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: 'SUPER_ADMIN',
        description: 'Has access to everything',
        permissions: ['*'],
        isSystem: true
      });
      logger.info('Created SUPER_ADMIN role');
    }

    // Create Editor role
    let editorRole = await Role.findOne({ name: 'EDITOR' });
    if (!editorRole) {
      editorRole = await Role.create({
        name: 'EDITOR',
        description: 'Standard editor',
        permissions: ['blogs.manage', 'portfolio.manage'], // Just an example subset
        isSystem: true
      });
      logger.info('Created EDITOR role');
    }

    // Migrate existing admins
    const admins = await Admin.find({});
    for (const admin of admins) {
      if (!admin.roles || admin.roles.length === 0) {
        // Look at legacy 'role' field, defaulting to EDITOR if missing
        const legacyRole = admin.get('role') || 'EDITOR';
        
        if (legacyRole === 'SUPER_ADMIN') {
          admin.roles = [superAdminRole._id];
        } else {
          admin.roles = [editorRole._id];
        }

        await admin.save({ validateBeforeSave: false });
        logger.info(`Migrated admin ${admin.email} to new role format`);
      }
    }

    logger.info('Migration complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateRoles();
