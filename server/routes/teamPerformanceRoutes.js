// My Team Performance — mounted at /ess/team-performance by
// employeePortalRoutes.js (a manager sees their direct reports, a Super Admin
// every BDE) and at /api/admin/activity/team-performance by activityRoutes.js
// (Super Admin only). Who is visible is decided in services/teamPerformance.js.
const express = require('express');
const { PERIODS, periodRange, teamSummary, memberDetail, teamCalls, teamDaily, visibleMembers, MAX_DAILY_DAYS } = require('../services/teamPerformance');
const { leadStatusBoard, pendingCallBoard, leadsFor } = require('../services/leadBoards');
const { hasPermission } = require('../config/permissions');

// Who the lead tables cover: the visible BDEs; with team.performance (Admin)
// also every other owner and Unassigned, so totals reconcile to all leads.
const teamScope = async (user) => ({ members: await visibleMembers(user), admin: hasPermission(user.permissions, 'team.performance') });
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


// Lead Status / Pending Call tables and their drill-down (services/leadBoards.js)
router.get('/lead-status', async (req, res) => {
  try {
    res.json({ success: true, asOf: new Date(), ...(await leadStatusBoard(await teamScope(req.user))) });
  } catch (err) {
    logger.error('Team lead status failed:', err);
    res.status(500).json({ success: false, message: 'Could not load the lead status table.' });
  }
});

router.get('/pending-calls', async (req, res) => {
  try {
    res.json({ success: true, asOf: new Date(), ...(await pendingCallBoard(await teamScope(req.user))) });
  } catch (err) {
    logger.error('Team pending calls failed:', err);
    res.status(500).json({ success: false, message: 'Could not load pending calls.' });
  }
});

router.get('/board-leads', async (req, res) => {
  try {
    const { owner, bucket, day } = req.query;
    const leads = await leadsFor(await teamScope(req.user), { owner, bucket, day });
    if (!leads) return res.status(404).json({ success: false, message: 'Not in your view.' });
    res.json({ success: true, leads });
  } catch (err) {
    logger.error('Team board leads failed:', err);
    res.status(500).json({ success: false, message: 'Could not load these leads.' });
  }
});

// BD-wise daily call performance — per BDE per IST day. Declared before /:adminId.
router.get('/daily', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const data = await teamDaily(req.user, range);
    if (!data) return res.status(400).json({ success: false, message: `Pick ${MAX_DAILY_DAYS} days or fewer for the daily breakdown.` });
    res.json({ success: true, range, ...data });
  } catch (err) {
    logger.error('Team daily call performance failed:', err);
    res.status(500).json({ success: false, message: 'Could not load the daily call performance.' });
  }
});

// Team call log — every call by the visible BDEs. Declared before /:adminId.
router.get('/calls', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const { by, result, q, page, limit } = req.query;
    const data = await teamCalls(req.user, range, { by, result, q, page, limit });
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
    const { q, page, limit } = req.query;
    const data = await memberDetail(req.user, req.params.adminId, { q, page, limit });
    if (!data) return res.status(404).json({ success: false, message: 'This person is not in your team.' });
    res.json({ success: true, range, asOf: new Date(), ...data });
  } catch (err) {
    logger.error('Team member performance failed:', err);
    res.status(500).json({ success: false, message: 'Could not load this team member.' });
  }
});

module.exports = router;
module.exports.rangeFrom = rangeFrom;
