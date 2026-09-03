const express = require('express');
const router = express.Router();
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead,
  assignLead, bulkAssignLeads, getAssignmentHistory, getAllAssignmentLogs, lockLead, unlockLead,
  uploadLeadDocument, deleteLeadDocument
} = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { uploadLeadDocument: uploadLeadDocumentMiddleware } = require('../utils/cloudinary');

// Public route to submit lead
router.post('/', createLead);

// Admin routes
router.get('/', authMiddleware, requirePermission('leads.view'), getLeads);
router.get('/assignments/all', authMiddleware, requirePermission('*'), getAllAssignmentLogs);
router.get('/:id', authMiddleware, requirePermission('leads.view'), getLeadById);
router.get('/:id/assignment-history', authMiddleware, requirePermission('leads.view'), getAssignmentHistory);
router.post('/bulk-assign', authMiddleware, requirePermission('leads.assign'), bulkAssignLeads);
router.post('/:id/assign', authMiddleware, requirePermission('leads.assign'), assignLead);
router.post('/:id/lock', authMiddleware, requirePermission('leads.view'), lockLead);
router.post('/:id/unlock', authMiddleware, requirePermission('leads.view'), unlockLead);
router.put('/:id', authMiddleware, requirePermission('leads.view'), updateLead);
router.post('/:id/documents', authMiddleware, requirePermission('leads.view'), uploadLeadDocumentMiddleware.single('file'), uploadLeadDocument);
router.delete('/:id/documents/:docId', authMiddleware, requirePermission('leads.view'), deleteLeadDocument);
router.delete('/:id', authMiddleware, requirePermission('*'), deleteLead);
// Fallback for strict firewalls that block DELETE requests
router.post('/:id/delete', authMiddleware, requirePermission('*'), deleteLead);


module.exports = router;
