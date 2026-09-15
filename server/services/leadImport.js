const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { findDuplicateLead } = require('./leadDedup');
const { autoAssignLead } = require('./leadAssignment');

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
 * UPSERT BEHAVIOUR: If a row matches an existing lead (by phone or email),
 * the existing lead is updated in-place with any non-empty fields from the
 * sheet row (status, remark, service, city, country, fullName, altPhone).
 * A new lead is only created when there is no match.
 */

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^[+]?[0-9\s().-]{7,20}$/;

// Valid lead status values — must stay in sync with Lead model schema enum.
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];

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
 * Updates an existing lead in-place with non-empty fields from the sheet row.
 * Only safe, user-editable fields are patched — system-managed fields
 * (assignedTo, callLogs, proposalValue, etc.) are never touched.
 * If the status changes, a pipelineHistory entry is appended automatically.
 *
 * @param {Document} lead        Mongoose document of the existing lead.
 * @param {object}   rowData     Parsed field values from the spreadsheet row.
 * @param {string}   fileName    Original filename (used in audit note).
 */
async function updateExistingLeadFromSheet(lead, rowData, fileName) {
  const patch = {};

  // Helper — only set field if value is non-empty (never overwrite with blank)
  const applyIfPresent = (field, value) => {
    if (value && String(value).trim()) patch[field] = String(value).trim();
  };

  applyIfPresent('fullName', rowData.fullName);
  applyIfPresent('altPhone', rowData.altPhone);
  applyIfPresent('service',  rowData.service);
  applyIfPresent('city',     rowData.city);
  applyIfPresent('country',  rowData.country);

  // Remark: prefer the dedicated remark column; fall back to message column.
  const remarkValue = rowData.remark || rowData.message;
  applyIfPresent('remark', remarkValue);

  // Status: validate against enum before applying — silently ignore if invalid.
  const newStatus = rowData.status ? String(rowData.status).trim() : '';
  const statusChanged = newStatus && VALID_STATUSES.includes(newStatus) && newStatus !== lead.status;
  if (newStatus && VALID_STATUSES.includes(newStatus)) {
    patch.status = newStatus;
  }

  // Nothing to update — row had no meaningful changes.
  if (Object.keys(patch).length === 0 && !statusChanged) return;

  // Append pipelineHistory entry only when status actually changes.
  const updateOp = { $set: patch };
  if (statusChanged) {
    updateOp.$push = {
      pipelineHistory: {
        status: newStatus,
        date: new Date(),
        note: `Updated via bulk import: ${fileName}`
      }
    };
  }

  await Lead.findByIdAndUpdate(lead._id, updateOp, { runValidators: false });
}

/**
 * @param {Buffer} buffer        the uploaded file's raw content
 * @param {string} originalName  original filename (drives .xlsx vs .csv parsing)
 * @param {object} actor         { id } — used for assignment audit trail
 */
async function importLeadsFromFile(buffer, originalName, actor) {
  if (!/\.(xlsx|csv)$/i.test(originalName || '')) {
    throw Object.assign(new Error('Only .xlsx or .csv files are supported.'), { status: 400 });
  }

  const worksheet = await loadWorksheet(buffer, originalName);
  if (!worksheet || worksheet.rowCount < 2) {
    return { totalRows: 0, imported: 0, updated: 0, invalid: [] };
  }

  const headerRow = worksheet.getRow(1);
  const fieldMap = mapHeaders(headerRow);

  if (!fieldMap.fullName || !fieldMap.phone) {
    throw Object.assign(
      new Error('The file must have a name column and a phone column (e.g. "Full Name", "Phone").'),
      { status: 400 }
    );
  }

  let totalRows = 0;
  let imported = 0;
  let updated  = 0;
  const invalid = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const fullName = cellText(row, fieldMap.fullName);
    const phone    = cellText(row, fieldMap.phone);
    if (!fullName && !phone) continue; // fully blank row

    totalRows++;

    if (!fullName) {
      invalid.push({ row: rowNumber, reason: 'Missing name' });
      continue;
    }
    if (!phone || !phoneRegex.test(phone)) {
      invalid.push({ row: rowNumber, reason: 'Missing or invalid phone number' });
      continue;
    }

    const rawEmail = cellText(row, fieldMap.email);
    const email    = emailRegex.test(rawEmail) ? rawEmail : '';
    const altPhone = cellText(row, fieldMap.altPhone);

    // Build a parsed-row object to pass into helpers cleanly.
    const rowData = {
      fullName,
      phone,
      altPhone,
      email,
      service:  cellText(row, fieldMap.service),
      remark:   cellText(row, fieldMap.remark),
      message:  cellText(row, fieldMap.message),
      city:     cellText(row, fieldMap.city),
      country:  cellText(row, fieldMap.country),
      status:   cellText(row, fieldMap.status),
      campaign: cellText(row, fieldMap.campaign),
      form:     cellText(row, fieldMap.form),
      platform: cellText(row, fieldMap.platform),
    };

    try {
      const existing = await findDuplicateLead({ phone, altPhone, email });

      if (existing) {
        // ── UPSERT PATH ──────────────────────────────────────────────────────
        // Lead already exists — update it with whatever the sheet has changed
        // instead of silently skipping it.
        await updateExistingLeadFromSheet(existing, rowData, originalName);
        updated++;
        continue;
      }

      // ── NEW LEAD PATH ─────────────────────────────────────────────────────
      const { campaign, form, platform } = rowData;
      const lead = await Lead.create({
        fullName,
        phone,
        altPhone: altPhone || undefined,
        // Leads imported from a spreadsheet rarely have a real email —
        // synthesized the same way the Facebook path does, since the
        // schema requires one.
        email: email || `import_${Date.now()}_${rowNumber}@vedhunt.in`,
        service:     rowData.service || 'Not specified',
        message:     rowData.message || rowData.remark,
        city:        rowData.city,
        country:     rowData.country,
        platform:    platform || 'Facebook',
        userSource:  'Manual Import',
        source:      campaign ? `Manual Import (Campaign: ${campaign})` : `Manual Import (${form || originalName})`,
        utmCampaign: campaign,
        utmContent:  form,
        consent:     true,
        rawPayload:  { importedFrom: originalName, row: rowNumber },
        pipelineHistory: [{ status: 'New', note: `Imported from ${originalName}` }]
      });

      await autoAssignLead(lead);
      imported++;
    } catch (err) {
      logger.error(`Lead import: failed to save row ${rowNumber} from ${originalName}:`, err);
      invalid.push({ row: rowNumber, reason: err.message || 'Failed to save' });
    }
  }

  logger.info(
    `Lead import by ${actor?.id || 'unknown'}: ${imported} new, ${updated} updated, ${invalid.length} invalid, out of ${totalRows} rows (${originalName}).`
  );

  return { totalRows, imported, updated, invalid };
}

module.exports = { importLeadsFromFile };
