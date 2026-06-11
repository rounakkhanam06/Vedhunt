import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Mail, Phone, Clock, Globe, Briefcase, FileText, CheckCircle2, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Eye, X, Play, Square, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  
  // Pagination & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
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
          platform: platformFilter,
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
  }, [currentPage, statusFilter, platformFilter, debouncedSearchTerm]);

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

  const handleFieldChange = async (id, field, value) => {
    try {
      await api.put(`/leads/${id}`, { [field]: value });
      setLeads(leads.map(l => l._id === id ? { ...l, [field]: value } : l));
      toast.success('Auto-saved', { duration: 1000, position: 'bottom-right' });
    } catch (error) {
      toast.error('Failed to update field');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading">Lead Manager</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage and track leads like a spreadsheet</p>
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
            placeholder="Search by name, email, phone or Lead ID..."
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
              setCurrentPage(1);
            }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
        </div>
        <div className="relative min-w-[160px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          <select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option className="bg-app-bg text-app-text" value="All">All Platforms</option>
            <option className="bg-app-bg text-app-text" value="Website">Website</option>
            <option className="bg-app-bg text-app-text" value="Facebook">Facebook</option>
            <option className="bg-app-bg text-app-text" value="Google Ads">Google Ads</option>
            <option className="bg-app-bg text-app-text" value="Instagram">Instagram</option>
            <option className="bg-app-bg text-app-text" value="Manual">Manual</option>
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
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm pb-4">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[2500px]">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-xs uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-3 font-semibold sticky left-0 bg-app-bg z-10 border-r border-app-border">Lead ID</th>
                      <th className="px-3 py-3 font-semibold">Lead Name</th>
                      <th className="px-3 py-3 font-semibold">Phone</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">City</th>
                      <th className="px-3 py-3 font-semibold">Platform</th>
                      <th className="px-3 py-3 font-semibold">Campaign (UTM)</th>
                      <th className="px-3 py-3 font-semibold">Business Name</th>
                      <th className="px-3 py-3 font-semibold">Source</th>
                      <th className="px-3 py-3 font-semibold">Segment (Service)</th>
                      <th className="px-3 py-3 font-semibold">BD</th>
                      <th className="px-3 py-3 font-semibold text-center">Start Call</th>
                      <th className="px-3 py-3 font-semibold">Call Start Time</th>
                      <th className="px-3 py-3 font-semibold text-center">End Call</th>
                      <th className="px-3 py-3 font-semibold">Call End Time</th>
                      <th className="px-3 py-3 font-semibold">Duration (min)</th>
                      <th className="px-3 py-3 font-semibold">Call Date</th>
                      <th className="px-3 py-3 font-semibold">Connected?</th>
                      <th className="px-3 py-3 font-semibold">Not Connected Reason</th>
                      <th className="px-3 py-3 font-semibold">Interest Level</th>
                      <th className="px-3 py-3 font-semibold">Stage</th>
                      <th className="px-3 py-3 font-semibold">Not Converted Reason</th>
                      <th className="px-3 py-3 font-semibold">Remark</th>
                      <th className="px-3 py-3 font-semibold">Next Follow-up</th>
                      <th className="px-3 py-3 font-semibold">Age @ Call</th>
                      <th className="px-3 py-3 font-semibold">Touch #</th>
                      <th className="px-3 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-xs">
                    {leads.map((lead) => (
                      <motion.tr 
                        key={lead._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-surface-variant transition-colors group"
                      >
                        <td className="px-3 py-2 align-middle font-mono font-medium text-primary sticky left-0 bg-app-card group-hover:bg-surface-variant border-r border-app-border">
                          {lead.leadId || '-'}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-app-text min-w-[150px]">
                          <input 
                            type="text" 
                            defaultValue={lead.fullName} 
                            onBlur={(e) => { if(e.target.value !== lead.fullName) handleFieldChange(lead._id, 'fullName', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <input 
                            type="text" 
                            defaultValue={lead.phone} 
                            onBlur={(e) => { if(e.target.value !== lead.phone) handleFieldChange(lead._id, 'phone', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[180px]">
                          <input 
                            type="email" 
                            defaultValue={lead.email} 
                            onBlur={(e) => { if(e.target.value !== lead.email) handleFieldChange(lead._id, 'email', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-app-text-muted"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <input 
                            type="text" 
                            defaultValue={lead.city || ''} 
                            placeholder="Add city..."
                            onBlur={(e) => { if(e.target.value !== lead.city) handleFieldChange(lead._id, 'city', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
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
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted text-xs min-w-[140px] truncate max-w-[180px]" title={lead.utmCampaign || lead.adCampaignId || 'N/A'}>
                          {lead.utmCampaign || lead.adCampaignId || '-'}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <input 
                            type="text" 
                            defaultValue={lead.businessName || ''} 
                            placeholder="Add business..."
                            onBlur={(e) => { if(e.target.value !== lead.businessName) handleFieldChange(lead._id, 'businessName', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle text-app-text-muted truncate max-w-[150px]">
                           {lead.source}
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                            {lead.service}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <input 
                            type="text" 
                            defaultValue={lead.bd || ''} 
                            placeholder="Assign BD..."
                            onBlur={(e) => { if(e.target.value !== lead.bd) handleFieldChange(lead._id, 'bd', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
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
                            className={`bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none cursor-pointer ${lead.connected === 'Yes' ? 'text-green-500 font-bold' : lead.connected === 'No' ? 'text-red-500 font-bold' : 'text-app-text'}`}
                          >
                            <option className="bg-app-bg text-app-text" value="">-Select-</option>
                            <option className="bg-app-bg text-app-text" value="Yes">Yes</option>
                            <option className="bg-app-bg text-app-text" value="No">No</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <input 
                            type="text" 
                            defaultValue={lead.notConnectedReason || ''} 
                            placeholder="Reason..."
                            onBlur={(e) => { if(e.target.value !== lead.notConnectedReason) handleFieldChange(lead._id, 'notConnectedReason', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                            disabled={lead.connected === 'Yes'}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[120px]">
                          <input 
                            type="text" 
                            defaultValue={lead.interestLevel || ''} 
                            placeholder="Interest..."
                            onBlur={(e) => { if(e.target.value !== lead.interestLevel) handleFieldChange(lead._id, 'interestLevel', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-yellow-500 font-medium"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[130px]">
                          <select 
                            value={lead.status}
                            onChange={(e) => handleFieldChange(lead._id, 'status', e.target.value)}
                            className="bg-transparent hover:bg-app-bg border border-transparent hover:border-app-border text-xs px-2 py-1 rounded text-app-text focus:outline-none focus:border-primary cursor-pointer w-full font-medium"
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
                          <input 
                            type="text" 
                            defaultValue={lead.notConvertedReason || ''} 
                            placeholder="Why not converted?"
                            onBlur={(e) => { if(e.target.value !== lead.notConvertedReason) handleFieldChange(lead._id, 'notConvertedReason', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[200px]">
                          <input 
                            type="text" 
                            defaultValue={lead.remark || ''} 
                            placeholder="Add remark..."
                            onBlur={(e) => { if(e.target.value !== lead.remark) handleFieldChange(lead._id, 'remark', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[150px]">
                          <input 
                            type="date" 
                            defaultValue={lead.nextFollowUpDate ? lead.nextFollowUpDate.split('T')[0] : ''} 
                            onBlur={(e) => { if(e.target.value !== (lead.nextFollowUpDate?.split('T')[0] || '')) handleFieldChange(lead._id, 'nextFollowUpDate', e.target.value) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none cursor-text [color-scheme:dark]"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[80px]">
                          <input 
                            type="number" 
                            defaultValue={lead.leadAgeAtCall ?? ''} 
                            onBlur={(e) => { if(Number(e.target.value) !== lead.leadAgeAtCall) handleFieldChange(lead._id, 'leadAgeAtCall', Number(e.target.value)) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-center"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle min-w-[80px]">
                          <input 
                            type="number" 
                            defaultValue={lead.touchNumber ?? 0} 
                            onBlur={(e) => { if(Number(e.target.value) !== lead.touchNumber) handleFieldChange(lead._id, 'touchNumber', Number(e.target.value)) }}
                            className="bg-transparent border border-transparent hover:border-app-border focus:border-primary px-2 py-1 rounded w-full focus:outline-none text-center"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap sticky right-0 bg-app-card group-hover:bg-surface-variant border-l border-app-border z-10">

                          <button 
                            onClick={() => deleteLead(lead._id)}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium px-2 py-1 ml-2"
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
            <div className="flex items-center justify-between bg-app-card border border-app-border p-4 rounded-xl mt-4">
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
                <Eye size={20} className="text-primary" /> Lead Details ({selectedLead.leadId || 'N/A'})
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
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Date Created</label>
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
                {selectedLead.city && (
                  <div>
                    <label className="text-xs text-app-text-muted uppercase tracking-wider">City</label>
                    <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                      <Globe size={16} className="text-primary" />
                      {selectedLead.city}
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
                {/* UTM and Campaign details */}
                <div className="sm:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 bg-app-bg border border-app-border p-4 rounded-xl mt-2">
                  <div>
                    <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Platform</label>
                    <p className="text-sm font-medium text-app-text truncate">{selectedLead.platform || 'Website'}</p>
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
                </div>
                <div className="sm:col-span-2 bg-app-bg border border-app-border rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 mt-2">
                  <div>
                    <label className="text-xs text-app-text-muted uppercase tracking-wider">Current Status</label>
                    <p className="text-xs text-app-text-muted mt-0.5">Update the status of this lead</p>
                  </div>
                  <div className="w-40 min-w-[150px]">
                    <select 
                      value={selectedLead.status}
                      onChange={(e) => {
                        handleFieldChange(selectedLead._id, 'status', e.target.value);
                        setSelectedLead({...selectedLead, status: e.target.value});
                      }}
                      className="bg-app-card border border-app-border text-sm px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer w-full"
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
