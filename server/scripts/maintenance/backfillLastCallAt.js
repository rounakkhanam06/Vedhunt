/**
 * One-off backfill: set lastCallAt on every lead that was last called before
 * that field existed — its newest callLogs.callDate, or for leads without call
 * logs (call timer only, or imported from the sheet) its callDate.
 * Powers the "Last call" date filters in the admin and Employee Portal lead
 * lists (until then they fall back to callLogs themselves).
 *
 * Safe to re-run — it only fills leads still missing lastCallAt and never
 * touches any other field.
 *
 *   node server/scripts/maintenance/backfillLastCallAt.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  // Raw driver, same as leadLifecycle.js — some legacy leads have a String _id.
  const result = await mongoose.connection.db.collection('leads').updateMany(
    { lastCallAt: null, $or: [{ 'callLogs.0': { $exists: true } }, { callDate: { $ne: null } }] },
    [{ $set: { lastCallAt: { $ifNull: [{ $max: '$callLogs.callDate' }, '$callDate'] } } }]
  );
  console.log(`Backfilled lastCallAt on ${result.modifiedCount} lead(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
