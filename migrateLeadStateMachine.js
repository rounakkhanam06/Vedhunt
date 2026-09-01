/**
 * One-off backfill for the Sales Lifecycle State Machine rollout:
 *
 *  - interestLevel 'Asked to Call Later' (a call outcome, not an interest
 *    level under the new model) moves to notConnectedReason + connected:'No'.
 *  - interestLevel 'Hot' is renamed to the new label 'Hot Lead'.
 *  - Any notConnectedReason / notConvertedReason that isn't in the new
 *    controlled lists is preserved verbatim in `remark` (never silently
 *    dropped) and the field itself is cleared (or bucketed to 'Other' for
 *    notConvertedReason, which has an 'Other' catch-all).
 *  - firstCallAt is backfilled from callDate where present.
 *
 * Safe to re-run — every step only touches leads that still have the old
 * shape, so a second run is a no-op.
 *
 *   node migrateLeadStateMachine.js
 */
require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const Lead = require('./server/models/Lead');
const { NOT_CONNECTED_REASONS, LOST_DROPPED_REASONS } = require('./server/utils/leadStateMachine');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Migrating leads to the new Sales Lifecycle State Machine shape...');

  // 1. 'Asked to Call Later' moves from interestLevel to notConnectedReason.
  const askedToCallLater = await Lead.updateMany(
    { interestLevel: 'Asked to Call Later' },
    { $set: { notConnectedReason: 'Asked to Call Later', connected: 'No' }, $unset: { interestLevel: '' } }
  );
  console.log(`Moved ${askedToCallLater.modifiedCount} lead(s): interestLevel 'Asked to Call Later' -> notConnectedReason.`);

  // 2. 'Hot' -> 'Hot Lead'.
  const hotRenamed = await Lead.updateMany({ interestLevel: 'Hot' }, { $set: { interestLevel: 'Hot Lead' } });
  console.log(`Renamed ${hotRenamed.modifiedCount} lead(s): interestLevel 'Hot' -> 'Hot Lead'.`);

  // 3. Free-text notConnectedReason values outside the new controlled list.
  const staleNotConnected = await Lead.find({
    notConnectedReason: { $nin: [...NOT_CONNECTED_REASONS, '', null] }
  }).select('notConnectedReason remark');
  for (const lead of staleNotConnected) {
    const note = `[Legacy not-connected reason] ${lead.notConnectedReason}`;
    await Lead.updateOne(
      { _id: lead._id },
      { $set: { remark: lead.remark ? `${lead.remark}\n${note}` : note }, $unset: { notConnectedReason: '' } }
    );
  }
  console.log(`Preserved and cleared ${staleNotConnected.length} non-conforming notConnectedReason value(s) into remark.`);

  // 4. Free-text notConvertedReason values outside the new controlled list ->
  //    bucketed as 'Other' (which the list already supports as a catch-all).
  const staleNotConverted = await Lead.find({
    notConvertedReason: { $nin: [...LOST_DROPPED_REASONS, '', null] }
  }).select('notConvertedReason remark');
  for (const lead of staleNotConverted) {
    const note = `[Legacy lost/dropped reason] ${lead.notConvertedReason}`;
    await Lead.updateOne(
      { _id: lead._id },
      { $set: { remark: lead.remark ? `${lead.remark}\n${note}` : note, notConvertedReason: 'Other' } }
    );
  }
  console.log(`Bucketed ${staleNotConverted.length} non-conforming notConvertedReason value(s) into 'Other' (original preserved in remark).`);

  // 5. Backfill firstCallAt from callDate for leads that already have call history.
  const firstCallBackfilled = await Lead.updateMany(
    { firstCallAt: { $exists: false }, callDate: { $exists: true, $ne: null } },
    [{ $set: { firstCallAt: '$callDate' } }]
  );
  console.log(`Backfilled firstCallAt for ${firstCallBackfilled.modifiedCount} lead(s).`);

  console.log('Migration complete.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
