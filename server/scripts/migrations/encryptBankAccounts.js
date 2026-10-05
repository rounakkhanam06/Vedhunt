/**
 * Encrypts employee bank account numbers that were saved in plain text
 * before encryption at rest was introduced (services/bankDetails.js).
 * Idempotent — already-encrypted values are skipped. Dry run by default.
 *
 *   node scripts/migrations/encryptBankAccounts.js            # report only
 *   node scripts/migrations/encryptBankAccounts.js --apply    # encrypt
 *
 * Take a backup first (scripts/migrations/backupDatabase.js), and run with
 * the same ENCRYPTION_KEY the server uses.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { encryptAccount } = require('../../services/bankDetails');

const ENCRYPTED = /^[0-9a-f]{32}:[0-9a-f]+$/i;
const apply = process.argv.includes('--apply');

(async () => {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY is not set — refusing to run (the server would not be able to decrypt).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('employees');
  const cursor = col.find({ 'bankDetails.accountNumber': { $nin: [null, ''] } }, { projection: { 'bankDetails.accountNumber': 1, employeeId: 1 } });

  let plain = 0;
  let done = 0;
  for await (const emp of cursor) {
    const n = emp.bankDetails.accountNumber;
    if (ENCRYPTED.test(n)) continue;
    plain++;
    if (apply) {
      await col.updateOne({ _id: emp._id }, { $set: { 'bankDetails.accountNumber': encryptAccount(n) } });
      done++;
    }
  }
  console.log(apply ? `Encrypted ${done} account number(s).` : `${plain} plain-text account number(s) found. Re-run with --apply to encrypt them.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
