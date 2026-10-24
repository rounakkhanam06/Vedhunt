import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLeadAccess } from '../../shared/crmAccess';
import { motion } from 'framer-motion';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Eye, Download, LayoutGrid, Table, UserCheck, FileText, Upload as UploadIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import LeadsPipelineView from '../components/LeadsPipelineView';
import { downloadLeadsCsv } from '../utils/leadExport';
import ImportLeadsModal from '../components/ImportLeadsModal';
import BulkReassignModal from '../components/BulkReassignModal';
import { INTEREST_LEVELS } from '../../shared/leadConstants';
import { SERVICES_REQUIRED_OPTIONS, LEAD_PRIORITY_LEVELS } from '../../shared/serviceQualification';

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person, fallback = 'Unknown') {
  if (!person) return null;
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || fallback;
}

/** Truncated page list, e.g. [1, '...', 5, 6, 7, '...', 72] — keeps the Prev/Next controls reachable regardless of page count. */
function getPaginationRange(current, total, delta = 1) {
  const range = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  const withDots = [];
  let last = null;
  for (const page of range) {
    if (last !== null) {
      if (page - last === 2) withDots.push(last + 1);
      else if (page - last !== 1) withDots.push('...');
    }
    withDots.push(page);
    last = page;
  }
  return withDots;
}

const STATUS_BADGE_CLASSES = {
  Won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-red-500/10 text-red-400 border-red-500/20',
  Dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Hold: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

// The dates the date-range filter can apply to (server: leadController.getLeads's dateField).
const DATE_FIELD_LABELS = { received: 'Received', assigned: 'Assigned', lastCall: 'Last call', lastActivity: 'Last activity' };

const ALL_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'];
// Statuses each page can contain (server/utils/leadActivity.js). Working keeps
// New/Contacted leads that have connected but not moved stage yet.
const STATUS_OPTIONS_BY_GROUP = {
  working: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'],
  'dropped-hold': ['Dropped', 'Hold'],
};

const fmtShortDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

export default function LeadsManager({ stageGroup }) {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const { http, root, can, leadPath } = useLeadAccess();
  const isSuperAdmin = can('*');
  const canAssign = can('leads.assign');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('leadsViewMode') || 'table');
  const [bds, setBds] = useState([]);

  // Pagination & Filters state — initial values read from the URL so a
  // dashboard KPI's drill-down link (e.g. /admin/leads/all?platform=Facebook&leadPriority=Hot)
  // actually lands pre-filtered, not just on an unfiltered list.
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [platformFilter, setPlatformFilter] = useState(searchParams.get('platform') || 'All');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('userSource') || 'All');
  // Sales vs Hiring. Facebook delivers both through the same webhook, and the
  // sales pipeline/revenue fields are meaningless for job applicants.
  const [leadTypeFilter, setLeadTypeFilter] = useState(searchParams.get('leadType') || 'Sales');
  const [formFilter, setFormFilter] = useState('All');
  const [assignedBdFilter, setAssignedBdFilter] = useState(searchParams.get('assignedTo') || 'All');
  const [serviceFilter, setServiceFilter] = useState(searchParams.get('service') || 'All');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('leadPriority') || 'All');
  const [breachedOnly, setBreachedOnly] = useState(searchParams.get('followUpBreached') === 'true');
  const [interestFilter, setInterestFilter] = useState(searchParams.get('interestLevel') || 'All');
  const [followUpFrom, setFollowUpFrom] = useState(searchParams.get('followUpFrom') || '');
  const [followUpTo, setFollowUpTo] = useState(searchParams.get('followUpTo') || '');
  const [stageFilter] = useState(searchParams.get('stage') || '');
  const [connectedFilter] = useState(searchParams.get('connected') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  // Which date the range applies to: received (createdAt), assigned, or last call.
  const [dateField, setDateField] = useState(searchParams.get('dateField') || 'received');
  const [leadForms, setLeadForms] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    setSearchTerm(''); // Clear search on mode switch for a clean view
  };

  // Fetch leads when dependencies change
  // Last filter set sent to the server: "select all matching" reuses it so the
  // bulk selection is exactly the list the admin is looking at.
  const lastFilterParams = useRef({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
          page: currentPage,
          limit: 10, // Items per page
          status: statusFilter,
          stageGroup,
          platform: platformFilter,
          userSource: sourceFilter,
          leadType: leadTypeFilter,
          fbFormId: formFilter,
          assignedTo: assignedBdFilter,
          service: serviceFilter,
          leadPriority: priorityFilter,
          followUpBreached: breachedOnly || undefined,
          interestLevel: interestFilter,
          followUpFrom: followUpFrom || undefined,
          followUpTo: followUpTo || undefined,
          stage: stageFilter || undefined,
          connected: connectedFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          dateField: (dateFrom || dateTo) && dateField !== 'received' ? dateField : undefined,
          search: debouncedSearchTerm,
          sortBy,
          sortOrder
      };
      lastFilterParams.current = params;
      const response = await http.get(`${root}/leads`, { params });
      if (response.data.success) {
        setLeads(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalLeads(response.data.totalLeads);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, stageGroup, platformFilter, sourceFilter, leadTypeFilter, formFilter, assignedBdFilter, serviceFilter, priorityFilter, breachedOnly, interestFilter, followUpFrom, followUpTo, stageFilter, connectedFilter, dateFrom, dateTo, dateField, debouncedSearchTerm, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Raw Leads hides anything a BD has already touched, so its count runs
  // below the "Results" Facebook shows for the same form — which reads like a
  // sync gap. For a selected form, show the full split so the numbers add up.
  // Scoped to the form (and received-date range) only, matching what Ads
  // Manager counts; other filters on the page don't apply.
  const [formSummary, setFormSummary] = useState(null);
  useEffect(() => {
    if (stageGroup !== 'raw' || formFilter === 'All') return;
    let cancelled = false;
    const useDates = dateField === 'received';
    const countFor = (group) => http.get(`${root}/leads`, {
      params: {
        stageGroup: group,
        fbFormId: formFilter,
        leadType: 'All',
        dateFrom: (useDates && dateFrom) || undefined,
        dateTo: (useDates && dateTo) || undefined,
        limit: 1
      }
    }).then((res) => res.data?.totalLeads ?? 0);

    Promise.all([countFor('raw'), countFor('working')])
      .then(([raw, working]) => {
        if (!cancelled) setFormSummary({ formId: formFilter, raw, working, total: raw + working });
      })
      .catch(() => { /* summary is a convenience — just leave it hidden */ });

    return () => { cancelled = true; };
    // totalLeads is a dependency so the summary refreshes after a delete.
  }, [stageGroup, formFilter, dateField, dateFrom, dateTo, totalLeads]);

  // Populate the form filter dropdown. Forms register themselves as leads
  // arrive, so this list grows on its own.
  useEffect(() => {
    http.get(`${root}/admin/lead-forms`)
      .then((res) => setLeadForms(res.data?.data || []))
      .catch(() => { /* filter just stays empty — not worth a toast */ });
  }, []);

  // BD roster for the "Assigned BD" filter and the assign control — only
  // fetchable by users who can actually assign (BDs get a 403, harmlessly skipped).
  useEffect(() => {
    if (!canAssign) return;
    http.get(`${root}/admin/assignment/bds`)
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* filter/assign control just stays empty */ });
  }, [canAssign]);

  // Deep link from a notification — /admin/leads?leadId=... redirects
  // straight into that lead's Workspace page.
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId) return;
    navigate(leadPath(leadId), { replace: true });
    // Only run once on mount — the leadId param is consumed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Bulk reassignment ----------------------------------------------------
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // 'all-matching' only while the selection is exactly "every lead matching
  // the filters"; any hand edit turns it back into a manual selection.
  const [selectionMode, setSelectionMode] = useState('manual');
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkReview, setBulkReview] = useState(null);

  const clearSelection = () => { setSelectedIds(new Set()); setSelectionMode('manual'); };

  // A selection made under one filter must not silently carry over to another.
  useEffect(() => {
    clearSelection();
  }, [statusFilter, platformFilter, sourceFilter, leadTypeFilter, formFilter, assignedBdFilter, serviceFilter, priorityFilter, breachedOnly, interestFilter, followUpFrom, followUpTo, dateFrom, dateTo, dateField, debouncedSearchTerm, stageGroup]);

  const pageIds = leads.map((l) => l._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;

  const toggleLead = (id) => {
    setSelectionMode('manual');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectionMode('manual');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id)); else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllMatching = async () => {
    try {
      const filters = { ...lastFilterParams.current };
      delete filters.page;
      delete filters.limit;
      const res = await http.get(`${root}/leads`, { params: { ...filters, idsOnly: true } });
      if (res.data?.success) {
        setSelectedIds(new Set(res.data.ids));
        setSelectionMode('all-matching');
      }
    } catch {
      toast.error('Could not select all matching leads');
    }
  };

  // Preview → confirm → summary all happen in BulkReassignModal. When the list
  // is filtered by one owner, the server refuses any lead no longer theirs.
  const handleBulkReassign = () => {
    if (!bulkTarget || selectedIds.size === 0) return;
    setBulkReview({
      leadIds: [...selectedIds],
      target: bulkTarget,
      expectedOwner: assignedBdFilter !== 'All' && assignedBdFilter !== 'Unassigned' ? assignedBdFilter : null,
      filterChips: activeFilterChips,
      selection: selectionMode,
    });
  };

  const afterBulkReassign = () => {
    clearSelection();
    setBulkTarget('');
    fetchLeads();
    // Workload counts in the BD dropdown are now stale.
    http.get(`${root}/admin/assignment/bds`).then((r) => setBds(r.data?.data || [])).catch(() => {});
  };


  const handleAssign = async (leadId, assignedTo, reason = '') => {
    try {
      const response = await http.post(`${root}/leads/${leadId}/assign`, { assignedTo: assignedTo || null, reason });
      const updated = response.data.data;
      setLeads(leads.map(l => l._id === leadId ? updated : l));
      toast.success(assignedTo ? 'Lead assigned' : 'Lead unassigned');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign lead');
    }
  };

  const deleteLead = async (id) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await http.post(`${root}/leads/${id}/delete`);
        toast.success('Lead deleted successfully');
        fetchLeads();
      } catch (error) {
        toast.error(`Failed to delete lead: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  // Combined-field version — anything that participates in stage gating
  // (connected+notConnectedReason+interestLevel, or a status change plus its
  // mandatory companion data) must travel in one request, since
  // server/utils/leadStateMachine.js validates the merged result of a single
  // update, not a sequence of partial ones.
  const handleFieldsChange = async (id, fields) => {
    try {
      const res = await http.put(`${root}/leads/${id}`, fields);
      setLeads(leads.map(l => l._id === id ? { ...l, ...fields } : l));
      toast.success('Saved', { duration: 1000, position: 'bottom-right' });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update lead');
      throw error;
    }
  };

  const handleFieldChange = (id, field, value) => handleFieldsChange(id, { [field]: value });

  // Used by the Pipeline (Kanban) view's per-card quick actions — the raw-field
  // table itself no longer surfaces call handling; that lives on the Workspace page.
  const startCall = async (id) => {
    try {
      const now = new Date();
      await http.put(`${root}/leads/${id}`, { callStartTime: now, callDate: now });
      setLeads(leads.map(l => l._id === id ? { ...l, callStartTime: now, callDate: now } : l));
      toast.success('Call started', { position: 'bottom-right' });
    } catch {
      toast.error('Failed to start call');
    }
  };

  const endCall = async (lead) => {
    if (!lead.callStartTime) {
      toast.error('Please start the call first');
      return;
    }
    try {
      const now = new Date();
      const diffMs = now.getTime() - new Date(lead.callStartTime).getTime();
      const durationMin = Math.max(1, Math.round(diffMs / 60000));
      await http.put(`${root}/leads/${lead._id}`, { callEndTime: now, callDuration: durationMin });
      setLeads(leads.map(l => l._id === lead._id ? { ...l, callEndTime: now, callDuration: durationMin } : l));
      toast.success(`Call ended (${durationMin} min)`, { position: 'bottom-right' });
    } catch {
      toast.error('Failed to end call');
    }
  };

  const handleExport = async (format) => {
    try {
      toast.loading('Preparing export...', { id: 'export-toast' });
      const response = await http.get(`${root}/leads`, {
        params: {
          export: true,
          status: statusFilter,
          stageGroup,
          platform: platformFilter,
          userSource: sourceFilter,
          leadType: leadTypeFilter,
          fbFormId: formFilter,
          assignedTo: assignedBdFilter,
          service: serviceFilter,
          leadPriority: priorityFilter,
          followUpBreached: breachedOnly || undefined,
          interestLevel: interestFilter,
          followUpFrom: followUpFrom || undefined,
          followUpTo: followUpTo || undefined,
          stage: stageFilter || undefined,
          connected: connectedFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          dateField: (dateFrom || dateTo) && dateField !== 'received' ? dateField : undefined,
          search: debouncedSearchTerm,
          sortBy,
          sortOrder
        }
      });
      if (response.data.success) {
        const leadsToExport = response.data.data;
        if (leadsToExport.length === 0) {
          toast.error('No leads to export', { id: 'export-toast' });
          return;
        }

        if (format === 'csv') {
          downloadLeadsCsv(leadsToExport, stageGroup ? `${stageGroup}_leads_export` : 'leads_export');
          toast.success('Export downloaded successfully', { id: 'export-toast' });
        }
      }
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Failed to export leads', { id: 'export-toast' });
    }
  };

  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const compactSelectClass = "bg-app-bg border border-app-border rounded-lg pl-3 pr-8 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer w-full sm:w-auto sm:max-w-[220px] truncate";

  // Plain-English summary of every active filter — so a lead list reached by
  // clicking a dashboard KPI always shows what's actually inside that number,
  // not just a bare table.
  const activeFilterChips = [
    statusFilter !== 'All' && `Status: ${statusFilter}`,
    platformFilter !== 'All' && `Platform: ${platformFilter}`,
    sourceFilter !== 'All' && `Source: ${sourceFilter}`,
    serviceFilter !== 'All' && `Service: ${serviceFilter}`,
    priorityFilter !== 'All' && `Priority: ${priorityFilter}`,
    assignedBdFilter !== 'All' && `BD: ${assignedBdFilter === 'Unassigned' ? 'Unassigned' : (bds.find((b) => b._id === assignedBdFilter) ? `${bds.find((b) => b._id === assignedBdFilter).firstName} ${bds.find((b) => b._id === assignedBdFilter).lastName}` : assignedBdFilter)}`,
    breachedOnly && 'Follow-up Breached only',
    interestFilter !== 'All' && `Interest: ${interestFilter}`,
    (followUpFrom || followUpTo) && `Follow-up due: ${followUpFrom || '…'} to ${followUpTo || '…'}`,
    stageFilter === 'open' && 'Open pipeline (not Won/Lost/Dropped/Hold)',
    connectedFilter && `Connected: ${connectedFilter}`,
    (dateFrom || dateTo) && `${DATE_FIELD_LABELS[dateField] || 'Received'}: ${dateFrom || '…'} to ${dateTo || '…'}`
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-app-text font-heading">
            {stageGroup === 'raw' ? 'Raw Leads' : stageGroup === 'working' ? 'Working Leads' : stageGroup === 'dropped-hold' ? 'Dropped & Hold Leads' : 'Lead Manager'}
          </h1>
          <p className="text-sm text-app-text-muted mt-1 max-w-3xl">
            {stageGroup === 'raw' && 'Assigned to a BD, no action taken yet. A logged call (even unanswered), message or note moves it to Working. Unassigned leads are on the Unassigned page. '}
            {stageGroup === 'working' && 'A BD has taken action (call, message or note) and the lead is still open. Won, Lost, Dropped and Hold leads leave this list. '}{stageGroup === 'dropped-hold' && 'Dropped and on-hold leads with their owner and history. Reactivating one returns it to Raw or Working. '}
            {leadTypeFilter === 'All' ? 'Total' : leadTypeFilter} leads:{' '}
            <span className="font-semibold text-app-text">{totalLeads}</span>
          </p>
          {stageGroup === 'raw' && formSummary?.formId === formFilter && (
            <p className="text-xs text-app-text-muted mt-1.5">
              This form{dateField === 'received' && (dateFrom || dateTo) ? ' (selected dates)' : ''}:{' '}
              <span className="font-semibold text-app-text">{formSummary.total}</span> total ={' '}
              <span className="font-semibold text-app-text">{formSummary.raw}</span> raw +{' '}
              <span className="font-semibold text-app-text">{formSummary.working}</span> working
              <span className="opacity-75"> — compare the total with Facebook&apos;s Results</span>
            </p>
          )}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeFilterChips.map((chip) => (
                <span key={chip} className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start">
          {stageGroup === 'raw' && can('leads.import') && (
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg font-semibold text-sm shadow-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <UploadIcon className="w-4 h-4" />
              <span>Import Leads</span>
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="inline-flex items-center gap-2 bg-app-card border border-app-border hover:border-primary/50 hover:bg-surface-variant/40 text-app-text px-3.5 py-2 rounded-lg font-semibold text-sm shadow-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-app-text-muted" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 text-app-text-muted transition-transform duration-200 ${showExportDropdown ? 'rotate-180 text-primary' : ''}`} />
            </button>
            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-app-card border border-app-border rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setShowExportDropdown(false);
                      handleExport('csv');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-app-text hover:bg-surface-variant hover:text-primary transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Export as CSV</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showImportModal && (
        <ImportLeadsModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchLeads}
        />
      )}

      {bulkReview && (
        <BulkReassignModal
          http={http}
          root={root}
          leadPath={leadPath}
          {...bulkReview}
          onClose={() => setBulkReview(null)}
          onDone={afterBulkReassign}
        />
      )}

      {/* Toolbar: type split + view toggle, one row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max max-w-full overflow-x-auto">
          {['Sales', 'Hiring', 'All'].map((type) => (
            <button
              key={type}
              onClick={() => {
                setLeadTypeFilter(type);
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                leadTypeFilter === type ? 'bg-primary text-black' : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              {type === 'All' ? 'All Leads' : `${type} Leads`}
            </button>
          ))}
        </div>

        <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max max-w-full overflow-x-auto">
          <button
            onClick={() => handleViewModeChange('table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'table' ? 'bg-primary text-black' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <Table size={15} /> Table
          </button>
          <button
            onClick={() => handleViewModeChange('pipeline')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'pipeline' ? 'bg-primary text-black' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <LayoutGrid size={15} /> Pipeline
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-app-card p-3 rounded-xl border border-app-border">
        <div className="relative flex-grow sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Search name, email, phone or Lead ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="hidden sm:block w-px h-6 bg-app-border" />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {stageGroup !== 'raw' && (
            <div className="relative min-w-0">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={compactSelectClass}
              >
                <option className="bg-app-bg text-app-text" value="All">{stageGroup === 'working' ? 'All Working Statuses' : stageGroup === 'dropped-hold' ? 'Dropped & Hold' : 'All Statuses'}</option>
                {(STATUS_OPTIONS_BY_GROUP[stageGroup] || ALL_STATUSES).map((st) => (
                  <option key={st} className="bg-app-bg text-app-text" value={st}>{st}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
            </div>
          )}

          <div className="relative min-w-0">
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={compactSelectClass}
            >
              <option className="bg-app-bg text-app-text" value="All">All Platforms</option>
              <option className="bg-app-bg text-app-text" value="Website">Website</option>
              <option className="bg-app-bg text-app-text" value="Facebook">Facebook</option>
              <option className="bg-app-bg text-app-text" value="Google Ads">Google Ads</option>
              <option className="bg-app-bg text-app-text" value="Instagram">Instagram</option>
              <option className="bg-app-bg text-app-text" value="Manual">Manual</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          <div className="relative min-w-0">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={compactSelectClass}
            >
              <option className="bg-app-bg text-app-text" value="All">All Sources</option>
              <option className="bg-app-bg text-app-text" value="Google">Google</option>
              <option className="bg-app-bg text-app-text" value="Facebook">Facebook</option>
              <option className="bg-app-bg text-app-text" value="Instagram">Instagram</option>
              <option className="bg-app-bg text-app-text" value="LinkedIn">LinkedIn</option>
              <option className="bg-app-bg text-app-text" value="YouTube">YouTube</option>
              <option className="bg-app-bg text-app-text" value="Referral">Referral</option>
              <option className="bg-app-bg text-app-text" value="Direct">Direct</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          {leadForms.length > 0 && (
            <div className="relative min-w-0">
              <select
                value={formFilter}
                onChange={(e) => {
                  setFormFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={compactSelectClass}
              >
                <option className="bg-app-bg text-app-text" value="All">All Forms</option>
                {leadForms.map((form) => (
                  <option key={form._id} className="bg-app-bg text-app-text" value={form.formId}>
                    {form.name || form.formId}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
            </div>
          )}

          {canAssign && (
            <div className="relative min-w-0">
              <select
                value={assignedBdFilter}
                onChange={(e) => {
                  setAssignedBdFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`${compactSelectClass} pl-8`}
              >
                <option className="bg-app-bg text-app-text" value="All">All BDs</option>
                <option className="bg-app-bg text-app-text" value="Unassigned">Unassigned</option>
                {bds.map((bd) => (
                  <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>
                    {bd.firstName} {bd.lastName}
                  </option>
                ))}
              </select>
              <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
            </div>
          )}

          <div className="relative min-w-0">
            <select
              value={serviceFilter}
              onChange={(e) => { setServiceFilter(e.target.value); setCurrentPage(1); }}
              className={compactSelectClass}
            >
              <option className="bg-app-bg text-app-text" value="All">All Services</option>
              {SERVICES_REQUIRED_OPTIONS.map((svc) => (
                <option key={svc} className="bg-app-bg text-app-text" value={svc}>{svc}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          <div className="relative min-w-0">
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className={compactSelectClass}
            >
              <option className="bg-app-bg text-app-text" value="All">All Priorities</option>
              {LEAD_PRIORITY_LEVELS.map((p) => (
                <option key={p} className="bg-app-bg text-app-text" value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          <button
            onClick={() => { setBreachedOnly((v) => !v); setCurrentPage(1); }}
            className={`w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              breachedOnly ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-app-bg text-app-text-muted border-app-border hover:border-red-500/30'
            }`}
          >
            Breached only
          </button>

          <div className="relative min-w-0">
            <select
              value={interestFilter}
              onChange={(e) => { setInterestFilter(e.target.value); setCurrentPage(1); }}
              className={compactSelectClass}
              aria-label="Interest level"
            >
              <option className="bg-app-bg text-app-text" value="All">All Interest Levels</option>
              {INTEREST_LEVELS.map((l) => (
                <option key={l} className="bg-app-bg text-app-text" value={l}>{l}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          <div className="col-span-2 flex flex-wrap items-center gap-1.5">
            <span className="text-app-text-muted text-xs">Follow-up due</span>
            <input
              type="date"
              value={followUpFrom}
              onChange={(e) => { setFollowUpFrom(e.target.value); setCurrentPage(1); }}
              className={`${compactSelectClass} flex-1 min-w-[130px] sm:flex-none sm:w-auto`}
              style={{ colorScheme: 'dark' }}
              title="Follow-up due from"
            />
            <span className="text-app-text-muted text-xs">to</span>
            <input
              type="date"
              value={followUpTo}
              onChange={(e) => { setFollowUpTo(e.target.value); setCurrentPage(1); }}
              className={`${compactSelectClass} flex-1 min-w-[130px] sm:flex-none sm:w-auto`}
              style={{ colorScheme: 'dark' }}
              title="Follow-up due to"
            />
            {(followUpFrom || followUpTo) && (
              <button
                onClick={() => { setFollowUpFrom(''); setFollowUpTo(''); setCurrentPage(1); }}
                className="text-xs text-app-text-muted hover:text-primary underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="col-span-2 flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-0 w-full sm:w-auto">
              <select
                value={dateField}
                onChange={(e) => { setDateField(e.target.value); setCurrentPage(1); }}
                className={compactSelectClass}
                title="Which date the range filters on"
              >
                {Object.entries(DATE_FIELD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={14} />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className={`${compactSelectClass} flex-1 min-w-[130px] sm:flex-none sm:w-auto`}
              style={{ colorScheme: 'dark' }}
              title="From date"
            />
            <span className="text-app-text-muted text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className={`${compactSelectClass} flex-1 min-w-[130px] sm:flex-none sm:w-auto`}
              style={{ colorScheme: 'dark' }}
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                className="text-xs text-app-text-muted hover:text-primary underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : viewMode === 'pipeline' ? (
        <LeadsPipelineView
          leads={leads}
          isSuperAdmin={isSuperAdmin}
          handleFieldChange={handleFieldChange}
          handleFieldsChange={handleFieldsChange}
          startCall={startCall}
          endCall={endCall}
          onOpenLead={(lead) => navigate(leadPath(lead._id))}
          handleAssign={handleAssign}
          bds={bds}
          canAssign={canAssign}
        />
      ) : (
        <>
          <div className="w-full">
            {canAssign && selectedIds.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 text-sm">
                <span className="font-semibold text-app-text">
                  {selectionMode === 'all-matching'
                    ? `All ${selectedIds.size} leads matching the filters selected (every page)`
                    : `${selectedIds.size} selected${selectedOnPage === selectedIds.size ? ' on this page' : ` (${selectedOnPage} on this page)`}`}
                </span>
                {selectionMode !== 'all-matching' && totalLeads > selectedIds.size && (
                  <button onClick={selectAllMatching} className="text-primary font-semibold hover:underline">
                    Select all {totalLeads} matching these filters
                  </button>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <select
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary"
                    aria-label="Reassign selected leads to"
                  >
                    <option value="">Reassign to...</option>
                    {bds.map((bd) => (
                      <option key={bd._id} value={bd._id}>{displayName(bd)} ({bd.activeLeadCount} active)</option>
                    ))}
                    <option value="unassign">Unassign</option>
                  </select>
                  <button
                    onClick={handleBulkReassign}
                    disabled={!bulkTarget}
                    className="px-4 py-2 rounded-lg bg-primary text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review reassignment
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-2 text-app-text-muted hover:text-app-text text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {leads.length === 0 ? (
              <div className="text-center py-12 bg-app-card border border-app-border rounded-xl">
                <p className="text-app-text-muted">No leads found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm pb-4">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[1500px]">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider sticky top-0 z-20">
                    <tr>
                      <th onClick={() => handleSort('leadId')} className="px-3 py-3 font-semibold sticky left-0 bg-app-bg z-30 border-r border-app-border cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          {canAssign && (
                            <input
                              type="checkbox"
                              checked={allPageSelected}
                              onChange={togglePage}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Select all leads on this page"
                              title="Select all on this page"
                              className="mr-1 w-4 h-4 accent-[#FF6B00] cursor-pointer"
                            />
                          )}
                          <span>Lead ID</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'leadId' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('createdAt')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Received Date/Time</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'createdAt' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('assignedAt')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Assigned</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'assignedAt' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('lastCallAt')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Last Call</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'lastCallAt' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('lastActivityAt')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Last Activity</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'lastActivityAt' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('fullName')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Lead Name</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'fullName' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 font-semibold">Phone</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">City</th>
                      <th className="px-3 py-3 font-semibold border-r-2 border-app-border">Country</th>
                      <th onClick={() => handleSort('platform')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Platform</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'platform' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('utmCampaign')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Campaign (UTM)</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'utmCampaign' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('userSource')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Source</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'userSource' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('service')} className="px-3 py-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
                          <span>Segment (Service)</span>
                          <span className="text-[9px] opacity-70">{sortBy === 'service' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 font-semibold border-r-2 border-app-border">BD</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/70 text-[13px]">
                    {leads.map((lead, rowIdx) => {
                      const rowStripeClass = rowIdx % 2 === 1 ? 'bg-app-bg/30' : 'bg-app-card';
                      return (
                      <motion.tr
                        key={lead._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`hover:bg-surface-variant transition-colors group ${rowStripeClass}`}
                      >
                        <td className={`px-3 py-2 align-middle font-mono font-semibold text-primary sticky left-0 ${rowStripeClass} group-hover:bg-surface-variant border-r border-app-border z-10`}>
                          <div className="flex items-center gap-2">
                            {canAssign && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(lead._id)}
                                onChange={() => toggleLead(lead._id)}
                                aria-label={`Select ${lead.fullName || lead.leadId}`}
                                className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                              />
                            )}
                            <span>
                              {lead.leadId || '-'}
                              {lead.fbLeadId && <span className="block text-[10px] font-normal text-app-text-muted" title="Meta Lead ID">{lead.fbLeadId}</span>}
                            </span>
                            {!lead.assignedTo && lead.unassignedSlaDeadline && new Date(lead.unassignedSlaDeadline) < new Date() && (
                              <span title="SLA Breached (Unassigned)" className="text-red-500">⚠️</span>
                            )}
                            {lead.lockedBy && (
                              <span title="Locked for active handling" className="text-amber-500">🔒</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted min-w-[150px]">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : '-'}
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted whitespace-nowrap">{fmtShortDate(lead.assignedAt)}</td>
                        <td className="px-3 py-2 align-middle text-app-text-muted whitespace-nowrap">
                          {fmtShortDate(lead.lastCallAt || lead.callLogs?.reduce((max, c) => (c.callDate && (!max || new Date(c.callDate) > new Date(max)) ? c.callDate : max), null) || lead.callDate)}
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted whitespace-nowrap" title={lead.lastActivityType || ''}>
                          {fmtShortDate(lead.lastActivityAt)}
                          {lead.lastActivityType && <span className="block text-[10px] opacity-70">{lead.lastActivityType}</span>}
                        </td>
                        <td className="px-3 py-2 align-middle font-semibold text-app-text min-w-[150px]">
                          {isSuperAdmin ? (
                            <input 
                              type="text" 
                              defaultValue={lead.fullName} 
                              onBlur={(e) => { if(e.target.value !== lead.fullName) handleFieldChange(lead._id, 'fullName', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            />
                          ) : (
                            <span className="px-2 py-1">{lead.fullName || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          {isSuperAdmin ? (
                            <input 
                              type="text" 
                              defaultValue={lead.phone} 
                              onBlur={(e) => { if(e.target.value !== lead.phone) handleFieldChange(lead._id, 'phone', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            />
                          ) : (
                            <span className="px-2 py-1">{lead.phone || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[180px]">
                          {isSuperAdmin ? (
                            <input 
                              type="email" 
                              defaultValue={lead.email} 
                              onBlur={(e) => { if(e.target.value !== lead.email) handleFieldChange(lead._id, 'email', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-app-text-muted"
                            />
                          ) : (
                            <span className="px-2 py-1 text-app-text-muted">{lead.email || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          {isSuperAdmin ? (
                            <input 
                              type="text" 
                              defaultValue={lead.city || ''} 
                              placeholder="Add city..."
                              onBlur={(e) => { if(e.target.value !== lead.city) handleFieldChange(lead._id, 'city', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            />
                          ) : (
                            <span className="px-2 py-1">{lead.city || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px] border-r-2 border-app-border/60">
                          {isSuperAdmin ? (
                            <input
                              type="text"
                              defaultValue={lead.country || ''}
                              placeholder="Add country..."
                              onBlur={(e) => { if(e.target.value !== lead.country) handleFieldChange(lead._id, 'country', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            />
                          ) : (
                            <span className="px-2 py-1">{lead.country || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            lead.platform === 'Facebook' ? 'bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20' :
                            lead.platform === 'Google Ads' ? 'bg-[#0F9D58]/10 text-[#0F9D58] border border-[#0F9D58]/20' :
                            lead.platform === 'Instagram' ? 'bg-[#E1306C]/10 text-[#E1306C] border border-[#E1306C]/20' :
                            'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {lead.platform || 'Website'}
                          </div>
                          {lead.userSource && (
                            <div className="text-[10px] text-app-text-muted mt-0.5 font-medium">
                              Source: <span className="text-[#E5E2E1] font-semibold">{lead.userSource}</span>
                            </div>
                          )}
                          {lead.fbFormName && (
                            <div className="text-[10px] text-app-text-muted mt-0.5 font-medium truncate max-w-[150px]" title={lead.fbFormName}>
                              Form: <span className="text-[#E5E2E1] font-semibold">{lead.fbFormName}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted text-xs min-w-[140px] truncate max-w-[180px]" title={lead.utmCampaign || lead.adCampaignId || 'N/A'}>
                          {lead.utmCampaign || lead.adCampaignId || '-'}
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted text-xs truncate max-w-[150px]" title={lead.source}>
                          {lead.source ? (
                            <a href={lead.source} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                              {lead.source}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                            {lead.service}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px] border-r-2 border-app-border/60">
                          {canAssign && (isSuperAdmin || (!['Won', 'Lost', 'Dropped'].includes(lead.status) && !lead.lockedBy)) ? (
                            <select
                              value={lead.assignedTo?._id || ''}
                              onChange={(e) => handleAssign(lead._id, e.target.value || null)}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none cursor-pointer text-xs"
                            >
                              <option className="bg-app-bg text-app-text" value="">Unassigned</option>
                              {bds.map((bd) => (
                                <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>
                                  {bd.firstName} {bd.lastName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-1 text-xs">
                              {lead.assignedTo ? displayName(lead.assignedTo) : (lead.bd || 'Unassigned')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[110px]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${STATUS_BADGE_CLASSES[lead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className={`px-3 py-2 align-middle text-right whitespace-nowrap sticky right-0 ${rowStripeClass} group-hover:bg-surface-variant border-l border-app-border z-10 flex items-center justify-end gap-2`}>
                          <button
                            onClick={() => navigate(leadPath(lead._id))}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                            title="Open Lead Workspace"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {can('leads.delete') && (
                            <button
                              onClick={() => deleteLead(lead._id)}
                              className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium px-2 py-1 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-app-card border border-app-border p-4 rounded-xl mt-4">
              <span className="text-sm text-app-text-muted whitespace-nowrap">
                Showing page <span className="font-bold text-app-text">{currentPage}</span> of <span className="font-bold text-app-text">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2 max-w-full overflow-x-auto">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 shrink-0 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1">
                  {getPaginationRange(currentPage, totalPages).map((page, idx) => (
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="w-9 h-9 flex items-center justify-center text-sm text-app-text-muted">…</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 shrink-0 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-black'
                            : 'bg-app-bg border border-app-border text-app-text hover:bg-surface-variant'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 shrink-0 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
