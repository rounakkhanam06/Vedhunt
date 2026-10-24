/**
 * One-off backfill for the "action taken" rule (utils/leadActivity.js): stamp
 * firstContactAt on leads whose only activity was a note, remark, WhatsApp
 * message or shared proposal. Without it those leads would drop back into Raw
 * Leads and the Pending Call board. Leads with a call field, a connected
 * outcome or a Qualified+ stage are already treated as actioned and are not
 * touched.
 *
 * DRY RUN by default — it only reports. server/.env is the production database,
 * so --apply first writes a backup of every lead it will change to
 * server/scripts/maintenance/backups/ and then sets only firstContactAt /
 * firstContactBy / firstContactType (nothing else).
 *
 *   node server/scripts/maintenance/backfillFirstContact.js           # report
 *   node server/scripts/maintenance/backfillFirstContact.js --apply   # write
 *
 * Safe to re-run: leads that already have firstContactAt are skipped.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const LeadNote = require('../../models/LeadNote');
const { rawLeadFilter, isActionType } = require('../../utils/leadActivity');

const APPLY = process.argv.includes('--apply');

/** Earliest qualifying event for one lead: { at, by, type } or null. */
function earliestAction(lead, firstNote) {
  const found = [];
  if (firstNote) found.push({ at: firstNote.createdAt, by: firstNote.author, type: 'Note' });
  for (const h of lead.pipelineHistory || []) {
    if (isActionType(h.status) && h.date) found.push({ at: h.date, by: h.updatedBy || null, type: h.status });
  }
  if (lead.firstActionAt && isActionType(lead.firstActionType)) {
    found.push({ at: lead.firstActionAt, by: lead.firstActionBy || null, type: lead.firstActionType });
  }
  if (lead.lastActivityAt && isActionType(lead.lastActivityType)) {
    found.push({ at: lead.lastActivityAt, by: null, type: lead.lastActivityType });
  }
  found.sort((a, b) => new Date(a.at) - new Date(b.at));
  return found[0] || null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Leads that are still Raw under the new rule
  const candidates = await Lead.find(rawLeadFilter()).lean();
  const firstNotes = await LeadNote.aggregate([
    { $match: { lead: { $in: candidates.map((l) => l._id) } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$lead', createdAt: { $first: '$createdAt' }, author: { $first: '$author' } } },
  ]);
  const noteBy = new Map(firstNotes.map((n) => [String(n._id), n]));

  const changes = [];
  for (const lead of candidates) {
    const action = earliestAction(lead, noteBy.get(String(lead._id)));
    if (action) changes.push({ lead, action });
  }

  const byType = changes.reduce((acc, c) => ({ ...acc, [c.action.type]: (acc[c.action.type] || 0) + 1 }), {});
  console.log(`${candidates.length} lead(s) are Raw under the new rule; ${changes.length} of them have a recorded note / remark / WhatsApp / proposal.`);
  console.log('By first action:', byType);
  console.log(`${candidates.length - changes.length} lead(s) stay in Raw (no qualifying action found).`);
  changes.slice(0, 10).forEach(({ lead, action }) => console.log(`  e.g. ${lead.leadId || lead._id}  ${action.type}  ${new Date(action.at).toISOString()}`));

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to stamp firstContactAt.');
  } else if (changes.length) {
    const dir = path.resolve(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `backfillFirstContact-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(changes.map(({ lead }) => ({
      _id: lead._id, leadId: lead.leadId, firstContactAt: lead.firstContactAt ?? null, firstContactBy: lead.firstContactBy ?? null, firstContactType: lead.firstContactType ?? '',
    })), null, 2));
    console.log(`\nBackup of ${changes.length} lead(s) written to ${file}`);

    const result = await Lead.collection.bulkWrite(changes.map(({ lead, action }) => ({
      updateOne: {
        filter: { _id: lead._id, firstContactAt: null },
        update: { $set: { firstContactAt: new Date(action.at), firstContactBy: action.by, firstContactType: action.type } },
      },
    })));
    console.log(`Stamped ${result.modifiedCount} lead(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill crashed:', err);
  process.exit(1);
});
