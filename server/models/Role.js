const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, // e.g., 'SUPER_ADMIN', 'EDITOR'
    },
    description: {
      type: String,
      trim: true,
    },
    // Human-readable name shown in the Employee Manager's role picker and
    // stored onto Employee.roleDept for display — distinct from `name`,
    // which is a fixed uppercase slug (e.g. name 'BDE', label 'Business
    // Development Executive').
    label: {
      type: String,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false, // true for immutable roles like SUPER_ADMIN
    },
    // True for roles meant to be assigned to Employee records (via the
    // Employee Manager) and that log into the Employee Portal — EMPLOYEE,
    // BDE, and any other employee-type role. Drives three things that used
    // to be separate hardcoded ['EMPLOYEE','BDE'] name lists: which roles
    // appear in the Employee Manager's role dropdown, which roles are
    // blocked from the Admin panel login, and which roles are allowed into
    // the Employee Portal login.
    isEmployeeRole: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
