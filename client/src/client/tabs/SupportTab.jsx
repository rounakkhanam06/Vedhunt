import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import clientService from '../../services/clientService';
import StatusBadge from '../components/StatusBadge';
import SLACountdown from '../components/SLACountdown';
import toast from 'react-hot-toast';
import {
  LifeBuoy, Plus, ChevronLeft, ChevronRight, ChevronDown,
  ChevronUp, RefreshCw, Send, Paperclip,
} from 'lucide-react';

const CATEGORIES = ['Bug Report', 'Feature Request', 'General Inquiry', 'Urgent Fix'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const SupportTab = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const formRef = useRef(null);

  const [form, setForm] = useState({
    subject: params.get('presubject') || '',
    description: '',
    category: params.get('precategory') || 'General Inquiry',
    priority: 'Medium',
  });

  // Auto-open form if pre-populated from renewal request link
  useEffect(() => {
    if (params.get('presubject')) setShowForm(true);
  }, []);

  const fetchTickets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const qp = { page, limit: 10 };
      if (statusFilter) qp.status = statusFilter;
      const res = await clientService.getTickets(qp);
      setTickets(res.data || []);
      setPagination(res.pagination || {});
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTickets(1); }, [fetchTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      return toast.error('Subject and description are required');
    }
    setSubmitting(true);
    try {
      const res = await clientService.createTicket(form);
      toast.success(res.message || 'Ticket submitted!');
      setForm({ subject: '', description: '', category: 'General Inquiry', priority: 'Medium' });
      setShowForm(false);
      fetchTickets(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Help &amp; Support</h2>
          <p className="text-[#D1D5DB] text-sm mt-1">Submit tickets and track resolution progress</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchTickets(pagination.page)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white text-sm transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-all cursor-pointer"
          >
            <Plus size={15} />
            New Ticket
          </button>
        </div>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <div
          ref={formRef}
          className="bg-bg-card border border-primary/20 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Send size={16} className="text-primary" />
            <h3 className="text-white font-semibold">Submit a New Ticket</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-[#E5E7EB] text-sm font-medium mb-1.5">Subject *</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Brief description of your issue"
                maxLength={200}
                className="w-full px-4 py-2.5 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm"
              />
            </div>

            {/* Category + Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#E5E7EB] text-sm font-medium mb-1.5">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-bg-surface/50 border border-border-default rounded-xl text-white focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#1A1F2B] text-white">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#E5E7EB] text-sm font-medium mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-bg-surface/50 border border-border-default rounded-xl text-white focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p} className="bg-[#1A1F2B] text-white">{p}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[#E5E7EB] text-sm font-medium mb-1.5">Description *</label>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behaviour..."
                className="w-full px-4 py-2.5 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <><Send size={14} /> Submit Ticket</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Status filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none whitespace-nowrap shrink-0">
        {['', 'Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer shrink-0 ${
              statusFilter === s
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-bg-surface/40 text-[#D1D5DB] border-border-default hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Tickets */}
      <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <LifeBuoy size={40} className="text-[#2B2A2A]" />
            <p className="text-[#9CA3AF] text-sm">No tickets found</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-primary text-sm hover:underline cursor-pointer"
            >
              Submit your first ticket →
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/[0.04]">
              {tickets.map((ticket) => {
                const isOpen = expandedId === ticket._id;
                return (
                  <div key={ticket._id}>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : ticket._id)}
                      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-bg-surface/30 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[#D1D5DB] text-xs font-mono">{ticket.ticketId}</span>
                          <StatusBadge status={ticket.status} size="xs" />
                          <StatusBadge status={ticket.priority} size="xs" />
                        </div>
                        <p className="text-white text-sm font-medium truncate">{ticket.subject}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="text-[#9CA3AF] text-xs">{ticket.category}</span>
                          <span className="text-[#9CA3AF] text-xs">·</span>
                          <SLACountdown slaDeadline={ticket.slaDeadline} status={ticket.status} />
                          <span className="text-[#9CA3AF] text-xs">·</span>
                          <span className="text-[#9CA3AF] text-xs">
                            {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <div className="text-[#9CA3AF] shrink-0 mt-1">
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-border-default/40 pt-4 bg-white/[0.01]">
                        <p className="text-[#D1D5DB] text-xs font-medium uppercase tracking-wider mb-2">Description</p>
                        <p className="text-[#E5E7EB] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                        {ticket.resolvedAt && (
                          <p className="text-[#22C55E] text-xs mt-3">
                            ✓ Resolved on {new Date(ticket.resolvedAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-default">
                <p className="text-[#9CA3AF] text-xs">
                  {pagination.total} total tickets
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchTickets(pagination.page - 1)}
                    className="p-1.5 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchTickets(pagination.page + 1)}
                    className="p-1.5 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SupportTab;
