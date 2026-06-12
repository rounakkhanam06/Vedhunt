const express = require('express');
const { getRoles, createRole, updateRole, deleteRole, getPermissions } = require('../controllers/rbacController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

const router = express.Router();

// Require auth for all RBAC routes
router.use(authMiddleware);
// Require 'roles.manage' for all RBAC routes
router.use(requirePermission('roles.manage'));

router.route('/permissions')
  .get(getPermissions);

router.route('/roles')
  .get(getRoles)
  .post(createRole);

router.route('/roles/:id')
  .put(updateRole)
  .delete(deleteRole);

module.exports = router;
