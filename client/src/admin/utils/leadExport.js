// Single source of truth for the Leads CSV export — column headers here are
// kept 1:1 with the field labels shown on admin/pages/LeadWorkspace.jsx so
// the export and the portal never drift apart again. Both LeadsManager.jsx
// and UnassignedLeadsManager.jsx use this instead of maintaining their own
// header arrays.

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const pendingAmount = (lead) => Math.max(0, (lead.dealCloseValue || 0) - (lead.amountPaid || 0));

const LEAD_EXPORT_COLUMNS = [
  { header: 'Lead ID', value: (lead) => lead.leadId || '' },
  { header: 'Date', value: (lead) => (lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '') },
  { header: 'Name', value: (lead) => csvCell(lead.fullName) },
  { header: 'Phone', value: (lead) => lead.phone || '' },
  { header: 'Email', value: (lead) => lead.email || '' },
  { header: 'City', value: (lead) => csvCell(lead.city) },
  { header: 'Country', value: (lead) => csvCell(lead.country) },
  { header: 'Platform', value: (lead) => lead.platform || '' },
  { header: 'Type', value: (lead) => lead.leadType || 'Sales' },
  { header: 'Form', value: (lead) => csvCell(lead.fbFormName) },
  { header: 'Campaign', value: (lead) => csvCell(lead.utmCampaign || lead.adCampaignId) },
  { header: 'Source', value: (lead) => csvCell(lead.source) },
  { header: 'Service', value: (lead) => csvCell(lead.service) },
  { header: 'Business Name', value: (lead) => csvCell(lead.businessName) },
  { header: 'Website', value: (lead) => csvCell(lead.website) },
  { header: 'Services Required', value: (lead) => csvCell((lead.servicesRequired || []).join(', ')) },
  { header: 'Business Type', value: (lead) => csvCell(lead.businessType) },
  { header: 'BD', value: (lead) => csvCell(lead.bd) },
  { header: 'Status', value: (lead) => lead.status || '' },
  { header: 'Interest Level', value: (lead) => csvCell(lead.interestLevel) },
  { header: 'Last Call Date', value: (lead) => (lead.callDate ? new Date(lead.callDate).toLocaleString() : '') },
  { header: 'Call Duration', value: (lead) => lead.callDuration ?? '' },
  { header: 'Age @ Call', value: (lead) => lead.leadAgeAtCall ?? '' },
  { header: 'Touch #', value: (lead) => lead.touchNumber ?? '' },
  { header: 'Project Budget', value: (lead) => csvCell(lead.projectBudget) },
  { header: 'Monthly Marketing Budget', value: (lead) => csvCell(lead.monthlyMarketingBudget) },
  { header: 'Lead Priority', value: (lead) => lead.leadPriority || '' },
  { header: 'Lead Score', value: (lead) => lead.leadScore ?? '' },
  { header: 'Estimated Deal Value', value: (lead) => lead.dealValue ?? '' },
  { header: 'Deal Close Value', value: (lead) => lead.dealCloseValue ?? '' },
  { header: 'Payment Status', value: (lead) => lead.paymentStatus || '' },
  { header: 'Amount Paid', value: (lead) => lead.amountPaid ?? '' },
  { header: 'Pending Amount', value: (lead) => (lead.dealCloseValue ? pendingAmount(lead) : '') },
  { header: 'Remark', value: (lead) => csvCell(lead.remark) }
];

/** Builds the CSV string for a list of leads using LEAD_EXPORT_COLUMNS. */
export function buildLeadsCsv(leads) {
  const rows = [LEAD_EXPORT_COLUMNS.map((col) => col.header).join(',')];
  for (const lead of leads) {
    rows.push(LEAD_EXPORT_COLUMNS.map((col) => col.value(lead)).join(','));
  }
  return rows.join('\n');
}

/** Triggers a CSV file download for the given leads. */
export function downloadLeadsCsv(leads, filenamePrefix = 'leads_export') {
  const csvString = buildLeadsCsv(leads);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
