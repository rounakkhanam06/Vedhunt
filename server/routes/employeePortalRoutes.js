const express = require('express');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const LeaveRequest = require('../models/LeaveRequest');
const SupportTicket = require('../models/SupportTicket');
const Lead = require('../models/Lead');
const Payslip = require('../models/Payslip');
const { getMyNotifications, markRead, markAllRead, registerDevice } = require('../controllers/notificationController');
const { findLeadRaw } = require('../utils/leadLookup');
const { LEAD_UPDATE_FIELDS } = require('../utils/leadStateMachine');
const { applyLeadUpdate } = require('../services/leadLifecycle');
const { addLeadDocument, removeLeadDocument } = require('../services/leadDocuments');
const { listTasks, completeTask } = require('../services/followUpTasks');
const { uploadLeadDocument: uploadLeadDocumentMiddleware } = require('../utils/cloudinary');
const employeeAuthMiddleware = require('../middleware/employeeAuthMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const { notifyTicketReply, notifyTicketStatus } = require('../services/clientNotify');
const { countChargeableDays, availableDays, findOverlap, startOfDay } = require('../services/leavePolicy');
const { notifyPermissionHolders, notifyStaff } = require('../services/staffNotify');
const BankChangeRequest = require('../models/BankChangeRequest');
const AuditLog = require('../models/AuditLog');
const bank = require('../services/bankDetails');
const { closeActiveTimer } = require('../services/workTimer');

const bankRequestView = (r) => ({
  _id: r._id,
  status: r.status,
  requested: bank.masked(r.requested),
  previous: bank.masked(r.previous),
  reviewComment: r.reviewComment || '',
  reviewedAt: r.reviewedAt || null,
  createdAt: r.createdAt,
});

const LEAVE_LABEL = { CL: 'Casual Leave', SL: 'Sick Leave', PL: 'Paid Leave', EL: 'Emergency Leave' };
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

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
    decrypted.bankDetails = bank.masked(decrypted.bankDetails);

    const pending = await BankChangeRequest.findOne({ employee: employee._id, status: 'Pending' }).sort({ createdAt: -1 }).lean();
    decrypted.pendingBankChange = pending ? bankRequestView(pending) : null;

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

    if (!bankDetails) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    // Salary account changes never apply directly — they go to HR for approval
    const { details, error } = bank.validateBankDetails(bankDetails);
    if (error) return res.status(400).json({ success: false, message: error });

    if (bank.sameDetails(details, employee.bankDetails)) {
      return res.status(400).json({ success: false, message: 'These are already your bank details on file.' });
    }
    const existing = await BankChangeRequest.findOne({ employee: employee._id, status: 'Pending' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a bank change waiting for HR approval. Cancel it first to submit a different one.' });
    }

    const request = await BankChangeRequest.create({
      employee: employee._id,
      requestedBy: req.user._id,
      previous: bank.forStorage(employee.bankDetails || {}),
      requested: bank.forStorage(details),
    });

    await AuditLog.create({
      adminId: req.user._id,
      action: 'BANK_CHANGE_REQUESTED',
      resource: 'Employee',
      beforeSnapshot: { employeeId: employee.employeeId, bank: bank.masked(employee.bankDetails || {}) },
      afterSnapshot: { requestId: request._id, bank: bank.masked(details) },
      ipAddress: req.ip,
    }).catch((e) => logger.error('Audit log failed (BANK_CHANGE_REQUESTED):', e.message));

    await notifyPermissionHolders('team.manage', {
      type: 'bank_change_request',
      title: `Bank change request from ${employee.firstName} ${employee.lastName}`,
      message: `${details.bankName} · account ending ${details.accountNumber.slice(-4)} — needs HR approval`,
      link: '/admin/bank-change-requests',
    }, { exclude: [req.user._id] });

    res.status(202).json({
      success: true,
      pendingApproval: true,
      message: 'Bank change submitted. It will apply once HR approves it.',
      request: bankRequestView(request.toObject()),
    });
  } catch (error) {
    logger.error('Error updating bank profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// My bank change requests (masked)
router.get('/ess/bank-change-requests', async (req, res) => {
  try {
    const employee = await Employee.findOne({ adminId: req.user._id }).select('_id');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee details not found' });
    const requests = await BankChangeRequest.find({ employee: employee._id }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, requests: requests.map(bankRequestView) });
  } catch (error) {
    logger.error('Error listing bank change requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/ess/bank-change-requests/:id/cancel', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request ID' });
    const employee = await Employee.findOne({ adminId: req.user._id }).select('_id employeeId');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee details not found' });
    const request = await BankChangeRequest.findOne({ _id: req.params.id, employee: employee._id });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'Pending') return res.status(400).json({ success: false, message: `This request is already ${request.status.toLowerCase()}.` });

    request.status = 'Cancelled';
    request.cancelledAt = new Date();
    await request.save();
    await AuditLog.create({
      adminId: req.user._id, action: 'BANK_CHANGE_CANCELLED', resource: 'Employee',
      afterSnapshot: { employeeId: employee.employeeId, requestId: request._id }, ipAddress: req.ip,
    }).catch(() => {});
    res.json({ success: true, message: 'Bank change request cancelled.' });
  } catch (error) {
    logger.error('Error cancelling bank change request:', error);
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
      // Clock In — any earlier day left without a clock-out gets flagged for HR
      const openDays = employee.attendance.filter((a) => a.clockIn && !a.clockOut && !a.missedClockOut && new Date(a.date).toDateString() !== todayStr);
      openDays.forEach((a) => { a.missedClockOut = true; });
      if (openDays.length) {
        await notifyPermissionHolders('team.manage', {
          type: 'attendance_missed_clockout',
          title: `${employee.firstName} ${employee.lastName} missed a clock-out`,
          message: `No clock-out on ${openDays.map((a) => fmtDay(a.date)).join(', ')} — attendance needs correcting.`,
          link: '/admin/attendance-roster',
        });
      }

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
      // Clock Out — a still-running work timer is stopped and logged first
      let timerStopped = false;
      if (employee.activeTimer && employee.activeTimer.startTime) {
        await closeActiveTimer(employee, { remarks: 'Stopped automatically at clock-out.' });
        timerStopped = true;
      }
      todayLog.clockOut = timeStr;
      await employee.save();
      return res.json({
        success: true,
        action: 'clockOut',
        time: timeStr,
        timerStopped,
        message: timerStopped ? 'Clocked out. Your running timer was stopped and logged.' : 'Successfully clocked out!',
      });
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
    const today = new Date().toDateString();
    const todayAttendance = employee.attendance.find((a) => new Date(a.date).toDateString() === today);
    if (!todayAttendance || !todayAttendance.clockIn) {
      return res.status(400).json({ success: false, message: 'Please clock in before starting the work timer.' });
    }
    if (todayAttendance.clockOut) {
      return res.status(400).json({ success: false, message: "You've already clocked out for today." });
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

    // Mark assigned task as completed if requested (read before the timer is cleared)
    if (markTaskCompleted && employee.activeTimer.activityType === 'Vedhunt Task') {
      const taskIndex = employee.tasks.findIndex(t => t.title === employee.activeTimer.task && t.status !== 'Completed');
      if (taskIndex !== -1) {
        employee.tasks[taskIndex].status = 'Completed';
        employee.tasks[taskIndex].completedAt = new Date();
      }
    }

    const { workLog, capped } = await closeActiveTimer(employee, { remarks, isProductive, isBillable, meetingWith, clientName, teamMemberName });
    // Ensure missing required fields are populated for legacy data
    if (!employee.phone) employee.phone = '0000000000';
    await employee.save();

    res.json({
      success: true,
      message: capped ? 'Work logged. The timer had been left running, so the session was capped.' : 'Work logged successfully!',
      workLog,
      capped,
    });
  } catch (error) {
    logger.error('Error stopping timer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update one of my own tasks: Pending → In Progress → Completed
const TASK_FLOW = { Pending: ['In Progress', 'Completed'], 'In Progress': ['Completed'], Completed: [] };
router.put('/ess/tasks/:taskId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "In Progress" or "Completed".' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) return res.status(400).json({ success: false, message: 'Invalid task ID' });

    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const task = employee.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const current = task.status || 'Pending';
    if (!(TASK_FLOW[current] || []).includes(status)) {
      return res.status(400).json({
        success: false,
        message: current === 'Completed' ? 'This task is already completed. Ask your manager to reopen it.' : `Cannot move a task from ${current} to ${status}.`,
      });
    }

    task.status = status;
    if (status === 'Completed') task.completedAt = new Date();
    if (!employee.phone) employee.phone = '0000000000'; // legacy records missing a required field
    await employee.save();

    if (status === 'Completed' && task.assignedBy && String(task.assignedBy) !== String(req.user._id)) {
      await notifyStaff(task.assignedBy, {
        type: 'task_completed',
        title: `Task completed by ${employee.firstName} ${employee.lastName}`,
        message: String(task.title).slice(0, 140),
        link: '/admin/tasks',
      });
    }

    res.json({ success: true, message: status === 'Completed' ? 'Task marked as completed.' : 'Task started.', task });
  } catch (error) {
    logger.error('Error updating task status:', error);
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
    const { leaveType, startDate, endDate } = req.body;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide leave type, start date, end date, and reason.' });
    }
    if (!LEAVE_LABEL[leaveType]) {
      return res.status(400).json({ success: false, message: 'Invalid leave type.' });
    }
    if (reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Reason is too long (max 500 characters).' });
    }

    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ success: false, message: 'Invalid date range provided.' });
    }
    // Backdated up to 30 days (e.g. sick leave after the fact), at most a year ahead
    const today = startOfDay(new Date());
    if (start < new Date(today.getTime() - 30 * 86400000)) {
      return res.status(400).json({ success: false, message: 'Leave cannot start more than 30 days in the past.' });
    }
    if (end > new Date(today.getTime() + 365 * 86400000)) {
      return res.status(400).json({ success: false, message: 'Leave cannot be requested more than a year ahead.' });
    }

    const employee = await Employee.findOne({ adminId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // \u2500\u2500 Probation Leave Guard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (employee.employmentStatus === 'Probation') {
      // Probationary employees may only use EL (Emergency Leave)
      if (leaveType !== 'EL') {
        return res.status(403).json({
          success: false,
          message: 'Only Emergency Leave (EL) is available during the probation period.'
        });
      }
    } else {
      // Permanent employees cannot use EL (that type is only for probation)
      if (leaveType === 'EL') {
        return res.status(400).json({
          success: false,
          message: 'Emergency Leave (EL) is only available during the probation period.'
        });
      }
    }
    // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    const days = await countChargeableDays(start, end);
    if (days === 0) {
      return res.status(400).json({ success: false, message: 'The selected dates are all Sundays or holidays — no leave is needed.' });
    }

    const overlap = await findOverlap(employee._id, start, end);
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${overlap.status.toLowerCase()} leave request for ${fmtDay(overlap.startDate)} – ${fmtDay(overlap.endDate)} that overlaps these dates.`,
      });
    }

    // Never more than the available balance (pending requests count against it)
    const balance = await availableDays(employee, leaveType);
    if (days > balance.available) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_LEAVE_BALANCE',
        message: `Not enough ${LEAVE_LABEL[leaveType]} balance: this request needs ${days} day${days > 1 ? 's' : ''}, you have ${balance.available} available${balance.pendingDays ? ` (${balance.pendingDays} already pending)` : ''}.`,
        balance: { ...balance, requested: days },
      });
    }

    const leaveRequest = await LeaveRequest.create({
      employeeId: employee._id,
      leaveType,
      startDate: start,
      endDate: end,
      reason
    });

    await notifyPermissionHolders('team.manage', {
      type: 'leave_request',
      title: `Leave request from ${employee.firstName} ${employee.lastName}`,
      message: `${LEAVE_LABEL[leaveType]} · ${days} day${days > 1 ? 's' : ''} · ${fmtDay(start)} – ${fmtDay(end)}`,
      link: '/admin/leave-requests',
    }, { exclude: [req.user._id] });

    res.status(201).json({ success: true, message: 'Leave request submitted successfully.', leaveRequest, days });
  } catch (error) {
    logger.error('Error creating leave request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Cancel one of my own PENDING leave requests
router.put('/ess/leave-requests/:id/cancel', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid leave request ID' });
    }
    const employee = await Employee.findOne({ adminId: req.user._id }).select('_id firstName lastName');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const leaveRequest = await LeaveRequest.findOne({ _id: req.params.id, employeeId: employee._id });
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'Leave request not found' });
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Only pending requests can be cancelled (this one is ${leaveRequest.status.toLowerCase()}).` });
    }

    leaveRequest.status = 'Cancelled';
    await leaveRequest.save();
    res.json({ success: true, message: 'Leave request cancelled.', leaveRequest });
  } catch (error) {
    logger.error('Error cancelling leave request:', error);
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

    const leavesPending = {};
    for (const type of Object.keys(LEAVE_LABEL)) {
      leavesPending[type] = (await availableDays(employee, type)).pendingDays;
    }

    res.json({
      success: true,
      leaveRequests: requests,
      leaveBalances: employee.leaveBalances,
      leavesUsed: employee.leavesUsed,
      leavesPending,
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
    
    const statusChanged = ticket.status !== status;
    ticket.status = status;
    await ticket.save();
    if (statusChanged) await notifyTicketStatus(ticket);
    
    res.json({ success: true, message: 'Status updated successfully', ticket });
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add message to ticket (employee)
router.post('/ess/tickets/:id/messages', async (req, res) => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ success: false, message: 'Message text is required' });
    if (text.length > 5000) return res.status(400).json({ success: false, message: 'Message is too long (max 5000 characters).' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await SupportTicket.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found or not assigned to you' });
    if (ticket.status === 'Closed') return res.status(400).json({ success: false, message: 'This ticket is closed. Reopen it before replying.' });

    const senderName = req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Employee';
    
    ticket.messages.push({
      senderModel: 'Employee',
      senderId: req.user._id,
      senderName,
      text
    });
    
    await ticket.save();
    await notifyTicketReply(ticket, senderName, text);
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
router.get('/ess/leads', requirePermission('leads.view'), async (req, res) => {
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
router.get('/ess/leads/:id', requirePermission('leads.view'), async (req, res) => {
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
router.put('/ess/leads/:id', requirePermission('leads.view'), async (req, res) => {
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

// Attach a document (proposal, quotation, scope, other) — scoped to a lead
// this BD actually owns, same as every other ESS lead endpoint.
router.post('/ess/leads/:id/documents', requirePermission('leads.view'), uploadLeadDocumentMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const result = await addLeadDocument(req.params.id, req.file, req.body.docType, req.user._id, { assignedTo: req.user._id });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(201).json({ success: true, lead: result.lead });
  } catch (error) {
    logger.error('Error uploading employee lead document:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/ess/leads/:id/documents/:docId', requirePermission('leads.view'), async (req, res) => {
  try {
    const result = await removeLeadDocument(req.params.id, req.params.docId, { assignedTo: req.user._id });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.json({ success: true, lead: result.lead });
  } catch (error) {
    logger.error('Error deleting employee lead document:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Follow-up Tasks — Primary (auto-synced with nextFollowUpDate) + any manager-
// created Parallel tasks on a lead this BD owns. Creating a Parallel task is
// manager-only (admin side), so there's no POST route here — a BD can only
// view and complete tasks assigned to them.
router.get('/ess/leads/:id/tasks', requirePermission('followups.view'), async (req, res) => {
  try {
    const result = await listTasks(req.params.id, { assignedTo: req.user._id });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.json({ success: true, tasks: result.tasks });
  } catch (error) {
    logger.error('Error listing employee lead tasks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/ess/leads/:id/tasks/:taskId/complete', requirePermission('followups.view'), async (req, res) => {
  try {
    const result = await completeTask(req.params.id, req.params.taskId, req.body.result, req.user._id, { canManage: false }, { assignedTo: req.user._id });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.json({ success: true, task: result.task });
  } catch (error) {
    logger.error('Error completing employee lead task:', error);
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

// Download one of my payslips as PDF — generated on the fly, so it works even
// when the stored copy (pdfUrl) is missing because the upload failed.
router.get('/ess/payslips/:id/pdf', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payslip ID' });
    const employee = await Employee.findOne({ adminId: req.user._id }).select('_id');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const payslip = await Payslip.findOne({ _id: req.params.id, employeeId: employee._id }).lean();
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found' });

    const { buildPayslipPdfBuffer } = require('../services/payslipGenerator');
    const pdf = await buildPayslipPdfBuffer(payslip);
    const name = `Payslip-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store',
    });
    res.send(pdf);
  } catch (error) {
    logger.error('Error generating payslip PDF:', error);
    res.status(500).json({ success: false, message: 'Could not generate the payslip PDF' });
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
router.post('/ess/notifications/register-device', registerDevice);

module.exports = router;
