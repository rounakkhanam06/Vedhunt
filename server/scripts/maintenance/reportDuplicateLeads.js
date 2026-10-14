/**
 * Read-only report: every group of leads that share a phone, alt phone or
 * real email (the same rule as services/leadDedup.js), written to an .xlsx
 * so the team can review before merging or deleting anything.
 *
 * Run backfillLeadDedupFields.js first — the grouping uses the normalized
 * contact fields.
 *
 * Within each group it suggests a lead to keep (the one with the most work
 * on it — linked client/proposals, calls, pipeline progress, assignment —
 * falling back to the oldest) and, for every other lead, the data it holds
 * that the keeper doesn't, so nothing is lost on merge.
 *
 * Writes nothing to the database.
 *
 *   node server/scripts/maintenance/reportDuplicateLeads.js [output.xlsx]
 *
 * The default output path is outside the repo, since the file holds
 * customer contact details.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Lead = require('../../models/Lead');
const Admin = require('../../models/Admin');
const AssignmentLog = require('../../models/AssignmentLog');
const Client = require('../../models/Client');
const FollowUpTask = require('../../models/FollowUpTask');
const Notification = require('../../models/Notification');
const Proposal = require('../../models/Proposal');

// Synthetic emails written when a lead had none — every one is unique or
// shared by unrelated people, so they must never link two leads.
const PLACEHOLDER_EMAIL = /^(import_.*@vedhunt\.in|fb_.*@facebook\.com|unknown@example\.com)$/i;

// Fields worth carrying over to the kept lead if only the duplicate has them.
const CARRY_FIELDS = [
  'fullName', 'altPhone', 'email', 'service', 'businessName', 'message', 'city', 'country',
  'fbLeadId', 'fbFormName', 'utmCampaign', 'utmSource', 'remark', 'nextFollowUpDate',
  'interestLevel', 'proposalValue', 'dealCloseValue', 'amountPaid', 'budget', 'website',
  'requirementSummary', 'decisionMaker', 'timeline',
];

const STATUS_RANK = {
  New: 0, Contacted: 1, Hold: 1, Dropped: 1, Lost: 1, Qualified: 2,
  'Proposal Sent': 3, Negotiation: 4, Won: 5,
};

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmtVal = (v) => (v instanceof Date ? fmtDate(v) : String(v));

/** Union-find over lead ids, linked by any shared contact key. */
function groupLeads(leads) {
  const parent = new Map(leads.map((l) => [String(l._id), String(l._id)]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const union = (a, b) => parent.set(find(a), find(b));

  const firstByKey = new Map();
  const reasons = new Map(); // root-independent: lead id -> Set of match keys
  for (const lead of leads) {
    const id = String(lead._id);
    const keys = [];
    if (lead.phoneNormalized) keys.push(`Phone ${lead.phoneNormalized}`);
    if (lead.altPhoneNormalized) keys.push(`Phone ${lead.altPhoneNormalized}`);
    if (lead.emailNormalized && !PLACEHOLDER_EMAIL.test(lead.emailNormalized)) keys.push(`Email ${lead.emailNormalized}`);
    for (const key of new Set(keys)) {
      if (firstByKey.has(key)) {
        union(id, firstByKey.get(key));
        for (const x of [id, firstByKey.get(key)]) {
          if (!reasons.has(x)) reasons.set(x, new Set());
          reasons.get(x).add(key);
        }
      } else {
        firstByKey.set(key, id);
      }
    }
  }

  const groups = new Map();
  for (const lead of leads) {
    const root = find(String(lead._id));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(lead);
  }
  return { groups: [...groups.values()].filter((g) => g.length > 1), reasons };
}

async function countRefs(Model, field, ids) {
  const rows = await Model.aggregate([
    { $match: { [field]: { $in: ids } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function main() {
  const outPath = path.resolve(
    process.argv[2] || path.resolve(__dirname, `../../../../duplicate-leads-${fmtDate(new Date())}.xlsx`)
  );
  await mongoose.connect(process.env.MONGODB_URI);

  const leads = await Lead.find({}).select('-rawPayload').sort({ createdAt: 1 }).lean();
  const { groups, reasons } = groupLeads(leads);
  const dupIds = groups.flat().map((l) => l._id);

  const [clients, proposals, tasks, assignLogs, notifications, admins] = await Promise.all([
    countRefs(Client, 'leadRef', dupIds),
    countRefs(Proposal, 'lead', dupIds),
    countRefs(FollowUpTask, 'lead', dupIds),
    countRefs(AssignmentLog, 'lead', dupIds),
    countRefs(Notification, 'lead', dupIds),
    Admin.find({}).select('firstName lastName').lean(),
  ]);
  const adminName = new Map(admins.map((a) => [String(a._id), `${a.firstName} ${a.lastName}`.trim()]));

  const workScore = (l) => {
    const id = String(l._id);
    return (clients.get(id) || 0) * 1000 + (proposals.get(id) || 0) * 100
      + (STATUS_RANK[l.status] || 0) * 10 + (l.callLogs?.length || 0) * 5
      + (tasks.get(id) || 0) * 2 + (l.assignedTo ? 1 : 0);
  };

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Duplicate leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Group', key: 'group', width: 7 },
    { header: 'Suggested action', key: 'action', width: 16 },
    { header: 'Matched on', key: 'matched', width: 34 },
    { header: 'Lead ID', key: 'leadId', width: 16 },
    { header: 'Full name', key: 'fullName', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Alt phone', key: 'altPhone', width: 16 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Platform', key: 'platform', width: 11 },
    { header: 'Source', key: 'source', width: 16 },
    { header: 'Form', key: 'form', width: 24 },
    { header: 'Campaign (UTM)', key: 'utm', width: 24 },
    { header: 'Status', key: 'status', width: 13 },
    { header: 'Assigned to', key: 'assignedTo', width: 18 },
    { header: 'Created', key: 'created', width: 11 },
    { header: 'Last updated', key: 'updated', width: 12 },
    { header: 'Calls logged', key: 'calls', width: 8 },
    { header: 'Status changes', key: 'history', width: 8 },
    { header: 'Documents', key: 'docs', width: 8 },
    { header: 'Client', key: 'client', width: 7 },
    { header: 'Proposals', key: 'proposals', width: 8 },
    { header: 'Follow-up tasks', key: 'tasks', width: 8 },
    { header: 'Assignment logs', key: 'assignLogs', width: 8 },
    { header: 'Notifications', key: 'notifications', width: 8 },
    { header: 'Remark', key: 'remark', width: 30 },
    { header: 'Data to carry over to kept lead', key: 'carry', width: 50 },
    { header: 'Mongo _id', key: 'id', width: 26 },
  ];
  sheet.getRow(1).font = { bold: true };

  let toReview = 0;
  let withLinkedWork = 0;
  groups
    .sort((a, b) => b.length - a.length || a[0].createdAt - b[0].createdAt)
    .forEach((group, gi) => {
      const keep = [...group].sort((a, b) => workScore(b) - workScore(a) || a.createdAt - b.createdAt)[0];
      const groupHasWorkOnOthers = group.some((l) => l !== keep && workScore(l) > 1);
      if (groupHasWorkOnOthers) withLinkedWork++;

      for (const lead of [keep, ...group.filter((l) => l !== keep)]) {
        const id = String(lead._id);
        const isKeep = lead === keep;
        const carry = isKeep ? [] : CARRY_FIELDS
          .filter((f) => !isEmpty(lead[f]) && isEmpty(keep[f])
            && !(f === 'email' && PLACEHOLDER_EMAIL.test(lead[f])))
          .map((f) => `${f}: ${fmtVal(lead[f])}`);
        if (!isKeep && (lead.callLogs?.length || 0)) carry.push(`${lead.callLogs.length} call log(s)`);
        if (!isKeep && (lead.documents?.length || 0)) carry.push(`${lead.documents.length} document(s)`);
        const linked = ['client', 'proposals', 'tasks']
          .filter((k, i) => ([clients, proposals, tasks][i].get(id) || 0) > 0);
        if (!isKeep && linked.length) carry.push(`re-point linked ${linked.join('/')} to kept lead`);

        const action = isKeep ? 'KEEP' : (carry.length ? 'MERGE then delete' : 'Delete');
        if (!isKeep) toReview++;

        const row = sheet.addRow({
          group: gi + 1,
          action,
          matched: [...(reasons.get(id) || [])].join(', '),
          leadId: lead.leadId,
          fullName: lead.fullName,
          phone: lead.phone,
          altPhone: lead.altPhone,
          email: PLACEHOLDER_EMAIL.test(lead.email || '') ? '(placeholder)' : lead.email,
          platform: lead.platform,
          source: lead.source,
          form: lead.fbFormName,
          utm: lead.utmCampaign,
          status: lead.status,
          assignedTo: lead.assignedTo ? (adminName.get(String(lead.assignedTo)) || String(lead.assignedTo)) : '',
          created: fmtDate(lead.createdAt),
          updated: fmtDate(lead.updatedAt),
          calls: lead.callLogs?.length || 0,
          history: lead.pipelineHistory?.length || 0,
          docs: lead.documents?.length || 0,
          client: clients.get(id) || 0,
          proposals: proposals.get(id) || 0,
          tasks: tasks.get(id) || 0,
          assignLogs: assignLogs.get(id) || 0,
          notifications: notifications.get(id) || 0,
          remark: lead.remark,
          carry: carry.join('; '),
          id,
        });
        if (gi % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        if (isKeep) row.getCell('action').font = { bold: true, color: { argb: 'FF1B7F3B' } };
        else if (carry.length) row.getCell('action').font = { bold: true, color: { argb: 'FFB45309' } };
      }
    });
  sheet.autoFilter = { from: 'A1', to: 'AA1' };

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 48 }, { width: 12 }];
  [
    ['Generated', new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Total leads', leads.length],
    ['Duplicate groups', groups.length],
    ['Leads in duplicate groups', dupIds.length],
    ['Extra copies (would be removed)', toReview],
    ['Groups where a non-kept copy has work on it', withLinkedWork],
    [],
    ['How to read this'],
    ['KEEP — suggested surviving lead: most work on it (client, proposals, calls, status), else the oldest.'],
    ['MERGE then delete — copy the "Data to carry over" into the KEEP lead first.'],
    ['Delete — nothing on this copy that the KEEP lead lacks.'],
    ['Placeholder emails (import_/fb_/unknown@) are ignored for matching.'],
    ['Report only — nothing in the database was changed.'],
  ].forEach((r) => summary.addRow(r));
  summary.getColumn(1).font = { bold: false };
  summary.getRow(8).font = { bold: true };

  await wb.xlsx.writeFile(outPath);
  console.log(`Leads: ${leads.length}. Duplicate groups: ${groups.length} (${dupIds.length} leads, ${toReview} extra copies).`);
  console.log(`Groups where a non-kept copy has work on it: ${withLinkedWork}.`);
  console.log(`Report written to ${outPath}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Duplicate report crashed:', err);
  process.exit(1);
});
