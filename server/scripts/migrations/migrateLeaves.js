const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Make sure we load the env
const Employee = require('../models/Employee');

async function migrateLeaves() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vedhunt');
    console.log('Connected to DB');

    const employees = await Employee.find({});
    console.log(`Found ${employees.length} employees`);

    let updatedCount = 0;
    for (let emp of employees) {
      let needsUpdate = false;

      // Migrate leaveBalances if it doesn't exist or is missing CL
      if (!emp.leaveBalances || emp.leaveBalances.CL === undefined) {
        // Flat leaveBalance was the old way. We just give defaults as the user requested "CL=6, SL=6, PL=12"
        // Let's reset everyone to the new defaults or apportion.
        // Actually, the new schema defaults are CL:6, SL:6, PL:12.
        emp.leaveBalances = {
          CL: 6,
          SL: 6,
          PL: 12
        };
        needsUpdate = true;
      }

      // Migrate leavesUsed if missing
      if (!emp.leavesUsed || emp.leavesUsed.CL === undefined) {
        // If there's an old `leavesUsed` number, we can just put it all into PL or SL, 
        // or just reset to 0 if it's a new system.
        // The safest is to put the old flat `leavesUsed` entirely into PL (Paid Leaves) up to 12.
        const oldUsed = emp.get('leavesUsed') || 0; 
        // Note: leavesUsed in schema is now an object. 
        // If it was a number before, Mongoose might cast it weirdly.
        
        let plUsed = Math.min(oldUsed, 12);
        let slUsed = Math.min(Math.max(0, oldUsed - 12), 6);
        let clUsed = Math.min(Math.max(0, oldUsed - 18), 6);

        emp.set('leavesUsed', {
          CL: clUsed,
          SL: slUsed,
          PL: plUsed
        });
        needsUpdate = true;
      }

      if (needsUpdate) {
        await emp.save();
        updatedCount++;
        console.log(`Migrated leaves for Employee: ${emp.firstName} ${emp.lastName}`);
      }
    }

    console.log(`Migration Complete. Updated ${updatedCount} employees.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateLeaves();
