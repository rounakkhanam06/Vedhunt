// Per-client campaign list (models/Campaign.js). Campaigns named in the daily ad data are
// brought in automatically — upserted on client + platform + campaign key, so running the sync
// any number of times never creates a duplicate — with no status until the team sets one.
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const AdPerformance = require('../models/AdPerformance');

const { STATUSES } = Campaign;
const keyOf = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Add every campaign in the ad data (for these clients, or all) that is not on the list yet. */
async function syncFromAdData(clientIds) {
  const match = clientIds ? { client_ref: { $in: clientIds.map(oid) } } : {};
  const found = await AdPerformance.aggregate([
    { $match: match },
    { $sort: { day: -1 } },
    { $group: {
      _id: { client: '$client_ref', platform: '$platform', key: '$campaignKey' },
      name: { $first: '$campaignName' },
      campaignId: { $first: '$campaignId' },
    } },
  ]);
  if (!found.length) return 0;
  const res = await Campaign.bulkWrite(found.map((f) => ({
    updateOne: {
      filter: { client_ref: f._id.client, platform: f._id.platform, campaignKey: f._id.key },
      update: { $setOnInsert: {
        client_ref: f._id.client, platform: f._id.platform, campaignKey: f._id.key,
        name: f.name, ...(f.campaignId && { campaignId: f.campaignId }), status: null, source: 'ad-data',
      } },
      upsert: true,
    },
  })), { ordered: false });
  return res.upsertedCount || 0;
}

/** A client's campaigns with their spend and last day in the ad data. */
async function listCampaigns(clientId) {
  await syncFromAdData([clientId]);
  const [campaigns, spend] = await Promise.all([
    Campaign.find({ client_ref: clientId }).sort({ platform: 1, name: 1 }).lean(),
    AdPerformance.aggregate([
      { $match: { client_ref: oid(clientId) } },
      { $group: { _id: { platform: '$platform', key: '$campaignKey' }, spend: { $sum: '$spend' }, lastDay: { $max: '$day' }, days: { $sum: 1 } } },
    ]),
  ]);
  const usage = new Map(spend.map((s) => [`${s._id.platform}|${s._id.key}`, s]));
  return campaigns.map((c) => {
    const u = usage.get(`${c.platform}|${c.campaignKey}`);
    return { ...c, spend: u ? Math.round(u.spend * 100) / 100 : 0, lastDay: u?.lastDay || null, adDays: u?.days || 0 };
  });
}

/** Add a campaign by hand (before any ad data exists). Refuses a duplicate. */
async function addCampaign(clientId, input, user, userName) {
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!name) return { ok: false, status: 400, message: 'Enter the campaign name.' };
  if (!Campaign.schema.path('platform').enumValues.includes(input?.platform)) return { ok: false, status: 400, message: 'Choose the platform.' };
  const status = input?.status ?? null;
  if (status !== null && !STATUSES.includes(status)) return { ok: false, status: 400, message: 'Status must be Active, Paused or Ended.' };
  try {
    const row = await Campaign.create({
      client_ref: clientId, platform: input.platform, name, campaignKey: keyOf(name),
      campaignId: String(input?.campaignId || '').trim().slice(0, 100) || undefined,
      status, source: 'manual',
      ...(status && { statusUpdatedBy: user, statusUpdatedByName: userName, statusUpdatedAt: new Date() }),
    });
    return { ok: true, campaign: row };
  } catch (err) {
    if (err.code === 11000) return { ok: false, status: 409, message: `${input.platform} already has a campaign called "${name}" for this client.` };
    throw err;
  }
}

/** Set Active / Paused / Ended (or null to clear). */
async function setStatus(clientId, campaignId, status, user, userName) {
  if (status !== null && !STATUSES.includes(status)) return { ok: false, status: 400, message: 'Status must be Active, Paused or Ended.' };
  if (!mongoose.isValidObjectId(campaignId)) return { ok: false, status: 404, message: 'Campaign not found' };
  const before = await Campaign.findOne({ _id: campaignId, client_ref: clientId }).lean();
  if (!before) return { ok: false, status: 404, message: 'Campaign not found' };
  const campaign = await Campaign.findByIdAndUpdate(campaignId, { $set: {
    status, statusUpdatedBy: user, statusUpdatedByName: userName, statusUpdatedAt: new Date(),
  } }, { returnDocument: 'after' }).lean();
  return { ok: true, campaign, before };
}

/** { live, needsStatus } counts for these clients (after bringing in any new campaigns). */
async function campaignCounts(clientIds) {
  await syncFromAdData(clientIds);
  const rows = await Campaign.aggregate([
    { $match: { client_ref: { $in: clientIds.map(oid) } } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id ?? 'none', r.n]));
  return { live: by.Active || 0, paused: by.Paused || 0, ended: by.Ended || 0, needsStatus: by.none || 0 };
}

module.exports = { syncFromAdData, listCampaigns, addCampaign, setStatus, campaignCounts, keyOf, STATUSES };
