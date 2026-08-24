import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Mail, Phone, Clock, FileText, CheckCircle2, Search, ChevronDown, ChevronLeft, ChevronRight, Eye, X, Play, Square, Save, Download, LayoutGrid, Table, UserCheck, MessageCircle } from 'lucide-react';
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

/** Merges pipelineHistory + assignment history + a synthetic "captured" event into one sorted feed, newest first. */
function buildActivityTimeline(lead, assignmentHistory) {
  if (!lead) return [];
  const events = [];

  events.push({
    key: 'captured',
    title: `Lead captured via ${lead.platform || 'Website'}`,
    date: lead.createdAt,
    actor: null
  });

  (lead.pipelineHistory || []).forEach((h, idx) => {
    events.push({
      key: `pipeline-${idx}`,
      title: h.status,
      date: h.date,
      note: h.note,
      actor: null
    });
  });

  (assignmentHistory || []).forEach((entry) => {
    const toName = displayName(entry.toAdmin);
    events.push({
      key: entry._id,
      title: toName ? `Assigned to ${toName}` : 'Unassigned',
      date: entry.createdAt,
      note: entry.reason,
      actor: entry.mode === 'Auto-RoundRobin' ? 'Round-robin' : (displayName(entry.assignedBy) || 'Admin')
    });
  });

  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** WhatsApp deep link — Indian 10-digit numbers get the country code prefixed. */
function toWhatsAppHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
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

// Mirrors server/utils/followUpRules.js's INTEREST_LEVELS — no shared
// import path between server and client in this repo.
const INTEREST_LEVELS = ['Hot', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Asked to Call Later'];
const FOLLOWUP_TRIGGER_INTEREST_LEVELS = ['Hot', 'Warm', 'Interested', 'Asked to Call Later'];

const STATUS_BADGE_CLASSES = {
  Won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-red-500/10 text-red-400 border-red-500/20',
  Dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

export default function LeadsManager() {
  const { can } = usePermissions();
  const isSuperAdmin = can('*');
  const canAssign = can('leads.assign');
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('leadsViewMode') || 'table');
  const [bds, setBds] = useState([]);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [assignReason, setAssignReason] = useState('');

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
  const [assignedBdFilter, setAssignedBdFilter] = useState('All');
  const [leadForms, setLeadForms] = useState([]);
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
    localStorage.setItem('leadsViewMode', mode);
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
          assignedTo: assignedBdFilter,
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
  }, [currentPage, statusFilter, platformFilter, sourceFilter, leadTypeFilter, formFilter, assignedBdFilter, debouncedSearchTerm, sortBy, sortOrder]);

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

  // Deep link from a notification — /admin/leads?leadId=... opens that
  // lead's detail modal directly.
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId) return;
    api.get(`/leads/${leadId}`)
      .then((res) => {
        if (res.data?.success) setSelectedLead(res.data.data);
      })
      .catch(() => toast.error('That lead could not be found'))
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('leadId');
        setSearchParams(next, { replace: true });
      });
    // Only run once on mount — the leadId param is consumed and removed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch this lead's audit trail whenever the detail modal opens.
  useEffect(() => {
    if (!selectedLead?._id) {
      setAssignmentHistory([]);
      return;
    }
    api.get(`/leads/${selectedLead._id}/assignment-history`)
      .then((res) => setAssignmentHistory(res.data?.data || []))
      .catch(() => setAssignmentHistory([]));
  }, [selectedLead?._id]);

  const handleAssign = async (leadId, assignedTo, reason = '') => {
    try {
      const response = await api.post(`/leads/${leadId}/assign`, { assignedTo: assignedTo || null, reason });
      const updated = response.data.data;
      setLeads(leads.map(l => l._id === leadId ? updated : l));
      if (selectedLead?._id === leadId) setSelectedLead(updated);
      setAssignReason('');
      toast.success(assignedTo ? 'Lead assigned' : 'Lead unassigned');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign lead');
    }
  };

  const deleteLead = async (id) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await api.delete(`/leads/${id}`);
        toast.success('Lead deleted successfully');
        fetchLeads();
      } catch (error) {
        toast.error('Failed to delete lead');
      }
    }
  };

  const handleFieldChange = async (id, field, value) => {
    try {
      await api.put(`/leads/${id}`, { [field]: value });
      setLeads(leads.map(l => l._id === id ? { ...l, [field]: value } : l));
      toast.success('Auto-saved', { duration: 1000, position: 'bottom-right' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update field');
    }
  };

  const startCall = async (id) => {
    try {
      const now = new Date();
      await api.put(`/leads/${id}`, { callStartTime: now, callDate: now });
      setLeads(leads.map(l => l._id === id ? { ...l, callStartTime: now, callDate: now } : l));
      toast.success('Call started', { position: 'bottom-right' });
    } catch(err) {
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
      await api.put(`/leads/${lead._id}`, { callEndTime: now, callDuration: durationMin });
      setLeads(leads.map(l => l._id === lead._id ? { ...l, callEndTime: now, callDuration: durationMin } : l));
      toast.success(`Call ended (${durationMin} min)`, { position: 'bottom-right' });
    } catch(err) {
      toast.error('Failed to end call');
    }
  };

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

      {/* Toolbar: type split + view toggle, one row */}
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

          {canAssign && (
            <div className="relative">
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
          startCall={startCall}
          endCall={endCall}
          setSelectedLead={setSelectedLead}
        />
      ) : (
        <>
          <div className="w-full">
            {leads.length === 0 ? (
              <div className="text-center py-12 bg-app-card border border-app-border rounded-xl">
                <p className="text-app-text-muted">No leads found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm pb-4">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[2650px]">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider sticky top-0 z-20">
                    <tr>
                      <th onClick={() => handleSort('leadId')} className="px-3 py-3 font-semibold sticky left-0 bg-app-bg z-30 border-r border-app-border cursor-pointer select-none hover:text-primary transition-colors">
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
                      <th className="px-3 py-3 font-semibold text-center">Start Call</th>
                      <th className="px-3 py-3 font-semibold">Call Start Time</th>
                      <th className="px-3 py-3 font-semibold text-center">End Call</th>
                      <th className="px-3 py-3 font-semibold">Call End Time</th>
                      <th className="px-3 py-3 font-semibold">Duration (min)</th>
                      <th className="px-3 py-3 font-semibold">Call Date</th>
                      <th className="px-3 py-3 font-semibold">Connected?</th>
                      <th className="px-3 py-3 font-semibold border-r-2 border-app-border">Not Connected Reason</th>
                      <th className="px-3 py-3 font-semibold">Interest Level</th>
                      <th className="px-3 py-3 font-semibold">Stage</th>
                      <th className="px-3 py-3 font-semibold">Not Converted Reason</th>
                      <th className="px-3 py-3 font-semibold">Remark</th>
                      <th className="px-3 py-3 font-semibold border-r-2 border-app-border">Next Follow-up</th>
                      <th className="px-3 py-3 font-semibold">Age @ Call</th>
                      <th className="px-3 py-3 font-semibold">Touch #</th>
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
                          {lead.leadId || '-'}
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
                          {canAssign ? (
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
                        <td className="px-3 py-2 align-middle text-center">
                          <button onClick={() => startCall(lead._id)} className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-md transition-colors" title="Start Call">
                            <Play size={14} />
                          </button>
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted">
                          {lead.callStartTime ? new Date(lead.callStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2 align-middle text-center">
                          <button onClick={() => endCall(lead)} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors" title="End Call">
                            <Square size={14} />
                          </button>
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted">
                          {lead.callEndTime ? new Date(lead.callEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2 align-middle font-bold text-center">
                          {lead.callDuration ? `${lead.callDuration}` : '-'}
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted">
                          {lead.callDate ? new Date(lead.callDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[100px]">
                          <select 
                            value={lead.connected || ''}
                            onChange={(e) => handleFieldChange(lead._id, 'connected', e.target.value)}
                            className={`border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none cursor-pointer ${lead.connected === 'Yes' ? 'text-green-500 font-bold' : lead.connected === 'No' ? 'text-red-500 font-bold' : 'text-app-text'}`}
                          >
                            <option className="bg-app-bg text-app-text" value="">-Select-</option>
                            <option className="bg-app-bg text-app-text" value="Yes">Yes</option>
                            <option className="bg-app-bg text-app-text" value="No">No</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px] border-r-2 border-app-border/60">
                          <select
                            value={lead.notConnectedReason || ''}
                            onChange={(e) => handleFieldChange(lead._id, 'notConnectedReason', e.target.value)}
                            className="bg-white/[0.02] hover:bg-app-bg border border-white/5 hover:border-app-border px-2 py-1 rounded text-app-text focus:outline-none focus:border-primary cursor-pointer w-full"
                            disabled={lead.connected === 'Yes'}
                          >
                            <option className="bg-app-bg text-app-text" value="">-Select Reason-</option>
                            <option className="bg-app-bg text-app-text" value="Busy">Busy</option>
                            <option className="bg-app-bg text-app-text" value="Did Not Answer">Did Not Answer</option>
                            <option className="bg-app-bg text-app-text" value="Switched Off">Switched Off</option>
                            <option className="bg-app-bg text-app-text" value="Invalid Number">Invalid Number</option>
                            <option className="bg-app-bg text-app-text" value="Wrong Person">Wrong Person</option>
                            <option className="bg-app-bg text-app-text" value="Not Reachable">Not Reachable</option>
                            <option className="bg-app-bg text-app-text" value="Other">Other</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <select
                            value={lead.interestLevel || ''}
                            onChange={(e) => handleFieldChange(lead._id, 'interestLevel', e.target.value)}
                            className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-yellow-500 font-medium cursor-pointer text-xs"
                          >
                            <option className="bg-app-bg text-app-text" value="">—</option>
                            {INTEREST_LEVELS.map((level) => (
                              <option key={level} className="bg-app-bg text-app-text" value={level}>{level}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[130px]">
                          <select 
                            value={lead.status}
                            onChange={(e) => handleFieldChange(lead._id, 'status', e.target.value)}
                            className="bg-white/[0.02] hover:bg-app-bg border border-white/5 hover:border-app-border text-xs px-2 py-1 rounded text-app-text focus:outline-none focus:border-primary cursor-pointer w-full font-medium"
                          >
                            <option className="bg-app-bg text-app-text" value="New">New</option>
                            <option className="bg-app-bg text-app-text" value="Contacted">Contacted</option>
                            <option className="bg-app-bg text-app-text" value="Qualified">Qualified</option>
                            <option className="bg-app-bg text-app-text" value="Proposal Sent">Proposal Sent</option>
                            <option className="bg-app-bg text-app-text" value="Negotiation">Negotiation</option>
                            <option className="bg-app-bg text-app-text" value="Won">Won</option>
                            <option className="bg-app-bg text-app-text" value="Lost">Lost</option>
                            <option className="bg-app-bg text-app-text" value="Dropped">Dropped</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <select 
                            value={lead.notConvertedReason || ''} 
                            onChange={(e) => handleFieldChange(lead._id, 'notConvertedReason', e.target.value)}
                            className="bg-white/[0.02] hover:bg-app-bg border border-white/5 hover:border-app-border px-2 py-1 rounded text-app-text focus:outline-none focus:border-primary cursor-pointer w-full"
                          >
                            <option className="bg-app-bg text-app-text" value="">-Why not converted?-</option>
                            <option className="bg-app-bg text-app-text" value="Too Expensive">Too Expensive</option>
                            <option className="bg-app-bg text-app-text" value="Went with Competitor">Went with Competitor</option>
                            <option className="bg-app-bg text-app-text" value="No Longer Needs Service">No Longer Needs Service</option>
                            <option className="bg-app-bg text-app-text" value="Unresponsive">Unresponsive</option>
                            <option className="bg-app-bg text-app-text" value="Not a Fit">Not a Fit</option>
                            <option className="bg-app-bg text-app-text" value="Timing Not Right">Timing Not Right</option>
                            <option className="bg-app-bg text-app-text" value="Other">Other</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[200px]">
                          <input 
                            type="text" 
                            defaultValue={lead.remark || ''} 
                            placeholder="Add remark..."
                            onBlur={(e) => { if(e.target.value !== lead.remark) handleFieldChange(lead._id, 'remark', e.target.value) }}
                            className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px] border-r-2 border-app-border/60">
                          <input
                            type="datetime-local"
                            defaultValue={lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : ''}
                            title={FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(lead.interestLevel) ? 'Required for this interest level' : undefined}
                            onBlur={(e) => {
                              const current = lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : '';
                              if (e.target.value === current) return;
                              const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                              handleFieldChange(lead._id, 'nextFollowUpDate', value);
                            }}
                            className={`bg-transparent border px-2 py-1 rounded w-full focus:outline-none cursor-text [color-scheme:dark] text-xs ${
                              FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(lead.interestLevel) && !lead.nextFollowUpDate
                                ? 'border-red-500/40 hover:border-red-500 focus:border-red-500'
                                : 'border-transparent hover:border-app-border focus:border-primary'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[80px]">
                          <input 
                            type="number" 
                            defaultValue={lead.leadAgeAtCall ?? ''} 
                            onBlur={(e) => { if(Number(e.target.value) !== lead.leadAgeAtCall) handleFieldChange(lead._id, 'leadAgeAtCall', Number(e.target.value)) }}
                            className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-center"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[80px]">
                          <input 
                            type="number" 
                            defaultValue={lead.touchNumber ?? 0} 
                            onBlur={(e) => { if(Number(e.target.value) !== lead.touchNumber) handleFieldChange(lead._id, 'touchNumber', Number(e.target.value)) }}
                            className="border border-white/5 bg-white/[0.02] hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-center"
                          />
                        </td>
                        <td className={`px-3 py-2 align-middle text-right whitespace-nowrap sticky right-0 ${rowStripeClass} group-hover:bg-surface-variant border-l border-app-border z-10 flex items-center justify-end gap-2`}>
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                            title="View Details"
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

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-app-border flex justify-between items-center sticky top-0 bg-app-card z-10">
              <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                <Eye size={20} className="text-primary" /> Lead Details ({selectedLead.leadId || 'N/A'})
              </h2>
              <button onClick={() => setSelectedLead(null)} className="p-2 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-2xl font-bold text-app-text">{selectedLead.fullName}</h3>
                <p className="text-sm text-app-text-muted mt-1">
                  {[selectedLead.businessName, selectedLead.leadId, selectedLead.phone].filter(Boolean).join(' · ')}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_BADGE_CLASSES[selectedLead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {selectedLead.status}
                  </span>
                  {selectedLead.interestLevel && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      {selectedLead.interestLevel}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-app-bg text-app-text-muted border border-app-border">
                    {selectedLead.platform || 'Website'}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3">
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-black font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  <Phone size={16} /> Call
                </a>
                {toWhatsAppHref(selectedLead.phone) ? (
                  <a
                    href={toWhatsAppHref(selectedLead.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-lg border border-app-border text-app-text font-bold text-sm hover:border-primary hover:text-primary transition-colors"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                ) : <div />}
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg border border-app-border text-app-text font-bold text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <Mail size={16} /> Email
                </a>
              </div>

              {/* Next Follow-up */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <label className="text-xs text-primary font-bold uppercase tracking-wider">Next Follow-up</label>
                <p className="text-sm font-medium text-app-text mt-1">
                  {selectedLead.nextFollowUpDate
                    ? new Date(selectedLead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Not scheduled'}
                </p>
                <input
                  type="datetime-local"
                  value={selectedLead.nextFollowUpDate ? new Date(selectedLead.nextFollowUpDate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                    handleFieldChange(selectedLead._id, 'nextFollowUpDate', value);
                    setSelectedLead({ ...selectedLead, nextFollowUpDate: value });
                  }}
                  className="mt-2 w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Lead Details */}
              <div className="bg-app-bg border border-app-border rounded-xl p-4">
                <label className="text-xs text-primary font-bold uppercase tracking-wider mb-3 block">Lead Details</label>
                <div className="divide-y divide-app-border">
                  <div className="flex items-center justify-between py-2.5 gap-4 flex-wrap">
                    <span className="text-sm text-app-text-muted">Assigned to</span>
                    {canAssign ? (
                      <select
                        value={selectedLead.assignedTo?._id || ''}
                        onChange={(e) => handleAssign(selectedLead._id, e.target.value || null, assignReason)}
                        className="bg-app-card border border-app-border text-sm px-3 py-1.5 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option className="bg-app-bg text-app-text" value="">Unassigned</option>
                        {bds.map((bd) => (
                          <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>
                            {bd.firstName} {bd.lastName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-medium text-app-text">
                        {selectedLead.assignedTo ? displayName(selectedLead.assignedTo) : (selectedLead.bd || 'Unassigned')}
                      </span>
                    )}
                  </div>
                  {canAssign && (
                    <div className="py-2.5">
                      <input
                        type="text"
                        value={assignReason}
                        onChange={(e) => setAssignReason(e.target.value)}
                        placeholder="Reason for (re)assignment (optional)"
                        className="bg-app-card border border-app-border text-sm px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary w-full"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Assigned on</span>
                    <span className="text-sm font-medium text-app-text">
                      {selectedLead.assignedAt ? new Date(selectedLead.assignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Service required</span>
                    <span className="text-sm font-medium text-app-text">{selectedLead.service}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Source platform</span>
                    <span className="text-sm font-medium text-app-text">{selectedLead.platform || 'Website'}</span>
                  </div>
                  {selectedLead.city && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-app-text-muted">City</span>
                      <span className="text-sm font-medium text-app-text">{selectedLead.city}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Connected</span>
                    <span className="text-sm font-medium text-app-text">{selectedLead.connected || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Estimated deal value</span>
                    <span className="text-sm font-medium text-app-text">₹{(selectedLead.dealValue || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-app-text-muted">Status</span>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => {
                        handleFieldChange(selectedLead._id, 'status', e.target.value);
                        setSelectedLead({ ...selectedLead, status: e.target.value });
                      }}
                      className="bg-app-card border border-app-border text-sm px-3 py-1.5 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option className="bg-app-bg text-app-text" value="New">New</option>
                      <option className="bg-app-bg text-app-text" value="Contacted">Contacted</option>
                      <option className="bg-app-bg text-app-text" value="Qualified">Qualified</option>
                      <option className="bg-app-bg text-app-text" value="Proposal Sent">Proposal Sent</option>
                      <option className="bg-app-bg text-app-text" value="Negotiation">Negotiation</option>
                      <option className="bg-app-bg text-app-text" value="Won">Won</option>
                      <option className="bg-app-bg text-app-text" value="Lost">Lost</option>
                      <option className="bg-app-bg text-app-text" value="Dropped">Dropped</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Message */}
              {selectedLead.message && (
                <div className="bg-app-bg border border-app-border rounded-xl p-4">
                  <label className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14} /> {selectedLead.fbFormId ? 'Form Answers' : 'Message Attached'}
                  </label>
                  <div className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">
                    {selectedLead.message}
                  </div>
                </div>
              )}

              {/* Campaign / UTM details — kept for reference, lower priority */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-app-bg border border-app-border p-4 rounded-xl">
                <div>
                  <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Attribution Source</label>
                  <p className="text-sm font-medium text-primary truncate">{selectedLead.userSource || 'Direct'}</p>
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Campaign</label>
                  <p className="text-sm font-medium text-app-text truncate">{selectedLead.utmCampaign || selectedLead.adCampaignId || '-'}</p>
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Source/Medium</label>
                  <p className="text-sm font-medium text-app-text truncate">
                    {selectedLead.utmSource || '-'}{selectedLead.utmMedium ? ` / ${selectedLead.utmMedium}` : ''}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Term/Content</label>
                  <p className="text-sm font-medium text-app-text truncate">
                    {selectedLead.utmTerm || '-'}{selectedLead.utmContent ? ` / ${selectedLead.utmContent}` : ''}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Source Link</label>
                  <a href={selectedLead.source} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-app-text hover:text-primary hover:underline truncate block">
                    {selectedLead.source || '-'}
                  </a>
                </div>
              </div>

              {/* Activity Timeline — merges status/call/interest changes with assignment history */}
              <div className="bg-app-bg border border-app-border rounded-xl p-4">
                <label className="text-xs text-primary font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock size={14} /> Activity Timeline
                </label>
                <div className="space-y-4">
                  {buildActivityTimeline(selectedLead, assignmentHistory).map((event) => (
                    <div key={event.key} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-app-text">{event.title}</p>
                        <p className="text-xs text-app-text-muted mt-0.5">
                          {new Date(event.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {event.actor ? ` · ${event.actor}` : ''}
                        </p>
                        {event.note && (
                          <p className="text-xs text-app-text-muted mt-1 italic border-l-2 border-primary/30 pl-2 py-0.5">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-card sticky bottom-0 z-10">
              {isSuperAdmin && (
                <button 
                  onClick={() => {
                    deleteLead(selectedLead._id);
                    setSelectedLead(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                >
                  Delete Lead
                </button>
              )}
              <button 
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 text-sm font-medium text-app-text bg-app-bg border border-app-border hover:bg-surface-variant rounded-lg transition-colors"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
