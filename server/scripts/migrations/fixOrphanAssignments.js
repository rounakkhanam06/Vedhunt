/**
 * Cleans up fallout from BD accounts that were deleted without being removed
 * from AssignmentRule.bdPool first (see server/services/leadAssignment.js):
 *
 *   1. Leads whose assignedTo points at an Admin id that no longer exists —
 *      unassigned, back into the queue.
 *   2. Notifications addressed to one of those same dead ids — deleted; they
 *      were never visible to anyone and the bell has no "unknown sender" state.
 *   3. Every AssignmentRule.bdPool — cleared to [] (auto: every active BDE,
 *      resolved live — see the updated autoAssignLead in leadAssignment.js)
 *      so a future deletion can't strand leads or notifications this way again.
 *
 *   node scripts/migrations/fixOrphanAssignments.js           # dry run
 *   node scripts/migrations/fixOrphanAssignments.js --apply   # write
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const db = mongoose.connection.db;
  const activeAdminIds = new Set(
    (await db.collection('admins').find({}, { projection: { _id: 1 } }).toArray()).map((a) => a._id.toString())
  );

  // ── 1. Orphaned lead assignments ───────────────────────────────────────
  const assignedLeads = await db
    .collection('leads')
    .find({ assignedTo: { $ne: null } }, { projection: { assignedTo: 1, bd: 1, fullName: 1 } })
    .toArray();
  const orphanLeads = assignedLeads.filter((l) => !activeAdminIds.has(l.assignedTo.toString()));

  console.log(`--- Leads assigned to a deleted admin: ${orphanLeads.length} ---`);
  orphanLeads.forEach((l) => console.log(`  ${l._id}  "${l.fullName || ''}"  bd="${l.bd || ''}"  assignedTo=${l.assignedTo}`));
  if (APPLY && orphanLeads.length) {
    const res = await db.collection('leads').updateMany(
      { _id: { $in: orphanLeads.map((l) => l._id) } },
      { $set: { assignedTo: null, assignedAt: null, bd: '', unassignedSlaDeadline: new Date() } }
    );
    console.log(`  => unassigned ${res.modifiedCount}`);
  }

  // ── 2. Orphaned notifications ──────────────────────────────────────────
  const notifs = await db.collection('notifications').find({}, { projection: { recipient: 1 } }).toArray();
  const orphanNotifIds = notifs.filter((n) => !n.recipient || !activeAdminIds.has(n.recipient.toString())).map((n) => n._id);

  console.log(`\n--- Notifications addressed to a deleted admin: ${orphanNotifIds.length} ---`);
  if (APPLY && orphanNotifIds.length) {
    const res = await db.collection('notifications').deleteMany({ _id: { $in: orphanNotifIds } });
    console.log(`  => deleted ${res.deletedCount}`);
  }

  // ── 3. Assignment rule pools ────────────────────────────────────────────
  const rules = await db.collection('assignmentrules').find({}).toArray();
  const staleRules = rules.filter((r) => (r.bdPool || []).some((id) => !activeAdminIds.has(id.toString())));

  console.log(`\n--- Assignment rules with a stale bdPool entry: ${staleRules.length} ---`);
  staleRules.forEach((r) => console.log(`  "${r.name}"  bdPool=[${(r.bdPool || []).join(', ')}]  -> []  (auto: all active BDs)`));
  if (APPLY && staleRules.length) {
    const res = await db.collection('assignmentrules').updateMany(
      { _id: { $in: staleRules.map((r) => r._id) } },
      { $set: { bdPool: [], cursor: 0 } }
    );
    console.log(`  => cleared ${res.modifiedCount}`);
  }

  if (!APPLY) console.log('\nDry run only. Re-run with --apply to write.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
