/**
 * Converts lead date fields stored as ISO strings into real BSON Dates.
 *
 * Lead updates go through the raw driver (services/leadLifecycle.js), which
 * skipped Mongoose's Date casting until normalizeDateFields was added — so
 * nextFollowUpDate & co. were saved as strings. Mongo's $lte/$gte never match
 * a string against a Date, which meant services/followUpEngine.js never sent
 * reminders/overdue alerts for those leads. Empty strings become null.
 *
 * Dry run by default; pass --confirm to write.
 *
 *   node scripts/migrations/fixLeadStringDates.js
 *   node scripts/migrations/fixLeadStringDates.js --confirm
 */
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { LEAD_DATE_FIELDS } = require('../../utils/leadStateMachine');

const CONFIRMED = process.argv.includes('--confirm');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const leads = client.db().collection('leads');

  let changed = 0;
  const invalid = [];

  const query = { $or: LEAD_DATE_FIELDS.map((f) => ({ [f]: { $type: 'string' } })) };
  const cursor = leads.find(query, { projection: Object.fromEntries(LEAD_DATE_FIELDS.map((f) => [f, 1])) });

  for await (const lead of cursor) {
    const set = {};
    for (const field of LEAD_DATE_FIELDS) {
      const value = lead[field];
      if (typeof value !== 'string') continue;
      if (value.trim() === '') {
        set[field] = null;
        continue;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        invalid.push({ _id: lead._id, field, value });
        continue;
      }
      set[field] = date;
    }
    if (!Object.keys(set).length) continue;

    changed++;
    console.log(`${lead._id}: ${Object.keys(set).join(', ')}`);
    if (CONFIRMED) await leads.updateOne({ _id: lead._id }, { $set: set });
  }

  console.log(`\n${changed} lead(s) ${CONFIRMED ? 'updated' : 'would be updated (dry run — pass --confirm to write)'}.`);
  if (invalid.length) {
    console.log(`${invalid.length} unparseable value(s) left untouched:`);
    invalid.forEach((i) => console.log(`  ${i._id} ${i.field} = ${JSON.stringify(i.value)}`));
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
