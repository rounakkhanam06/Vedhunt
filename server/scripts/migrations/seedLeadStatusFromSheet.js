/**
 * ONE-TIME: sets each lead's status to the "Status" column of an exported
 * lead sheet, bypassing the stage-order / mandatory-field rules that the
 * normal import (services/leadImport.js) enforces. Rows with an invalid
 * phone or a duplicate contact in the sheet are left out, as are locked
 * leads. Only `status` (plus closedDate / notConvertedReason / history) is
 * written — no Client account is created for Won leads and deal values are
 * left as they are, to be filled in later from the panel.
 *
 * Dry run by default. Writes a JSON backup of every lead's previous values
 * before applying, so the change can be reverted.
 *
 *   node scripts/migrations/seedLeadStatusFromSheet.js "<file.xlsx>"
 *   node scripts/migrations/seedLeadStatusFromSheet.js "<file.xlsx>" --apply --reason="Unresponsive"
 *
 * --reason is required with --apply when any lead becomes Lost/Dropped: the
 * state machine rejects every later save of a Lost/Dropped lead without one.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');
const { prepareImport, buildImportPlan } = require('../../services/leadImport');
const { LOST_DROPPED_REASONS, TERMINAL_STATUSES } = require('../../utils/leadStateMachine');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
const reason = (args.find((a) => a.startsWith('--reason=')) || '').slice('--reason='.length);

// Rows the admin chose not to seed.
const EXCLUDED_ERROR = /^(Same contact as row|Invalid phone number|Missing phone number|Missing name|Lead is open \(locked\))/;

function idFilter(ref) {
  return mongoose.Types.ObjectId.isValid(ref) && String(new mongoose.Types.ObjectId(ref)) === ref
    ? { $or: [{ _id: new mongoose.Types.ObjectId(ref) }, { _id: ref }] }
    : { _id: ref };
}

(async () => {
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/migrations/seedLeadStatusFromSheet.js "<file.xlsx>" [--apply --reason="<reason>"]');
    process.exit(1);
  }
  if (reason && !LOST_DROPPED_REASONS.includes(reason)) {
    console.error(`--reason must be one of: ${LOST_DROPPED_REASONS.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const prepared = await prepareImport(fs.readFileSync(file), path.basename(file));
  const plan = await buildImportPlan(prepared);

  const excluded = plan.filter((e) => e.errors.some((err) => EXCLUDED_ERROR.test(err)));
  const todo = plan.filter((e) => e.statusChange && !excluded.includes(e));
  const counts = {};
  todo.forEach((e) => {
    const k = `${e.statusChange.from} -> ${e.statusChange.to}${e.action === 'skip' ? '  (forced)' : ''}`;
    counts[k] = (counts[k] || 0) + 1;
  });
  const needsReason = todo.filter((e) => ['Lost', 'Dropped'].includes(e.statusChange.to));

  console.log(`Sheet rows: ${plan.length}`);
  console.log(`Status changes to seed: ${todo.length}`);
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  console.log(`Already matching / no status change: ${plan.filter((e) => !e.statusChange && !excluded.includes(e)).length}`);
  console.log(`Left out (bad phone / duplicate / locked): ${excluded.length}`);
  excluded.forEach((e) => console.log(`  row ${e.row}  ${e.fullName}  — ${e.errors.join('; ')}`));

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply --reason="<reason>" to write.');
    await mongoose.disconnect();
    return;
  }
  if (needsReason.length && !reason) {
    console.error(`\n${needsReason.length} lead(s) become Lost/Dropped — pass --reason="<one of: ${LOST_DROPPED_REASONS.join(', ')}>".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const col = mongoose.connection.db.collection('leads');
  const backup = [];
  const now = new Date();
  const sheetName = path.basename(file);
  let done = 0;

  for (const e of todo) {
    const lead = await col.findOne(idFilter(e.leadRef));
    if (!lead) { console.warn(`row ${e.row}: lead ${e.leadRef} not found, skipped`); continue; }
    const from = lead.status;
    const to = e.statusChange.to;
    if (from === to) continue;

    backup.push({
      _id: lead._id, leadId: lead.leadId, row: e.row,
      status: lead.status, closedDate: lead.closedDate ?? null, notConvertedReason: lead.notConvertedReason ?? null
    });

    const set = { status: to, updatedAt: now };
    if (TERMINAL_STATUSES.includes(to)) {
      set.closedDate = lead.closedDate && TERMINAL_STATUSES.includes(from) ? lead.closedDate : now;
    } else if (TERMINAL_STATUSES.includes(from)) {
      set.closedDate = null;
    }
    if (to === 'Lost' || to === 'Dropped') set.notConvertedReason = lead.notConvertedReason || reason;
    else if (from === 'Lost' || from === 'Dropped') set.notConvertedReason = '';

    await col.updateOne({ _id: lead._id }, {
      $set: set,
      $push: { pipelineHistory: {
        status: to,
        date: now,
        note: `Status seeded from ${sheetName} (row ${e.row}): ${from} -> ${to}`
      } }
    });
    done++;
  }

  const backupDir = path.resolve(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `seedLeadStatus-${now.toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

  console.log(`\nUpdated ${done} lead(s). Previous values saved to ${backupFile}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
