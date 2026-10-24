/**
 * Merge the duplicate leads created by the 1 Oct 2026 manual re-import back
 * into their original leads.
 *
 * The ORIGINAL lead (Meta / website / Google) survives: its _id, leadId,
 * Meta lead id, form data, message, UTM/source and pipeline history are kept.
 * From the IMPORTED copy (userSource 'Manual Import') — which the team has
 * been working since — it takes:
 *   - status/pipeline stage and the deal/hold/close fields that go with it
 *     (unless the copy is still 'New' and the original had progressed —
 *     then the original's status is kept)
 *   - the assigned BD (assignedTo, assignedAt, bd)
 *   - the remark (an earlier, different remark on the original is kept below it)
 *   - the next follow-up, when the imported copy has one
 *   - the latest-call snapshot, when its last call is the more recent
 * and merges both copies' call logs, pipeline history, documents and
 * servicesRequired. Any other field empty on the original is filled from the
 * imported copy. Follow-up tasks, assignment logs, notifications and client
 * links are re-pointed to the original; the imported copy is then deleted.
 *
 * Only pairs matching on BOTH phone and email with a similar name are
 * approved by default. Phone-only / email-only / different-name matches are
 * listed for review and are only merged when named with --include.
 *
 *   Dry run (default, writes nothing to the DB):
 *     node server/scripts/maintenance/mergeDuplicateLeads.js [--approve VH-...,VH-...]
 *       --approve marks review-only pairs (imported lead IDs) as approved in the plan
 *   -> writes lead-merge-dry-run-<date>.xlsx (the report) and
 *      lead-merge-plan-<date>.json (exactly what --apply would do)
 *
 *   Apply a reviewed plan (take a backup first — scripts/migrations/backupDatabase.js):
 *     node server/scripts/maintenance/mergeDuplicateLeads.js --apply <plan.json> --admin <admin email>
 *       [--include VH-...,VH-...]   also merge these review-only duplicates (imported lead IDs)
 *       [--exclude VH-...,VH-...]   skip these (imported lead IDs)
 *
 * --apply re-reads both leads and skips any pair changed since the dry run.
 * Each merge writes an AuditLog entry (action LEAD_MERGE) with full
 * before-snapshots of both leads.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { EJSON } = require('bson');
const Lead = require('../../models/Lead');
const Admin = require('../../models/Admin');
const AssignmentLog = require('../../models/AssignmentLog');
const AuditLog = require('../../models/AuditLog');
const Client = require('../../models/Client');
const FollowUpTask = require('../../models/FollowUpTask');
const Notification = require('../../models/Notification');
const { normalizePhone } = require('../../utils/normalize');
const { groupLeads, sharedKeys, isRealEmail } = require('./lib/duplicateLeadGroups');

const OUT_DIR = path.resolve(__dirname, '../../../..'); // outside the repo: files hold customer data
const today = new Date().toISOString().slice(0, 10);

// ---- field rules --------------------------------------------------------

// Never changed on the original.
const KEEP_ORIGINAL = new Set([
  '_id', '__v', 'leadId', 'fbLeadId', 'fbFormId', 'fbFormName', 'rawPayload', 'source', 'platform',
  'userSource', 'leadType', 'adCampaignId', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent',
  'utmTerm', 'message', 'consent', 'createdAt', 'updatedAt', 'fullName', 'phone', 'email',
  'phoneNormalized', 'emailNormalized', 'altPhoneNormalized',
]);
// Taken from the imported copy when it has a value (the team's working data).
const IMPORT_WINS = [
  'status', 'notConvertedReason', 'holdReason', 'holdUntil', 'leadPriority', 'leadScore',
  'proposalValue', 'proposalSentDate', 'proposalReference', 'expectedCloseDate', 'dealCloseValue',
  'paymentStatus', 'amountPaid', 'dealValue', 'closedBy', 'closedDate', 'lockedBy', 'lockedAt',
];
// Taken together from the imported copy when it is assigned.
const ASSIGNMENT = ['assignedTo', 'assignedAt', 'bd', 'unassignedSlaDeadline', 'unassignedSlaAlerted'];
// Taken together from whichever copy was called most recently.
const LAST_CALL = [
  'callStartTime', 'callEndTime', 'callDuration', 'callDate', 'connected', 'notConnectedReason',
  'interestLevel', 'leadAgeAtCall',
];
// Taken together from the imported copy when it has a next follow-up.
const FOLLOW_UP = [
  'nextFollowUpDate', 'nextActionType', 'followUpType', 'followUpReminderSentAt', 'followUpDueNotifiedAt',
  'followUpOverdueBDNotifiedAt', 'followUpOverdueManagerNotifiedAt', 'followUpBreached', 'followUpBreachedAt',
];
const SPECIAL = new Set([
  ...IMPORT_WINS, ...ASSIGNMENT, ...LAST_CALL, ...FOLLOW_UP, 'remark', 'callLogs', 'pipelineHistory',
  'documents', 'servicesRequired', 'touchNumber', 'firstCallAt', 'lastCallAt', 'altPhone',
]);
// Schema defaults / import placeholders that mean "nothing entered".
const EMPTY_DEFAULTS = {
  status: 'New', leadPriority: 'Normal', paymentStatus: 'Not Applicable', leadScore: 0,
  amountPaid: 0, dealValue: 0, service: 'Not specified',
};

const STATUS_RANK = {
  New: 0, Contacted: 1, Hold: 1, Dropped: 1, Lost: 1, Qualified: 2, 'Proposal Sent': 3, Negotiation: 4, Won: 5,
};

const isEmpty = (v, field) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
  || (field in EMPTY_DEFAULTS && v === EMPTY_DEFAULTS[field]);
const norm = (v) => JSON.stringify(v ?? null);
const fmt = (v) => {
  if (v === undefined || v === null || v === '') return '';
  if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 16);
  if (Array.isArray(v)) return `${v.length} item(s)`;
  return String(v);
};
const time = (d) => (d ? new Date(d).getTime() : 0);
const isImported = (lead) => lead.userSource === 'Manual Import';

function nameSimilarity(a, b) {
  // NFKC folds styled Unicode ("𝐒𝐮𝐦𝐢𝐭", "𝓐𝓷𝓲𝓵") back to plain letters
  const clean = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z\s]/g, ' ').trim();
  const ca = clean(a);
  const cb = clean(b);
  if (!ca || !cb) return 'Missing';
  const flatA = ca.replace(/\s+/g, '');
  const flatB = cb.replace(/\s+/g, '');
  if (flatA === flatB) return 'Same';
  const ta = new Set(ca.split(/\s+/).filter((t) => t.length >= 3));
  if (cb.split(/\s+/).some((t) => ta.has(t)) || flatA.includes(flatB) || flatB.includes(flatA)) return 'Similar';
  // edit distance for typos ("Rahul" vs "Rahu1"-style differences)
  const dp = Array.from({ length: flatA.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= flatB.length; j++) dp[0][j] = j;
  for (let i = 1; i <= flatA.length; i++) {
    for (let j = 1; j <= flatB.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (flatA[i - 1] === flatB[j - 1] ? 0 : 1));
    }
  }
  return dp[flatA.length][flatB.length] <= 2 ? 'Similar' : 'Different';
}

// ---- merge computation --------------------------------------------------

/**
 * Every entry already on the original is kept as is; an entry from the copy
 * is only dropped when it exactly repeats one on the original. Never
 * de-duplicates a lead's own entries against each other.
 */
function appendFromCopy(origList = [], dupList = [], keyOf) {
  const origKeys = new Set(origList.map(keyOf));
  return [...origList, ...dupList.filter((e) => !origKeys.has(keyOf(e)))];
}

function mergeCallLogs(orig, dup) {
  const when = (c) => time(c.callStartTime) || time(c.callDate) || time(c.loggedAt);
  const key = (c) => `${when(c)}|${c.calledBy || ''}|${c.connected || ''}|${c.remark || ''}`;
  return appendFromCopy(orig.callLogs, dup.callLogs, key)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => when(a.c) - when(b.c) || a.i - b.i) // stable: same-time calls keep their order
    .map(({ c }, i) => ({ ...c, touchNumber: i + 1 }));
}

function mergePipelineHistory(orig, dup, keepOriginalStatus) {
  // When the original's further-along status is kept, the copy's 'New'
  // (import) entries would otherwise become the latest history entry.
  const dupHistory = (dup.pipelineHistory || []).filter((h) => !(keepOriginalStatus && h.status === 'New'));
  const key = (h) => `${h.status}|${time(h.date)}|${h.note || ''}`;
  return appendFromCopy(orig.pipelineHistory, dupHistory, key)
    .map((h, i) => ({ h, i }))
    .sort((a, b) => time(a.h.date) - time(b.h.date) || a.i - b.i)
    .map(({ h }) => h);
}

/**
 * The imported copy's status wins — except when it is still 'New' and the
 * original had already progressed (Contacted, Qualified, Dropped, ...): then
 * the original's status and the fields that go with it are kept.
 */
const keepsOriginalStatus = (orig, dup) => dup.status === 'New' && Boolean(orig.status) && orig.status !== 'New';
const STATUS_TIED = new Set(['status', 'notConvertedReason', 'holdReason', 'holdUntil', 'closedBy', 'closedDate']);

/** Returns { set: {...}, changes: [{field, before, after, from}] } for the original lead. */
function computeMerge(orig, dup) {
  const keepStatus = keepsOriginalStatus(orig, dup);
  const set = {};
  const changes = [];
  const put = (field, value, from) => {
    if (norm(value) === norm(orig[field])) return;
    // unset -> null/false/'' is not a real change
    if (isEmpty(orig[field]) && (value === false || isEmpty(value))) return;
    set[field] = value;
    changes.push({ field, before: orig[field], after: value, from });
  };

  for (const f of IMPORT_WINS) {
    if (keepStatus && STATUS_TIED.has(f)) {
      if (isEmpty(orig[f], f) && !isEmpty(dup[f], f)) put(f, dup[f], 'imported copy (original empty)');
    } else if (!isEmpty(dup[f], f)) {
      put(f, dup[f], 'imported copy');
    }
  }
  if (dup.assignedTo) for (const f of ASSIGNMENT) put(f, dup[f] ?? null, 'imported copy');

  // remark: the imported copy's, with a different earlier remark kept below it
  const origRemark = (orig.remark || '').trim();
  const dupRemark = (dup.remark || '').trim();
  if (dupRemark && origRemark && dupRemark !== origRemark && !dupRemark.includes(origRemark)) {
    put('remark', `${dupRemark}\n\n[Earlier remark on original lead] ${origRemark}`, 'both');
  } else if (dupRemark) {
    put('remark', dupRemark, 'imported copy');
  }

  if (dup.nextFollowUpDate) for (const f of FOLLOW_UP) put(f, dup[f] ?? null, 'imported copy');
  else for (const f of FOLLOW_UP) if (isEmpty(orig[f], f) && !isEmpty(dup[f], f)) put(f, dup[f], 'imported copy');

  const lastCall = (l) => time(l.lastCallAt) || time(l.callDate) || time(l.callStartTime);
  if (lastCall(dup) > lastCall(orig)) for (const f of LAST_CALL) put(f, dup[f] ?? null, 'imported copy (more recent call)');
  else for (const f of LAST_CALL) if (isEmpty(orig[f], f) && !isEmpty(dup[f], f)) put(f, dup[f], 'imported copy');

  const firsts = [orig.firstCallAt, dup.firstCallAt].filter(Boolean).sort((a, b) => time(a) - time(b));
  if (firsts.length) put('firstCallAt', firsts[0], 'earliest of both');
  const lasts = [orig.lastCallAt, dup.lastCallAt].filter(Boolean).sort((a, b) => time(b) - time(a));
  if (lasts.length) put('lastCallAt', lasts[0], 'latest of both');

  const callLogs = mergeCallLogs(orig, dup);
  if (callLogs.length !== (orig.callLogs || []).length) put('callLogs', callLogs, 'both');
  put('touchNumber', Math.max(callLogs.length, orig.touchNumber || 0, dup.touchNumber || 0), 'both');

  const history = mergePipelineHistory(orig, dup, keepStatus);
  if (history.length !== (orig.pipelineHistory || []).length) put('pipelineHistory', history, 'both');

  const docUrls = new Set((orig.documents || []).map((d) => d.url));
  const newDocs = (dup.documents || []).filter((d) => !docUrls.has(d.url));
  if (newDocs.length) put('documents', [...(orig.documents || []), ...newDocs], 'both');

  const services = [...new Set([...(orig.servicesRequired || []), ...(dup.servicesRequired || [])])];
  if (services.length !== (orig.servicesRequired || []).length) put('servicesRequired', services, 'both');

  if (isEmpty(orig.altPhone) && dup.altPhone && normalizePhone(dup.altPhone) !== orig.phoneNormalized) {
    put('altPhone', dup.altPhone, 'imported copy (original empty)');
    set.altPhoneNormalized = normalizePhone(dup.altPhone);
  }

  // everything else: fill only where the original is empty
  for (const f of Object.keys(Lead.schema.paths)) {
    if (f.includes('.') || KEEP_ORIGINAL.has(f) || SPECIAL.has(f)) continue;
    if (isEmpty(orig[f], f) && !isEmpty(dup[f], f)) put(f, dup[f], 'imported copy (original empty)');
  }

  return { set, changes };
}

// ---- dry run ------------------------------------------------------------

async function dryRun(approveIds) {
  await mongoose.connect(process.env.MONGODB_URI);
  const leads = await Lead.find({}).sort({ createdAt: 1 }).lean();
  const groups = groupLeads(leads);
  const admins = await Admin.find({}).select('firstName lastName email').lean();
  const adminName = new Map(admins.map((a) => [String(a._id), `${a.firstName} ${a.lastName}`.trim()]));
  const who = (id) => (id ? adminName.get(String(id)) || String(id) : '(unassigned)');

  const pairs = [];
  const notMerged = [];
  for (const group of groups) {
    const originals = group.filter((l) => !isImported(l));
    const imports = group.filter(isImported);
    if (!imports.length) {
      group.forEach((l) => notMerged.push({ lead: l, group, reason: 'No imported copy — separate submissions by the same contact; left as is' }));
      continue;
    }
    if (!originals.length) {
      group.forEach((l) => notMerged.push({ lead: l, group, reason: 'Only imported copies in this group; left as is' }));
      continue;
    }
    const usedOriginals = new Set();
    for (const dup of imports) {
      // best original: most shared contact keys, then similar name, then oldest
      const ranked = originals
        .map((o) => ({ o, keys: sharedKeys(o, dup), name: nameSimilarity(o.fullName, dup.fullName) }))
        .sort((a, b) => b.keys.length - a.keys.length
          || (a.name === 'Different') - (b.name === 'Different')
          || time(a.o.createdAt) - time(b.o.createdAt));
      const best = ranked[0];
      if (!best.keys.length) {
        notMerged.push({ lead: dup, group, reason: 'Imported copy shares no contact detail directly with an original; left as is' });
        continue;
      }
      usedOriginals.add(best.o);
      pairs.push({ orig: best.o, dup, keys: best.keys, name: best.name, group });
    }
    if (imports.length > 1) {
      const counts = new Map();
      pairs.filter((p) => p.group === group).forEach((p) => counts.set(p.orig, (counts.get(p.orig) || 0) + 1));
      pairs.filter((p) => p.group === group && counts.get(p.orig) > 1)
        .forEach((p) => { p.multi = true; });
    }
    originals.filter((o) => !usedOriginals.has(o)).forEach((o) =>
      notMerged.push({ lead: o, group, reason: 'Another original for the same contact (separate submission); not merged — kept as its own lead' }));
  }

  // related records on the imported copies
  const dupIds = pairs.map((p) => p.dup._id);
  const origIds = pairs.map((p) => p.orig._id);
  const [tasks, assignLogs, notifs, clients] = await Promise.all([
    FollowUpTask.find({ lead: { $in: [...dupIds, ...origIds] } }).lean(),
    AssignmentLog.find({ lead: { $in: dupIds } }).select('lead').lean(),
    Notification.find({ lead: { $in: dupIds } }).select('lead').lean(),
    Client.find({ leadRef: { $in: dupIds } }).select('leadRef').lean(),
  ]);
  const byLead = (rows, field) => rows.reduce((m, r) => m.set(String(r[field]), [...(m.get(String(r[field])) || []), r]), new Map());
  const tasksBy = byLead(tasks, 'lead');
  const logsBy = byLead(assignLogs, 'lead');
  const notifsBy = byLead(notifs, 'lead');
  const clientsBy = byLead(clients, 'leadRef');

  const plan = [];
  for (const p of pairs) {
    const { orig, dup } = p;
    const { set, changes } = computeMerge(orig, dup);
    const matchType = p.keys.some((k) => k.startsWith('Phone')) && p.keys.some((k) => k.startsWith('Email'))
      ? 'Phone + email' : p.keys.some((k) => k.startsWith('Phone')) ? 'Phone only' : 'Email only';

    const reviewReasons = [];
    if (matchType !== 'Phone + email') reviewReasons.push(matchType);
    if (p.name === 'Different' || p.name === 'Missing') reviewReasons.push(`Name ${p.name.toLowerCase()}`);
    if (p.multi) reviewReasons.push('Several imported copies of one original');

    const warnings = [];
    if (keepsOriginalStatus(orig, dup)) {
      warnings.push(`Status kept from original: ${orig.status} (imported copy still New)`);
    } else if ((STATUS_RANK[dup.status] ?? 0) < (STATUS_RANK[orig.status] ?? 0)) {
      warnings.push(`Status goes back: ${orig.status} -> ${dup.status}`);
    }
    if (orig.assignedTo && dup.assignedTo && String(orig.assignedTo) !== String(dup.assignedTo)) {
      warnings.push(`BD changes: ${who(orig.assignedTo)} -> ${who(dup.assignedTo)}`);
    }
    if (isRealEmail(dup.emailNormalized) && isRealEmail(orig.emailNormalized) && dup.emailNormalized !== orig.emailNormalized) {
      warnings.push(`Different emails: ${orig.email} / ${dup.email} (original kept)`);
    }
    if (orig.phoneNormalized && dup.phoneNormalized && orig.phoneNormalized !== dup.phoneNormalized) {
      warnings.push(`Different phones: ${orig.phone} / ${dup.phone} (original kept)`);
    }

    // follow-up tasks: move the copy's tasks; if both copies end up with a
    // pending Primary task, keep the imported copy's (the team's current one)
    const dupTasks = tasksBy.get(String(dup._id)) || [];
    const origTasks = tasksBy.get(String(orig._id)) || [];
    const dupPendingPrimary = dupTasks.filter((t) => t.type === 'Primary' && t.status === 'Pending');
    const cancelTasks = dupPendingPrimary.length
      ? origTasks.filter((t) => t.type === 'Primary' && t.status === 'Pending').map((t) => t._id)
      : [];
    if (cancelTasks.length) warnings.push(`${cancelTasks.length} pending follow-up task(s) on the original superseded by the imported copy's — will be marked Cancelled`);

    const manuallyApproved = reviewReasons.length > 0 && approveIds.has(dup.leadId);
    plan.push({
      approved: reviewReasons.length === 0 || manuallyApproved,
      manuallyApproved,
      reviewReasons,
      warnings,
      matchType,
      nameCheck: p.name,
      primaryId: orig._id,
      primaryLeadId: orig.leadId,
      primaryUpdatedAt: orig.updatedAt,
      duplicateId: dup._id,
      duplicateLeadId: dup.leadId,
      duplicateUpdatedAt: dup.updatedAt,
      set,
      moveTaskIds: dupTasks.map((t) => t._id),
      cancelTaskIds: cancelTasks,
      moveAssignmentLogs: (logsBy.get(String(dup._id)) || []).length,
      moveNotifications: (notifsBy.get(String(dup._id)) || []).length,
      moveClients: (clientsBy.get(String(dup._id)) || []).length,
      // for the report only
      _orig: orig,
      _dup: dup,
      _changes: changes,
      _keys: p.keys,
    });
  }

  const planPath = path.join(OUT_DIR, `lead-merge-plan-${today}.json`);
  const reportPath = path.join(OUT_DIR, `lead-merge-dry-run-${today}.xlsx`);
  const planOut = plan.map(({ _orig, _dup, _changes, _keys, ...rest }) => rest);
  fs.writeFileSync(planPath, EJSON.stringify({ createdAt: new Date(), merges: planOut }, { relaxed: false }, 1));
  await writeReport(reportPath, plan, notMerged, who);

  const approved = plan.filter((p) => p.approved).length;
  console.log(`Duplicate groups: ${groups.length}`);
  console.log(`Merges proposed: ${plan.length} (${approved} approved — ${plan.filter((p) => p.manuallyApproved).length} of them after manual review; ${plan.length - approved} need review)`);
  console.log(`Leads not merged (left as is): ${notMerged.length}`);
  console.log(`With warnings: ${plan.filter((p) => p.warnings.length).length}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Plan:   ${planPath}`);
  console.log('DRY RUN — nothing in the database was changed.');
  await mongoose.disconnect();
}

async function writeReport(file, plan, notMerged, who) {
  const wb = new ExcelJS.Workbook();
  const bold = (ws) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 70 }, { width: 12 }];
  const approved = plan.filter((p) => p.approved);
  [
    ['Lead merge — DRY RUN (nothing has been changed)', ''],
    ['Generated', new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Merges proposed', plan.length],
    ['  approved by default (phone + email match, similar name)', approved.length - plan.filter((p) => p.manuallyApproved).length],
    ['  approved after manual review (--approve)', plan.filter((p) => p.manuallyApproved).length],
    ['  need review (phone-only / email-only / name differs) — NOT merged unless included', plan.length - approved.length],
    ['Original status kept (imported copy still New, original progressed)', plan.filter((p) => p.warnings.some((w) => w.startsWith('Status kept'))).length],
    ['Merges with warnings (status goes back, BD changes, cancelled task …)', plan.filter((p) => p.warnings.length).length],
    ['Leads not merged (left as is)', notMerged.length],
    ['Follow-up tasks to move', plan.reduce((n, p) => n + p.moveTaskIds.length, 0)],
    ['Follow-up tasks to cancel (superseded)', plan.reduce((n, p) => n + p.cancelTaskIds.length, 0)],
    ['Assignment logs to move', plan.reduce((n, p) => n + p.moveAssignmentLogs, 0)],
    ['Notifications to move', plan.reduce((n, p) => n + p.moveNotifications, 0)],
    ['Client records to re-link', plan.reduce((n, p) => n + p.moveClients, 0)],
    [],
    ['Rules'],
    ['Original lead survives: lead ID, Meta lead ID, form, message, source/UTM, name, phone, email, history kept.'],
    ['From the imported copy: status/stage, assigned BD, remark (earlier different remark kept below), next follow-up.'],
    ['Exception: if the imported copy is still New but the original progressed, the original status is kept.'],
    ['Merged from both: call logs (renumbered by date), pipeline history, documents, services required.'],
    ['Any other field empty on the original is filled from the imported copy.'],
    ['Imported copy is deleted after its tasks/logs/notifications/client links move to the original.'],
  ].forEach((r) => summary.addRow(r));
  summary.getRow(1).font = { bold: true, size: 13 };
  summary.getRow(16).font = { bold: true };

  const merges = wb.addWorksheet('Merges');
  merges.columns = [
    ['Decision', 16], ['Review reason', 26], ['Warnings', 46], ['Matched on', 14], ['Name check', 10],
    ['KEEP: original lead ID', 17], ['Original name', 22], ['Original phone', 15], ['Original email', 28],
    ['Original source', 30], ['Original created', 12],
    ['DELETE: imported lead ID', 17], ['Imported name', 22], ['Imported phone', 15], ['Imported email', 28],
    ['Status before -> after', 24], ['BD before -> after', 30], ['Remark after merge', 40],
    ['Call logs (orig + import -> merged)', 14], ['History entries after', 10], ['Next follow-up after', 16],
    ['Fields filled from import', 30], ['Tasks moved', 8], ['Tasks cancelled', 8], ['Assignment logs moved', 9],
    ['Notifications moved', 9], ['Client re-linked', 8],
  ].map(([header, width]) => ({ header, width }));
  bold(merges);

  const sorted = [...plan].sort((a, b) => a.approved - b.approved || b.warnings.length - a.warnings.length);
  for (const p of sorted) {
    const { _orig: o, _dup: d } = p;
    const after = (f) => (f in p.set ? p.set[f] : o[f]);
    const filled = p._changes.filter((c) => c.from === 'imported copy (original empty)').map((c) => c.field);
    const row = merges.addRow([
      !p.approved ? 'REVIEW (not merged)' : p.manuallyApproved ? 'MERGE (approved after review)' : 'MERGE',
      p.reviewReasons.join('; '),
      p.warnings.join('; '),
      p.matchType,
      p.nameCheck,
      o.leadId, o.fullName, o.phone, o.email, o.source, fmt(o.createdAt).slice(0, 10),
      d.leadId, d.fullName, d.phone, d.email,
      `${o.status} -> ${after('status')}`,
      `${who(o.assignedTo)} -> ${who(after('assignedTo'))}`,
      after('remark') || '',
      `${(o.callLogs || []).length} + ${(d.callLogs || []).length} -> ${(after('callLogs') || []).length}`,
      (after('pipelineHistory') || []).length,
      fmt(after('nextFollowUpDate')),
      filled.join(', '),
      p.moveTaskIds.length, p.cancelTaskIds.length, p.moveAssignmentLogs, p.moveNotifications, p.moveClients,
    ]);
    const color = !p.approved ? 'FFFDE68A' : p.warnings.length ? 'FFFFEDD5' : null;
    if (color) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  }
  merges.autoFilter = { from: 'A1', to: 'AA1' };

  const fields = wb.addWorksheet('All field changes');
  fields.columns = [
    ['Decision', 16], ['Original lead ID', 17], ['Imported lead ID', 17], ['Field', 22],
    ['Before (original)', 40], ['After merge', 40], ['Taken from', 30],
  ].map(([header, width]) => ({ header, width }));
  bold(fields);
  for (const p of sorted) {
    for (const c of p._changes) {
      const show = (v, field) => (field === 'assignedTo' || field === 'closedBy' || field === 'lockedBy'
        ? (v ? who(v) : '') : fmt(v));
      fields.addRow([p.approved ? 'MERGE' : 'REVIEW (not merged)', p.primaryLeadId, p.duplicateLeadId,
        c.field, show(c.before, c.field), show(c.after, c.field), c.from]);
    }
  }
  fields.autoFilter = { from: 'A1', to: 'G1' };

  const left = wb.addWorksheet('Not merged');
  left.columns = [
    ['Lead ID', 17], ['Name', 22], ['Phone', 15], ['Email', 28], ['Source', 34], ['Status', 12],
    ['Created', 12], ['Same contact as', 30], ['Why not merged', 60],
  ].map(([header, width]) => ({ header, width }));
  bold(left);
  for (const n of notMerged) {
    left.addRow([n.lead.leadId, n.lead.fullName, n.lead.phone, n.lead.email, n.lead.source, n.lead.status,
      fmt(n.lead.createdAt).slice(0, 10), n.group.filter((l) => l !== n.lead).map((l) => l.leadId).join(', '), n.reason]);
  }

  await wb.xlsx.writeFile(file);
}

// ---- apply --------------------------------------------------------------

async function apply(planPath, adminEmail, include, exclude) {
  const { merges } = EJSON.parse(fs.readFileSync(planPath, 'utf8'), { relaxed: false });
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await Admin.findOne({ email: String(adminEmail || '').toLowerCase() }).select('_id');
  if (!admin) throw new Error('--admin <email> must be an existing admin (recorded on the audit log)');

  const todo = merges.filter((m) => !exclude.has(m.duplicateLeadId) && (m.approved || include.has(m.duplicateLeadId)));
  console.log(`Applying ${todo.length} of ${merges.length} merge(s) from ${planPath}`);

  let done = 0;
  const skipped = [];
  const failed = [];
  for (const m of todo) {
    try {
      const [orig, dup] = await Promise.all([Lead.findById(m.primaryId).lean(), Lead.findById(m.duplicateId).lean()]);
      if (!orig || !dup) { skipped.push(`${m.duplicateLeadId}: lead no longer exists`); continue; }
      if (time(orig.updatedAt) !== time(m.primaryUpdatedAt) || time(dup.updatedAt) !== time(m.duplicateUpdatedAt)) {
        skipped.push(`${m.duplicateLeadId} -> ${m.primaryLeadId}: changed since the dry run — re-run the dry run`);
        continue;
      }

      // Raw collection writes: the plan already holds the final values, and
      // Mongoose save hooks (leadId, notifications) must not fire here.
      await Lead.collection.updateOne({ _id: orig._id }, { $set: { ...m.set, updatedAt: new Date() } });
      if (m.moveTaskIds.length) await FollowUpTask.collection.updateMany({ _id: { $in: m.moveTaskIds } }, { $set: { lead: orig._id } });
      if (m.cancelTaskIds.length) {
        await FollowUpTask.collection.updateMany(
          { _id: { $in: m.cancelTaskIds }, status: 'Pending' },
          { $set: { status: 'Cancelled', result: `Superseded during duplicate merge of ${m.duplicateLeadId}`, updatedAt: new Date() } }
        );
      }
      await AssignmentLog.collection.updateMany({ lead: dup._id }, { $set: { lead: orig._id } });
      await Client.collection.updateMany({ leadRef: dup._id }, { $set: { leadRef: orig._id } });
      const notifs = await Notification.collection
        .find({ $or: [{ lead: dup._id }, { link: { $regex: String(dup._id) } }] })
        .project({ lead: 1, link: 1 })
        .toArray();
      for (const n of notifs) {
        await Notification.collection.updateOne({ _id: n._id }, {
          $set: {
            ...(String(n.lead) === String(dup._id) ? { lead: orig._id } : {}),
            ...(n.link ? { link: n.link.split(String(dup._id)).join(String(orig._id)) } : {}),
          },
        });
      }
      await AuditLog.create({
        adminId: admin._id,
        action: 'LEAD_MERGE',
        resource: 'Lead',
        beforeSnapshot: { primary: orig, duplicate: dup },
        afterSnapshot: { primaryId: orig._id, primaryLeadId: orig.leadId, deletedLeadId: dup.leadId, set: m.set },
        ipAddress: 'script:mergeDuplicateLeads',
      });
      await Lead.collection.deleteOne({ _id: dup._id });
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${todo.length}`);
    } catch (err) {
      // keep going — a half-applied pair is visible in the post-merge check
      // (both leads still exist) and restorable from its AuditLog/backup
      failed.push(`${m.duplicateLeadId} -> ${m.primaryLeadId}: ${err.message}`);
    }
  }

  console.log(`Merged ${done}. Skipped ${skipped.length}. Failed ${failed.length}.`);
  skipped.forEach((s) => console.log(`  skipped ${s}`));
  failed.forEach((s) => console.log(`  FAILED ${s}`));
  await mongoose.disconnect();
}

// ---- entry --------------------------------------------------------------

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
const idList = (name) => new Set((arg(name) || '').split(',').map((s) => s.trim()).filter(Boolean));

(arg('--apply')
  ? apply(path.resolve(arg('--apply')), arg('--admin'), idList('--include'), idList('--exclude'))
  : dryRun(idList('--approve'))
).catch((err) => {
  console.error('Lead merge crashed:', err);
  process.exit(1);
});
