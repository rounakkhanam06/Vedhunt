const Role = require('../models/Role');
const Settings = require('../models/Settings');
const logger = require('./logger');
const { LEGACY_TEAM_MANAGE } = require('../config/permissions');

const MARKER_KEY = 'permission_migration';
const VERSION = 1;

/**
 * One-time (per database) upgrade for the HR permission split: `team.manage`
 * used to unlock every HRMS page, which now each have their own permission
 * (config/permissions.js). Every role that had team.manage gets those new
 * permissions, so nobody loses access. Recorded in Settings so it never runs
 * again — permissions an admin later untick stay unticked.
 */
async function migratePermissions() {
  const done = await Settings.findOne({ key: MARKER_KEY }).lean();
  if ((done?.value?.version || 0) >= VERSION) return;

  const roles = await Role.find({ permissions: 'team.manage' });
  for (const role of roles) {
    role.permissions = [...new Set([...role.permissions, ...LEGACY_TEAM_MANAGE])];
    await role.save();
  }
  await Settings.findOneAndUpdate(
    { key: MARKER_KEY },
    { $set: { value: { version: VERSION, at: new Date(), roles: roles.map((r) => r.name) } } },
    { upsert: true }
  );
  logger.info(`Permission migration v${VERSION}: HR permissions added to ${roles.length} role(s) with team.manage`);
}

module.exports = { migratePermissions };
