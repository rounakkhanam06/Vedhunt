const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { getLeadForms, updateLeadForm } = require('../controllers/leadFormController');

router.get('/', authMiddleware, getLeadForms);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  updateLeadForm
);

module.exports = router;
