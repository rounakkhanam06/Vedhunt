const express = require('express');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { encrypt, decrypt } = require('../utils/encryption');
const { sendEmail } = require('../utils/sendEmail');
const crypto = require('crypto');
const logger = require('../utils/logger');

const router = express.Router();

// Helper to ensure EMPLOYEE role exists and returns it
async function getEmployeeRole() {
  let role = await Role.findOne({ name: 'EMPLOYEE' });
  if (!role) {
    role = await Role.create({
      name: 'EMPLOYEE',
      description: 'Default role for employees. Access limited to ESS portal.',
      permissions: ['ess.access'],
      isSystem: true
    });
  }
  return role;
}

// All HRMS / Employee routes require authentication
router.use(authMiddleware);

// ==========================================
// ADMIN HRMS ROUTES
// ==========================================

// Get all employees (Admin/HR only)
router.get('/', requirePermission('team.manage'), async (req, res) => {
  try {
    const employees = await Employee.find({}).populate('adminId', 'isActive');
    // Decrypt PAN and Aadhaar for administration view
    const decryptedEmployees = employees.map(emp => {
      const obj = emp.toObject();
      obj.panNumber = decrypt(obj.panNumber);
      obj.aadhaarNumber = decrypt(obj.aadhaarNumber);
      return obj;
    });
    res.json({ success: true, employees: decryptedEmployees });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new employee (Admin/HR only)
router.post('/', requirePermission('team.manage'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      roleDept,
      employmentType,
      joinDate,
      salaryCTC,
      panNumber,
      aadhaarNumber
    } = req.body;

    // ── Server-Side Validation ─────────────────────────────────────────────
    const validationErrors = [];

    const NAME_REGEX = /^[a-zA-Z\s'-]{2,50}$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PHONE_REGEX = /^[0-9+\-\s()]{10,15}$/;
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;

    // Required presence check
    const required = { firstName, lastName, email, phone, roleDept, joinDate, salaryCTC, panNumber, aadhaarNumber };
    for (const [field, value] of Object.entries(required)) {
      if (!value && value !== 0) {
        validationErrors.push(`${field} is required.`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors[0], errors: validationErrors });
    }

    // Format validations
    if (!NAME_REGEX.test(firstName.trim())) {
      return res.status(400).json({ success: false, message: 'First name: only letters, spaces, hyphens allowed (2–50 chars).' });
    }
    if (!NAME_REGEX.test(lastName.trim())) {
      return res.status(400).json({ success: false, message: 'Last name: only letters, spaces, hyphens allowed (2–50 chars).' });
    }
    // Convert types to strings before trim
    const strFirstName = String(firstName || '');
    const strLastName = String(lastName || '');
    const strEmail = String(email || '');
    const strPhone = String(phone || '');
    const strRoleDept = String(roleDept || '');

    if (!EMAIL_REGEX.test(strEmail.trim().toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    if (!PHONE_REGEX.test(strPhone.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid phone number (10-15 digits).' });
    }
    if (strRoleDept.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Role / Department must be at least 2 characters.' });
    }

    // Join date parsing
    const parsedJoinDate = new Date(joinDate);
    if (isNaN(parsedJoinDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Joining date is invalid.' });
    }

    // Salary CTC range check
    const salaryNum = Number(salaryCTC);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      return res.status(400).json({ success: false, message: 'Salary CTC must be a positive number.' });
    }
    if (salaryNum < 10000) {
      return res.status(400).json({ success: false, message: 'Minimum salary CTC must be ₹10,000.' });
    }
    if (salaryNum > 100000000) {
      return res.status(400).json({ success: false, message: 'Salary CTC value seems too high. Please verify.' });
    }

    // PAN format: 5 letters, 4 digits, 1 letter — e.g. ABCDE1234F
    const panUpper = String(panNumber || '').trim().toUpperCase();
    if (!PAN_REGEX.test(panUpper)) {
      return res.status(400).json({ success: false, message: 'Invalid PAN number. Required format: ABCDE1234F (5 letters + 4 digits + 1 letter).' });
    }

    // Aadhaar: exactly 12 digits, must not start with 0 or 1
    const aadhaarClean = String(aadhaarNumber || '').trim();
    if (!AADHAAR_REGEX.test(aadhaarClean)) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar number. Must be exactly 12 digits and not start with 0 or 1.' });
    }

    // Employment type check
    if (employmentType && !['Billable', 'Non-billable'].includes(employmentType)) {
      return res.status(400).json({ success: false, message: 'Employment type must be Billable or Non-billable.' });
    }

    // Duplicate email check
    const adminExists = await Admin.findOne({ email: strEmail.trim().toLowerCase() });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists in the system.' });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Generate Employee ID: e.g. VH-EMP-007
    const lastEmployee = await Employee.findOne({}, 'employeeId').sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastEmployee && lastEmployee.employeeId && lastEmployee.employeeId.startsWith('VH-EMP-')) {
      const parts = lastEmployee.employeeId.split('-');
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const employeeId = `VH-EMP-${String(nextNum).padStart(3, '0')}`;

    // 2. Generate temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex');

    // 3. Get or create EMPLOYEE role
    const employeeRole = await getEmployeeRole();

    // 4. Create Admin Account
    const admin = await Admin.create({
      firstName: strFirstName.trim(),
      lastName: strLastName.trim(),
      email: strEmail.trim().toLowerCase(),
      password: tempPassword,
      roles: [employeeRole._id],
      isTemporaryPassword: true,
      employeeId
    });

    // 5. Create Employee Details with encrypted PAN/Aadhaar
    const employee = await Employee.create({
      employeeId,
      adminId: admin._id,
      firstName: strFirstName.trim(),
      lastName: strLastName.trim(),
      email: strEmail.trim().toLowerCase(),
      phone: strPhone.trim(),
      tempPassword: tempPassword,
      roleDept: strRoleDept.trim(),
      employmentType: employmentType || 'Billable',
      joinDate: parsedJoinDate,
      salaryCTC: salaryNum,
      panNumber: encrypt(panUpper),
      aadhaarNumber: encrypt(aadhaarClean),
      bankDetails: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
      attendance: [], tasks: [], timesheet: [], payslips: [], performance: []
    });

    // 6. Send Welcome Email
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/login`;
    const message = `Welcome to Vedhunt, ${strFirstName.trim()} ${strLastName.trim()}!\n\nYour employee account has been created.\n\nLogin Credentials:\nEmail: ${strEmail.trim().toLowerCase()}\nTemporary Password: ${tempPassword}\n\nLogin & reset your password: ${loginUrl}`;
    try {
      await sendEmail({ email: strEmail.trim().toLowerCase(), subject: 'Welcome to Vedhunt — Your Employee Credentials', message });
    } catch (mailError) {
      logger.error('Welcome email failed, account still created:', mailError.message);
    }

    logger.info(`EMPLOYEE CREATED: ${strEmail.trim().toLowerCase()} | ID: ${employeeId} | Temp PWD: ${tempPassword}`);

    res.status(201).json({ success: true, employeeId, tempPassword, employee });
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Employee (Admin/HR only)
router.put('/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      roleDept,
      employmentType,
      joinDate,
      salaryCTC,
      panNumber,
      aadhaarNumber,
      // Admin options to add tasks, goals, payslips
      newTask,
      newGoal,
      newPayslip
    } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (roleDept) employee.roleDept = roleDept;
    if (employmentType) employee.employmentType = employmentType;
    if (joinDate) employee.joinDate = joinDate;
    if (salaryCTC) employee.salaryCTC = salaryCTC;
    if (panNumber) employee.panNumber = encrypt(panNumber);
    if (aadhaarNumber) employee.aadhaarNumber = encrypt(aadhaarNumber);

    if (newTask) {
      employee.tasks.push(newTask);
    }
    if (newGoal) {
      employee.performance.push(newGoal);
    }
    if (newPayslip) {
      employee.payslips.push(newPayslip);
    }

    // Fix legacy documents missing required fields before save
    if (!employee.phone) employee.phone = '0000000000';

    await employee.save();

    // Also update Admin user first/last name if modified
    if ((firstName || lastName) && employee.adminId) {
      await Admin.findByIdAndUpdate(employee.adminId, {
        firstName: employee.firstName,
        lastName: employee.lastName
      });
    }

    res.json({ success: true, employee });
  } catch (error) {
    logger.error('Error updating employee:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Delete Employee (Admin/HR only)
router.delete('/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Delete linked admin login credentials
    await Admin.findByIdAndDelete(employee.adminId);
    // Delete employee details
    await Employee.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Employee and linked user account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting employee:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


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
      employee.bankDetails = {
        accountName: bankDetails.accountName || employee.bankDetails.accountName,
        accountNumber: bankDetails.accountNumber || employee.bankDetails.accountNumber,
        bankName: bankDetails.bankName || employee.bankDetails.bankName,
        ifscCode: bankDetails.ifscCode || employee.bankDetails.ifscCode
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
      employee.attendance.push({
        date: new Date(),
        status: 'Present',
        clockIn: timeStr,
        clockOut: ''
      });
      await employee.save();
      return res.json({ success: true, action: 'clockIn', time: timeStr, message: 'Successfully clocked in!' });
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

// Manager Dashboard: Get Employee Productivity
router.get('/manager/productivity', authMiddleware, requirePermission('ess.manage'), async (req, res) => {
  try {
    const { dateRange, department, employeeId } = req.query;
    
    // Filter by Date
    let dateFilter = {};
    const now = new Date();
    
    if (dateRange === 'Today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (dateRange === 'Weekly') {
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startOfWeek };
    } else if (dateRange === 'Monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { $gte: startOfMonth };
    }

    // Filter by Employee
    let empQuery = {};
    if (department) empQuery.roleDept = department;
    if (employeeId) empQuery._id = employeeId;

    const employees = await Employee.find(empQuery).select('firstName lastName roleDept employmentType _id');
    const employeeIds = employees.map(emp => emp._id);

    let logQuery = { employeeId: { $in: employeeIds } };
    if (Object.keys(dateFilter).length > 0) {
      logQuery.date = dateFilter;
    }

    const logs = await WorkLog.find(logQuery);

    // Aggregate stats per employee
    const stats = employees.map(emp => {
      const empLogs = logs.filter(log => log.employeeId.toString() === emp._id.toString());
      let productiveMinutes = 0;
      let nonProductiveMinutes = 0;
      let billableMinutes = 0;

      empLogs.forEach(log => {
        if (log.isProductive) productiveMinutes += log.duration;
        else nonProductiveMinutes += log.duration;
        
        if (log.isBillable) billableMinutes += log.duration;
      });

      const totalMinutes = productiveMinutes + nonProductiveMinutes;
      // Target based on days (approximate for the requested period)
      // For simplicity, just reporting total vs productive
      const utilization = totalMinutes > 0 ? ((productiveMinutes / totalMinutes) * 100).toFixed(2) : 0;

      return {
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.roleDept,
        type: emp.employmentType,
        totalWorkedHours: (totalMinutes / 60).toFixed(2),
        productiveHours: (productiveMinutes / 60).toFixed(2),
        nonProductiveHours: (nonProductiveMinutes / 60).toFixed(2),
        billableHours: (billableMinutes / 60).toFixed(2),
        utilizationPercentage: parseFloat(utilization)
      };
    });

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error fetching manager productivity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
