import React, { useState, useEffect } from 'react';
import { IndianRupee, FileText, CheckCircle, XCircle, Search, Clock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const PaymentVerificationManager = () => {
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
      const res = await api.get('/admin/payments');
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
      const res = await api.put(`/admin/payments/${id}/approve`);
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
      const res = await api.put(`/admin/payments/${id}/reject`, { rejectionReason });
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
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Payment Verification</h1>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-admin-surface border border-outline-variant rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-admin-bg/50">
              <div>
                <h3 className="text-xl font-bold text-on-surface">Review Payment</h3>
                <p className="text-sm text-on-surface-variant mt-1">From: {selectedPayment.client_ref?.businessName}</p>
              </div>
              <button
                onClick={() => { setSelectedPayment(null); setRejectionReason(''); }}
                className="p-2 text-on-surface-variant hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
              {/* Left Column: Details */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">Invoice Details</h4>
                  <div className="bg-admin-bg border border-outline-variant rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">Invoice No:</span>
                      <span className="text-on-surface font-medium">{selectedPayment.invoice_ref?.invoiceId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">Total Amount:</span>
                      <span className="text-on-surface font-medium">₹{selectedPayment.invoice_ref?.totalAmount?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">Amount Paid So Far:</span>
                      <span className="text-green-500 font-medium">₹{selectedPayment.invoice_ref?.paidAmount?.toLocaleString('en-IN') || 0}</span>
                    </div>
                    <div className="pt-3 border-t border-outline-variant flex justify-between">
                      <span className="text-on-surface-variant text-sm">Remaining Due:</span>
                      <span className="text-orange-500 font-bold">
                        ₹{Math.max(0, (selectedPayment.invoice_ref?.totalAmount || 0) - (selectedPayment.invoice_ref?.paidAmount || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">Payment Submission</h4>
                  <div className="bg-admin-bg border border-outline-variant rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">Amount Sent:</span>
                      <span className="text-[#25D366] font-bold text-lg">₹{selectedPayment.amountPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">UTR No:</span>
                      <span className="text-on-surface font-mono">{selectedPayment.utrNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant text-sm">Date Paid:</span>
                      <span className="text-on-surface">{new Date(selectedPayment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant text-sm">Current Status:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(selectedPayment.status)}`}>
                        {selectedPayment.status}
                      </span>
                    </div>
                    {selectedPayment.status === 'Rejected' && (
                      <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-400 font-semibold mb-1">Rejection Reason:</p>
                        <p className="text-sm text-red-300">{selectedPayment.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Screenshot */}
              <div className="flex flex-col">
                <h4 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">Payment Proof / Screenshot</h4>
                <div className="flex-1 bg-admin-bg border border-outline-variant rounded-xl overflow-hidden relative flex flex-col">
                  {selectedPayment.screenshotUrl ? (
                    <>
                      <a href={selectedPayment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black text-white rounded-lg backdrop-blur flex items-center gap-2 text-xs font-medium transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Full
                      </a>
                      <img src={selectedPayment.screenshotUrl} alt="Payment Proof" className="w-full h-full object-contain bg-black/20" />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-on-surface-variant flex-col gap-2 p-6 text-center">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p>No screenshot attached.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-outline-variant bg-admin-bg/50">
              {selectedPayment.status === 'Pending' ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Reason (required if rejecting)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-4 py-2.5 bg-admin-surface border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-on-surface-variant/50"
                    />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleReject(selectedPayment._id)}
                      disabled={actionLoading}
                      className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedPayment._id)}
                      disabled={actionLoading}
                      className="px-6 py-2.5 bg-[#25D366] hover:bg-[#20b858] text-black rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(37,211,102,0.3)] hover:shadow-[0_0_20px_rgba(37,211,102,0.5)] flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Payment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-on-surface-variant text-sm">
                  This payment was <strong className={selectedPayment.status === 'Approved' ? 'text-green-500' : 'text-red-500'}>{selectedPayment.status}</strong> on {selectedPayment.verifiedAt ? new Date(selectedPayment.verifiedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVerificationManager;
