/**
 * One-off backfill: pull leads Facebook is holding from the gap window
 * (server was 23 days behind, and the token was likely dead for the last
 * ~6 days of that), which the regular 10-min poller's 24h lookback will
 * never reach on its own.
 *
 * Run ONCE on the server, AFTER git pull + restart AND after the token has
 * been replaced with a working one:
 *
 *   node backfillLeads.js
 *
 * Safe to re-run — saveFacebookLead skips anything already stored.
 */
require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const { syncFacebookLeads } = require('./server/services/leadSync');

const LOOKBACK_DAYS = 10; // covers the outage with margin

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`Backfilling Facebook/Instagram leads from the last ${LOOKBACK_DAYS} days...`);
  const result = await syncFacebookLeads({
    lookbackHours: LOOKBACK_DAYS * 24,
    notify: false, // don't email HR for every backfilled lead, only new live ones going forward
  });

  console.log('Result:', result);
  if (result.tokenExpired) {
    console.log('\nToken is still invalid — fix FB_PAGE_ACCESS_TOKEN and re-run this script.');
  } else {
    console.log(`\nImported ${result.imported} lead(s), ${result.skipped} already present, across ${result.forms} active form(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
