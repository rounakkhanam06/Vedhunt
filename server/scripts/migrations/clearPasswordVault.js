/**
 * Clears passwords that people chose themselves from the HR "password vault"
 * (Employee.tempPassword). Until Oct 2026 the Admin panel's forgot / change /
 * first-login password flows copied the new password there in plain text,
 * where anyone who could open the Employees page could read it.
 *
 * Only vault entries whose login no longer has a temporary password are
 * cleared — admin-issued temporary passwords (still unchanged) stay, since
 * that is what the vault is for. Nothing else is touched. No copy of the
 * erased values is kept anywhere (keeping one would recreate the problem);
 * the affected employee IDs are recorded in Settings
 * ('password_vault_cleanup'), so the forced reset below knows whom to ask.
 *
 *   node scripts/migrations/clearPasswordVault.js                 # report only
 *   node scripts/migrations/clearPasswordVault.js --apply         # erase
 *   node scripts/migrations/clearPasswordVault.js --force-reset   # after deploying the fix:
 *       make those people choose a new password at their next login
 *       (their old one may have been seen)
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');
const forceReset = process.argv.includes('--force-reset');
const KEY = 'password_vault_cleanup';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const employees = db.collection('employees');
  const admins = db.collection('admins');
  const settings = db.collection('settings');

  if (forceReset) {
    const record = await settings.findOne({ key: KEY });
    const adminIds = (record?.value?.affected || []).map((a) => a.adminId);
    if (!adminIds.length) {
      console.log('Nothing recorded — run --apply first.');
    } else {
      const r = await admins.updateMany({ _id: { $in: adminIds } }, { $set: { isTemporaryPassword: true }, $unset: { refreshToken: 1 } });
      await settings.updateOne({ key: KEY }, { $set: { 'value.forcedResetAt': new Date() } });
      console.log(`${r.modifiedCount} login(s) must now choose a new password at their next sign-in.`);
    }
    await mongoose.disconnect();
    return;
  }

  const stored = await employees.find({ tempPassword: { $nin: [null, ''] } }, { projection: { adminId: 1, employeeId: 1 } }).toArray();
  const logins = await admins.find({ _id: { $in: stored.map((e) => e.adminId).filter(Boolean) } }, { projection: { isTemporaryPassword: 1 } }).toArray();
  const stillTemporary = new Set(logins.filter((a) => a.isTemporaryPassword).map((a) => String(a._id)));
  const chosen = stored.filter((e) => !stillTemporary.has(String(e.adminId)));

  console.log(`${stored.length} stored password(s): ${stored.length - chosen.length} still temporary (kept), ${chosen.length} chosen by the person (to erase).`);
  for (const e of chosen) console.log(`  ${e.employeeId}`);

  if (!apply) {
    console.log(chosen.length ? '\nRe-run with --apply to erase them.' : '\nNothing to erase.');
  } else if (chosen.length) {
    const r = await employees.updateMany({ _id: { $in: chosen.map((e) => e._id) } }, { $unset: { tempPassword: 1 } });
    await settings.updateOne(
      { key: KEY },
      { $set: { value: { clearedAt: new Date(), affected: chosen.map((e) => ({ employeeId: e.employeeId, adminId: e.adminId })) } } },
      { upsert: true },
    );
    console.log(`\nErased ${r.modifiedCount}. Affected employee IDs recorded in Settings '${KEY}'.`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
