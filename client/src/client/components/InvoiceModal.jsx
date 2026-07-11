import { useState, useEffect } from 'react';
import { X, Copy, CheckCheck, ExternalLink, CreditCard, QrCode, FileText, UploadCloud, Clock } from 'lucide-react';
import clientService from '../../services/clientService';
import StatusBadge from './StatusBadge';
import SubmitPaymentProofForm from './SubmitPaymentProofForm';
import toast from 'react-hot-toast';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const InvoiceModal = ({ invoiceId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showProofForm, setShowProofForm] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await clientService.getInvoiceById(invoiceId);
      setData(res);
    } catch (err) {
      toast.error('Could not load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await clientService.getPaymentHistory(invoiceId);
      if (res.success) {
        setPaymentHistory(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!invoiceId) return;
    fetchInvoice();
    fetchHistory();
  }, [invoiceId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const copyUpi = () => {
    if (!data?.paymentInfo?.upiId) return;
    navigator.clipboard.writeText(data.paymentInfo.upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('UPI ID copied!');
  };

  const handleProofSuccess = () => {
    setShowProofForm(false);
    fetchInvoice();
    fetchHistory();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Approved': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Rejected': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-bg-card border border-border-default rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <div>
            <h3 className="text-white font-semibold text-lg">Invoice Details</h3>
            {data?.data?.invoiceId && (
              <p className="text-[#9CA3AF] text-xs mt-0.5">{data.data.invoiceId}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-surface/60 text-[#9CA3AF] hover:text-white hover:bg-bg-surface transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* Status + Dates */}
              <div className="flex flex-wrap gap-3 items-center">
                <StatusBadge status={data.data.paymentStatus} />
                <span className="text-[#6B7280] text-xs">
                  Issued: {new Date(data.data.issueDate).toLocaleDateString('en-IN')}
                </span>
                <span className="text-[#6B7280] text-xs">
                  Due: {new Date(data.data.dueDate).toLocaleDateString('en-IN')}
                </span>
              </div>

              {/* Line Items */}
              <div className="rounded-xl border border-border-default overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-surface/40">
                      <th className="text-left px-4 py-2.5 text-[#9CA3AF] font-medium text-xs">Description</th>
                      <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-xs">Qty</th>
                      <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-xs">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.data.lineItems || []).map((item, i) => (
                      <tr key={i} className="border-t border-border-default/40">
                        <td className="px-4 py-3 text-white text-xs">{item.description}</td>
                        <td className="px-4 py-3 text-[#9CA3AF] text-xs text-right">{item.qty}</td>
                        <td className="px-4 py-3 text-[#E5E2E1] text-xs text-right">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {data.data.taxPercent > 0 && (
                      <tr className="border-t border-border-default">
                        <td colSpan={2} className="px-4 py-2 text-[#9CA3AF] text-xs text-right">
                          Tax ({data.data.taxPercent}%)
                        </td>
                        <td className="px-4 py-2 text-[#9CA3AF] text-xs text-right">{fmt(data.data.taxAmount)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-border-default bg-bg-surface/20">
                      <td colSpan={2} className="px-4 py-3 text-white font-semibold text-sm text-right">Total Amount</td>
                      <td className="px-4 py-3 text-white font-bold text-sm text-right">
                        {fmt(data.data.totalAmount)}
                      </td>
                    </tr>
                    {data.data.paidAmount > 0 && (
                      <tr className="border-t border-border-default bg-[#22C55E]/5">
                        <td colSpan={2} className="px-4 py-3 text-[#22C55E] font-semibold text-sm text-right">Paid Amount</td>
                        <td className="px-4 py-3 text-[#22C55E] font-bold text-sm text-right">
                          {fmt(data.data.paidAmount)}
                        </td>
                      </tr>
                    )}
                    {data.data.paymentStatus !== 'Paid' && (
                      <tr className="border-t border-border-default bg-primary/5">
                        <td colSpan={2} className="px-4 py-3 text-primary font-bold text-sm text-right">Remaining Due</td>
                        <td className="px-4 py-3 text-primary font-bold text-sm text-right">
                          {fmt(Math.max(0, data.data.totalAmount - (data.data.paidAmount || 0)))}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Payment Proof History */}
              {!loadingHistory && paymentHistory.length > 0 && (
                <div className="rounded-xl border border-border-default overflow-hidden">
                  <div className="px-4 py-3 bg-bg-surface/40 border-b border-border-default">
                    <h4 className="text-white text-sm font-semibold flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      Payment History
                    </h4>
                  </div>
                  <div className="divide-y divide-border-default/40">
                    {paymentHistory.map(ph => (
                      <div key={ph._id} className="p-4 bg-bg-surface/20 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold">{fmt(ph.amountPaid)}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${getStatusColor(ph.status)}`}>
                              {ph.status}
                            </span>
                          </div>
                          <p className="text-[#9CA3AF] text-xs font-mono mb-1">UTR: {ph.utrNumber}</p>
                          <p className="text-[#6B7280] text-[10px] flex items-center gap-1">
                            Paid: {new Date(ph.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {ph.verifiedAt && ph.status !== 'Pending' && ` • Verified: ${new Date(ph.verifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                          </p>
                          {ph.status === 'Rejected' && ph.rejectionReason && (
                            <p className="text-red-400 text-xs mt-2 bg-red-500/10 p-2 rounded border border-red-500/20">
                              Reason: {ph.rejectionReason}
                            </p>
                          )}
                        </div>
                        {ph.screenshotUrl && (
                          <a href={ph.screenshotUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-12 h-12 rounded bg-black/20 border border-border-default overflow-hidden hover:opacity-80 transition-opacity">
                            <img src={ph.screenshotUrl} alt="Proof" className="w-full h-full object-cover" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment section — only for unpaid/overdue */}
              {['Unpaid', 'Overdue'].includes(data.data.paymentStatus) && (
                showProofForm ? (
                  <SubmitPaymentProofForm 
                    invoice={data.data} 
                    onSuccess={handleProofSuccess}
                    onCancel={() => setShowProofForm(false)}
                  />
                ) : (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <CreditCard size={16} />
                        <span className="font-semibold text-sm">Pay Now</span>
                      </div>
                    </div>

                    {/* UPI QR Code */}
                    {data.paymentInfo?.upiQrCodeUrl && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-1">
                          <QrCode size={14} />
                          Scan with any UPI app
                        </div>
                        <img
                          src={data.paymentInfo.upiQrCodeUrl}
                          alt="UPI QR Code"
                          className="w-44 h-44 object-contain rounded-xl border border-border-default bg-white p-2"
                        />
                        {data.paymentInfo.upiId && (
                          <div className="flex items-center gap-2 bg-bg-surface border border-border-default rounded-lg px-3 py-2 w-full">
                            <span className="flex-1 text-white text-sm font-mono truncate text-center">
                              {data.paymentInfo.upiId}
                            </span>
                            <button
                              onClick={copyUpi}
                              className="text-[#9CA3AF] hover:text-primary transition-colors cursor-pointer p-1"
                              title="Copy UPI ID"
                            >
                              {copied ? <CheckCheck size={16} className="text-[#22C55E]" /> : <Copy size={16} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bank Transfer */}
                    {data.paymentInfo?.bankDetails && (
                      <div className="space-y-1.5 text-sm pt-2">
                        <p className="text-[#9CA3AF] text-xs font-medium uppercase tracking-wider mb-2">Or Pay via Bank Transfer</p>
                        {Object.entries(data.paymentInfo.bankDetails).map(([k, v]) =>
                          v ? (
                            <div key={k} className="flex justify-between items-center bg-bg-surface/30 px-3 py-2 rounded">
                              <span className="text-[#9CA3AF] text-xs capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                              <span className="text-white text-xs font-mono">{v}</span>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}

                    {/* Payment Proof Button */}
                    <div className="pt-4 border-t border-primary/20">
                      <p className="text-[#9CA3AF] text-xs mb-3 text-center">
                        Already paid? Submit your payment proof for verification.
                      </p>
                      <button
                        onClick={() => setShowProofForm(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-[#FF6B00] text-white transition-colors text-sm font-bold"
                      >
                        <UploadCloud size={16} />
                        Submit Payment Proof
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Already paid */}
              {data.data.paymentStatus === 'Paid' && (
                <div className="rounded-xl bg-[#22C55E]/[0.06] border border-[#22C55E]/20 px-4 py-3 flex items-center gap-2">
                  <CheckCheck className="text-[#22C55E]" size={20} />
                  <div>
                    <p className="text-[#22C55E] text-sm font-bold">Paid in Full</p>
                    {data.data.paidOn && (
                      <p className="text-[#22C55E]/80 text-xs mt-0.5">
                        Completed on {new Date(data.data.paidOn).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[#EF4444] text-sm text-center">Could not load invoice.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
