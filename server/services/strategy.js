// Campaign strategy versions (Client Portal CRM §3.2).
const CampaignStrategy = require('../models/CampaignStrategy');

const TEXT_FIELDS = ['objective', 'targetAudience', 'adStrategySummary', 'keyDifferentiator', 'specialInstructions', 'competitorReference'];

// The only fields a client may ever see
const CLIENT_FIELDS = ['objective', 'targetAudience', 'adStrategySummary', 'keyDifferentiator', 'specialInstructions'];

const clean = (v) => String(v ?? '').trim();

/** Which strategy fields differ between two versions (so the history can say what changed). */
function changedFields(prev, next) {
  return TEXT_FIELDS.filter((f) => clean(prev?.[f]) !== clean(next?.[f]));
}

/** What the client is allowed to see of a version — never internal notes or authorship details. */
const clientView = (doc) => ({
  version: doc.version,
  sharedAt: doc.sharedAt,
  updatedAt: doc.updatedAt,
  ...Object.fromEntries(CLIENT_FIELDS.map((f) => [f, doc[f] || ''])),
});

/**
 * Save the next version. Refuses a save that changes nothing, so the history
 * isn't padded with identical versions.
 * @returns { ok: true, doc } | { ok: false, status, message }
 */
async function saveNewVersion(clientId, input, author) {
  const latest = await CampaignStrategy.findOne({ client_ref: clientId }).sort({ version: -1 }).lean();
  const next = Object.fromEntries(TEXT_FIELDS.map((f) => [f, clean(input?.[f])]));
  if (!TEXT_FIELDS.some((f) => next[f])) return { ok: false, status: 400, message: 'Add at least one strategy field before saving.' };
  if (latest && changedFields(latest, next).length === 0) {
    return { ok: false, status: 400, message: 'Nothing has changed since the latest version.' };
  }
  const name = [author.firstName, author.lastName].filter(Boolean).join(' ').trim() || author.email;
  try {
    const doc = await CampaignStrategy.create({
      client_ref: clientId,
      version: (latest?.version || 0) + 1,
      ...next,
      changeNote: clean(input?.changeNote).slice(0, 1000),
      author: author._id,
      authorName: name,
    });
    return { ok: true, doc, previous: latest || null };
  } catch (err) {
    // Two people saving at once collide on the unique (client, version) index
    if (err.code === 11000) return { ok: false, status: 409, message: 'Someone else just saved a new version. Reload and try again.' };
    throw err;
  }
}

/** The newest version the client may see, or null. */
const latestSharedFor = (clientId) =>
  CampaignStrategy.findOne({ client_ref: clientId, sharedWithClient: true }).sort({ version: -1 }).lean();

module.exports = { TEXT_FIELDS, CLIENT_FIELDS, changedFields, clientView, saveNewVersion, latestSharedFor };
