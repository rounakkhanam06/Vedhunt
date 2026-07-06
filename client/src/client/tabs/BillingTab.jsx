import { useState, useEffect, useCallback } from 'react';
import clientService from '../../services/clientService';
import StatusBadge from '../components/StatusBadge';
import InvoiceModal from '../components/InvoiceModal';
import { FileText, IndianRupee, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const BillingTab = () => {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const res = await clientService.getInvoices(params);
      setInvoices(res.data || []);
      setPagination(res.pagination || {});
    } catch (_) {
      // Toast handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(1); }, [fetch]);

  const handlePageChange = (p) => fetch(p);

  const summaryStats = [
    { label: 'Total', count: pagination.total, color: 'text-white' },
    { label: 'Paid', count: invoices.filter(i => i.paymentStatus === 'Paid').length, color: 'text-[#22C55E]' },
    { label: 'Unpaid', count: invoices.filter(i => i.paymentStatus === 'Unpaid').length, color: 'text-[#F59E0B]' },
    { label: 'Overdue', count: invoices.filter(i => i.paymentStatus === 'Overdue').length, color: 'text-[#EF4444]' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Billing &amp; Invoices</h2>
          <p className="text-[#D1D5DB] text-sm mt-1">Track all your invoices and make payments</p>
        </div>
        <button
          onClick={() => fetch(pagination.page)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white text-sm transition-all cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryStats.map((s) => (
          <div key={s.label} className="bg-bg-card border border-border-default rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[#9CA3AF] text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none whitespace-nowrap shrink-0">
        {['', 'Paid', 'Unpaid', 'Overdue'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); }}
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

      {/* Table */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-bg-surface/20">
                <th className="text-left px-4 py-3 text-[#D1D5DB] font-medium text-xs">Invoice ID</th>
                <th className="text-left px-4 py-3 text-[#D1D5DB] font-medium text-xs hidden sm:table-cell">Issue Date</th>
                <th className="text-left px-4 py-3 text-[#D1D5DB] font-medium text-xs hidden md:table-cell">Due Date</th>
                <th className="text-right px-4 py-3 text-[#D1D5DB] font-medium text-xs">Amount</th>
                <th className="text-center px-4 py-3 text-[#D1D5DB] font-medium text-xs">Status</th>
                <th className="text-center px-4 py-3 text-[#D1D5DB] font-medium text-xs">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <FileText size={32} className="text-[#2B2A2A] mx-auto mb-2" />
                    <p className="text-[#9CA3AF] text-sm">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="border-t border-border-default/40 hover:bg-bg-surface/30 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-white font-mono text-xs">{inv.invoiceId}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[#D1D5DB] text-xs hidden sm:table-cell">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5 text-[#D1D5DB] text-xs hidden md:table-cell">
                      {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-white font-semibold text-sm flex items-center justify-end gap-1">
                        <IndianRupee size={12} className="text-[#D1D5DB]" />
                        {(inv.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={inv.paymentStatus} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedInvoiceId(inv._id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          inv.paymentStatus !== 'Paid'
                            ? 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25'
                            : 'bg-bg-surface/50 text-[#D1D5DB] border border-border-default hover:text-white'
                        }`}
                      >
                        {inv.paymentStatus !== 'Paid' ? 'Pay Now' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-default">
            <p className="text-[#9CA3AF] text-xs">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="p-1.5 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="p-1.5 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}
    </div>
  );
};

export default BillingTab;
