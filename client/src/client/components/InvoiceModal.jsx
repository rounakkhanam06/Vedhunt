import { useState, useEffect } from 'react';
import { X, Copy, CheckCheck, ExternalLink, CreditCard, QrCode } from 'lucide-react';
import clientService from '../../services/clientService';
import StatusBadge from './StatusBadge';
import toast from 'react-hot-toast';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const InvoiceModal = ({ invoiceId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    clientService
      .getInvoiceById(invoiceId)
      .then((res) => setData(res))
      .catch(() => toast.error('Could not load invoice details'))
      .finally(() => setLoading(false));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-bg-card border border-border-default rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
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

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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
                      <td colSpan={2} className="px-4 py-3 text-white font-semibold text-sm text-right">Total</td>
                      <td className="px-4 py-3 text-primary font-bold text-sm text-right">
                        {fmt(data.data.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment section — only for unpaid/overdue */}
              {['Unpaid', 'Overdue'].includes(data.data.paymentStatus) && (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <CreditCard size={16} />
                    <span className="font-semibold text-sm">Pay Now</span>
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
                          <span className="flex-1 text-white text-sm font-mono truncate">
                            {data.paymentInfo.upiId}
                          </span>
                          <button
                            onClick={copyUpi}
                            className="text-[#9CA3AF] hover:text-primary transition-colors cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copied ? <CheckCheck size={15} className="text-[#22C55E]" /> : <Copy size={15} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bank Transfer */}
                  {data.paymentInfo?.bankDetails && (
                    <div className="space-y-1.5 text-sm">
                      <p className="text-[#9CA3AF] text-xs font-medium uppercase tracking-wider">Bank Transfer</p>
                      {Object.entries(data.paymentInfo.bankDetails).map(([k, v]) =>
                        v ? (
                          <div key={k} className="flex justify-between">
                            <span className="text-[#6B7280] text-xs capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                            <span className="text-white text-xs font-mono">{v}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Paid confirmation nudge */}
                  <p className="text-[#9CA3AF] text-xs border-t border-border-default pt-3">
                    After payment, share your UTR/transaction ID with us at{' '}
                    <a href="mailto:billing@vedhunt.in" className="text-primary hover:underline">
                      billing@vedhunt.in
                    </a>
                  </p>
                </div>
              )}

              {/* Already paid */}
              {data.data.paymentStatus === 'Paid' && data.data.paidOn && (
                <div className="rounded-xl bg-[#22C55E]/[0.06] border border-[#22C55E]/20 px-4 py-3">
                  <p className="text-[#22C55E] text-sm font-medium">
                    ✓ Paid on {new Date(data.data.paidOn).toLocaleDateString('en-IN')}
                    {data.data.paymentMethod && ` via ${data.data.paymentMethod}`}
                  </p>
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
