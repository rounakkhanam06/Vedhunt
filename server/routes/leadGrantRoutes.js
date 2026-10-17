// Employee Portal → lead pages granted to one person (Leads, Follow-ups, Lead
// Activity). Mounted at /api/employee-portal/grants behind the portal auth, with
// the same paths the Admin panel uses (/leads, /admin/...), so the same screens
// run here. Every route checks page + action and limits the data to the
// person's scope (role and grant combined; config/pageAccess.js).
const express = require('express');
const requirePageAccess = require('../middleware/requirePageAccess');
const { getLeadForms } = require('../controllers/leadFormController');
const { getAssignableBDs } = require('../controllers/assignmentController');
const { assigneeIds } = require('../utils/leadScope');

const router = express.Router();
const ANY_LEAD_PAGE = [['leads', 'view'], ['followups', 'view'], ['lead-activity', 'view']];

router.use('/leads', require('./leadRoutes').scopedLeadRouter);
router.use('/admin/activity', require('./activityRoutes').scopedActivityRouter);
router.get('/admin/lead-forms', requirePageAccess('leads', 'view'), getLeadForms);

// BD picker: only the people inside the person's scope
router.get('/admin/assignment/bds', requirePageAccess(ANY_LEAD_PAGE), async (req, res, next) => {
  const ids = await assigneeIds(req);
  const json = res.json.bind(res);
  res.json = (body) => {
    if (ids && Array.isArray(body?.data)) body.data = body.data.filter((bd) => ids.includes(String(bd._id)));
    return json(body);
  };
  return getAssignableBDs(req, res, next);
});

module.exports = router;
