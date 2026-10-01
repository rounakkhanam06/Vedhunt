const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { autoAssignLead } = require('./leadAssignment');
const { applyLeadUpdate } = require('./leadLifecycle');
const { validateLeadTransition, TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { normalizePhone, normalizeEmail } = require('../utils/normalize');

/**
 * Manual bulk lead import (Excel/CSV) — the counterpart to the Facebook
 * webhook/sync paths for leads that arrive by spreadsheet instead. Column
 * headers vary by whoever compiled the file, so they're matched loosely
 * (case/space/underscore-insensitive) against known aliases, mirroring
 * services/facebookLeads.js's STANDARD_FIELDS. Deliberately has no "business
 * name" mapping — that column isn't reliably present in either Facebook's
 * export or the team's manual sheet, so it's dropped from this portal
 * entirely rather than half-populated.
 *
 * TWO STEPS, ONE PLAN: buildImportPlan works out — read-only — what every row
 * would do (create / update / unchanged / skip) and why. previewImport returns
 * that plan without writing anything; runImport rebuilds it against the
 * current DB when the admin confirms, then executes it. Existing leads are
 * updated through services/leadLifecycle.js's applyLeadUpdate, so the same
 * state machine as the UI re-validates every change at write time.
 *
 * UPSERT BEHAVIOUR: a row matching an existing lead (by phone, alt phone or
 * email) updates it with the sheet's non-empty fields (status, remark,
 * service, city, country, fullName, altPhone). Otherwise a new lead is created.
 */

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^[+]?[0-9\s().-]{7,20}$/;

// Valid lead status values — must stay in sync with Lead model schema enum.
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];

// Same window as leadLifecycle.js's lock enforcement.
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/** Matches a sheet status case/spacing-insensitively ("proposal  sent" -> "Proposal Sent"). */
function matchStatus(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return VALID_STATUSES.find((s) => s.toLowerCase() === key) || null;
}

/** Normalizes a header cell into a lookup key: lowercase, letters/digits only. */
function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_ALIASES = {
  fullName:  ['fullname', 'name', 'leadname', 'customername'],
  phone:     ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber', 'whatsappnumber'],
  altPhone:  ['altphone', 'alternatephone', 'alternatenumber', 'secondaryphone'],
  email:     ['email', 'emailaddress', 'workemail'],
  city:      ['city', 'location'],
  country:   ['country'],
  service:   ['service', 'servicerequired', 'interest', 'requirement'],
  // "remark" covers the exported "Remark" column; "message" aliases kept for
  // new-lead creation path that uses the message field.
  remark:    ['remark', 'remarks', 'note', 'notes', 'comments'],
  message:   ['message'],
  campaign:  ['campaign', 'campaignname', 'utmcampaign'],
  form:      ['form', 'formname', 'adname'],
  platform:  ['platform', 'channel'],
  // Status column — supports common export column names.
  status:    ['status', 'leadstatus', 'stage', 'pipelinestatus', 'pipelinestate'],
  createdAt: ['date', 'createdat', 'submittedon', 'leaddate', 'createdtime']
};

/** Reverse-index: normalized alias -> our field name. */
const ALIAS_TO_FIELD = Object.entries(FIELD_ALIASES).reduce((acc, [field, aliases]) => {
  aliases.forEach((alias) => { acc[alias] = field; });
  return acc;
}, {});

/** Builds { fieldName: columnIndex } from a header row. */
function mapHeaders(headerRow) {
  const map = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const field = ALIAS_TO_FIELD[normalizeHeader(cell.value)];
    if (field && !(field in map)) map[field] = colNumber;
  });
  return map;
}

function cellText(row, colNumber) {
  if (!colNumber) return '';
  const value = row.getCell(colNumber).value;
  if (value == null) return '';
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  if (typeof value === 'object' && value.result != null) return String(value.result).trim();
  return String(value).trim();
}

/** Loads the uploaded buffer into an ExcelJS worksheet, whether it's .xlsx or .csv. */
async function loadWorksheet(buffer, originalName) {
  const isCsv = /\.csv$/i.test(originalName || '');
  const workbook = new ExcelJS.Workbook();
  if (isCsv) {
    const stream = Readable.from(buffer);
    return workbook.csv.read(stream);
  }
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

/**
 * Parses the upload and checks its headers — fast, so it runs inside the
 * request and a bad file is rejected immediately. Returns the worksheet and
 * column map for previewImport/runImport, plus a row count.
 */
async function prepareImport(buffer, originalName) {
  if (!/\.(xlsx|csv)$/i.test(originalName || '')) {
    throw Object.assign(new Error('Only .xlsx or .csv files are supported.'), { status: 400 });
  }

  const worksheet = await loadWorksheet(buffer, originalName);
  if (!worksheet || worksheet.rowCount < 2) {
    return { worksheet: null, fieldMap: null, rowCount: 0 };
  }

  const fieldMap = mapHeaders(worksheet.getRow(1));
  if (!fieldMap.fullName || !fieldMap.phone) {
    throw Object.assign(
      new Error('The file must have a name column and a phone column (e.g. "Full Name", "Phone").'),
      { status: 400 }
    );
  }

  return { worksheet, fieldMap, rowCount: worksheet.rowCount - 1 };
}

/** Reads every non-blank data row into plain values. */
function readRows({ worksheet, fieldMap }) {
  const rows = [];
  if (!worksheet) return rows;
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const data = {};
    for (const field of Object.keys(FIELD_ALIASES)) data[field] = cellText(row, fieldMap[field]);
    if (!data.fullName && !data.phone) continue; // fully blank row
    rows.push({ rowNumber, data });
  }
  return rows;
}

/**
 * One query for every lead any row could match — same rule as
 * services/leadDedup.js (phone/altPhone/email against phoneNormalized,
 * altPhoneNormalized, emailNormalized) — instead of a query per row.
 * Raw driver so legacy String-_id leads come back too (utils/leadLookup.js).
 */
async function loadCandidateLeads(rows) {
  const phones = new Set();
  const emails = new Set();
  for (const { data } of rows) {
    [data.phone, data.altPhone].map(normalizePhone).filter(Boolean).forEach((p) => phones.add(p));
    if (emailRegex.test(data.email)) emails.add(normalizeEmail(data.email));
  }
  const or = [];
  if (phones.size) {
    or.push({ phoneNormalized: { $in: [...phones] } });
    or.push({ altPhoneNormalized: { $in: [...phones] } });
  }
  if (emails.size) or.push({ emailNormalized: { $in: [...emails] } });
  if (!or.length) return [];
  return mongoose.connection.db.collection('leads').find({ $or: or }).sort({ _id: 1 }).toArray();
}

function findMatch(candidates, phones, email) {
  return candidates.find((lead) =>
    phones.includes(lead.phoneNormalized) ||
    phones.includes(lead.altPhoneNormalized) ||
    (email && lead.emailNormalized === email)
  ) || null;
}

const UPDATABLE_FIELDS = ['fullName', 'altPhone', 'service', 'city', 'country', 'remark'];

/**
 * Read-only: decides what each row would do. Never writes.
 *
 * Each entry: { row, fullName, phone, action: 'create'|'update'|'unchanged'|'skip',
 *   leadId, leadRef, changes: [{ field, from, to }],
 *   statusChange: { from, to, closing, reopening } | null, errors: [string], warnings: [string] }
 * plus internal `_create`/`_patch` (stripped from the preview response).
 * `loadCandidates` is injectable so tests can run without a database.
 */
async function buildImportPlan(prepared, { loadCandidates = loadCandidateLeads } = {}) {
  const rows = readRows(prepared);
  const candidates = await loadCandidates(rows);
  const seenInSheet = new Map(); // normalized phone/email -> first row number

  return rows.map(({ rowNumber, data }) => {
    const entry = {
      row: rowNumber,
      fullName: data.fullName,
      phone: data.phone,
      action: 'skip',
      leadId: null,
      leadRef: null,
      changes: [],
      statusChange: null,
      errors: [],
      warnings: []
    };

    if (!data.fullName) entry.errors.push('Missing name');
    if (!data.phone || !phoneRegex.test(data.phone)) {
      entry.errors.push(data.phone ? `Invalid phone number "${data.phone}"` : 'Missing phone number');
    }
    if (data.altPhone && !phoneRegex.test(data.altPhone)) {
      entry.warnings.push(`Invalid alternate phone "${data.altPhone}" — will be ignored`);
      data.altPhone = '';
    }

    const emailValid = emailRegex.test(data.email);
    if (data.email && !emailValid) entry.warnings.push(`Invalid email "${data.email}" — will be ignored`);
    const email = emailValid ? normalizeEmail(data.email) : '';

    let status = null;
    if (data.status) {
      status = matchStatus(data.status);
      if (!status) {
        entry.warnings.push(`Unrecognized status "${data.status}" — status will not be changed (allowed: ${VALID_STATUSES.join(', ')})`);
      }
    }

    if (entry.errors.length) return entry;

    // The same person twice in one sheet: the second row would otherwise
    // silently update the lead the first row creates.
    const phones = [data.phone, data.altPhone].map(normalizePhone).filter(Boolean);
    const keys = [...phones.map((p) => `p:${p}`), ...(email ? [`e:${email}`] : [])];
    const firstRow = keys.map((k) => seenInSheet.get(k)).find(Boolean);
    if (firstRow) {
      entry.errors.push(`Same contact as row ${firstRow} in this sheet`);
      return entry;
    }
    keys.forEach((k) => seenInSheet.set(k, rowNumber));

    const existing = findMatch(candidates, phones, email);
    const remark = data.remark || data.message;

    if (!existing) {
      entry.action = 'create';
      if (!emailValid) entry.warnings.push('No valid email — a placeholder email will be used');
      if (status && status !== 'New') {
        entry.warnings.push(`New leads always start as New — status "${status}" will not be applied`);
      }
      entry._create = { ...data, email: emailValid ? data.email : '', remark };
      return entry;
    }

    entry.leadId = existing.leadId || String(existing._id);
    entry.leadRef = String(existing._id);

    const patch = {};
    const sheetValues = { ...data, remark };
    for (const field of UPDATABLE_FIELDS) {
      const value = String(sheetValues[field] || '').trim();
      if (value && value !== String(existing[field] || '').trim()) {
        patch[field] = value;
        entry.changes.push({ field, from: existing[field] || '', to: value });
      }
    }
    if (status && status !== existing.status) {
      patch.status = status;
      entry.statusChange = {
        from: existing.status,
        to: status,
        closing: TERMINAL_STATUSES.includes(status),
        reopening: TERMINAL_STATUSES.includes(existing.status)
      };
    }

    if (!Object.keys(patch).length) {
      entry.action = 'unchanged';
      return entry;
    }

    if (existing.lockedBy && existing.lockedAt && Date.now() - new Date(existing.lockedAt).getTime() < LOCK_TIMEOUT_MS) {
      entry.errors.push('Lead is open (locked) by another user right now — try again in a few minutes');
      return entry;
    }

    // Same rules the UI hits (importing is Super Admin only).
    const ruleError = validateLeadTransition(existing, { ...patch }, { isSuperAdmin: true });
    if (ruleError) {
      entry.errors.push(ruleError);
      return entry;
    }

    entry.action = 'update';
    entry._patch = patch;
    return entry;
  });
}

function summarizePlan(plan) {
  const count = (fn) => plan.filter(fn).length;
  return {
    totalRows: plan.length,
    create: count((e) => e.action === 'create'),
    update: count((e) => e.action === 'update'),
    unchanged: count((e) => e.action === 'unchanged'),
    skip: count((e) => e.action === 'skip'),
    withWarnings: count((e) => e.warnings.length > 0),
    statusChanges: count((e) => e.action === 'update' && e.statusChange),
    criticalStatusChanges: count((e) => e.action === 'update' && (e.statusChange?.closing || e.statusChange?.reopening))
  };
}

const publicEntry = ({ _create, _patch, ...entry }) => entry;

/** Dry run — returns the plan for the admin to review. No DB writes. */
async function previewImport(prepared, options) {
  const plan = await buildImportPlan(prepared, options);
  return { summary: summarizePlan(plan), rows: plan.map(publicEntry) };
}

/**
 * Confirmed import. Rebuilds the plan against the DB as it is now (it may
 * have changed since the preview), then executes it. Each new lead costs a
 * dozen-plus sequential DB round trips (leadId counter, insert, auto-assign,
 * notification, push), so this runs as a background job (services/importJobs.js)
 * and reports through onProgress.
 *
 * @param {object}   prepared     result of prepareImport
 * @param {string}   originalName original filename (used in audit notes)
 * @param {object}   actor        { id } — the Super Admin confirming the import
 * @param {Function} onProgress   called with the running summary after each row
 */
async function runImport(prepared, originalName, actor, onProgress = () => {}) {
  const plan = await buildImportPlan(prepared);
  let imported = 0;
  let updated = 0;
  const unchanged = plan.filter((e) => e.action === 'unchanged').length;
  const invalid = plan
    .filter((e) => e.action === 'skip')
    .map((e) => ({ row: e.row, reason: e.errors.join('; ') }));
  const todo = plan.filter((e) => e.action === 'create' || e.action === 'update');
  const report = (processed) => onProgress({
    processed,
    rowCount: todo.length,
    summary: { totalRows: plan.length, imported, updated, unchanged, invalid }
  });

  for (let i = 0; i < todo.length; i++) {
    const entry = todo[i];
    report(i);
    try {
      if (entry.action === 'update') {
        const patch = { ...entry._patch };
        if ('altPhone' in patch) patch.altPhoneNormalized = normalizePhone(patch.altPhone);
        // applyLeadUpdate re-validates against the lead as it is right now.
        const result = await applyLeadUpdate(entry.leadRef, patch, { id: actor?.id, isSuperAdmin: true });
        if (!result.ok) {
          invalid.push({ row: entry.row, reason: result.message });
          continue;
        }
        const fields = entry.changes.map((c) => c.field).concat(entry.statusChange ? ['status'] : []);
        await mongoose.connection.db.collection('leads').updateOne(
          { _id: result.lead._id },
          { $push: { pipelineHistory: {
            status: 'Updated via import',
            date: new Date(),
            updatedBy: actor?.id,
            note: `${originalName} (row ${entry.row}): ${fields.join(', ')}`
          } } }
        );
        updated++;
        continue;
      }

      const data = entry._create;
      const lead = await Lead.create({
        fullName: data.fullName,
        phone: data.phone,
        altPhone: data.altPhone || undefined,
        // Leads imported from a spreadsheet rarely have a real email —
        // synthesized the same way the Facebook path does, since the
        // schema requires one.
        email: data.email || `import_${Date.now()}_${entry.row}@vedhunt.in`,
        service:     data.service || 'Not specified',
        message:     data.message || data.remark,
        city:        data.city,
        country:     data.country,
        platform:    data.platform || 'Facebook',
        userSource:  'Manual Import',
        source:      data.campaign ? `Manual Import (Campaign: ${data.campaign})` : `Manual Import (${data.form || originalName})`,
        utmCampaign: data.campaign,
        utmContent:  data.form,
        consent:     true,
        rawPayload:  { importedFrom: originalName, row: entry.row },
        pipelineHistory: [{ status: 'New', note: `Imported from ${originalName}` }]
      });
      await autoAssignLead(lead);
      imported++;
    } catch (err) {
      logger.error(`Lead import: failed to save row ${entry.row} from ${originalName}:`, err);
      invalid.push({ row: entry.row, reason: err.message || 'Failed to save' });
    }
  }
  invalid.sort((a, b) => a.row - b.row);
  report(todo.length);

  logger.info(
    `Lead import by ${actor?.id || 'unknown'}: ${imported} new, ${updated} updated, ${unchanged} unchanged, ${invalid.length} skipped, out of ${plan.length} rows (${originalName}).`
  );

  return { totalRows: plan.length, imported, updated, unchanged, invalid };
}

module.exports = { prepareImport, previewImport, runImport, buildImportPlan };
