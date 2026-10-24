// Lead Activity — every logged call, one row per call, linked to its lead.
// Shared by the Admin panel / grants (controllers/activityController.js) and
// the Employee Portal (routes/employeePortalRoutes.js); the caller passes the
// leads the viewer may see (`leadMatch`), so the scope rule lives with them.
// Duration and outcome follow utils/callOutcome.js.
const Lead = require('../models/Lead');
const { DURATION_EXPR, callOutcome } = require('../utils/callOutcome');

const CALL_AT = { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] };
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Adds callLogs[i].prevAt = when the call before it was logged (the duration rule needs it). */
const WITH_PREV_AT = {
  $addFields: {
    callLogs: {
      $map: {
        input: { $range: [0, { $size: { $ifNull: ['$callLogs', []] } }] },
        as: 'i',
        in: {
          $mergeObjects: [
            { $arrayElemAt: ['$callLogs', '$$i'] },
            {
              prevAt: {
                $cond: [
                  { $gt: ['$$i', 0] },
                  { $let: { vars: { p: { $arrayElemAt: ['$callLogs', { $subtract: ['$$i', 1] }] } }, in: { $ifNull: ['$$p.loggedAt', '$$p.callDate'] } } },
                  null,
                ],
              },
            },
          ],
        },
      },
    },
  },
};

/**
 * @param leadMatch  leads the viewer may see ({} for everything)
 * @param q          { page, limit, by, result, stage, client, period:{$gte,$lte} }
 */
async function listCallActivity(leadMatch, q) {
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);

  const leadStage = [{ $match: { ...leadMatch, 'callLogs.0': { $exists: true } } }];
  const client = String(q.client || '').trim().slice(0, 100);
  if (client) {
    const re = new RegExp(escapeRegex(client), 'i');
    const or = [{ fullName: re }, { businessName: re }, { email: re }, { leadId: new RegExp(`^${escapeRegex(client)}`, 'i') }];
    const digits = client.replace(/\D/g, '');
    if (digits.length >= 4) or.push({ phone: new RegExp(digits) });
    leadStage.push({ $match: { $or: or } });
  }

  const callMatch = {};
  if (q.result === 'Connected') callMatch['callLogs.connected'] = 'Yes';
  else if (q.result === 'Not Connected') callMatch['callLogs.connected'] = { $ne: 'Yes' };
  if (q.stage && q.stage !== 'All') callMatch.$expr = { $eq: [{ $ifNull: ['$callLogs.leadStage', '$status'] }, q.stage] };
  const period = q.period ? [{ $match: { $expr: { $and: [
    ...(q.period.$gte ? [{ $gte: [CALL_AT, q.period.$gte] }] : []),
    ...(q.period.$lte ? [{ $lte: [CALL_AT, q.period.$lte] }] : []),
  ] } } }] : [];
  const onlyBy = q.by ? [{ $match: { 'callLogs.calledBy': q.by } }] : [];

  const [result] = await Lead.aggregate([
    ...leadStage,
    WITH_PREV_AT,
    { $unwind: '$callLogs' },
    { $match: callMatch },
    ...period,
    {
      $facet: {
        // who made the calls in this view (ignores ?by so the chips stay put)
        perBd: [
          { $group: { _id: '$callLogs.calledBy', calls: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } }, leads: { $addToSet: '$_id' } } },
          { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'admin' } },
          { $project: {
            _id: 0, bdId: '$_id', calls: 1, connected: 1, leads: { $size: '$leads' },
            name: { $let: { vars: { a: { $arrayElemAt: ['$admin', 0] } }, in: { $trim: { input: { $concat: [{ $ifNull: ['$$a.firstName', ''] }, ' ', { $ifNull: ['$$a.lastName', ''] }] } } } } },
            email: { $arrayElemAt: ['$admin.email', 0] },
          } },
          { $sort: { calls: -1 } },
        ],
        data: [
          ...onlyBy,
          { $sort: { 'callLogs.loggedAt': -1, 'callLogs.callDate': -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $lookup: { from: 'admins', localField: 'callLogs.calledBy', foreignField: '_id', as: 'byAdmin' } },
          {
            $project: {
              _id: 0,
              leadId: '$_id',
              leadDisplayId: '$leadId',
              leadName: '$fullName',
              businessName: '$businessName',
              leadPhone: '$phone',
              date: CALL_AT,
              connected: '$callLogs.connected',
              notConnectedReason: '$callLogs.notConnectedReason',
              interestLevel: '$callLogs.interestLevel',
              duration: DURATION_EXPR,
              touchNumber: '$callLogs.touchNumber',
              callType: '$callLogs.callType',
              leadStage: { $ifNull: ['$callLogs.leadStage', '$status'] },
              currentStage: '$status',
              remark: '$callLogs.remark',
              nextAction: {
                date: '$callLogs.nextFollowUpDate',
                actionType: '$callLogs.nextActionType',
                followUpType: '$callLogs.followUpType',
              },
              by: {
                $let: {
                  vars: { a: { $arrayElemAt: ['$byAdmin', 0] } },
                  // firstName/lastName aren't guaranteed on the legacy
                  // admin seed account — email is the display fallback.
                  in: { _id: '$$a._id', firstName: '$$a.firstName', lastName: '$$a.lastName', email: '$$a.email' },
                },
              },
            },
          },
        ],
        totalCount: [...onlyBy, { $count: 'count' }],
        leadCount: [...onlyBy, { $group: { _id: '$_id' } }, { $count: 'count' }],
      },
    },
  ]);

  const total = result?.totalCount?.[0]?.count || 0;
  return {
    data: (result?.data || []).map((row) => {
      const { status, detail } = callOutcome(row);
      return { ...row, outcome: status, outcomeDetail: detail, nextAction: row.nextAction?.date ? row.nextAction : null };
    }),
    total,
    leadCount: result?.leadCount?.[0]?.count || 0,
    perBd: result?.perBd || [],
    totalPages: Math.max(1, Math.ceil(total / limit)),
    currentPage: page,
  };
}

module.exports = { listCallActivity, WITH_PREV_AT, CALL_AT };
