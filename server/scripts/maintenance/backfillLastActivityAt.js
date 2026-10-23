/**
 * One-off backfill: set lastActivityAt on leads last worked before that field
 * existed — their newest history entry written by a person, or failing that
 * their newest call. Lets the admin "Last activity" column sort legacy leads
 * properly (the Employee Portal list already falls back on its own).
 *
 * Dry run by default (prints the count); --apply writes. Safe to re-run — it
 * only fills leads still missing lastActivityAt and never touches any other
 * field.
 *
 *   node server/scripts/maintenance/backfillLastActivityAt.js           # dry run
 *   node server/scripts/maintenance/backfillLastActivityAt.js --apply
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

// History entries a person wrote (not the capture/import/cross-assign ones)
const personEntries = {
  $filter: {
    input: { $ifNull: ['$pipelineHistory', []] },
    cond: { $not: { $regexMatch: { input: { $ifNull: ['$$this.status', ''] }, regex: /^(New|Updated via import|Cross-assigned to .*|Cross-assignment removed: .*)$/ } } },
  },
};

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);
  // Raw driver, same as leadLifecycle.js — some legacy leads have a String _id.
  const leads = mongoose.connection.db.collection('leads');
  const filter = {
    lastActivityAt: null,
    $or: [{ 'callLogs.0': { $exists: true } }, { lastCallAt: { $ne: null } }, { 'pipelineHistory.1': { $exists: true } }],
  };
  const candidates = await leads.countDocuments(filter);
  if (!apply) {
    console.log(`Dry run: ${candidates} lead(s) would get lastActivityAt. Re-run with --apply to write.`);
  } else {
    const result = await leads.updateMany(filter, [{
      $set: {
        lastActivityAt: { $ifNull: [{ $max: { $map: { input: personEntries, in: '$$this.date' } } }, '$lastCallAt', { $max: '$callLogs.callDate' }] },
      },
    }]);
    console.log(`Backfilled lastActivityAt on ${result.modifiedCount} of ${candidates} lead(s).`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
