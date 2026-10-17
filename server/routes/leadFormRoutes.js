const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { getLeadForms, updateLeadForm } = require('../controllers/leadFormController');

router.get('/', authMiddleware, requirePermission(['leads.view', 'settings.manage']), getLeadForms);

router.put(
  '/:id',
  authMiddleware,
  requirePermission('settings.manage'),
  updateLeadForm
);

module.exports = router;
