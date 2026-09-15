/**
 * Repairs documents whose `_id` was imported as a BSON string instead of an
 * ObjectId. Mongoose casts `_id` to ObjectId on hydration, so `doc.save()`
 * issues `updateOne({_id: ObjectId(hex)})`, which never matches a string `_id`
 * — every admin update failed with DocumentNotFoundError (500) or, via
 * findByIdAndUpdate returning null, a bogus 404.
 *
 * The hex value is preserved, so existing references keep resolving.
 *
 *   node scripts/migrations/fixStringObjectIds.js           # dry run
 *   node scripts/migrations/fixStringObjectIds.js --apply   # write
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const HEX24 = /^[0-9a-fA-F]{24}$/;
const BACKUP_DIR = path.resolve(__dirname, '../../backups');

// Collections holding data the app does not own — never rewritten.
const SKIP = new Set(['sessions', 'agendaJobs']);

const loadModels = () => {
  const dir = path.resolve(__dirname, '../../models');
  fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .forEach((f) => require(path.join(dir, f)));
};

// Every ObjectId-typed path declared across all models, keyed by collection.
const objectIdPathsByCollection = () => {
  const map = {};
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const paths = [];
    model.schema.eachPath((p, type) => {
      if (p === '_id') return;
      const t = type.instance === 'Array' ? type.caster : type;
      if (t && t.instance === 'ObjectId') paths.push({ path: p, isArray: type.instance === 'Array' });
    });
    if (paths.length) map[model.collection.collectionName] = paths;
  }
  return map;
};

// Replaces a document's _id by removing and reinserting it. Standalone mongod
// has no transactions, so fall back to a bare delete+insert there.
let transactionsSupported = true;
const swap = async (col, oldId, replacement) => {
  if (transactionsSupported) {
    const session = mongoose.connection.getClient().startSession();
    try {
      await session.withTransaction(async () => {
        await col.deleteOne({ _id: oldId }, { session });
        await col.insertOne(replacement, { session });
      });
      return;
    } catch (err) {
      if (!/Transaction numbers|replica set|not supported/i.test(err.message)) throw err;
      transactionsSupported = false;
      console.log('  (transactions unavailable — falling back to plain writes)');
    } finally {
      await session.endSession();
    }
  }
  await col.deleteOne({ _id: oldId });
  await col.insertOne(replacement);
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to ${mongoose.connection.name} — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  loadModels();
  const db = mongoose.connection.db;
  const refPaths = objectIdPathsByCollection();
  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !SKIP.has(n));

  // ── Phase 0: back up everything this script will touch ────────────────────
  const backup = {};
  for (const name of collections) {
    const docs = await db.collection(name).find({ _id: { $type: 'string' } }).toArray();
    if (docs.length) backup[name] = docs;
  }
  const idTotal = Object.values(backup).reduce((n, d) => n + d.length, 0);

  if (APPLY && idTotal) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, `string-ids-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Backed up ${idTotal} documents to ${file}\n`);
  }

  // ── Phase 1: string _id → ObjectId ────────────────────────────────────────
  console.log('--- Phase 1: _id ---');
  let converted = 0;
  let skipped = 0;
  for (const [name, docs] of Object.entries(backup)) {
    const bad = docs.filter((d) => !HEX24.test(d._id));
    if (bad.length) {
      console.log(`  ${name}: SKIPPED — ${bad.length} _id(s) are not 24-char hex`);
      skipped += bad.length;
      continue;
    }
    console.log(`  ${name}: ${docs.length}`);
    if (!APPLY) {
      converted += docs.length;
      continue;
    }
    const col = db.collection(name);
    for (const doc of docs) {
      const replacement = { ...doc, _id: new mongoose.Types.ObjectId(doc._id) };
      // _id is immutable, so the old document has to go first — a unique index
      // on any other field would reject the copy otherwise. That leaves a
      // window where the document exists nowhere, so the pair runs in a
      // transaction where the server supports one.
      await swap(col, doc._id, replacement);
      converted++;
    }
  }
  console.log(`  => ${converted} ${APPLY ? 'converted' : 'to convert'}${skipped ? `, ${skipped} skipped` : ''}\n`);

  // ── Phase 2: ObjectId-typed reference fields holding hex strings ──────────
  console.log('--- Phase 2: reference fields ---');
  let refsFixed = 0;
  for (const [name, paths] of Object.entries(refPaths)) {
    if (!collections.includes(name)) continue;
    for (const { path: field, isArray } of paths) {
      const docs = await db
        .collection(name)
        .find({ [field]: { $type: 'string' } }, { projection: { [field]: 1 } })
        .toArray();
      if (!docs.length) continue;

      const fixable = docs.filter((d) => {
        const v = d[field];
        return isArray ? Array.isArray(v) : HEX24.test(v);
      });
      const unfixable = docs.length - fixable.length;
      console.log(`  ${name}.${field}: ${fixable.length}${unfixable ? ` (${unfixable} not hex, left alone)` : ''}`);
      if (!APPLY) {
        refsFixed += fixable.length;
        continue;
      }
      for (const d of fixable) {
        const raw = d[field];
        const value = isArray
          ? raw.map((v) => (HEX24.test(v) ? new mongoose.Types.ObjectId(v) : v))
          : new mongoose.Types.ObjectId(raw);
        await db.collection(name).updateOne({ _id: d._id }, { $set: { [field]: value } });
        refsFixed++;
      }
    }
  }
  console.log(`  => ${refsFixed} ${APPLY ? 'fixed' : 'to fix'}\n`);

  if (!APPLY) console.log('Dry run only. Re-run with --apply to write.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
