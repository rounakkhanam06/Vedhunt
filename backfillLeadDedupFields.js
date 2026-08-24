/**
 * One-off backfill: populate phoneNormalized / altPhoneNormalized /
 * emailNormalized on every existing Lead so duplicate-lead detection (added
 * in server/services/leadDedup.js) can match new submissions against leads
 * that were saved before those fields existed.
 *
 * Safe to re-run — it only ever recomputes the normalized copies from the
 * existing phone/altPhone/email, it never touches anything else.
 *
 *   node backfillLeadDedupFields.js
 */
require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const Lead = require('./server/models/Lead');
const { normalizePhone, normalizeEmail } = require('./server/utils/normalize');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const leads = await Lead.find({}).select('phone altPhone email phoneNormalized altPhoneNormalized emailNormalized');
  console.log(`Found ${leads.length} lead(s). Backfilling normalized contact fields...`);

  let updated = 0;
  for (const lead of leads) {
    const phoneNormalized = normalizePhone(lead.phone);
    const altPhoneNormalized = normalizePhone(lead.altPhone);
    const emailNormalized = normalizeEmail(lead.email);

    if (
      lead.phoneNormalized === phoneNormalized &&
      lead.altPhoneNormalized === altPhoneNormalized &&
      lead.emailNormalized === emailNormalized
    ) {
      continue;
    }

    await Lead.updateOne(
      { _id: lead._id },
      { $set: { phoneNormalized, altPhoneNormalized, emailNormalized } }
    );
    updated++;
  }

  console.log(`Done. Updated ${updated} of ${leads.length} lead(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
