const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead,
  assignLead, bulkAssignLeads, getAssignmentHistory, getAllAssignmentLogs, lockLead, unlockLead,
  uploadLeadDocument, deleteLeadDocument, importLeads,
  getLeadTasks, createLeadTask, completeLeadTask
} = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { uploadLeadDocument: uploadLeadDocumentMiddleware } = require('../utils/cloudinary');

// In-memory only — the uploaded spreadsheet is parsed and discarded, never
// persisted anywhere (unlike lead documents, which go to Cloudinary).
const uploadLeadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|csv)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only .xlsx or .csv files are supported.'));
  }
});

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
router.post('/import', authMiddleware, requirePermission('*'), uploadLeadFile.single('file'), importLeads);
router.post('/:id/documents', authMiddleware, requirePermission('leads.view'), uploadLeadDocumentMiddleware.single('file'), uploadLeadDocument);
router.delete('/:id/documents/:docId', authMiddleware, requirePermission('leads.view'), deleteLeadDocument);
router.get('/:id/tasks', authMiddleware, requirePermission('leads.view'), getLeadTasks);
router.post('/:id/tasks', authMiddleware, requirePermission('leads.assign'), createLeadTask);
router.put('/:id/tasks/:taskId/complete', authMiddleware, requirePermission('leads.view'), completeLeadTask);
router.delete('/:id', authMiddleware, requirePermission('*'), deleteLead);
// Fallback for strict firewalls that block DELETE requests
router.post('/:id/delete', authMiddleware, requirePermission('*'), deleteLead);


module.exports = router;
