// Single source of truth for the Leads CSV export — column headers here are
// kept 1:1 with the field labels shown on admin/pages/LeadWorkspace.jsx so
// the export and the portal never drift apart again. Both LeadsManager.jsx
// and UnassignedLeadsManager.jsx use this instead of maintaining their own
// header arrays.

const csvCell = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
};

// Format phone so Excel treats it as text and doesn't convert to scientific notation (9.19E+11)
const csvPhone = (phone) => {
  if (!phone) return '""';
  const cleaned = String(phone).trim();
  return `"\t${cleaned.replace(/"/g, '""')}"`;
};

// Format dates nicely without commas (YYYY-MM-DD HH:mm:ss) so older or regional spreadsheet parsers never split on commas
const formatDateForCsv = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const pendingAmount = (lead) => Math.max(0, (lead.dealCloseValue || 0) - (lead.amountPaid || 0));

const LEAD_EXPORT_COLUMNS = [
  { header: 'Lead ID', value: (lead) => csvCell(lead.leadId) },
  { header: 'Date', value: (lead) => csvCell(formatDateForCsv(lead.createdAt)) },
  { header: 'Name', value: (lead) => csvCell(lead.fullName) },
  { header: 'Phone', value: (lead) => csvPhone(lead.phone) },
  { header: 'Email', value: (lead) => csvCell(lead.email) },
  { header: 'City', value: (lead) => csvCell(lead.city) },
  { header: 'Country', value: (lead) => csvCell(lead.country) },
  { header: 'Platform', value: (lead) => csvCell(lead.platform) },
  { header: 'Type', value: (lead) => csvCell(lead.leadType || 'Sales') },
  { header: 'Form', value: (lead) => csvCell(lead.fbFormName) },
  { header: 'Campaign', value: (lead) => csvCell(lead.utmCampaign || lead.adCampaignId) },
  { header: 'Source', value: (lead) => csvCell(lead.source) },
  { header: 'Service', value: (lead) => csvCell(lead.service) },
  { header: 'Business Name', value: (lead) => csvCell(lead.businessName) },
  { header: 'Website', value: (lead) => csvCell(lead.website) },
  { header: 'Services Required', value: (lead) => csvCell((lead.servicesRequired || []).join(', ')) },
  { header: 'Business Type', value: (lead) => csvCell(lead.businessType) },
  { header: 'BD', value: (lead) => csvCell(lead.bd) },
  { header: 'Status', value: (lead) => csvCell(lead.status) },
  { header: 'Connected', value: (lead) => csvCell(lead.connected) },
  { header: 'Not Connected Reason', value: (lead) => csvCell(lead.notConnectedReason) },
  { header: 'Interest Level', value: (lead) => csvCell(lead.interestLevel) },
  { header: 'Last Call Date', value: (lead) => csvCell(formatDateForCsv(lead.callDate)) },
  { header: 'Call Duration', value: (lead) => (lead.callDuration != null ? lead.callDuration : '') },
  { header: 'Age @ Call', value: (lead) => (lead.leadAgeAtCall != null ? lead.leadAgeAtCall : '') },
  { header: 'Touch #', value: (lead) => (lead.touchNumber != null ? lead.touchNumber : '') },
  { header: 'Next Follow-up Date', value: (lead) => csvCell(formatDateForCsv(lead.nextFollowUpDate)) },
  { header: 'Not Converted Reason', value: (lead) => csvCell(lead.notConvertedReason) },
  { header: 'Project Budget', value: (lead) => csvCell(lead.projectBudget) },
  { header: 'Monthly Marketing Budget', value: (lead) => csvCell(lead.monthlyMarketingBudget) },
  { header: 'Lead Priority', value: (lead) => csvCell(lead.leadPriority) },
  { header: 'Lead Score', value: (lead) => (lead.leadScore != null ? lead.leadScore : '') },
  { header: 'Estimated Deal Value', value: (lead) => (lead.dealValue != null ? lead.dealValue : '') },
  { header: 'Deal Close Value', value: (lead) => (lead.dealCloseValue != null ? lead.dealCloseValue : '') },
  { header: 'Expected Close Date', value: (lead) => csvCell(formatDateForCsv(lead.expectedCloseDate)) },
  { header: 'Payment Status', value: (lead) => csvCell(lead.paymentStatus) },
  { header: 'Amount Paid', value: (lead) => (lead.amountPaid != null ? lead.amountPaid : '') },
  { header: 'Pending Amount', value: (lead) => (lead.dealCloseValue ? pendingAmount(lead) : '') },
  { header: 'Remark', value: (lead) => csvCell(lead.remark) }
];

/** Builds the CSV string for a list of leads using LEAD_EXPORT_COLUMNS. */
export function buildLeadsCsv(leads) {
  const rows = [LEAD_EXPORT_COLUMNS.map((col) => csvCell(col.header)).join(',')];
  for (const lead of leads) {
    rows.push(LEAD_EXPORT_COLUMNS.map((col) => col.value(lead)).join(','));
  }
  return rows.join('\r\n');
}

/** Triggers a CSV file download for the given leads with UTF-8 BOM so Excel opens it with proper encoding. */
export function downloadLeadsCsv(leads, filenamePrefix = 'leads_export') {
  const csvString = buildLeadsCsv(leads);
  // \uFEFF is UTF-8 Byte Order Mark (BOM) — essential for Excel to read UTF-8 and not garble characters
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
