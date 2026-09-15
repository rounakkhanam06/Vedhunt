/**
 * Full database dump/restore in canonical Extended JSON.
 *
 * Canonical EJSON preserves exact BSON types, which matters here: a string
 * `_id` and an ObjectId `_id` with the same hex are different values, and
 * a backup that blurs them cannot undo fixStringObjectIds.js.
 *
 *   node scripts/migrations/backupDatabase.js
 *   node scripts/migrations/backupDatabase.js --restore <dir> --confirm
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const BACKUP_ROOT = path.resolve(__dirname, '../../backups');
const EJSON_OPTS = { relaxed: false };

const restoreIdx = process.argv.indexOf('--restore');
const RESTORE_DIR = restoreIdx === -1 ? null : process.argv[restoreIdx + 1];
const CONFIRMED = process.argv.includes('--confirm');

const connect = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  return client;
};

const backup = async (client) => {
  const db = client.db();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUP_ROOT, stamp);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`Dumping ${db.databaseName} -> ${dir}\n`);

  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), collections: {} };
  let grandTotal = 0;

  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, EJSON_OPTS));

    const stringIds = docs.filter((d) => typeof d._id === 'string').length;
    manifest.collections[name] = { count: docs.length, stringIds };
    grandTotal += docs.length;
    console.log(`  ${name.padEnd(24)} ${String(docs.length).padStart(5)}${stringIds ? `  (${stringIds} string _id)` : ''}`);
  }

  manifest.totalDocuments = grandTotal;
  fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n${grandTotal} documents in ${names.length} collections.`);
  console.log(`Restore with:\n  node scripts/migrations/backupDatabase.js --restore "${dir}" --confirm`);
  return dir;
};

const restore = async (client, dir) => {
  if (!fs.existsSync(dir)) throw new Error(`No such backup directory: ${dir}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));

  if (!CONFIRMED) {
    console.log(`Would restore ${manifest.totalDocuments} documents into ${manifest.database}.`);
    console.log('Every collection in the backup is DROPPED and rewritten. Re-run with --confirm.');
    return;
  }

  const db = client.db();
  console.log(`Restoring ${dir} -> ${db.databaseName}\n`);

  for (const [name, meta] of Object.entries(manifest.collections)) {
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'), EJSON_OPTS);
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });

    const now = await db.collection(name).countDocuments();
    const ok = now === meta.count;
    console.log(`  ${name.padEnd(24)} ${String(now).padStart(5)}/${meta.count} ${ok ? '' : ' MISMATCH'}`);
  }
  console.log('\nRestore complete.');
};

const run = async () => {
  const client = await connect();
  try {
    if (RESTORE_DIR) await restore(client, RESTORE_DIR);
    else await backup(client);
  } finally {
    await client.close();
  }
};

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
