const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, // duration in minutes
      default: 0
    },
    project: {
      type: String,
      required: true
    },
    task: {
      type: String,
      required: true
    },
    activityType: {
      type: String,
      enum: [
        'Client Work',
        'Client Meeting',
        'Internal Meeting',
        'Vedhunt Task',
        'Training',
        'Research',
        'Testing',
        'Documentation',
        'Bug Fixing',
        'Development',
        'Other'
      ],
      required: true
    },
    isProductive: {
      type: Boolean,
      default: false
    },
    isBillable: {
      type: Boolean,
      default: false
    },
    // Meeting tracking fields
    meetingWith: {
      type: String
    },
    clientName: {
      type: String
    },
    teamMemberName: {
      type: String
    },
    remarks: {
      type: String
    }
  },
  { timestamps: true }
);

// Indexes for fast querying by employee and date range
workLogSchema.index({ employeeId: 1, date: -1 });

const WorkLog = mongoose.model('WorkLog', workLogSchema);

module.exports = WorkLog;
