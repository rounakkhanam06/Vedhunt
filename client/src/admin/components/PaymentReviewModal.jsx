import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ExternalLink, X, ImageOff, FileText, AlertTriangle } from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d, time = false) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—');
const STATUS_PILL = {
  Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  Approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  Rejected: 'bg-red-500/10 text-red-500 border-red-500/30',
};

function Row({ label, children, strong }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-app-text-muted">{label}</span>
      <span className={`text-sm text-right text-app-text ${strong ? 'font-bold' : 'font-medium'}`}>{children}</span>
    </div>
  );
}

/**
 * Review one client payment proof: what the invoice still owes, what the client says
 * they sent (checked against the amount due), and the screenshot — then approve, or
 * reject with a reason the client will see.
 */
export default function PaymentReviewModal({ payment, canEdit, busy, reason, setReason, onApprove, onReject, onClose }) {
  const [rejecting, setRejecting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const inv = payment.invoice_ref || {};
  const due = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
  const sent = Number(payment.amountPaid || 0);
  const diff = sent - due;
  let match = null;
  if (payment.status === 'Pending') {
    if (Math.abs(diff) < 1) match = { ok: true, text: 'Matches the amount due' };
    else if (diff < 0) match = { ok: false, text: `${inr(-diff)} less than due — a part payment` };
    else match = { ok: false, text: `${inr(diff)} more than due — check before approving` };
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="bg-app-card text-app-text border border-app-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-app-border">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="review-title" className="text-lg font-bold">Review Payment</h3>
              <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_PILL[payment.status] || ''}`}>{payment.status}</span>
            </div>
            <p className="text-sm text-app-text-muted mt-0.5">
              {payment.client_ref?.businessName || 'Client'} · Invoice <span className="font-medium text-app-text">{inv.invoiceId || '—'}</span> · submitted {day(payment.createdAt, true)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-full text-app-text-muted hover:text-app-text hover:bg-app-border/40 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-xl border border-app-border bg-app-bg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Amount sent</p>
              <p className="text-3xl font-extrabold text-emerald-500 mt-1">{inr(sent)}</p>
              {match && (
                <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${match.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {match.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {match.text}
                </p>
              )}
            </div>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Payment details</h4>
              <div className="divide-y divide-app-border">
                <Row label="UTR / Transaction ID"><span className="font-mono select-all">{payment.utrNumber}</span></Row>
                <Row label="Date paid">{day(payment.paymentDate)}</Row>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Invoice</h4>
              <div className="divide-y divide-app-border">
                <Row label="Invoice total">{inr(inv.totalAmount)}</Row>
                <Row label="Paid so far"><span className="text-emerald-500">{inr(inv.paidAmount)}</span></Row>
                <Row label="Remaining due" strong><span className="text-orange-500">{inr(due)}</span></Row>
              </div>
            </section>

            {payment.status === 'Rejected' && payment.rejectionReason && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs font-semibold text-red-500 mb-1">Rejection reason</p>
                <p className="text-sm text-app-text">{payment.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Screenshot */}
          <section className="lg:col-span-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Payment proof</h4>
              {payment.screenshotUrl && (
                <a href={payment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <ExternalLink size={13} /> Open full size
                </a>
              )}
            </div>
            <div className="rounded-xl border border-app-border bg-app-bg h-[320px] sm:h-[420px] flex items-center justify-center overflow-hidden">
              {payment.screenshotUrl && !imgFailed ? (
                <a href={payment.screenshotUrl} target="_blank" rel="noopener noreferrer" title="Open full size" className="w-full h-full flex items-center justify-center cursor-zoom-in">
                  <img src={payment.screenshotUrl} alt="Payment screenshot" onError={() => setImgFailed(true)} className="max-w-full max-h-full object-contain" />
                </a>
              ) : (
                <div className="text-center text-app-text-muted p-6">
                  {payment.screenshotUrl ? <ImageOff className="w-10 h-10 mx-auto opacity-40" /> : <FileText className="w-10 h-10 mx-auto opacity-40" />}
                  <p className="text-sm mt-2">{payment.screenshotUrl ? 'The screenshot could not be shown here.' : 'No screenshot attached.'}</p>
                  {payment.screenshotUrl && (
                    <a href={payment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Open it in a new tab</a>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border">
          {payment.status === 'Pending' && canEdit ? (
            rejecting ? (
              <div className="space-y-3">
                <label htmlFor="reject-reason" className="block text-sm font-semibold">
                  Why is this payment being rejected? <span className="text-app-text-muted font-normal">(the client will see this)</span>
                </label>
                <textarea
                  id="reject-reason"
                  autoFocus
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. UTR not found in our bank statement"
                  className="w-full px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-red-500 resize-none"
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setRejecting(false); setReason(''); }} className="px-4 py-2 rounded-xl border border-app-border text-sm font-medium hover:bg-app-border/30 cursor-pointer">Back</button>
                  <button type="button" onClick={onReject} disabled={busy || !reason.trim()} className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    <XCircle size={16} /> {busy ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-app-text-muted">Approving records {inr(sent)} against invoice {inv.invoiceId || ''} and notifies the client.</p>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="px-5 py-2.5 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    <XCircle size={16} /> Reject
                  </button>
                  <button type="button" onClick={onApprove} disabled={busy} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    <CheckCircle size={16} /> {busy ? 'Approving…' : 'Approve payment'}
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="text-center text-sm text-app-text-muted">
              {payment.status === 'Pending'
                ? 'This payment is awaiting verification.'
                : <>This payment was <strong className={payment.status === 'Approved' ? 'text-emerald-500' : 'text-red-500'}>{payment.status.toLowerCase()}</strong> on {day(payment.verifiedAt, true)}.</>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
