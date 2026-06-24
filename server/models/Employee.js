const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Weekend'], default: 'Present' },
  clockIn: { type: String },
  clockOut: { type: String },
  lateByMins: { type: Number, default: 0 }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  dueDate: { type: Date }
});

const timesheetSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  hoursWorked: { type: Number, required: true },
  description: { type: String, required: true }
});

const payslipSchema = new mongoose.Schema({
  month: { type: String, required: true },
  year: { type: String, required: true },
  baseSalary: { type: Number, required: true },
  allowance: { type: Number, default: 0 },
  deduction: { type: Number, default: 0 },
  deductionReason: { type: String, default: '' },
  netPay: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Paid' }
});

const performanceSchema = new mongoose.Schema({
  goal: { type: String, required: true },
  targetDate: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Achieved'], default: 'Pending' }
});

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    tempPassword: {
      type: String
    },
    roleDept: {
      type: String,
      required: true
    },
    employmentType: {
      type: String,
      enum: ['Billable', 'Non-billable', 'Partner', 'Founder'],
      default: 'Billable'
    },
    joinDate: {
      type: Date,
      required: true
    },
    salaryCTC: {
      type: Number,
      required: true
    },
    panNumber: {
      type: String,
      required: true
    },
    aadhaarNumber: {
      type: String,
      required: true
    },
    bankDetails: {
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      ifscCode: { type: String, default: '' }
    },
    leaveBalances: {
      CL: { type: Number, default: 6 },
      SL: { type: Number, default: 6 },
      PL: { type: Number, default: 12 }
    },
    leavesUsed: {
      CL: { type: Number, default: 0 },
      SL: { type: Number, default: 0 },
      PL: { type: Number, default: 0 }
    },
    attendance: [attendanceSchema],
    tasks: [taskSchema],
    timesheet: [timesheetSchema],
    payslips: [payslipSchema],
    performance: [performanceSchema],
    activeTimer: {
      project: { type: String },
      task: { type: String },
      startTime: { type: Date },
      activityType: { type: String }
    },
    alerts: [{
      type: { type: String, enum: ['Productivity', 'Inactivity', 'MissingTimesheet', 'LongTimer', 'Other'] },
      message: { type: String },
      createdAt: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }]
  },
  { timestamps: true }
);

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
