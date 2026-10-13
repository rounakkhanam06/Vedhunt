// My Team Performance — mounted at /ess/team-performance by
// employeePortalRoutes.js (a manager sees their direct reports, a Super Admin
// every BDE) and at /api/admin/activity/team-performance by activityRoutes.js
// (Super Admin only). Who is visible is decided in services/teamPerformance.js.
const express = require('express');
const { PERIODS, periodRange, teamSummary, memberDetail, teamCalls } = require('../services/teamPerformance');
const logger = require('../utils/logger');

const router = express.Router();

function rangeFrom(req, res) {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'today';
  const range = periodRange({ period, from: req.query.from, to: req.query.to });
  if (!range || range.start > range.end) {
    res.status(400).json({ success: false, message: 'Pick a valid date range.' });
    return null;
  }
  return range;
}

router.get('/', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const data = await teamSummary(req.user, range);
    res.json({ success: true, range, ...data });
  } catch (err) {
    logger.error('Team performance summary failed:', err);
    res.status(500).json({ success: false, message: 'Could not load team performance.' });
  }
});

// Team call log — every call by the visible BDEs. Declared before /:adminId.
router.get('/calls', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const { by, result, page, limit } = req.query;
    const data = await teamCalls(req.user, range, { by, result, page, limit });
    res.json({ success: true, range, ...data });
  } catch (err) {
    logger.error('Team call log failed:', err);
    res.status(500).json({ success: false, message: 'Could not load the team call log.' });
  }
});

router.get('/:adminId', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const data = await memberDetail(req.user, req.params.adminId, range);
    if (!data) return res.status(404).json({ success: false, message: 'This person is not in your team.' });
    res.json({ success: true, range, asOf: new Date(), ...data });
  } catch (err) {
    logger.error('Team member performance failed:', err);
    res.status(500).json({ success: false, message: 'Could not load this team member.' });
  }
});

module.exports = router;
