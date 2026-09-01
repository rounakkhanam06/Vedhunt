const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Only Super Admins can view audit logs
router.get('/', authMiddleware, requirePermission('*'), getAuditLogs);

module.exports = router;
