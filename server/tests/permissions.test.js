const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  PERMISSIONS,
  LEGACY_TEAM_MANAGE,
  permissionsOf,
  hasPermission,
  grantsAdminPanel,
  missingGrants,
} = require('../config/permissions');

// Pure-function tests for the role permission catalog and its rules
// (config/permissions.js). Run: npm test

describe('permission catalog', () => {
  test('has no duplicates and never lists the * wildcard', () => {
    assert.equal(new Set(PERMISSIONS).size, PERMISSIONS.length);
    assert.ok(!PERMISSIONS.includes('*'));
  });

  test('every permission team.manage used to cover is in the catalog', () => {
    for (const key of LEGACY_TEAM_MANAGE) assert.ok(PERMISSIONS.includes(key), key);
  });
});

describe('permissionsOf / hasPermission', () => {
  test('flattens and de-duplicates across roles', () => {
    const perms = permissionsOf([{ permissions: ['leads.view', 'ess.access'] }, { permissions: ['leads.view'] }, null]);
    assert.deepEqual(perms.sort(), ['ess.access', 'leads.view']);
  });

  test('* passes any check', () => {
    assert.ok(hasPermission(['*'], 'employees.sensitive'));
    assert.ok(!hasPermission(['employees.view'], 'employees.sensitive'));
  });
});

describe('grantsAdminPanel', () => {
  test('BDE and plain employee permissions stay portal-only', () => {
    assert.equal(grantsAdminPanel(['leads.view', 'followups.view', 'ess.access']), false);
    assert.equal(grantsAdminPanel(['ess.access']), false);
  });

  test('an HR permission opens the Admin panel', () => {
    assert.equal(grantsAdminPanel(['ess.access', 'leave.manage']), true);
    assert.equal(grantsAdminPanel(['*']), true);
  });
});

describe('missingGrants', () => {
  test('lists what the granter lacks', () => {
    assert.deepEqual(missingGrants(['employees.view'], ['employees.view', 'roles.manage']), ['roles.manage']);
  });

  test('a Super Admin can grant anything', () => {
    assert.deepEqual(missingGrants(['*'], ['roles.manage', 'team.manage']), []);
  });
});
