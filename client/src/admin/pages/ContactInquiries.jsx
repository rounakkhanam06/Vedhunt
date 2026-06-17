import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { Mail, Phone, Clock, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Eye, X, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

export default function ContactInquiries() {
  const { can } = usePermissions();
  const isSuperAdmin = can('*');
  
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  
  // Pagination & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInquiries, setTotalInquiries] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch inquiries
  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/contact', {
        params: {
          page: currentPage,
          limit: 10,
          status: statusFilter,
          search: debouncedSearchTerm
        }
      });
      if (response.data.success) {
        setInquiries(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalInquiries(response.data.totalInquiries);
      }
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearchTerm]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const deleteInquiry = async (id) => {
    if (window.confirm('Are you sure you want to delete this inquiry?')) {
      try {
        await api.delete(`/contact/${id}`);
        toast.success('Inquiry deleted successfully');
        fetchInquiries();
      } catch (error) {
        toast.error('Failed to delete inquiry');
      }
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await api.put(`/contact/${id}/status`, { status: newStatus });
      setInquiries(inquiries.map(i => i._id === id ? { ...i, status: newStatus } : i));
      toast.success('Status updated', { duration: 1500 });
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRowClick = (inquiry) => {
    setSelectedInquiry(inquiry);
    if (inquiry.status === 'Unread') {
      updateStatus(inquiry._id, 'Read');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading">FAQ Contact Inquiries</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage messages submitted from the FAQ contact form</p>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap text-center flex items-center gap-2">
          <MessageSquare size={16} /> Total Inquiries: {totalInquiries}
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
              setCurrentPage(1);
            }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option className="bg-app-bg text-app-text" value="All">All Statuses</option>
            <option className="bg-app-bg text-app-text" value="Unread">Unread</option>
            <option className="bg-app-bg text-app-text" value="Read">Read</option>
            <option className="bg-app-bg text-app-text" value="Responded">Responded</option>
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
            {inquiries.length === 0 ? (
              <div className="text-center py-12 bg-app-card border border-app-border rounded-xl">
                <p className="text-app-text-muted">No inquiries found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm pb-4">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
                  <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-xs uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-sm">
                    {inquiries.map((inquiry) => (
                      <motion.tr 
                        key={inquiry._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`hover:bg-surface-variant transition-colors group cursor-pointer ${inquiry.status === 'Unread' ? 'bg-primary/5 font-medium' : ''}`}
                        onClick={(e) => {
                          if (e.target.closest('button')) return;
                          handleRowClick(inquiry);
                        }}
                      >
                        <td className="px-4 py-3 align-middle">
                          <select
                            value={inquiry.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateStatus(inquiry._id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
                              inquiry.status === 'Unread' ? 'bg-primary text-black' : 
                              inquiry.status === 'Responded' ? 'bg-green-500/20 text-green-500' : 'bg-surface-variant text-app-text-muted'
                            }`}
                          >
                            <option className="bg-app-bg text-app-text" value="Unread">UNREAD</option>
                            <option className="bg-app-bg text-app-text" value="Read">READ</option>
                            <option className="bg-app-bg text-app-text" value="Responded">RESPONDED</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 align-middle text-app-text-muted">
                          {new Date(inquiry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 align-middle text-app-text">
                          {inquiry.firstName} {inquiry.lastName}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <a href={`mailto:${inquiry.email}`} className="text-primary hover:underline">{inquiry.email}</a>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <a href={`tel:${inquiry.phone}`} className="text-primary hover:underline">{inquiry.phone}</a>
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleRowClick(inquiry)}
                              className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors" 
                              title="View Message"
                            >
                              <Eye size={16} />
                            </button>
                            {isSuperAdmin && (
                              <button 
                                onClick={() => deleteInquiry(inquiry._id)}
                                className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors" 
                                title="Delete Inquiry"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
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

      {/* Inquiry Details Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-app-border flex justify-between items-center sticky top-0 bg-app-card z-10">
              <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                <MessageSquare size={20} className="text-primary" /> Inquiry Details
              </h2>
              <button onClick={() => setSelectedInquiry(null)} className="p-2 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-app-bg p-4 rounded-xl border border-app-border">
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Full Name</label>
                  <p className="font-medium text-app-text text-lg">{selectedInquiry.firstName} {selectedInquiry.lastName}</p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Date Received</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Clock size={16} className="text-app-text-muted" />
                    {new Date(selectedInquiry.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Email Address</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Mail size={16} className="text-primary" />
                    <a href={`mailto:${selectedInquiry.email}`} className="hover:text-primary hover:underline">{selectedInquiry.email}</a>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-app-text-muted uppercase tracking-wider">Phone Number</label>
                  <p className="font-medium text-app-text flex items-center gap-2 mt-1">
                    <Phone size={16} className="text-primary" />
                    <a href={`tel:${selectedInquiry.phone}`} className="hover:text-primary hover:underline">{selectedInquiry.phone}</a>
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="bg-surface-variant/30 border border-app-border rounded-xl p-4">
                <label className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-2 block border-b border-app-border pb-2">
                  Message Content
                </label>
                <div className="text-sm text-app-text whitespace-pre-wrap leading-relaxed mt-4">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-card sticky bottom-0 z-10">
              {isSuperAdmin && (
                <button 
                  onClick={() => {
                    deleteInquiry(selectedInquiry._id);
                    setSelectedInquiry(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                >
                  Delete Inquiry
                </button>
              )}
              <button 
                onClick={() => setSelectedInquiry(null)}
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
