const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead,
  assignLead, bulkAssignLeads, getAssignmentHistory, getAllAssignmentLogs, lockLead, unlockLead,
  uploadLeadDocument, deleteLeadDocument, importLeads, previewImportLeads, getImportStatus,
  getLeadTasks, createLeadTask, completeLeadTask,
  getLeadNotes, addLeadNote, shareLeadWith, unshareLeadWith,
  previewBulkAssign, getBulkAssignRuns
} = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const requirePageAccess = require('../middleware/requirePageAccess');
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

// Authenticated lead routes. No auth here: mounted behind the Admin auth below
// (/api/leads) and behind the Employee Portal auth for person-wise grants
// (/api/employee-portal/grants/leads). Each route checks page + action through
// requirePageAccess (role access exactly as before, plus any grant), and the
// controller limits the data to req.pageScope (utils/leadScope.js).
const scoped = express.Router();
const leads = (action) => requirePageAccess('leads', action);
// Follow-up tasks are shared by the Leads and Follow-ups pages
const tasks = (action) => requirePageAccess([['leads', action], ['followups', action]]);

scoped.get('/', leads('view'), getLeads);
scoped.get('/import/:jobId', requirePermission('leads.import'), getImportStatus);
scoped.get('/assignments/all', requirePermission('audit.view'), getAllAssignmentLogs);
scoped.get('/bulk-assign/runs', leads('assign'), getBulkAssignRuns);
scoped.get('/bulk-assign/runs/:runId', leads('assign'), getBulkAssignRuns);
scoped.get('/:id', leads('view'), getLeadById);
scoped.get('/:id/assignment-history', leads('view'), getAssignmentHistory);
scoped.post('/bulk-assign/preview', leads('assign'), previewBulkAssign);
scoped.post('/bulk-assign', leads('assign'), bulkAssignLeads);
scoped.post('/:id/assign', leads('assign'), assignLead);
scoped.post('/:id/share', leads('assign'), shareLeadWith);
scoped.delete('/:id/share/:adminId', leads('assign'), unshareLeadWith);
scoped.post('/:id/share/:adminId/remove', leads('assign'), unshareLeadWith);
scoped.get('/:id/notes', leads('view'), getLeadNotes);
scoped.post('/:id/notes', leads('view'), addLeadNote);
scoped.post('/:id/lock', leads('edit'), lockLead);
scoped.post('/:id/unlock', leads('view'), unlockLead);
scoped.put('/:id', leads('edit'), updateLead);
scoped.post('/import/preview', requirePermission('leads.import'), uploadLeadFile.single('file'), previewImportLeads);
scoped.post('/import', requirePermission('leads.import'), uploadLeadFile.single('file'), importLeads);
scoped.post('/:id/documents', leads('edit'), uploadLeadDocumentMiddleware.single('file'), uploadLeadDocument);
scoped.delete('/:id/documents/:docId', leads('edit'), deleteLeadDocument);
scoped.get('/:id/tasks', tasks('view'), getLeadTasks);
scoped.post('/:id/tasks', requirePageAccess('followups', 'edit'), createLeadTask);
scoped.put('/:id/tasks/:taskId/complete', tasks('edit'), completeLeadTask);
scoped.delete('/:id', leads('delete'), deleteLead);
// Fallback for strict firewalls that block DELETE requests
scoped.post('/:id/delete', leads('delete'), deleteLead);

// Public route to submit lead
router.post('/', createLead);
// Admin panel
router.use(authMiddleware, scoped);

module.exports = router;
module.exports.scopedLeadRouter = scoped;
