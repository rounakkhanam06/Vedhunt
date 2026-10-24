/**
 * Moves person-wise CRM grants from the legacy Admin.crmGrants field
 * ({ page, allClients, clients, actions }) to Admin.accessGrants
 * ({ page, actions, scope: { mode, clients } }) — see config/pageAccess.js.
 *
 * Safe to run more than once: only logins that have crmGrants and no
 * accessGrants yet are touched. crmGrants is left in place as a backup (the
 * server ignores it once accessGrants is set), and a JSON copy of every
 * changed login's before/after is written to scripts/migrations/backups/.
 * Until this runs, the server already reads crmGrants as a fallback, so
 * nobody loses access in between. Dry run by default.
 *
 *   node scripts/migrations/migrateCrmGrants.js            # report only
 *   node scripts/migrations/migrateCrmGrants.js --apply    # migrate
 *
 * The backup goes to scripts/migrations/backups/ unless MIGRATION_BACKUP_DIR names
 * another folder (the end-to-end tests use a temporary one so they leave nothing behind).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { fromLegacyCrmGrants } = require('../../config/pageAccess');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('admins');
  const pending = await col.find(
    { 'crmGrants.0': { $exists: true }, accessGrants: { $exists: false } },
    { projection: { email: 1, crmGrants: 1 } },
  ).toArray();

  const changes = [];
  for (const admin of pending) {
    const { value, error } = fromLegacyCrmGrants(admin.crmGrants);
    if (error) {
      console.error(`SKIPPED ${admin.email}: ${error}`);
      continue;
    }
    // Stored as ObjectIds, like the schema does
    const accessGrants = value.map((g) => ({
      ...g,
      scope: g.scope.clients ? { ...g.scope, clients: g.scope.clients.map((id) => new mongoose.Types.ObjectId(id)) } : g.scope,
    }));
    changes.push({ _id: admin._id, email: admin.email, before: admin.crmGrants, after: accessGrants });
    console.log(`${admin.email}: ${admin.crmGrants.length} legacy grant(s) → ${accessGrants.length} access grant(s)`);
    for (const g of accessGrants) {
      console.log(`  ${g.page}: ${g.actions.join('/')} · ${g.scope.mode === 'all' ? 'all clients' : `${g.scope.clients.length} client(s)`}`);
    }
  }

  if (!changes.length) {
    console.log('Nothing to migrate.');
  } else if (!apply) {
    console.log(`\n${changes.length} login(s) to migrate. Re-run with --apply to write them.`);
  } else {
    const dir = process.env.MIGRATION_BACKUP_DIR ? path.resolve(process.env.MIGRATION_BACKUP_DIR) : path.resolve(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `crmGrants-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(changes, null, 2));
    for (const c of changes) {
      // Guarded again so a grant saved from the editor in the meantime is never overwritten
      await col.updateOne({ _id: c._id, accessGrants: { $exists: false } }, { $set: { accessGrants: c.after } });
    }
    console.log(`\nMigrated ${changes.length} login(s). Backup: ${file}`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
