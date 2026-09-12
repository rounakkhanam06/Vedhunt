const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

// Get financial overview and project breakdown.
// No permission gate beyond authMiddleware: the Dashboard fetches this for
// every logged-in admin unconditionally (no client-side permission check
// either), and there's no dedicated "view financial overview" permission in
// the RBAC system. This used to hardcode roleMiddleware('SUPER_ADMIN',
// 'ADMIN', 'EDITOR') — a role-name allowlist from before the permission
// system existed, that 403'd any other admin role (PROJECT MANAGER, or any
// custom role created later) and even referenced 'ADMIN', a role name that
// doesn't exist in this system. authMiddleware alone is sufficient here:
// HRMS employees can never reach the admin panel at all (see routes/auth.js),
// so anyone passing auth is already a real admin.
router.get(
  '/earnings',
  authMiddleware,
  analyticsController.getFinancialOverview
);

module.exports = router;
