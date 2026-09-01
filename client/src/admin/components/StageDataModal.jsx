import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import { LOST_DROPPED_REASONS } from '../../shared/leadConstants';

/**
 * Collects the mandatory data a stage transition requires before it's sent
 * as one combined update — server/utils/leadStateMachine.js rejects, say, a
 * bare `status: 'Won'` with no dealValue, so every field this stage needs
 * has to travel in the same request. Used wherever a lead's status can be
 * changed to Proposal Sent / Won / Lost / Dropped / Hold: the admin table's
 * status dropdown, the lead detail drawer, and the Kanban board's drag-drop.
 */
export default function StageDataModal({ lead, targetStatus, onClose, onSubmit }) {
  const [proposalValue, setProposalValue] = useState(lead?.proposalValue || '');
  const [proposalSentDate, setProposalSentDate] = useState(
    lead?.proposalSentDate ? new Date(lead.proposalSentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    lead?.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : ''
  );
  const [dealValue, setDealValue] = useState(lead?.dealValue || '');
  const [notConvertedReason, setNotConvertedReason] = useState(lead?.notConvertedReason || '');
  const [holdReason, setHoldReason] = useState(lead?.holdReason || '');
  const [holdUntil, setHoldUntil] = useState(lead?.holdUntil ? new Date(lead.holdUntil).toISOString().slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);

  if (!lead || !targetStatus) return null;

  const titles = {
    'Proposal Sent': 'Send Proposal',
    Won: 'Mark as Won',
    Lost: 'Mark as Lost',
    Dropped: 'Mark as Dropped',
    Hold: 'Put Lead on Hold'
  };

  const handleSubmit = async () => {
    let fields = { status: targetStatus };
    if (targetStatus === 'Proposal Sent') {
      if (!(Number(proposalValue) > 0)) return;
      if (!proposalSentDate) return;
      if (!nextFollowUpDate) return;
      fields = { ...fields, proposalValue: Number(proposalValue), proposalSentDate: new Date(proposalSentDate).toISOString(), nextFollowUpDate: new Date(nextFollowUpDate).toISOString() };
    } else if (targetStatus === 'Won') {
      if (!(Number(dealValue) > 0)) return;
      fields = { ...fields, dealValue: Number(dealValue) };
    } else if (targetStatus === 'Lost' || targetStatus === 'Dropped') {
      if (!notConvertedReason) return;
      fields = { ...fields, notConvertedReason };
    } else if (targetStatus === 'Hold') {
      if (!holdReason.trim()) return;
      fields = { ...fields, holdReason: holdReason.trim(), holdUntil: holdUntil ? new Date(holdUntil).toISOString() : undefined };
    }

    setSubmitting(true);
    try {
      await onSubmit(fields);
    } catch {
      // The caller's handleFieldsChange already toasted the server's
      // rejection message — swallow here so the form just stays open with
      // the values intact for the admin to fix and retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-app-border flex justify-between items-center bg-app-card">
          <h2 className="text-lg font-bold text-app-text">{titles[targetStatus] || targetStatus}</h2>
          <button onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-app-text-muted">
            Moving <strong className="text-app-text">{lead.fullName}</strong> to <strong className="text-app-text">{targetStatus}</strong>.
          </p>

          <AnimatePresence mode="wait">
            {targetStatus === 'Proposal Sent' && (
              <motion.div key="proposal-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Proposal Value (₹) *</label>
                  <input type="number" min="0" value={proposalValue} onChange={(e) => setProposalValue(e.target.value)}
                    className="w-full mt-1 bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Proposal Sent Date *</label>
                  <input type="date" value={proposalSentDate} onChange={(e) => setProposalSentDate(e.target.value)}
                    className="w-full mt-1 bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Next Follow-Up *</label>
                  <input type="datetime-local" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full mt-1 bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" style={{ colorScheme: 'dark' }} />
                </div>
              </motion.div>
            )}

            {targetStatus === 'Won' && (
              <motion.div key="won-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Final Deal Value (₹) *</label>
                <input type="number" min="0" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="e.g. 50000"
                  className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" />
                <p className="text-[10px] text-emerald-500/80">Closing this will also create the client's portal account automatically. 🚀</p>
              </motion.div>
            )}

            {(targetStatus === 'Lost' || targetStatus === 'Dropped') && (
              <motion.div key="lost-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Reason *</label>
                <select value={notConvertedReason} onChange={(e) => setNotConvertedReason(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary cursor-pointer">
                  <option value="">-Select Reason-</option>
                  {LOST_DROPPED_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </motion.div>
            )}

            {targetStatus === 'Hold' && (
              <motion.div key="hold-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Hold Reason *</label>
                  <input type="text" value={holdReason} onChange={(e) => setHoldReason(e.target.value)}
                    className="w-full mt-1 bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Resume By (optional)</label>
                  <input type="date" value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)}
                    className="w-full mt-1 bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary" style={{ colorScheme: 'dark' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-bg/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-app-text hover:bg-surface-variant rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {targetStatus === 'Won' ? <CheckCircle2 size={16} /> : targetStatus === 'Lost' || targetStatus === 'Dropped' ? <XCircle size={16} /> : null}
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
