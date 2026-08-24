/**
 * One-off diagnostic: why have no Facebook/Instagram leads arrived recently?
 *
 * Run this ON THE SERVER (same box/env as production, so it has the real
 * FB_PAGE_ACCESS_TOKEN and MONGODB_URI):
 *
 *   node checkLeadSync.js
 *
 * It checks, in order:
 *   1. Is FB_PAGE_ACCESS_TOKEN valid? (calls Graph API /me)
 *   2. What Instant Forms does Facebook say are ACTIVE on the page?
 *   3. For each form, what's the newest lead Facebook actually has?
 *   4. What's the newest lead of that platform sitting in our own DB?
 *
 * If Facebook has recent leads but our DB doesn't -> the sync pipeline is
 * broken/not running even though the token is fine (deploy/cron problem).
 * If Facebook has nothing recent either -> it's not a code bug, Facebook
 * itself has nothing new to give us (ads paused, form archived, etc).
 * If step 1 fails with code 190 -> the token is expired, which explains
 * BOTH the webhook and the poller going dark at the same time.
 */
require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const Lead = require('./server/models/Lead');
const LeadForm = require('./server/models/LeadForm');
const { GRAPH, LEAD_FIELDS } = require('./server/services/facebookLeads');
const { fetchActiveForms } = require('./server/services/leadSync');

const token = process.env.FB_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID || '108804051644644';

async function main() {
  console.log('--- Facebook Lead Sync Diagnostic ---\n');

  if (!token) {
    console.log('FAIL: FB_PAGE_ACCESS_TOKEN is not set in this environment. Stopping here.');
    process.exit(1);
  }

  // 1. Token validity
  const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${token}`);
  const me = await meRes.json();
  if (me.error) {
    console.log(`FAIL: FB_PAGE_ACCESS_TOKEN is INVALID — [${me.error.code}] ${me.error.message}`);
    console.log('This alone explains both the webhook and the poller producing zero leads.');
    console.log('Fix: generate a new Page Access Token in Meta Business Suite and update it in the server .env, then restart the app.');
    process.exit(1);
  }
  console.log(`OK: token is valid, resolves to page/user "${me.name}" (${me.id})\n`);

  // 2. Active forms per Facebook
  const forms = await fetchActiveForms(token);
  console.log(`Facebook reports ${forms.length} ACTIVE lead form(s) on page ${PAGE_ID}:`);
  forms.forEach((f) => console.log(`  - ${f.name} (${f.id})`));
  if (!forms.length) {
    console.log('\nNo active forms at all — check whether the forms/ads were archived or the wrong page ID is configured (FB_PAGE_ID).');
  }
  console.log('');

  // 3. Newest lead per form, straight from Facebook
  for (const form of forms) {
    const url = `${GRAPH}/${form.id}/leads?fields=${LEAD_FIELDS}&limit=1&access_token=${token}`;
    const res = await (await fetch(url)).json();
    if (res.error) {
      console.log(`  ${form.name}: ERROR [${res.error.code}] ${res.error.message}`);
      continue;
    }
    const newest = res.data?.[0];
    console.log(`  ${form.name}: newest lead on Facebook = ${newest ? newest.created_time : '(none ever)'}`);
  }
  console.log('');

  // 4. Newest lead in our DB, and LeadForm sync bookkeeping
  await mongoose.connect(process.env.MONGODB_URI);

  const newestFbLead = await Lead.findOne({ platform: { $in: ['Facebook', 'Instagram'] } })
    .sort({ createdAt: -1 })
    .select('fullName platform createdAt fbFormName');
  console.log(
    newestFbLead
      ? `Newest FB/IG lead in OUR DB: ${newestFbLead.createdAt.toISOString()} — ${newestFbLead.fullName} (${newestFbLead.platform}, form: ${newestFbLead.fbFormName})`
      : 'Newest FB/IG lead in OUR DB: none found at all'
  );

  const leadForms = await LeadForm.find({}).select('name lastLeadAt leadCount');
  console.log('\nLeadForm registry (our DB bookkeeping):');
  leadForms.forEach((f) =>
    console.log(`  - ${f.name || '(unnamed)'}: leadCount=${f.leadCount}, lastLeadAt=${f.lastLeadAt ? f.lastLeadAt.toISOString() : 'never'}`)
  );

  await mongoose.disconnect();
  console.log('\n--- Done ---');
}

main().catch((err) => {
  console.error('Diagnostic script crashed:', err);
  process.exit(1);
});
