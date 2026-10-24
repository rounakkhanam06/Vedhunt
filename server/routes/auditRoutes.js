const express = require('express');
const router = express.Router();
const { getAuditLogs, getNotClockedIn, getAuditEmployees } = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Only Super Admins can view audit logs
router.get('/', authMiddleware, requirePermission('audit.view'), getAuditLogs);
router.get('/not-clocked-in', authMiddleware, requirePermission('audit.view'), getNotClockedIn);
router.get('/employees', authMiddleware, requirePermission('audit.view'), getAuditEmployees);

module.exports = router;
