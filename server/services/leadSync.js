const logger = require('../utils/logger');
const Lead = require('../models/Lead');
const { GRAPH, LEAD_FIELDS, saveFacebookLead } = require('./facebookLeads');

const PAGE_ID = process.env.FB_PAGE_ID || '108804051644644';

/**
 * Pull-based safety net for Facebook leads.
 *
 * The webhook is the fast path, but when Facebook stops delivering there is no
 * error to see — leads simply never arrive, and we found out 17 days and 44
 * leads later. Reading leads back from the Graph API needs nothing the webhook
 * does not already need, so this closes that blind spot: worst case a lead is
 * late by one sync interval instead of lost.
 *
 * Idempotent by design. saveFacebookLead skips anything already stored, so
 * overlapping runs and re-scans of the same window are harmless.
 */

const get = async (url) => (await fetch(url)).json();

/** Active Instant Forms on the page. Archived forms cannot receive new leads. */
async function fetchActiveForms(token) {
  const forms = [];
  let url = `${GRAPH}/${PAGE_ID}/leadgen_forms?fields=id,name,status&limit=50&access_token=${token}`;

  while (url) {
    const page = await get(url);
    if (page.error) {
      logger.error(`Lead sync: could not list forms — [${page.error.code}] ${page.error.message}`);
      return forms;
    }
    forms.push(...(page.data || []).filter((f) => f.status === 'ACTIVE'));
    url = page.paging?.next || null;
  }
  return forms;
}

/**
 * @param {number} lookbackHours how far back to consider leads
 * @param {boolean} notify       email the team about each imported lead
 */
async function syncFacebookLeads({ lookbackHours = 24, notify = true } = {}) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    logger.error('Lead sync skipped: FB_PAGE_ACCESS_TOKEN is not set.');
    return { imported: 0, skipped: 0, forms: 0 };
  }

  const since = Date.now() - lookbackHours * 60 * 60 * 1000;
  const forms = await fetchActiveForms(token);
  let imported = 0;
  let skipped = 0;

  for (const form of forms) {
    try {
      const res = await get(
        `${GRAPH}/${form.id}/leads?fields=${LEAD_FIELDS}&limit=100&access_token=${token}`
      );
      if (res.error) {
        // Surface an expired token loudly — it is the failure that silently
        // drops every lead, and the one we have been bitten by twice.
        if (res.error.code === 190) {
          logger.error(
            'Lead sync: FB_PAGE_ACCESS_TOKEN is EXPIRED or INVALID (code 190). ' +
            'No leads can be imported until it is replaced.'
          );
          return { imported, skipped, forms: forms.length, tokenExpired: true };
        }
        logger.warn(`Lead sync: form ${form.name} — [${res.error.code}] ${res.error.message}`);
        continue;
      }

      // Leads come back newest first, so stop once we walk past the window.
      const recent = [];
      for (const fbLead of res.data || []) {
        if (new Date(fbLead.created_time).getTime() < since) break;
        recent.push(fbLead);
      }
      if (!recent.length) continue;

      // One query instead of one per lead — most runs find nothing new.
      const ids = recent.map((l) => l.id);
      const known = new Set(
        (await Lead.find({ fbLeadId: { $in: ids } }).select('fbLeadId').lean()).map((l) => l.fbLeadId)
      );
      const missing = recent.filter((l) => !known.has(l.id));
      skipped += recent.length - missing.length;

      for (const fbLead of missing) {
        try {
          const result = await saveFacebookLead({
            fbLead,
            formId: form.id,
            pageAccessToken: token,
            notify,
            useSubmittedTime: true
          });
          if (result.created) imported++;
          else skipped++;
        } catch (err) {
          logger.error(`Lead sync: failed to save lead ${fbLead.id} from ${form.name}:`, err);
        }
      }
    } catch (err) {
      logger.error(`Lead sync: error processing form ${form.name}:`, err);
    }
  }

  if (imported > 0) {
    logger.warn(
      `Lead sync imported ${imported} lead(s) the webhook did not deliver. ` +
      'If this keeps happening, Facebook webhook delivery is broken.'
    );
  } else {
    logger.info(`Lead sync: nothing new (${skipped} already stored across ${forms.length} active forms).`);
  }

  return { imported, skipped, forms: forms.length };
}

module.exports = { syncFacebookLeads, fetchActiveForms };
