import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Eye, Download, LayoutGrid, Table, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import LeadsPipelineView from '../components/LeadsPipelineView';

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

export default function UnassignedLeadsManager() {
  const { can } = usePermissions();
  const isSuperAdmin = can('*');
  const canAssign = can('leads.assign');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('leadsViewMode') || 'table');
  const [bds, setBds] = useState([]);

  // Pagination & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  // Sales vs Hiring. Facebook delivers both through the same webhook, and the
  // sales pipeline/revenue fields are meaningless for job applicants.
  const [leadTypeFilter, setLeadTypeFilter] = useState('Sales');
  const [formFilter, setFormFilter] = useState('All');
  const [leadForms, setLeadForms] = useState([]);
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
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

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l._id));
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTo) {
      toast.error('Please select a BD');
      return;
    }
    
    try {
      const response = await api.post('/leads/bulk-assign', {
        leadIds: selectedLeads,
        assignedTo: bulkAssignTo,
        reason: 'Bulk Assigned from Unassigned View'
      });
      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedLeads([]);
        setBulkAssignTo('');
        fetchLeads();
      }
    } catch (error) {
      console.error('Bulk assign error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign leads');
    }
  };

  // Fetch leads when dependencies change
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads', {
        params: {
          page: currentPage,
          limit: 10, // Items per page
          status: statusFilter,
          platform: platformFilter,
          userSource: sourceFilter,
          leadType: leadTypeFilter,
          fbFormId: formFilter,
          assignedTo: 'Unassigned',
          search: debouncedSearchTerm,
          sortBy,
          sortOrder
        }
      });
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
  }, [currentPage, statusFilter, platformFilter, sourceFilter, leadTypeFilter, formFilter, debouncedSearchTerm, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Populate the form filter dropdown. Forms register themselves as leads
  // arrive, so this list grows on its own.
  useEffect(() => {
    api.get('/admin/lead-forms')
      .then((res) => setLeadForms(res.data?.data || []))
      .catch(() => { /* filter just stays empty — not worth a toast */ });
  }, []);

  // BD roster for the "Assigned BD" filter and the assign control — only
  // fetchable by users who can actually assign (BDs get a 403, harmlessly skipped).
  useEffect(() => {
    if (!canAssign) return;
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* filter/assign control just stays empty */ });
  }, [canAssign]);

  // Deep link from a notification — /admin/leads?leadId=... redirects
  // straight into that lead's Workspace page.
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId) return;
    navigate(`/admin/leads/${leadId}`, { replace: true });
    // Only run once on mount — the leadId param is consumed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssign = async (leadId, assignedTo, reason = '') => {
    try {
      const response = await api.post(`/leads/${leadId}/assign`, { assignedTo: assignedTo || null, reason });
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
        await api.post(`/leads/${id}/delete`);
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
      const res = await api.put(`/leads/${id}`, fields);
      setLeads(leads.map(l => l._id === id ? { ...l, ...fields } : l));
      toast.success('Saved', { duration: 1000, position: 'bottom-right' });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update lead');
      throw error;
    }
  };

  const handleFieldChange = (id, field, value) => handleFieldsChange(id, { [field]: value });

  const handleExport = async (format) => {
    try {
      toast.loading('Preparing export...', { id: 'export-toast' });
      const response = await api.get('/leads', {
        params: {
          export: true,
          status: statusFilter,
          platform: platformFilter,
          userSource: sourceFilter,
          leadType: leadTypeFilter,
          fbFormId: formFilter,
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
          const headers = ['Lead ID', 'Date', 'Name', 'Phone', 'Email', 'City', 'Country', 'Platform', 'Type', 'Form', 'Campaign', 'Business Name', 'Source', 'Service', 'BD', 'Call Duration', 'Status', 'Deal Value'];
          const csvRows = [headers.join(',')];

          for (const lead of leadsToExport) {
            const values = [
              lead.leadId || '',
              lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '',
              `"${(lead.fullName || '').replace(/"/g, '""')}"`,
              lead.phone || '',
              lead.email || '',
              `"${(lead.city || '').replace(/"/g, '""')}"`,
              `"${(lead.country || '').replace(/"/g, '""')}"`,
              lead.platform || '',
              lead.leadType || 'Sales',
              `"${(lead.fbFormName || '').replace(/"/g, '""')}"`,
              `"${(lead.utmCampaign || lead.adCampaignId || '').replace(/"/g, '""')}"`,
              `"${(lead.businessName || '').replace(/"/g, '""')}"`,
              `"${(lead.source || '').replace(/"/g, '""')}"`,
              `"${(lead.service || '').replace(/"/g, '""')}"`,
              `"${(lead.bd || '').replace(/"/g, '""')}"`,
              lead.callDuration || '',
              lead.status || '',
              lead.dealValue || ''
            ];
            csvRows.push(values.join(','));
          }

          const csvString = csvRows.join('\n');
          const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success('Export downloaded successfully', { id: 'export-toast' });
        }
      }
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Failed to export leads', { id: 'export-toast' });
    }
  };

  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const compactSelectClass = "bg-app-bg border border-app-border rounded-lg pl-3 pr-8 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading">Lead Manager</h1>
          <p className="text-sm text-app-text-muted mt-1">
            {leadTypeFilter === 'All' ? 'Total' : leadTypeFilter} leads:{' '}
            <span className="font-semibold text-app-text">{totalLeads}</span>
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="flex items-center gap-2 bg-app-card border border-app-border hover:border-primary px-4 py-2 rounded-lg font-semibold text-sm text-app-text transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showExportDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-app-card border border-app-border rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    handleExport('csv');
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-app-text hover:bg-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export as CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedLeads.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 p-3 rounded-xl flex items-center justify-between shadow-lg sticky top-0 z-30 mb-4 animate-in fade-in slide-in-from-top-4">
          <div className="font-semibold text-primary">
            {selectedLeads.length} lead(s) selected
          </div>
          <div className="flex items-center gap-3">
            <select
              value={bulkAssignTo}
              onChange={(e) => setBulkAssignTo(e.target.value)}
              className="bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-primary"
            >
              <option value="">-Select BD to Assign-</option>
              {bds.map(bd => (
                <option key={bd._id} value={bd._id}>{bd.firstName} {bd.lastName}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              className="px-4 py-1.5 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              Assign Selected
            </button>
          </div>
        </div>
      )}

      {/* Leads Table Toolbar: type split + view toggle, one row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max">
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

        <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max">
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
        <div className="relative flex-grow min-w-[220px]">
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={compactSelectClass}
            >
              <option className="bg-app-bg text-app-text" value="All">All Statuses</option>
              <option className="bg-app-bg text-app-text" value="New">New</option>
              <option className="bg-app-bg text-app-text" value="Contacted">Contacted</option>
              <option className="bg-app-bg text-app-text" value="Qualified">Qualified</option>
              <option className="bg-app-bg text-app-text" value="Proposal Sent">Proposal Sent</option>
              <option className="bg-app-bg text-app-text" value="Negotiation">Negotiation</option>
              <option className="bg-app-bg text-app-text" value="Won">Won</option>
              <option className="bg-app-bg text-app-text" value="Lost">Lost</option>
              <option className="bg-app-bg text-app-text" value="Dropped">Dropped</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          <div className="relative">
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

          <div className="relative">
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
              <option className="bg-app-bg text-app-text" value="LinkedIn">LinkedIn</option>
              <option className="bg-app-bg text-app-text" value="Instagram">Instagram</option>
              <option className="bg-app-bg text-app-text" value="WhatsApp">WhatsApp</option>
              <option className="bg-app-bg text-app-text" value="Twitter/X">Twitter/X</option>
              <option className="bg-app-bg text-app-text" value="YouTube">YouTube</option>
              <option className="bg-app-bg text-app-text" value="Referral">Referral</option>
              <option className="bg-app-bg text-app-text" value="Direct">Direct</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted w-3.5 h-3.5 pointer-events-none" />
          </div>

          {leadForms.length > 0 && (
            <div className="relative">
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="w-full">
            {leads.length === 0 ? (
              <div className="text-center py-12 bg-app-card border border-app-border rounded-xl">
                <p className="text-app-text-muted">No leads found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm pb-4">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[1550px]">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-3 sticky left-0 bg-app-bg z-30">
                        <input
                          type="checkbox"
                          checked={selectedLeads.length > 0 && selectedLeads.length === leads.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-app-border text-primary focus:ring-primary/50"
                        />
                      </th>
                      <th onClick={() => handleSort('leadId')} className="px-3 py-3 font-semibold sticky left-8 bg-app-bg z-30 border-r border-app-border cursor-pointer select-none hover:text-primary transition-colors">
                        <div className="flex items-center gap-1">
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
                      <th className="px-3 py-3 font-semibold">Business Name</th>
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
                        <td className={`px-3 py-2 align-middle sticky left-0 ${rowStripeClass} group-hover:bg-surface-variant z-10`}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead._id)}
                            onChange={() => toggleLeadSelection(lead._id)}
                            className="w-4 h-4 rounded border-app-border text-primary focus:ring-primary/50 cursor-pointer"
                          />
                        </td>
                        <td className={`px-3 py-2 align-middle font-mono font-semibold text-primary sticky left-8 ${rowStripeClass} group-hover:bg-surface-variant border-r border-app-border z-10`}>
                          <div className="flex items-center gap-2">
                            <span>{lead.leadId || '-'}</span>
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
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          {isSuperAdmin ? (
                            <input 
                              type="text" 
                              defaultValue={lead.businessName || ''} 
                              placeholder="Add business..."
                              onBlur={(e) => { if(e.target.value !== lead.businessName) handleFieldChange(lead._id, 'businessName', e.target.value) }}
                              className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            />
                          ) : (
                            <span className="px-2 py-1">{lead.businessName || '-'}</span>
                          )}
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
                            onClick={() => navigate(`/admin/leads/${lead._id}`)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                            title="Open Lead Workspace"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
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
