const cron = require('node-cron');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const logger = require('../utils/logger');

const startCronJobs = () => {
  // 1. Check for Active Timers running for more than 12 hours (Run every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      
      const employeesWithLongTimers = await Employee.find({
        'activeTimer.startTime': { $lt: twelveHoursAgo }
      });

      for (const employee of employeesWithLongTimers) {
        // Stop the timer and auto-log it
        const durationMinutes = Math.floor((now - employee.activeTimer.startTime) / (1000 * 60));
        
        const workLog = new WorkLog({
          employeeId: employee._id,
          date: now,
          startTime: employee.activeTimer.startTime,
          endTime: now,
          duration: durationMinutes,
          project: employee.activeTimer.project,
          task: employee.activeTimer.task,
          activityType: employee.activeTimer.activityType,
          isProductive: false, // Auto-stopped, marked non-productive
          isBillable: false,
          remarks: 'Auto-stopped by system after 12 hours.'
        });

        await workLog.save();
        
        employee.activeTimer = undefined;
        employee.alerts.push({
          type: 'LongTimer',
          message: 'Your timer was auto-stopped because it ran for more than 12 hours.'
        });
        
        await employee.save();
        logger.info(`Auto-stopped timer for employee ${employee.employeeId}`);
      }
    } catch (error) {
      logger.error('Error in Long Timer cron:', error);
    }
  });

  // 2. Check for missing timesheets (Run at 11:30 PM everyday)
  cron.schedule('30 23 * * *', async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const employees = await Employee.find({});
      
      for (const employee of employees) {
        const logs = await WorkLog.countDocuments({
          employeeId: employee._id,
          date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (logs === 0) {
          employee.alerts.push({
            type: 'MissingTimesheet',
            message: 'No work logged today. Please submit your timesheet.'
          });
          await employee.save();
        }
      }
      logger.info('Checked for missing timesheets.');
    } catch (error) {
      logger.error('Error in Missing Timesheet cron:', error);
    }
  });

  // 3. Check for low productivity < 70% (Run at 11:45 PM everyday)
  cron.schedule('45 23 * * *', async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const targetMinutes = 8.5 * 60;

      const employees = await Employee.find({});
      
      for (const employee of employees) {
        const logs = await WorkLog.find({
          employeeId: employee._id,
          date: { $gte: startOfDay, $lte: endOfDay }
        });

        let productiveMinutes = 0;
        logs.forEach(log => {
          if (log.isProductive) productiveMinutes += log.duration;
        });

        const productivityPercentage = (productiveMinutes / targetMinutes) * 100;
        
        if (logs.length > 0 && productivityPercentage < 70) {
          employee.alerts.push({
            type: 'Productivity',
            message: `Your productivity today was ${productivityPercentage.toFixed(2)}% (Below 70%).`
          });
          await employee.save();
        }
      }
      logger.info('Checked for low productivity.');
    } catch (error) {
      logger.error('Error in Productivity cron:', error);
    }
  });

  logger.info('Timesheet Cron Jobs Initialized.');
};

module.exports = startCronJobs;
