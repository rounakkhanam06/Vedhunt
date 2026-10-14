// My Call Log — a BDE's own calls, mounted at /ess/my-calls by
// employeePortalRoutes.js. Always scoped to the signed-in user: there is no
// way to ask for someone else's calls here (managers use /ess/team-performance).
const express = require('express');
const { myCalls, myCallSummary } = require('../services/teamPerformance');
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

module.exports = router;
