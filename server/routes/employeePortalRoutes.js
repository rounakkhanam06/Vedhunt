const express = require('express');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const LeaveRequest = require('../models/LeaveRequest');
const SupportTicket = require('../models/SupportTicket');
const Lead = require('../models/Lead');
const Payslip = require('../models/Payslip');
const { getMyNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const { findLeadRaw } = require('../utils/leadLookup');
const { LEAD_UPDATE_FIELDS } = require('../utils/leadStateMachine');
const { applyLeadUpdate } = require('../services/leadLifecycle');
const employeeAuthMiddleware = require('../middleware/employeeAuthMiddleware');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const router = express.Router();

router.use(employeeAuthMiddleware);

// ==========================================
// EMPLOYEE SELF-SERVICE (ESS) ROUTES
// ==========================================

// Get logged-in employee details
router.get('/ess/profile', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee details not found' });
    }
    const decrypted = employee.toObject();
    decrypted.panNumber = decrypt(decrypted.panNumber);
    decrypted.aadhaarNumber = decrypt(decrypted.aadhaarNumber);

    res.json({ success: true, employee: decrypted });
  } catch (error) {
    logger.error('Error getting employee profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update personal and bank details in ESS
router.put('/ess/profile', async (req, res) => {
  try {
    const { bankDetails } = req.body;
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee details not found' });
    }

    if (bankDetails) {
      const { bankName, accountName, accountNumber, ifscCode } = bankDetails;
      const nameRegex = /^[a-zA-Z\s]+$/;
      const numberRegex = /^\d+$/;
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

      if (accountName && !nameRegex.test(accountName)) return res.status(400).json({ success: false, message: 'Account Holder Name must contain only letters and spaces.' });
      if (bankName && !nameRegex.test(bankName)) return res.status(400).json({ success: false, message: 'Bank Name must contain only letters and spaces.' });
      if (accountNumber && !numberRegex.test(accountNumber)) return res.status(400).json({ success: false, message: 'Account Number must contain only numbers.' });
      if (ifscCode && !ifscRegex.test(ifscCode)) return res.status(400).json({ success: false, message: 'Invalid IFSC Code format.' });

      employee.bankDetails = {
        accountName: accountName || employee.bankDetails.accountName,
        accountNumber: accountNumber || employee.bankDetails.accountNumber,
        bankName: bankName || employee.bankDetails.bankName,
        ifscCode: ifscCode || employee.bankDetails.ifscCode
      };
    }

    await employee.save();
    res.json({ success: true, employee });
  } catch (error) {
    logger.error('Error updating bank profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clock in / Clock out Attendance
router.post('/ess/attendance/clock', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee details not found' });
    }

    const todayStr = new Date().toDateString();
    let todayLog = employee.attendance.find(a => new Date(a.date).toDateString() === todayStr);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!todayLog) {
      // Clock In
      let lateByMins = 0;
      try {
        const settings = await Settings.findOne({ key: 'office_timings' });
        if (settings && settings.value && settings.value.standardStartTime) {
          const standardStart = settings.value.standardStartTime; // e.g., "09:00"
          const [startHour, startMin] = standardStart.split(':').map(Number);
          const now = new Date();
          const currentHour = now.getHours();
          const currentMin = now.getMinutes();
          
          const standardTimeInMins = (startHour * 60) + startMin;
          const currentTimeInMins = (currentHour * 60) + currentMin;
          
          if (currentTimeInMins > standardTimeInMins) {
            lateByMins = currentTimeInMins - standardTimeInMins;
          }
        }
      } catch (err) {
        logger.error('Error fetching office timings for late check:', err);
      }

      employee.attendance.push({
        date: new Date(),
        status: 'Present',
        clockIn: timeStr,
        clockOut: '',
        lateByMins
      });
      await employee.save();
      return res.json({ success: true, action: 'clockIn', time: timeStr, lateByMins, message: 'Successfully clocked in!' });
    } else if (!todayLog.clockOut) {
      // Clock Out
      todayLog.clockOut = timeStr;
      await employee.save();
      return res.json({ success: true, action: 'clockOut', time: timeStr, message: 'Successfully clocked out!' });
    } else {
      return res.status(400).json({ success: false, message: 'Already clocked in and out for today.' });
    }
  } catch (error) {
    logger.error('Error clocking attendance:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Real-Time Work Timer: Start Work
router.post('/ess/timer/start', async (req, res) => {
  try {
    const { project, task, activityType } = req.body;
    if (!project || !task || !activityType) {
      return res.status(400).json({ success: false, message: 'Provide project, task, and activity type to start work.' });
    }

    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Check if there is an active timer
    if (employee.activeTimer && employee.activeTimer.startTime) {
      return res.status(400).json({ success: false, message: 'You already have an active timer. Please stop it first.' });
    }

    employee.activeTimer = {
      project,
      task,
      activityType,
      startTime: new Date()
    };
    employee.markModified('activeTimer');

    await employee.save();
    res.json({ success: true, message: 'Timer started!', activeTimer: employee.activeTimer });
  } catch (error) {
    logger.error('Error starting timer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Real-Time Work Timer: Stop Work
router.post('/ess/timer/stop', async (req, res) => {
  try {
    const { remarks, isProductive, isBillable, meetingWith, clientName, teamMemberName, markTaskCompleted } = req.body;
    
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    if (!employee.activeTimer || !employee.activeTimer.startTime) {
      return res.status(400).json({ success: false, message: 'No active timer found.' });
    }

    const startTime = employee.activeTimer.startTime;
    const endTime = new Date();
    const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60)); // Total minutes

    const workLog = new WorkLog({
      employeeId: employee._id,
      date: new Date(),
      startTime,
      endTime,
      duration: durationMinutes,
      project: employee.activeTimer.project,
      task: employee.activeTimer.task,
      activityType: employee.activeTimer.activityType,
      isProductive: isProductive || false,
      isBillable: isBillable || false,
      remarks,
      meetingWith,
      clientName,
      teamMemberName
    });

    await workLog.save();

    // Mark assigned task as completed if requested
    if (markTaskCompleted && employee.activeTimer.activityType === 'Vedhunt Task') {
      const taskIndex = employee.tasks.findIndex(t => t.title === employee.activeTimer.task && t.status !== 'Completed');
      if (taskIndex !== -1) {
        employee.tasks[taskIndex].status = 'Completed';
      }
    }

    // Clear active timer
    employee.activeTimer = { project: null, task: null, activityType: null, startTime: null };
    employee.markModified('activeTimer');
    // Ensure missing required fields are populated for legacy data
    if (!employee.phone) employee.phone = '0000000000';
    await employee.save();

    res.json({ success: true, message: 'Work logged successfully!', workLog });
  } catch (error) {
    logger.error('Error stopping timer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch WorkLogs (Paginated / Timeline)
router.get('/ess/worklogs', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Extract query params for filtering
    const { date, page = 1, limit = 50 } = req.query;
    let query = { employeeId: employee._id };
    
    if (date && date !== 'undefined' && date !== '[object Object]') {
      const startOfDay = new Date(date);
      if (!isNaN(startOfDay.getTime())) {
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);
        query.date = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await WorkLog.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await WorkLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching work logs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dashboard Stats for ESS
router.get('/ess/dashboard-stats', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Allow date-wise filtering via ?date=YYYY-MM-DD
    const { date } = req.query;
    let startOfDay, endOfDay;

    if (date && date !== 'undefined' && date !== '[object Object]') {
      startOfDay = new Date(date);
      // Fallback if parsing fails
      if (isNaN(startOfDay.getTime())) startOfDay = new Date();
    } else {
      startOfDay = new Date();
    }

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await WorkLog.find({
      employeeId: employee._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    let productiveMinutes = 0;
    let nonProductiveMinutes = 0;

    logs.forEach(log => {
      if (log.isProductive) {
        productiveMinutes += log.duration;
      } else {
        nonProductiveMinutes += log.duration;
      }
    });

    const totalMinutes = productiveMinutes + nonProductiveMinutes;
    // Base 8.5 hours per day
    const targetMinutes = 8.5 * 60;
    const productivityPercentage = targetMinutes > 0 ? ((productiveMinutes / targetMinutes) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      stats: {
        totalWorkedHours: (totalMinutes / 60).toFixed(2),
        productiveHours: (productiveMinutes / 60).toFixed(2),
        nonProductiveHours: (nonProductiveMinutes / 60).toFixed(2),
        productivityPercentage: parseFloat(productivityPercentage),
        remainingTargetHours: Math.max(0, ((targetMinutes - totalMinutes) / 60)).toFixed(2)
      },
      activeTimer: employee.activeTimer || null
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Create Leave Request
router.post('/ess/leave-requests', async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide leave type, start date, end date, and reason.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ success: false, message: 'Invalid date range provided.' });
    }

    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const leaveRequest = await LeaveRequest.create({
      employeeId: employee._id,
      leaveType,
      startDate: start,
      endDate: end,
      reason
    });

    res.status(201).json({ success: true, message: 'Leave request submitted successfully.', leaveRequest });
  } catch (error) {
    logger.error('Error creating leave request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Leave Requests for Logged-in Employee
router.get('/ess/leave-requests', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const requests = await LeaveRequest.find({ employeeId: employee._id }).sort({ createdAt: -1 });

    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ key: 'attendance_rules' });
    const leaveBalancePeriod = settings?.value?.leaveBalancePeriod || 'Year';

    res.json({
      success: true,
      leaveRequests: requests,
      leaveBalances: employee.leaveBalances,
      leavesUsed: employee.leavesUsed,
      leaveBalancePeriod
    });
  } catch (error) {
    logger.error('Error fetching leave requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// Get tickets assigned to employee
router.get('/ess/tickets', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    const tickets = await SupportTicket.find({ assignedTo: req.user._id })
      .populate('client_ref', 'contactName businessName email')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, tickets });
  } catch (error) {
    logger.error('Error fetching employee tickets:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update ticket status (employee)
router.put('/ess/tickets/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const ticket = await SupportTicket.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found or not assigned to you' });
    
    ticket.status = status;
    await ticket.save();
    
    res.json({ success: true, message: 'Status updated successfully', ticket });
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add message to ticket (employee)
router.post('/ess/tickets/:id/messages', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Message text is required' });
    
    const ticket = await SupportTicket.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found or not assigned to you' });
    
    const senderName = req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Employee';
    
    ticket.messages.push({
      senderModel: 'Employee',
      senderId: req.user._id,
      senderName,
      text
    });
    
    await ticket.save();
    res.json({ success: true, message: 'Message sent', ticket });
  } catch (error) {
    logger.error('Error adding ticket message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ASSIGNED LEADS (BDs) — Employee Portal is the BD's only workspace now
// (see server/routes/auth.js's PORTAL_ONLY_ROLES check), so this covers
// both viewing and working the lead. Reassigning ownership stays out of
// reach here — that only happens through the audited POST
// /api/leads/:id/assign flow on the admin side.
// ==========================================

// Get leads assigned to this employee
router.get('/ess/leads', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const leads = await Lead.find({ assignedTo: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, leads });
  } catch (error) {
    logger.error('Error fetching employee leads:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get a single lead assigned to this employee — powers the Lead Workspace
// page. Scoped to assignedTo so a BD can't fetch a lead that isn't theirs.
router.get('/ess/leads/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid lead id' });
    }
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    res.json({ success: true, lead });
  } catch (error) {
    logger.error('Error fetching employee lead:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a lead assigned to this employee. Goes through the shared state
// machine in services/leadLifecycle.js (same one the admin panel's
// leadController.updateLead uses), so gating is identical regardless of
// which portal edits the lead.
router.put('/ess/leads/:id', async (req, res) => {
  try {
    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (LEAD_UPDATE_FIELDS.includes(key)) updates[key] = req.body[key];
    }

    const result = await applyLeadUpdate(req.params.id, updates, { id: req.user._id }, { assignedTo: req.user._id });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    res.json({ success: true, message: 'Lead updated', lead: result.lead });
  } catch (error) {
    logger.error('Error updating employee lead:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// PAYSLIPS — read-only, self-scoped. Payroll is generated and approved
// entirely from the admin side (server/routes/payrollRoutes.js); this is
// just where an employee views/downloads their own history.
// ==========================================
router.get('/ess/payslips', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const payslips = await Payslip.find({ employeeId: employee._id, status: 'Active' }).sort({ year: -1, month: -1 });
    res.json({ success: true, payslips });
  } catch (error) {
    logger.error('Error fetching employee payslips:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/ess/payslips/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const payslip = await Payslip.findOne({ _id: req.params.id, employeeId: employee._id });
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found' });
    res.json({ success: true, payslip });
  } catch (error) {
    logger.error('Error fetching employee payslip:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// NOTIFICATIONS — same recipient-scoped logic as the admin panel's
// /api/notifications (notificationController.js only ever reads
// req.user._id, so it works identically under either auth middleware).
// ==========================================
router.get('/ess/notifications', getMyNotifications);
router.put('/ess/notifications/read-all', markAllRead);
router.put('/ess/notifications/:id/read', markRead);

module.exports = router;
