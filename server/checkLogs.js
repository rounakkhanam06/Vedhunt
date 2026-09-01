const mongoose = require('mongoose');
require('dotenv').config();

const AuditLog = require('./models/AuditLog');

const checkLogs = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(10);
    console.log('Recent Audit Logs:');
    logs.forEach(log => {
      console.log(`[${log.createdAt}] ${log.action} - ${log.resource} - ${log.message || ''} - ${JSON.stringify(log.details)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkLogs();
