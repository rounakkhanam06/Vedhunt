// My Call Log — a BDE's own calls, mounted at /ess/my-calls by
// employeePortalRoutes.js. Always scoped to the signed-in user: there is no
// way to ask for someone else's calls here (managers use /ess/team-performance).
const express = require('express');
const { myCalls, myCallSummary, myDaily, MAX_DAILY_DAYS } = require('../services/teamPerformance');
const { leadStatusBoard, pendingCallBoard, leadsFor } = require('../services/leadBoards');

// A BD's own leads, and separately the leads shared with them
const myScope = async (user) => ({ self: user._id });
const { rangeFrom } = require('./teamPerformanceRoutes');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    res.json({ success: true, range, ...(await myCallSummary(req.user, range)) });
  } catch (err) {
    logger.error('My call summary failed:', err);
    res.status(500).json({ success: false, message: 'Could not load your calls.' });
  }
});

router.get('/calls', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const { result, q, page, limit } = req.query;
    res.json({ success: true, range, ...(await myCalls(req.user, range, { result, q, page, limit })) });
  } catch (err) {
    logger.error('My call log failed:', err);
    res.status(500).json({ success: false, message: 'Could not load your call log.' });
  }
});


// Lead Status / Pending Call tables and their drill-down (services/leadBoards.js)
router.get('/lead-status', async (req, res) => {
  try {
    res.json({ success: true, asOf: new Date(), ...(await leadStatusBoard(await myScope(req.user))) });
  } catch (err) {
    logger.error('My lead status failed:', err);
    res.status(500).json({ success: false, message: 'Could not load the lead status table.' });
  }
});

router.get('/pending-calls', async (req, res) => {
  try {
    res.json({ success: true, asOf: new Date(), ...(await pendingCallBoard(await myScope(req.user))) });
  } catch (err) {
    logger.error('My pending calls failed:', err);
    res.status(500).json({ success: false, message: 'Could not load pending calls.' });
  }
});

router.get('/board-leads', async (req, res) => {
  try {
    const { owner, bucket, day } = req.query;
    const leads = await leadsFor(await myScope(req.user), { owner, bucket, day });
    if (!leads) return res.status(404).json({ success: false, message: 'Not in your view.' });
    res.json({ success: true, leads });
  } catch (err) {
    logger.error('My board leads failed:', err);
    res.status(500).json({ success: false, message: 'Could not load these leads.' });
  }
});

// The BDE's own daily call performance (same shape as the team breakdown)
router.get('/daily', async (req, res) => {
  try {
    const range = rangeFrom(req, res);
    if (!range) return;
    const data = await myDaily(req.user, range);
    if (!data) return res.status(400).json({ success: false, message: `Pick ${MAX_DAILY_DAYS} days or fewer for the daily breakdown.` });
    res.json({ success: true, range, ...data });
  } catch (err) {
    logger.error('My daily call performance failed:', err);
    res.status(500).json({ success: false, message: 'Could not load your daily call performance.' });
  }
});

module.exports = router;
