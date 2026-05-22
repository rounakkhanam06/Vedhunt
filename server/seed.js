require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const logger = require('./utils/logger');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    const email = 'vedhunt@gmail.com';
    const password = '123456';

    const adminExists = await Admin.findOne({ email });

    if (adminExists) {
      logger.info('Admin already exists!');
      process.exit(0);
    }

    // The Admin model has a pre-save hook that will automatically hash the password
    const admin = new Admin({
      email,
      password,
      role: 'SUPER_ADMIN',
    });

    await admin.save();
    logger.info('Admin seeded successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
