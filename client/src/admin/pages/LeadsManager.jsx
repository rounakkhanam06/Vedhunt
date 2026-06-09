import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Mail, Phone, Clock, Globe, Briefcase, FileText, CheckCircle2, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  
  // Pagination & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
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

  // Fetch leads when dependencies change
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads', {
        params: {
          page: currentPage,
          limit: 10, // Items per page
          status: statusFilter,
          search: debouncedSearchTerm
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
  }, [currentPage, statusFilter, debouncedSearchTerm]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

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

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/leads/${id}`, { status });
      toast.success('Status updated');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading">Lead Manager</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage and track leads from landing pages</p>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap text-center">
          Total Leads: {totalLeads}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-app-card p-4 rounded-xl border border-app-border">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset to page 1 on filter change
            }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Lost">Lost</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
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
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Name</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">Phone</th>
                      <th className="px-3 py-3 font-semibold">Business</th>
                      <th className="px-3 py-3 font-semibold">Service</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-sm">
                    {leads.map((lead) => (
                      <motion.tr 
                        key={lead._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="hover:bg-app-bg/50 transition-colors"
                      >
                        <td className="px-3 py-2 align-middle">
                          <div className="text-app-text-muted text-xs">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-app-text">
                          {lead.fullName}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs">
                          <a href={`mailto:${lead.email}`} className="text-app-text-muted hover:text-primary transition-colors">{lead.email}</a>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs">
                          <a href={`tel:${lead.phone}`} className="text-app-text-muted hover:text-primary transition-colors">{lead.phone}</a>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-app-text-muted truncate max-w-[100px]">
                          {lead.businessName || '-'}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                            {lead.service}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <select 
                            value={lead.status}
                            onChange={(e) => updateStatus(lead._id, e.target.value)}
                            className="bg-app-bg border border-app-border text-xs px-2 py-1 rounded text-app-text focus:outline-none focus:border-primary cursor-pointer w-full max-w-[100px]"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                          <button 
                            onClick={() => setSelectedLead(lead)}
                            className="text-xs text-primary hover:text-primary/80 transition-colors font-medium px-2 py-1 inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button 
                            onClick={() => deleteLead(lead._id)}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium px-2 py-1"
                          >
                            Delete
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-app-card border border-app-border p-4 rounded-xl">
              <span className="text-sm text-app-text-muted">
                Showing page <span className="font-bold text-app-text">{currentPage}</span> of <span className="font-bold text-app-text">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page 
                          ? 'bg-primary text-black' 
                          : 'bg-app-bg border border-app-border text-app-text hover:bg-surface-variant'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <Eye size={20} className="text-primary" /> Lead Details
              </h2>
              <button onClick={() => setSelectedLead(null)} className="p-2 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Full Name</label>
                  <p className="font-medium text-app-text text-lg">{selectedLead.fullName}</p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Date & Time</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Clock size={16} className="text-app-text-muted" />
                    {new Date(selectedLead.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Email Address</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Mail size={16} className="text-primary" />
                    <a href={`mailto:${selectedLead.email}`} className="hover:text-primary hover:underline">{selectedLead.email}</a>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Phone Number</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Phone size={16} className="text-primary" />
                    <a href={`tel:${selectedLead.phone}`} className="hover:text-primary hover:underline">{selectedLead.phone}</a>
                  </p>
                </div>
                {selectedLead.businessName && (
                  <div>
                    <label className="text-xs text-app-text-muted uppercase tracking-wider">Business Name</label>
                    <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                      <Briefcase size={16} className="text-primary" />
                      {selectedLead.businessName}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Service Requested</label>
                  <p className="font-medium text-app-text mt-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      {selectedLead.service}
                    </span>
                  </p>
                </div>
                <div className="sm:col-span-2 bg-app-bg border border-app-border rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <label className="text-xs text-app-text-muted uppercase tracking-wider">Current Status</label>
                    <p className="text-xs text-app-text-muted mt-0.5">Update the status of this lead</p>
                  </div>
                  <div className="w-40 min-w-[150px]">
                    <select 
                      value={selectedLead.status}
                      onChange={(e) => {
                        updateStatus(selectedLead._id, e.target.value);
                        setSelectedLead({...selectedLead, status: e.target.value});
                      }}
                      className="bg-app-card border border-app-border text-sm px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer w-full"
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Source Highlight */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <label className="text-xs text-primary font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Globe size={14} /> Source Link
                </label>
                <a href={selectedLead.source} target="_blank" rel="noopener noreferrer" className="text-sm text-app-text hover:text-primary hover:underline break-all font-medium">
                  {selectedLead.source}
                </a>
              </div>

              {/* Message */}
              {selectedLead.message && (
                <div className="bg-app-bg border border-app-border rounded-xl p-4">
                  <label className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14} /> Message Attached
                  </label>
                  <div className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">
                    {selectedLead.message}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-card sticky bottom-0 z-10">
              <button 
                onClick={() => {
                  deleteLead(selectedLead._id);
                  setSelectedLead(null);
                }}
                className="px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                Delete Lead
              </button>
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
