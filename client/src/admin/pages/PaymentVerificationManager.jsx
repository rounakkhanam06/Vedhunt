import React, { useState, useEffect } from 'react';
import { IndianRupee, FileText, CheckCircle, XCircle, Search, Clock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCrm } from '../../shared/crmAccess';
import PaymentReviewModal from '../components/PaymentReviewModal';

const PaymentVerificationManager = () => {
  // Admin panel (full access) or Employee Portal (person-wise grants) — shared/crmAccess.js
  const { http, base, can: canCrm } = useCrm();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await http.get(`${base}/payments`);
      if (res.data.success) {
        setPayments(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load payments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      const res = await http.put(`${base}/payments/${id}/approve`);
      if (res.data.success) {
        toast.success('Payment approved and invoice updated.');
        fetchPayments();
        setSelectedPayment(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      return toast.error('Please provide a reason for rejection.');
    }
    try {
      setActionLoading(true);
      const res = await http.put(`${base}/payments/${id}/reject`, { rejectionReason });
      if (res.data.success) {
        toast.success('Payment rejected.');
        fetchPayments();
        setSelectedPayment(null);
        setRejectionReason('');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = 
      p.client_ref?.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.utrNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.invoice_ref?.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Approved': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Rejected': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-app-text mb-2 tracking-tight">Payment Verification</h1>
          <p className="text-on-surface-variant">Review and approve client payment submissions.</p>
        </div>
      </div>

      <div className="bg-admin-surface border border-outline-variant rounded-2xl shadow-lg overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-6 border-b border-outline-variant flex flex-col sm:flex-row gap-4 justify-between items-center bg-admin-surface/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
            <input
              type="text"
              placeholder="Search client, UTR, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 transition-all placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex bg-admin-bg p-1 rounded-xl border border-outline-variant overflow-x-auto w-full sm:w-auto">
            {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-secondary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-admin-bg/50 border-b border-outline-variant">
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Client & Invoice</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">UTR Number</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Amount Paid</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-on-surface-variant">
                    <div className="flex justify-center mb-4">
                      <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-on-surface-variant">
                    No payment submissions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-on-surface font-medium">{new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(payment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-on-surface">{payment.client_ref?.businessName}</div>
                      <div className="text-xs text-on-surface-variant mt-1">Invoice: {payment.invoice_ref?.invoiceId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-on-surface">{payment.utrNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-[#25D366] flex items-center justify-end gap-1">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {payment.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-admin-bg border border-outline-variant hover:border-secondary hover:text-secondary rounded-lg text-sm font-medium transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedPayment && (
        <PaymentReviewModal
          payment={selectedPayment}
          canEdit={canCrm('payments', 'edit')}
          busy={actionLoading}
          reason={rejectionReason}
          setReason={setRejectionReason}
          onApprove={() => handleApprove(selectedPayment._id)}
          onReject={() => handleReject(selectedPayment._id)}
          onClose={() => { setSelectedPayment(null); setRejectionReason(''); }}
        />
      )}
    </div>
  );
};

export default PaymentVerificationManager;
